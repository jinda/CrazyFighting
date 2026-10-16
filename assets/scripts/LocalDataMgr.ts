import { clamp, sys } from "cc";
import CryptoTS from "crypto-ts";
import { ClientApi } from "./ClientApi";
import { Constants } from "./Constants";
import { DataMgr } from "./DataMgr";
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

    private loadGameInfoData(): boolean {
        const encryptStr = sys.localStorage.getItem(this.GameInfoStr);
        let gameInfoData = null;
        if (encryptStr) {
            gameInfoData = this.decryptValue(encryptStr, "local");
        } else {
            gameInfoData = this.createDefaultGameInfo();
        }
        egf.Logger.log("local game info:", gameInfoData);
        this._gameInfo = gameInfoData as IGameInfo;
        DataMgr.coin = this._gameInfo.coin;
        DataMgr.level = this._gameInfo.level;
        if (this.isSignToday()) {
            this._gameInfo.bShare = true;
        }
        egf.Logger.log("load game info local:", this._gameInfo);
        return true;
    }

    private loadSettingData(): boolean {
        const encryptStr = sys.localStorage.getItem(this.SettingStr);
        let settingData = null;
        if (encryptStr) {
            settingData = this.decryptValue(encryptStr, "local");
        } else {
            settingData = this.createDefaultSetting();
        }
        this._setting = settingData as ISetting;
        return true;
    }

    public resetLocalGameInfo() {
        this._gameInfo.saveTime = 0;
        this.writeLocalValue(this.GameInfoStr, this._gameInfo, "local");
    }

    public saveGameInfoData() {
        // 每次落盘都刷新存档时间
        this._gameInfo.saveTime = Date.now();
        this.writeLocalValue(this.GameInfoStr, this._gameInfo, "local");
    }

    public saveSettingData() {
        this.writeLocalValue(this.SettingStr, this._setting, "local");
    }

    public saveData() {
        this.saveGameInfoData();
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
            return;
        }
        ClientApi.inst.getData(
            this.SettingStr,
            (data) => {
                egf.Logger.log("loadCloud Setting success:", data);
                if (data?.value) {
                    const settingData = this.decryptValue(data?.value, "cloud");
                    this._setting = settingData as ISetting;
                    //再次存档一次
                    this.saveSettingData();
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
                    const gameInfoData = this.decryptValue(data?.value, "cloud");
                    egf.Logger.log("loadCloud GameInfo success:", gameInfoData);
                    this.setGameInfo(gameInfoData as IGameInfo);
                } else {
                    egf.Logger.log("loadCloud GameInfo is null");
                }
                finish && finish();
            },
            (errcode, errmsg) => {
                egf.Logger.log("loadCloud GameInfo error:", errmsg);
                finish && finish();
            },
        );
    }

    private setGameInfo(gameInfoData: IGameInfo) {
        egf.Logger.log("set game info:", gameInfoData.saveTime >= this._gameInfo.saveTime);
        if (gameInfoData.saveTime >= this._gameInfo.saveTime) {
            egf.Logger.log("use cloud save data");
            // 使用云存档
            this._gameInfo = gameInfoData;

            DataMgr.coin = this._gameInfo.coin;
            DataMgr.level = this._gameInfo.level;
            //再次存档一次
            this.saveGameInfoData();
        } else {
            egf.Logger.log("use local save data");
            DataMgr.coin = this._gameInfo.coin;
            DataMgr.level = this._gameInfo.level;
        }
        egf.Logger.log("use game info:", this.GameInfo);
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

    private decryptValue(encryptStr: string, label: string): unknown | null {
        try {
            const decryptStr = AES.decrypt(encryptStr, AES_KEY).toString(CryptoTS.enc.Utf8);
            if (!decryptStr) {
                return null;
            }
            return JSON.parse(decryptStr) as unknown;
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
            this.saveCloud(key, encryptStr);
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
        this.saveGameInfoData();

        egf.Logger.log("doSign success:", rewardDay);
        return rewardDay;
    }

    public getCoinRate() {
        const lv = clamp(this._gameInfo.coinLv, 1, Constants.goldRate.maxLv);
        return (lv - 1) * Constants.goldRate.step;
    }
}

export const LocalDataMgr = LocalDataManager.inst;
