import { clamp, sys } from "cc";
import CryptoTS from "crypto-ts";
import { ClientApi } from "./ClientApi";
import { Constants } from "./Constants";
import { DataMgr } from "./DataMgr";
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

const AES_KEY = "eeffaif19822sf11156ff734fsefa9f0bb";

// 通关进度待上报队列上限。
const MAX_PENDING_LEVELS = 50;

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

    private _setting: ISetting = {
        musicVolume: 1,
        soundVolume: 1,
        language: "",
        shakeSwith: 1,
    }; // 设置

    private _gameInfo: IGameInfo = {
        deviceID: "",
        coin: 100, //金币数量
        level: 0, //默认初始关卡
        coinLv: 1,
        fighterLv: 1,
        landLv: 1,
        unlock: [Constants.BASE_FIGHTER], //已解锁士兵
        onlineReward: 0, //在线奖励的数值
        finishGuides: [], //完成的引导步骤
        formation: { 1: 101, 2: 101, 3: 101 },
        signDay: 0,
        lastSignTime: 0,
        signTotalDay: 0,
    };

    public get Setting(): ISetting {
        return this._setting;
    }

    public get GameInfo(): IGameInfo {
        return this._gameInfo;
    }

    public loadData(): void {
        this.loadGameInfoData();
        this.loadSettingData();
    }

    public loadDataFromSever(): void {
        this.loadServerData(this.GameInfoStr, (data: string) => {
            const serverInfo = egf.SafeJSON.parse(data) as IGameInfo;
            // 金币始终来自当前余额，禁止旧云存档恢复金币或待补报操作。
            serverInfo.coin = DataMgr.coin;
            serverInfo.pendingLedgerOps = [];
            serverInfo.pendingLevels = this._gameInfo.pendingLevels;
            this._gameInfo = serverInfo;
            //再次存档一次
            this.saveGameInfoData();
        });
        this.loadServerData(this.SettingStr, (data: string) => {
            this._setting = egf.SafeJSON.parse(data) as ISetting;
            //再次存档一次
            this.saveSettingData();
        });
    }

    private loadGameInfoData() {
        const encryptStr = sys.localStorage.getItem(this.GameInfoStr);
        if (encryptStr) {
            try {
                const decryptStr = AES.decrypt(encryptStr, AES_KEY).toString(CryptoTS.enc.Utf8);
                const gameInfo = JSON.parse(decryptStr) as IGameInfo | null;
                if (!gameInfo || typeof gameInfo !== "object" || Array.isArray(gameInfo)) {
                    throw new Error("Invalid local game info");
                }
                this._gameInfo = gameInfo;
                egf.Logger.log("loadGameInfoData:", this._gameInfo);
            } catch (error) {
                egf.Logger.error("Failed to load and parse gameinfo:", error);
            }
        }
        // 无存档或存档损坏时也初始化默认余额，避免首次离线启动显示 0。
        if (!Number.isSafeInteger(this._gameInfo.coin) || this._gameInfo.coin < 0) {
            this._gameInfo.coin = 100;
        }
        DataMgr.coin = this._gameInfo.coin;
        DataMgr.level = this._gameInfo.level ?? 0;
        this.clearPendingLedgerOps();
    }

    private loadSettingData() {
        const encryptStr = sys.localStorage.getItem(this.SettingStr);
        if (encryptStr) {
            try {
                const decryptStr = AES.decrypt(encryptStr, AES_KEY).toString(CryptoTS.enc.Utf8);
                this._setting = egf.SafeJSON.parse(decryptStr) as ISetting;
                egf.Logger.log("loadSettingData:", this._setting);
                egf.AudioMgr.musicVolume = this._setting.musicVolume;
                egf.AudioMgr.soundVolume = this._setting.soundVolume;

                egf.Logger.log("language:", sys.language, sys.languageCode);
                egf.i18nMgr.setLanguage(LocalDataMgr.Setting.language);
            } catch (error) {
                egf.Logger.error("Failed to load and parse settings:", error);
            }
        }
    }

    public saveGameInfoData() {
        const encryptStr = AES.encrypt(egf.SafeJSON.stringify(this._gameInfo), AES_KEY).toString();
        sys.localStorage.setItem(this.GameInfoStr, encryptStr);
        this.saveDataToServer(this.GameInfoStr, encryptStr);
    }

    public saveSettingData() {
        const encryptStr = AES.encrypt(egf.SafeJSON.stringify(this._setting), AES_KEY).toString();
        sys.localStorage.setItem(this.SettingStr, encryptStr);
        this.saveDataToServer(this.SettingStr, encryptStr);
    }

    public saveData() {
        this.saveGameInfoData();
        this.saveSettingData();
    }

    private loadServerData(key: string, cb: (data: string) => void) {
        if (!ClientApi.inst.userInfo) {
            egf.Logger.warn("请先登陆获取用户信息！");
            return;
        }
        ClientApi.inst.getData(
            key,
            (data) => {
                egf.Logger.log("loadServGameInfoData success:", data);
                if (data?.value) {
                    const decryptStr = AES.decrypt(data.value, AES_KEY).toString(CryptoTS.enc.Utf8);
                    cb && cb(decryptStr);
                } else {
                    egf.Logger.log("loadServGameInfoData is null");
                }
            },
            (errcode, errmsg) => {
                egf.Logger.log("loadServGameInfoData error:", errmsg);
            },
        );
    }

    private saveDataToServer(key: string, encryptStr: string) {
        if (!ClientApi.inst.userInfo) {
            egf.Logger.warn("请先登陆获取用户信息！");
            return;
        }
        ClientApi.inst.saveData(
            key,
            encryptStr,
            () => {
                egf.Logger.log("saveData success:", key);
            },
            (errcode, errmsg) => {
                egf.Logger.log("saveData error:", errmsg);
            },
        );
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
