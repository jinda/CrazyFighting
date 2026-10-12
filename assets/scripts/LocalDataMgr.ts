import { clamp, sys } from "cc";
import CryptoTS from "crypto-ts";
import { ClientApi } from "./ClientApi";
import { Constants } from "./Constants";
import { DataMgr } from "./DataMgr";
import type { ILoginData } from "./apiInterface";
const { AES } = CryptoTS;

/**
 * 待上报的账本操作
 * 在线操作重试复用同一个 req_id；旧存档中的待补报队列只用于迁移清理。
 */
export interface IPendingLedgerOp {
    req_id: string; // 幂等键，服务端按 (game_code, uid, source, req_id, resource) 去重
    op: "gain" | "consume"; // 加币 / 扣币
    amount: number; // 实际发生数量（已取整）
    scene: string; // 审计场景，见 Constants.LEDGER_SCENE
}

interface IGameInfo {
    deviceID: string;
    hasLoggedIn?: boolean; // 是否已经登录过
    coin: number; //金币数量
    level: number; //默认初始关卡
    coinLv: number; // 金币等级
    fighterLv: number; // 战士等级
    landLv: number; // 土地等级
    unlock: Array<number>; //已解锁士兵
    onlineReward: number; //在线奖励的数值
    finishGuides: Array<number>; //完成的引导步骤
    formation: { [key: number]: number }; //阵型
    signDay: number;
    lastSignTime: number;
    signTotalDay: number;
    pendingLedgerOps?: IPendingLedgerOp[]; //旧版金币补报队列，新版加载时清除
    pendingLevels?: number[]; //待上报的通关关卡（服务端只增不减，重试安全），旧存档无此字段
}

interface ISetting {
    musicVolume: number;
    soundVolume: number;
    language: string;
    shakeSwith: number;
}

export enum InitialDataState {
    IDLE = "idle",
    LOADING_LOCAL = "loading_local",
    WAITING_CLOUD = "waiting_cloud",
    READY_LOCAL = "ready_local",
    READY_CLOUD = "ready_cloud",
    READY_DEFAULT = "ready_default",
}

export interface IInitialDataResult {
    state: InitialDataState;
    source: "local" | "cloud" | "default";
    reason?: string;
}

interface ICloudSaveState {
    latest: string | null;
    inFlight: boolean;
    retryCount: number;
    timer: ReturnType<typeof setTimeout> | null;
}

const AES_KEY = "eeffaif19822sf11156ff734fsefa9f0bb";

// 通关进度待上报队列上限。
const MAX_PENDING_LEVELS = 50;
const INITIAL_CLOUD_TIMEOUT_MS = 10000;
const CLOUD_SAVE_DEBOUNCE_MS = 500;
const CLOUD_SAVE_RETRY_BASE_MS = 1000;
const CLOUD_SAVE_MAX_BACKOFF_MS = 30000;
const CLOUD_SAVE_MAX_RETRIES = 5;

class LocalDataManager {
    private static _inst: LocalDataManager | null = null;
    public static get inst(): LocalDataManager {
        if (this._inst == null) {
            this._inst = new LocalDataManager();
        }
        return this._inst;
    }

    private SettingStr = "CrazyFightSettingConfig";
    private GameInfoStr = "CrazyFightGameInfoConfig";

    private _setting: ISetting = this.createDefaultSetting();
    private _gameInfo: IGameInfo = this.createDefaultGameInfo();
    private _initialDataState = InitialDataState.IDLE;
    private initialDataPromise: Promise<IInitialDataResult> | null = null;
    private cloudSaveStates = new Map<string, ICloudSaveState>();

    public get Setting(): ISetting {
        return this._setting;
    }

    public get GameInfo(): IGameInfo {
        return this._gameInfo;
    }

    public get initialDataState(): InitialDataState {
        return this._initialDataState;
    }

    /** 兼容旧调用：同步读取本地数据，不执行云恢复。 */
    public loadData(): void {
        this._initialDataState = InitialDataState.LOADING_LOCAL;
        const hasValidGameInfo = this.loadGameInfoData();
        this.loadSettingData();
        this._initialDataState = hasValidGameInfo ? InitialDataState.READY_LOCAL : InitialDataState.READY_DEFAULT;
    }

    /**
     * 启动数据准备。有效本地游戏存档立即完成；否则最多等待云存档 10 秒。
     * 登录仍会在本地命中时启动，供金币账本和待上报进度同步使用。
     */
    public prepareInitialData(startLogin: () => Promise<ILoginData | null>): Promise<IInitialDataResult> {
        if (!this.initialDataPromise) {
            this.initialDataPromise = this.prepareInitialDataInternal(startLogin);
        }
        return this.initialDataPromise;
    }

    private async prepareInitialDataInternal(
        startLogin: () => Promise<ILoginData | null>,
    ): Promise<IInitialDataResult> {
        this._initialDataState = InitialDataState.LOADING_LOCAL;
        const hasValidGameInfo = this.loadGameInfoData();
        this.loadSettingData();

        let loginPromise: Promise<ILoginData | null>;
        try {
            loginPromise = startLogin();
        } catch (error) {
            egf.Logger.error("[LocalDataMgr] failed to start login:", error);
            loginPromise = Promise.resolve(null);
        }

        if (hasValidGameInfo) {
            this._initialDataState = InitialDataState.READY_LOCAL;
            void loginPromise.catch((error: unknown) => {
                egf.Logger.error("[LocalDataMgr] background login failed:", error);
            });
            return { state: this._initialDataState, source: "local" };
        }

        this._initialDataState = InitialDataState.WAITING_CLOUD;
        return new Promise<IInitialDataResult>((resolve) => {
            let settled = false;
            let timer: ReturnType<typeof setTimeout>;
            const complete = (
                source: IInitialDataResult["source"],
                reason?: string,
                gameInfo?: IGameInfo,
                setting?: ISetting,
            ) => {
                if (settled) {
                    return;
                }
                settled = true;
                clearTimeout(timer);
                if (source === "cloud" && gameInfo) {
                    this.applyGameInfo(gameInfo, true);
                    if (setting) {
                        this.applySetting(setting);
                    }
                    this.writeGameInfoLocal();
                    this.writeSettingLocal();
                    this._initialDataState = InitialDataState.READY_CLOUD;
                } else {
                    this._initialDataState = InitialDataState.READY_DEFAULT;
                }
                resolve({ state: this._initialDataState, source, reason });
            };
            timer = setTimeout(() => complete("default", "cloud_timeout"), INITIAL_CLOUD_TIMEOUT_MS);

            void loginPromise
                .then(async (loginData) => {
                    if (!loginData) {
                        complete("default", "login_failed");
                        return;
                    }
                    const cloudData = await this.loadInitialCloudData();
                    if (!cloudData.gameInfo) {
                        complete("default", cloudData.reason ?? "cloud_invalid");
                        return;
                    }
                    complete("cloud", undefined, cloudData.gameInfo, cloudData.setting ?? undefined);
                })
                .catch((error: unknown) => {
                    egf.Logger.error("[LocalDataMgr] cloud recovery failed:", error);
                    complete("default", "cloud_failed");
                });
        });
    }

    private loadGameInfoData(): boolean {
        this.applyGameInfo(this.createDefaultGameInfo(), false);
        const encryptStr = sys.localStorage.getItem(this.GameInfoStr);
        if (!encryptStr) {
            return false;
        }
        const gameInfo = this.parseGameInfo(encryptStr, "local");
        if (!gameInfo) {
            return false;
        }
        this.applyGameInfo(gameInfo, false);
        return true;
    }

    private loadSettingData(): boolean {
        this.applySetting(this.createDefaultSetting());
        const encryptStr = sys.localStorage.getItem(this.SettingStr);
        if (!encryptStr) {
            return false;
        }
        const setting = this.parseSetting(encryptStr, "local");
        if (!setting) {
            return false;
        }
        this.applySetting(setting);
        return true;
    }

    public saveGameInfoData() {
        const encryptStr = this.writeGameInfoLocal();
        if (encryptStr) {
            this.queueCloudSave(this.GameInfoStr, encryptStr);
        }
    }

    public saveSettingData() {
        const encryptStr = this.writeSettingLocal();
        if (encryptStr) {
            this.queueCloudSave(this.SettingStr, encryptStr);
        }
    }

    public saveData() {
        this.saveGameInfoData();
        this.saveSettingData();
    }

    /** 立即尝试发送所有待上传快照；后台切换时允许重新启动已耗尽的重试轮次。 */
    public flushCloudSaves(restartRetries: boolean = false) {
        for (const [key, state] of this.cloudSaveStates) {
            if (state.latest === null || state.inFlight) {
                continue;
            }
            if (restartRetries) {
                state.retryCount = 0;
            }
            if (state.timer !== null) {
                clearTimeout(state.timer);
                state.timer = null;
            }
            this.sendCloudSave(key, state);
        }
    }

    private async loadInitialCloudData(): Promise<{
        gameInfo: IGameInfo | null;
        setting: ISetting | null;
        reason?: string;
    }> {
        const gameValuePromise = this.loadServerValue(this.GameInfoStr);
        const settingValuePromise = this.loadServerValue(this.SettingStr);
        const gameValue = await gameValuePromise;
        if (!gameValue) {
            return { gameInfo: null, setting: null, reason: "cloud_missing" };
        }
        const gameInfo = this.parseGameInfo(gameValue, "cloud");
        // 设置不是进入场景所需的关键存档。
        // 仅使用已完成的结果，不让它拖过总恢复时限。
        const settingValue = await Promise.race([settingValuePromise, Promise.resolve(null)]);
        const setting = settingValue ? this.parseSetting(settingValue, "cloud") : null;
        return { gameInfo, setting, reason: gameInfo ? undefined : "cloud_invalid" };
    }

    private loadServerValue(key: string): Promise<string | null> {
        return new Promise<string | null>((resolve) => {
            ClientApi.inst.getData(
                key,
                (data) => resolve(data?.value || null),
                (errcode) => {
                    egf.Logger.warn("[LocalDataMgr] cloud load failed:", key, errcode);
                    resolve(null);
                },
            );
        });
    }

    private queueCloudSave(key: string, value: string) {
        let state = this.cloudSaveStates.get(key);
        if (!state) {
            state = { latest: null, inFlight: false, retryCount: 0, timer: null };
            this.cloudSaveStates.set(key, state);
        }
        if (state.latest !== value) {
            state.retryCount = 0;
        }
        state.latest = value;
        if (state.inFlight) {
            return;
        }
        this.scheduleCloudSave(key, state, CLOUD_SAVE_DEBOUNCE_MS);
    }

    private scheduleCloudSave(key: string, state: ICloudSaveState, delay: number) {
        if (state.timer !== null) {
            clearTimeout(state.timer);
        }
        state.timer = setTimeout(() => {
            state.timer = null;
            this.sendCloudSave(key, state);
        }, delay);
    }

    private sendCloudSave(key: string, state: ICloudSaveState) {
        if (state.inFlight || state.latest === null || !ClientApi.inst.token) {
            return;
        }
        const snapshot = state.latest;
        state.inFlight = true;
        ClientApi.inst.saveData(
            key,
            snapshot,
            () => {
                state.inFlight = false;
                state.retryCount = 0;
                if (state.latest === snapshot) {
                    state.latest = null;
                    return;
                }
                this.scheduleCloudSave(key, state, CLOUD_SAVE_DEBOUNCE_MS);
            },
            (errcode) => {
                state.inFlight = false;
                state.retryCount++;
                egf.Logger.warn("[LocalDataMgr] cloud save failed:", key, errcode, state.retryCount);
                if (state.retryCount > CLOUD_SAVE_MAX_RETRIES) {
                    return;
                }
                const delay = Math.min(
                    CLOUD_SAVE_RETRY_BASE_MS * Math.pow(2, state.retryCount - 1),
                    CLOUD_SAVE_MAX_BACKOFF_MS,
                );
                this.scheduleCloudSave(key, state, delay);
            },
        );
    }

    private createDefaultGameInfo(): IGameInfo {
        return {
            deviceID: "",
            coin: 100,
            level: 0,
            coinLv: 1,
            fighterLv: 1,
            landLv: 1,
            unlock: [Constants.BASE_FIGHTER],
            onlineReward: 0,
            finishGuides: [],
            formation: { 1: 101, 2: 101, 3: 101 },
            signDay: 0,
            lastSignTime: 0,
            signTotalDay: 0,
            pendingLedgerOps: [],
            pendingLevels: [],
        };
    }

    private createDefaultSetting(): ISetting {
        return {
            musicVolume: 1,
            soundVolume: 1,
            language: "",
            shakeSwith: 1,
        };
    }

    private parseGameInfo(encryptStr: string, source: "local" | "cloud"): IGameInfo | null {
        const value = this.decryptValue(encryptStr, `${source} game info`);
        if (!this.isRecord(value)) {
            egf.Logger.error(`[LocalDataMgr] ${source} game info is not an object`);
            return null;
        }
        const defaults = this.createDefaultGameInfo();
        const coin = this.normalizeInteger(value.coin, defaults.coin, 0);
        const level = this.normalizeInteger(value.level, defaults.level, 0);
        const coinLv = this.normalizeInteger(value.coinLv, defaults.coinLv, 1);
        const fighterLv = this.normalizeInteger(value.fighterLv, defaults.fighterLv, 1);
        const landLv = this.normalizeInteger(value.landLv, defaults.landLv, 1);
        const onlineReward =
            this.normalizeInteger(value.onlineReward, defaults.onlineReward, 0) ?? defaults.onlineReward;
        const signDay = this.normalizeInteger(value.signDay, defaults.signDay, 0) ?? defaults.signDay;
        const lastSignTime =
            this.normalizeInteger(value.lastSignTime, defaults.lastSignTime, 0) ?? defaults.lastSignTime;
        const signTotalDay =
            this.normalizeInteger(value.signTotalDay, defaults.signTotalDay, 0) ?? defaults.signTotalDay;
        const unlock = this.normalizeIntegerArray(value.unlock, defaults.unlock, 1, false);
        const finishGuides =
            this.normalizeIntegerArray(value.finishGuides, defaults.finishGuides, 0, true) ?? defaults.finishGuides;
        const pendingLevels = this.normalizeIntegerArray(value.pendingLevels, [], 1, true) ?? [];
        const formation = this.normalizeFormation(value.formation, defaults.formation);
        const deviceID = typeof value.deviceID === "string" ? value.deviceID : defaults.deviceID;
        const hasLoggedIn = typeof value.hasLoggedIn === "boolean" ? value.hasLoggedIn : undefined;
        if (
            coin === null ||
            level === null ||
            coinLv === null ||
            fighterLv === null ||
            landLv === null ||
            unlock === null ||
            formation === null
        ) {
            egf.Logger.error(`[LocalDataMgr] ${source} game info contains invalid fields`);
            return null;
        }

        return {
            deviceID,
            hasLoggedIn,
            coin,
            level,
            coinLv,
            fighterLv,
            landLv,
            unlock,
            onlineReward,
            finishGuides,
            formation,
            signDay,
            lastSignTime,
            signTotalDay,
            pendingLedgerOps: [],
            pendingLevels: Array.from(new Set(pendingLevels)).slice(-MAX_PENDING_LEVELS),
        };
    }

    private parseSetting(encryptStr: string, source: "local" | "cloud"): ISetting | null {
        const value = this.decryptValue(encryptStr, `${source} settings`);
        if (!this.isRecord(value)) {
            egf.Logger.error(`[LocalDataMgr] ${source} settings are not an object`);
            return null;
        }
        const defaults = this.createDefaultSetting();
        const musicVolume = this.normalizeVolume(value.musicVolume, defaults.musicVolume);
        const soundVolume = this.normalizeVolume(value.soundVolume, defaults.soundVolume);
        const language = value.language === undefined ? defaults.language : value.language;
        const shakeSwith = this.normalizeInteger(value.shakeSwith, defaults.shakeSwith, 0, 1);
        if (musicVolume === null || soundVolume === null || typeof language !== "string" || shakeSwith === null) {
            egf.Logger.error(`[LocalDataMgr] ${source} settings contain invalid fields`);
            return null;
        }
        return { musicVolume, soundVolume, language, shakeSwith };
    }

    private decryptValue(encryptStr: string, label: string): unknown | null {
        try {
            const decryptStr = AES.decrypt(encryptStr, AES_KEY).toString(CryptoTS.enc.Utf8);
            if (!decryptStr) {
                throw new Error("empty decrypted value");
            }
            return JSON.parse(decryptStr) as unknown;
        } catch (error) {
            egf.Logger.error(`[LocalDataMgr] failed to decrypt or parse ${label}:`, error);
            return null;
        }
    }

    private isRecord(value: unknown): value is { [key: string]: unknown } {
        return value !== null && typeof value === "object" && !Array.isArray(value);
    }

    private normalizeInteger(
        value: unknown,
        fallback: number,
        minimum: number,
        maximum: number = Number.MAX_SAFE_INTEGER,
    ): number | null {
        if (value === undefined) {
            return fallback;
        }
        if (typeof value !== "number" || !Number.isSafeInteger(value) || value < minimum || value > maximum) {
            return null;
        }
        return value;
    }

    private normalizeVolume(value: unknown, fallback: number): number | null {
        if (value === undefined) {
            return fallback;
        }
        if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) {
            return null;
        }
        return value;
    }

    private normalizeIntegerArray(
        value: unknown,
        fallback: number[],
        minimum: number,
        allowEmpty: boolean,
    ): number[] | null {
        if (value === undefined) {
            return [...fallback];
        }
        if (!Array.isArray(value) || (!allowEmpty && value.length === 0)) {
            return null;
        }
        const result: number[] = [];
        for (const item of value) {
            if (typeof item !== "number" || !Number.isSafeInteger(item) || item < minimum) {
                return null;
            }
            result.push(item);
        }
        return result;
    }

    private normalizeFormation(value: unknown, fallback: { [key: number]: number }): { [key: number]: number } | null {
        if (value === undefined) {
            return { ...fallback };
        }
        if (!this.isRecord(value) || Object.keys(value).length === 0) {
            return null;
        }
        const formation: { [key: number]: number } = {};
        for (const key of Object.keys(value)) {
            const fighter = value[key];
            const position = Number(key);
            if (
                !Number.isSafeInteger(position) ||
                position <= 0 ||
                typeof fighter !== "number" ||
                !Number.isSafeInteger(fighter) ||
                fighter < 0
            ) {
                return null;
            }
            formation[position] = fighter;
        }
        return formation;
    }

    private applyGameInfo(gameInfo: IGameInfo, preserveCoin: boolean) {
        const applied: IGameInfo = {
            ...gameInfo,
            coin: preserveCoin ? DataMgr.coin : gameInfo.coin,
            unlock: [...gameInfo.unlock],
            finishGuides: [...gameInfo.finishGuides],
            formation: { ...gameInfo.formation },
            pendingLedgerOps: [],
            pendingLevels: [...(gameInfo.pendingLevels ?? [])],
        };
        this._gameInfo = applied;
        DataMgr.coin = applied.coin;
        DataMgr.level = applied.level;
    }

    private applySetting(setting: ISetting) {
        this._setting = { ...setting };
        egf.AudioMgr.musicVolume = setting.musicVolume;
        egf.AudioMgr.soundVolume = setting.soundVolume;
    }

    private writeGameInfoLocal(): string | null {
        return this.writeLocalValue(this.GameInfoStr, this._gameInfo, "game info");
    }

    private writeSettingLocal(): string | null {
        return this.writeLocalValue(this.SettingStr, this._setting, "settings");
    }

    private writeLocalValue(key: string, value: unknown, label: string): string | null {
        try {
            const encryptStr = AES.encrypt(JSON.stringify(value), AES_KEY).toString();
            sys.localStorage.setItem(key, encryptStr);
            return encryptStr;
        } catch (error) {
            egf.Logger.error(`[LocalDataMgr] failed to save local ${label}:`, error);
            return null;
        }
    }

    /**
     * 格子上的士兵数据互换
     * @param cellA
     * @param cellB
     */
    public swapCell(cellA: number, cellB: number) {
        let tmp = this.GameInfo.formation[cellA];
        this.GameInfo.formation[cellA] = this.GameInfo.formation[cellB];
        this.GameInfo.formation[cellB] = tmp;

        this.saveGameInfoData();
    }

    /**
     * 合并格子
     * @param cellOld
     * @param cellTarge
     * @param nextId
     */
    public combineCell(cellOld: number, cellTarget: number, nextId: number) {
        this.GameInfo.formation[cellOld] = 0;
        this.GameInfo.formation[cellTarget] = nextId;

        this.saveGameInfoData();
    }

    /**
     * 生成新的格子数据并添加到队列里面去
     * @returns
     */
    public addCell() {
        const len = Object.keys(this.GameInfo.formation).length;
        //从数组里面取对应的位置
        let nextPos = Constants.UNLOCK_CELL_SEQ[len];
        //如果超过24个，则位置的值网上累加
        if (len >= Constants.UNLOCK_CELL_SEQ.length) {
            nextPos = len;
        }

        //刚生成的格子上默认没有士兵
        this.GameInfo.formation[nextPos] = 0;
        this.saveGameInfoData();
        return nextPos;
    }

    /**
     * 获得已经解锁的士兵
     */
    public getUnlockFighters(): number[] {
        if (this._gameInfo.unlock) {
            return this._gameInfo.unlock;
        }

        return [Constants.BASE_FIGHTER];
    }
    /**
     * 获得阵型上空闲格子的位置
     */
    public getEmptyPos(): number {
        for (let pos in this._gameInfo.formation) {
            if (this._gameInfo.formation[pos] === 0) {
                return Number(pos);
            }
        }

        return -1;
    }

    /**
     * 添加士兵到阵型里面
     * @param pos 在第几个格子
     * @param fighterId 士兵编号/种类
     * @returns
     */
    public addFighter(pos: number, fighterId: number) {
        if (this._gameInfo.formation[pos] !== 0) {
            return false;
        }

        this._gameInfo.formation[pos] = Number(fighterId); //强制转换成阵型，避免因为异常数据转成字符串了

        this.saveGameInfoData();

        return true;
    }

    /**
     * 获得购买士兵的价格
     */
    public getBuyFighterPrice() {
        let fighterLv = this._gameInfo.fighterLv;
        let factor = 1.07;
        let sep = 13;

        if (fighterLv < sep) {
            return 30 + 10 * fighterLv;
        } else {
            return 30 + 10 * sep + Math.round(30 * Math.pow(factor, fighterLv - sep));
        }
    }

    /**
     * 获得购买格子的价格
     */
    public getBuyCellPrice() {
        return Math.floor(100 * Math.pow(1.2, this._gameInfo.landLv));
    }

    /**
     * 获得购买金币加成价格
     */
    public getBuyCoinPrice() {
        return Math.floor(100 * Math.pow(1.2, this._gameInfo.coinLv));
    }

    public upgradeCoin() {
        this._gameInfo.coinLv++;
        this.saveGameInfoData();
    }

    public upgradeFighter() {
        this._gameInfo.fighterLv++;
        this.saveGameInfoData();
    }

    public upgradeLand() {
        this._gameInfo.landLv++;
        this.saveGameInfoData();
    }

    /** 清理旧版金币补报队列；新版离线金币变化不会上传。 */
    public clearPendingLedgerOps() {
        if (this._gameInfo.pendingLedgerOps?.length) {
            this._gameInfo.pendingLedgerOps = [];
            this.saveGameInfoData();
        }
    }

    /**
     * 待上报的通关关卡
     */
    public get pendingLevels(): number[] {
        return this._gameInfo.pendingLevels ?? [];
    }

    /**
     * 记录一关待上报的通关进度
     * 服务端按只增不减处理，重试（含较低/重复的关卡）不会降低历史进度
     * @param bSave 是否立即落盘；若调用方紧接着还会 saveGameInfoData，可传 false 避免重复写
     */
    public addPendingLevel(level: number, bSave: boolean = true) {
        if (!this._gameInfo.pendingLevels) {
            this._gameInfo.pendingLevels = [];
        }
        const list = this._gameInfo.pendingLevels;
        if (list.indexOf(level) === -1) {
            list.push(level);
            while (list.length > MAX_PENDING_LEVELS) {
                list.shift();
            }
        }
        if (bSave) {
            this.saveGameInfoData();
        }
    }

    /**
     * 服务端返回持久化后的历史最高关后，清理已确认（≤ level）的待上报进度
     */
    public removePendingLevelsUpTo(level: number) {
        const list = this._gameInfo.pendingLevels;
        if (!list || list.length === 0) {
            return;
        }
        const rest = list.filter((item) => item > level);
        if (rest.length === list.length) {
            return;
        }
        this._gameInfo.pendingLevels = rest;
        this.saveGameInfoData();
    }

    // ---------- Sign 签到便捷访问 ----------
    /**
     * 将时间戳归一化到当日 0 点（用于跨天判断）
     */
    private getTodayZero(): number {
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        return now.getTime();
    }

    /**
     * 今天是否已签到
     */
    public isSignToday(): boolean {
        return this._gameInfo.lastSignTime >= this.getTodayZero();
    }

    /**
     * 获取当前应领取的奖励天数（1~N，跨天不重置，用于展示第几天）
     */
    public getSignProgress(): number {
        return (this._gameInfo.signDay % 7) + 1;
    }

    /**
     * 执行签到
     * @returns 返回本次签到领取的奖励档位（第几天）
     */
    public doSign(): number {
        if (this.isSignToday()) {
            egf.Logger.warn("今天已签到，不能重复签到！");
            return 0;
        }

        const today = this.getTodayZero();
        const lastSignTime = this._gameInfo.lastSignTime;

        // 判断是否连续签到（昨天签到过）
        const yesterday = today - 24 * 60 * 60 * 1000;
        if (lastSignTime >= yesterday) {
            this._gameInfo.signTotalDay += 1;
        } else {
            // 跨天/断签，连续签到重置
            this._gameInfo.signTotalDay = 1;
        }

        this._gameInfo.signDay += 1;
        this._gameInfo.lastSignTime = Date.now();
        this.saveGameInfoData();

        const day = this.getSignProgress();
        egf.Logger.log("doSign success:", day, this._gameInfo);
        return day;
    }

    public getCoinRate() {
        const lv = clamp(this._gameInfo.coinLv, 1, Constants.goldRate.maxLv);
        return (lv - 1) * Constants.goldRate.step;
    }
}

export const LocalDataMgr = LocalDataManager.inst;
