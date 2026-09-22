/**
 * 网络数据管理器
 */

import { IUserInfo } from "./apiInterface";
import { Constants } from "./Constants";
import { LocalDataMgr } from "./LocalDataMgr";

window.onerror = function (message, source, lineno, colno, error) {
    egf.Logger.error("捕获到全局错误: ", message, source, lineno, colno, error);
    return true; // 返回true可以阻止错误冒泡
};
export interface IMaintenance {
    isUpdating?: boolean;
    content?: {
        title: string;
        text: string;
    };
    whitelist?: number[];
}

class DataManager {
    private static _inst: DataManager | null = null;
    public static get inst(): DataManager {
        if (this._inst == null) {
            this._inst = new DataManager();
        }
        return this._inst;
    }

    public maintenance: IMaintenance = {}; // 维护信息

    // 内存加密存储，防止内存扫描篡改金币/关卡
    private _coin: egf.SecureValue = new egf.SecureValue(0);
    private _level: egf.SecureValue = new egf.SecureValue(0);

    private _userData: IUserInfo = { money: 0, level: 0 }; // 用户数据
    public get userData(): IUserInfo {
        return this._userData;
    }
    public set userData(v: IUserInfo) {
        this._userData = v;
        // 登录拿到服务器账号信息后，同步进加密字段
        if (v) {
            this._coin.set(v.money ?? 0);
            this._level.set(v.level ?? 0);
        }
    }
    public onlineGetTime: number = Date.now(); // 在线奖励获取时间
    public bBannerAd: boolean = false; // 是否显示banner
    public isDebugMode: boolean = false; // 调试模式
    public waitingBuy: number = -1; //优先安排购买

    public get coin() {
        return this._coin.get();
    }
    public set coin(value: number) {
        this._coin.set(value);
    }

    public addCoin(coin: number) {
        this._coin.set(this._coin.get() + coin);
        LocalDataMgr.GameInfo.coin = DataMgr.coin;
        LocalDataMgr.saveGameInfoData();
        egf.EventMgr.emit(Constants.EVENT_NAME.UPDATE_FORMATION);
    }

    public subCoin(coin: number) {
        const cur = this._coin.get();
        this._coin.set(cur > coin ? cur - coin : 0);
        LocalDataMgr.GameInfo.coin = DataMgr.coin;
        LocalDataMgr.saveGameInfoData();
        egf.EventMgr.emit(Constants.EVENT_NAME.UPDATE_FORMATION);
        egf.EventMgr.emit("coin_changed");
    }

    public get level() {
        return this._level.get() + 1;
    }

    public set level(value: number) {
        this._level.set(value);
    }

    public nextLevel() {
        this._level.set(Math.min(this._level.get() + 1, Constants.MAX_LEVEL));
        LocalDataMgr.GameInfo.level = this._level.get();
        LocalDataMgr.saveGameInfoData();
    }
}

export const DataMgr = DataManager.inst;
