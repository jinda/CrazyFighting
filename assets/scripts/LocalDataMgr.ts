import { sys } from "cc";
import CryptoTS from "crypto-ts";
import { ClientApi } from "./ClientApi";
import { Constants } from "./Constants";
import { DataMgr } from "./DataMgr";
const { AES } = CryptoTS;

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
}

interface ISetting {
    musicVolume: number;
    soundVolume: number;
    language: string;
    shakeSwith: number;
}

const AES_KEY = "eeffaif19822sf11156ff734fsefa9f0bb";
class LocalDataManager {
    private static _inst: LocalDataManager;
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
        coinLv: 0,
        fighterLv: 0,
        landLv: 0,
        unlock: [Constants.BASE_FIGHTER], //已解锁士兵
        onlineReward: 0, //在线奖励的数值
        finishGuides: [], //完成的引导步骤
        formation: { 1: 101, 2: 101, 3: 101 },
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
            this._gameInfo = egf.SafeJSON.parse(data) as IGameInfo;
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
                this._gameInfo = egf.SafeJSON.parse(decryptStr) as IGameInfo;
                DataMgr.coin = this._gameInfo.coin ?? 0;
                DataMgr.level = this._gameInfo.level ?? 0;
                egf.Logger.log("loadGameInfoData:", this._gameInfo);
            } catch (error) {
                egf.Logger.error("Failed to load and parse gameinfo:", error);
            }
        }
    }

    private loadSettingData() {
        const encryptStr = sys.localStorage.getItem(this.SettingStr);
        if (encryptStr) {
            try {
                const decryptStr = AES.decrypt(encryptStr, AES_KEY).toString(CryptoTS.enc.Utf8);
                this._setting = egf.SafeJSON.parse(decryptStr) as ISetting;

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
}

export const LocalDataMgr = LocalDataManager.inst;
