import { clamp, sys } from "cc";
import CryptoTS from "crypto-ts";
import { ClientApi } from "./ClientApi";
import { Constants } from "./Constants";
import { DataMgr } from "./DataMgr";
import { EResourceType } from "./apiInterface";
const { AES } = CryptoTS;

interface IGameInfo {
    deviceID: string;
    saveTime: number; // 最近一次存档时间
    coin: number; // 金币数量
    level: number; // 关卡
    coinLv: number; // 金币等级
    fighterLv: number; // 战士等级
    landLv: number; // 土地等级
    unlock: Array<number>; // 已解锁士兵
    formation: { [key: number]: number }; //阵型
    signDay: number;
    lastSignTime: number;
    signTotalDay: number;
    guideStep: number; // 引导步骤
    bShare: boolean;
    stamina: number;
    lastStaminaTime: number;
}

interface ISetting {
    musicVolume: number;
    soundVolume: number;
    language: string;
    shakeSwith: number;
}

const AES_KEY = "eeffaif19822sf11156ff734fsefa9f0bb";

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

    public get Setting(): ISetting {
        return this._setting;
    }

    public get GameInfo(): IGameInfo {
        return this._gameInfo;
    }

    /** 读取本地数据 */
    public loadData(): void {
        this.loadSettingData();
        this.loadGameInfoData();
    }

    private loadGameInfoData(): void {
        const value = this.readLocalValue(this.GameInfoStr);
        this._gameInfo = this.normalizeGameInfo(value) ?? this.createDefaultGameInfo();
        this.setUseRes();
    }

    private loadSettingData(): void {
        const defaults = this.createDefaultSetting();
        this._setting = this.mergeSave(this.readLocalValue(this.SettingStr), defaults, "settings") ?? defaults;
    }

    public resetLocalGameInfo() {
        this._gameInfo.saveTime = 0;
        const encryptStr = this.writeLocalValue(this.GameInfoStr, this._gameInfo, "local");
        if (encryptStr) {
            this.saveCloud(this.GameInfoStr, encryptStr);
        }
    }

    public saveGameInfoData() {
        // 每次落盘都刷新存档时间
        this._gameInfo.saveTime = Date.now();
        this._gameInfo.coin = DataMgr.coin;
        this._gameInfo.level = DataMgr.completedLevel;
        this._gameInfo.stamina = DataMgr.stamina;
        const encryptStr = this.writeLocalValue(this.GameInfoStr, this._gameInfo, "local");
        if (encryptStr) {
            this.saveCloud(this.GameInfoStr, encryptStr);
        }
    }

    public saveSettingData() {
        const encryptStr = this.writeLocalValue(this.SettingStr, this._setting, "local");
        if (encryptStr) {
            this.saveCloud(this.SettingStr, encryptStr);
        }
    }

    public saveData() {
        DataMgr.bSyncCloudData = true;
        this.saveSettingData();
    }

    public saveCloud(key: string, data: any) {
        ClientApi.inst.saveData(
            key,
            data,
            () => {
                egf.Logger.log("saveCloud success:", key);
            },
            (errcode, errmsg) => {
                egf.Logger.log("saveCloud error:", key, errmsg);
            },
        );
    }

    public loadCloud(finish: () => void) {
        if (!ClientApi.inst.token) {
            egf.Logger.warn("请先登陆获取用户信息！");
            finish();
            return;
        }
        ClientApi.inst.getData(
            this.SettingStr,
            (data) => {
                if (data?.value) {
                    const setting = this.mergeSave(
                        this.decryptValue(data.value, "cloud settings"),
                        this.createDefaultSetting(),
                        "cloud settings",
                    );
                    if (setting) {
                        this._setting = setting;
                        this.saveSettingData();
                    }
                } else {
                    egf.Logger.log("loadCloud Setting is null");
                }
            },
            (errcode, errmsg) => {
                egf.Logger.log("loadCloud Setting error:", errmsg);
            },
        );
        ClientApi.inst.getData(
            this.GameInfoStr,
            (data) => {
                if (data?.value) {
                    const gameInfo = this.normalizeGameInfo(this.decryptValue(data.value, "cloud game info"));
                    if (gameInfo) {
                        this.setGameInfo(gameInfo);
                    }
                } else {
                    egf.Logger.log("loadCloud GameInfo is null");
                }
                finish();
            },
            (errcode, errmsg) => {
                egf.Logger.log("loadCloud GameInfo error:", errmsg);
                finish();
            },
        );
    }

    private setGameInfo(gameInfoData: IGameInfo) {
        egf.Logger.log("set game info:", gameInfoData.saveTime >= this._gameInfo.saveTime);
        if (gameInfoData.saveTime >= this._gameInfo.saveTime) {
            egf.Logger.log("use cloud save data");
            // 使用云存档
            this._gameInfo = gameInfoData;

            this.setUseRes();
            //再次存档一次
            DataMgr.bSyncCloudData = true;
        } else {
            egf.Logger.log("use local save data");
            this.setUseRes();
        }
        egf.Logger.log("use game info:", this.GameInfo);
    }
    private setUseRes() {
        DataMgr.coin = this._gameInfo.coin || 0;
        DataMgr.level = this._gameInfo.level || 0;
        DataMgr.stamina = this._gameInfo.stamina;
    }

    private createDefaultGameInfo(): IGameInfo {
        return {
            deviceID: "",
            saveTime: 0,
            coin: 0,
            level: 0,
            coinLv: 1,
            fighterLv: 1,
            landLv: 1,
            unlock: [Constants.BASE_FIGHTER],
            formation: { 1: 101, 2: 101, 3: 101 },
            signDay: 0,
            lastSignTime: 0,
            signTotalDay: 0,
            guideStep: 0,
            bShare: false,
            stamina: Constants.MAX_STAMINA,
            lastStaminaTime: 0,
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

    private readLocalValue(key: string): unknown {
        try {
            const value = sys.localStorage.getItem(key);
            return value ? this.decryptValue(value, key) : null;
        } catch (error) {
            egf.Logger.error("[LocalDataMgr] failed to read local save:", key, error);
            return null;
        }
    }

    private isRecord(value: unknown): value is Record<string, unknown> {
        return typeof value === "object" && value !== null && !Array.isArray(value);
    }

    private mergeSave<T extends object>(value: unknown, defaults: T, label: string): T | null {
        if (!this.isRecord(value)) {
            if (value !== null) {
                egf.Logger.warn("[LocalDataMgr] invalid save:", label);
            }
            return null;
        }

        const merged = { ...defaults };
        let hasKnownField = false;
        for (const [key, fallback] of Object.entries(defaults)) {
            const field = value[key];
            if (field === undefined) {
                continue;
            }
            if (
                typeof field !== typeof fallback ||
                field === null ||
                (typeof field === "number" && !Number.isFinite(field))
            ) {
                egf.Logger.warn("[LocalDataMgr] invalid save field:", label, key);
                return null;
            }
            Reflect.set(merged, key, field);
            hasKnownField = true;
        }
        if (!hasKnownField) {
            egf.Logger.warn("[LocalDataMgr] save has no known fields:", label);
            return null;
        }
        return merged;
    }

    private normalizeGameInfo(value: unknown): IGameInfo | null {
        const defaults = this.createDefaultGameInfo();
        if (!this.isRecord(value)) {
            return this.mergeSave(value, defaults, "game info");
        }

        const stamina = value.stamina;
        const validStamina = typeof stamina === "number" && Number.isSafeInteger(stamina) && stamina >= 0;
        const fields = { ...value };
        if (stamina !== undefined && !validStamina) {
            egf.Logger.warn("[LocalDataMgr] invalid saved stamina");
            delete fields.stamina;
        }
        const gameInfo = this.mergeSave(fields, defaults, "game info");
        if (!gameInfo) {
            return null;
        }
        if (!Array.isArray(gameInfo.unlock) || !this.isRecord(gameInfo.formation)) {
            egf.Logger.warn("[LocalDataMgr] invalid formation or unlock list");
            return null;
        }

        // 旧存档中的兵种编号可能来自 CSV 字符串。
        const unlock = gameInfo.unlock.map((id: unknown) => this.readSavedFighterId(id));
        if (!unlock.every((id): id is number => id !== null && id > 0)) {
            egf.Logger.warn("[LocalDataMgr] invalid unlock list");
            return null;
        }
        const formation: IGameInfo["formation"] = {};
        for (const [cell, savedFighterId] of Object.entries(gameInfo.formation)) {
            const id = this.readSavedFighterId(savedFighterId);
            if (!/^\d+$/.test(cell) || !Number.isSafeInteger(Number(cell)) || id === null) {
                egf.Logger.warn("[LocalDataMgr] invalid formation cell:", cell);
                return null;
            }
            formation[Number(cell)] = id;
        }
        gameInfo.unlock = unlock.length ? unlock : defaults.unlock;
        gameInfo.formation = formation;
        return gameInfo;
    }

    private readSavedFighterId(value: unknown): number | null {
        const id = typeof value === "string" && /^\d+$/.test(value) ? Number(value) : value;
        return typeof id === "number" && Number.isSafeInteger(id) && id >= 0 ? id : null;
    }

    private decryptValue(encryptStr: string, label: string): unknown | null {
        try {
            const decryptStr = AES.decrypt(encryptStr, AES_KEY).toString(CryptoTS.enc.Utf8);
            if (!decryptStr) {
                egf.Logger.warn("[LocalDataMgr] empty decrypted save:", label);
                return null;
            }
            const value: unknown = JSON.parse(decryptStr);
            if (value === null) {
                egf.Logger.warn("[LocalDataMgr] invalid null save:", label);
            }
            return value;
        } catch (error) {
            egf.Logger.error(`[LocalDataMgr] failed to decrypt or parse ${label}:`, error);
            return null;
        }
    }
    private writeLocalValue(key: string, value: unknown, label: string): string | null {
        try {
            egf.Logger.log("writeLocalValue: ", key, value);
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

        DataMgr.bSyncCloudData = true;
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

        DataMgr.bSyncCloudData = true;
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
        DataMgr.bSyncCloudData = true;
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

        DataMgr.bSyncCloudData = true;

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
        DataMgr.bSyncCloudData = true;
    }

    public upgradeFighter() {
        this._gameInfo.fighterLv++;
        DataMgr.bSyncCloudData = true;
    }

    public upgradeLand() {
        this._gameInfo.landLv++;
        DataMgr.bSyncCloudData = true;
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

    /** 获取今天已领取的档位；今天尚未领取时返回 0。 */
    public getSignedRewardDayToday(): number {
        if (!this.isSignToday() || this._gameInfo.signDay <= 0) {
            return 0;
        }
        return ((this._gameInfo.signDay - 1) % 7) + 1;
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

        const rewardDay = this.getSignProgress();
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
        DataMgr.bSyncCloudData = true;

        egf.Logger.log("doSign success:", rewardDay);
        return rewardDay;
    }

    public getCoinRate() {
        const lv = clamp(this._gameInfo.coinLv, 1, Constants.goldRate.maxLv);
        return (lv - 1) * Constants.goldRate.step;
    }

    /**
     * 按时间差结算体力回复（离线/跨局也生效）
     * - 体力已满：重置计时，不累加
     * - 未满：累加经过的回复点数，满则重置计时，未满保留余数
     */
    public refreshStamina() {
        const now = Date.now();
        const lastTime = egf.Utils.toInteger(this.GameInfo.lastStaminaTime, 0);
        const elapsed = now - lastTime;
        if (elapsed < 0) {
            // 时间异常回退，重置计时
            this.GameInfo.lastStaminaTime = now;
            DataMgr.bSyncCloudData = true;
            return;
        }

        const cur = DataMgr.stamina;
        if (cur >= Constants.MAX_STAMINA) {
            if (elapsed >= Constants.STAMINA_RECOVER_MS) {
                this.GameInfo.lastStaminaTime = now;
                DataMgr.bSyncCloudData = true;
            }
            return;
        }

        const gain = Math.floor(elapsed / Constants.STAMINA_RECOVER_MS);
        if (gain <= 0) {
            return;
        }

        const newVal = DataMgr.stamina + gain;
        let count = 0;
        if (newVal >= Constants.MAX_STAMINA) {
            count = Constants.MAX_STAMINA - DataMgr.stamina;
            DataMgr.stamina = Constants.MAX_STAMINA;
            this.GameInfo.lastStaminaTime = now;
        } else {
            count = newVal - DataMgr.stamina;
            DataMgr.stamina = newVal;
            this.GameInfo.lastStaminaTime += gain * Constants.STAMINA_RECOVER_MS;
        }
        ClientApi.inst.gainResource({
            req_id: ClientApi.createReqId("add_stamina"),
            type: EResourceType.Stamina,
            amount: count,
        });
        DataMgr.bSyncCloudData = true;
        egf.EventMgr.emit(Constants.EVENT_NAME.STAMINA_CHANGED);
    }

    /** 消费 1 点游戏体力；通用服务端资源的体力采用另一套规则，不参与开局。 */
    public tryConsumeStamina(): boolean {
        this.refreshStamina();
        const cur = DataMgr.stamina;
        if (cur <= 0) {
            return false;
        }

        // 从满体力开始扣除时，重置回复计时，保证下次回复从当前时刻重新计算
        if (cur >= Constants.MAX_STAMINA) {
            this.GameInfo.lastStaminaTime = Date.now();
        }
        DataMgr.addStamina(-1, true);
        DataMgr.bSyncCloudData = true;
        return true;
    }

    /**
     * 距离下一体力的剩余秒数（满体力时为 0）
     */
    public getStaminaRecoverRemainSec(): number {
        this.refreshStamina();
        if (DataMgr.stamina >= Constants.MAX_STAMINA) {
            return 0;
        }
        const lastTime = egf.Utils.toInteger(this.GameInfo.lastStaminaTime, 0);
        const remain = Constants.STAMINA_RECOVER_MS - (Date.now() - lastTime);
        return Math.max(0, Math.ceil(remain / 1000));
    }
}

export const LocalDataMgr = LocalDataManager.inst;
