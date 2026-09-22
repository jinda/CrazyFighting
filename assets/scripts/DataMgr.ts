/**
 * 网络数据管理器
 */

import { clamp } from "cc";
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

    public userData: IUserInfo = { money: 0, level: 0 }; // 用户数据
    public onlineGetTime: number = Date.now(); // 在线奖励获取时间
    public bBannerAd: boolean = false; // 是否显示banner
    public isDebugMode: boolean = false; // 调试模式
    public waitingBuy: number = -1; //优先安排购买

    public get coin() {
        return this.userData.money || 0;
    }
    public set coin(value: number) {
        this.userData.money = value;
    }

    public addCoin(coin: number) {
        this.userData.money += coin;
        LocalDataMgr.GameInfo.coin = DataMgr.coin;
        LocalDataMgr.saveGameInfoData();
        egf.EventMgr.emit(Constants.EVENT_NAME.UPDATE_FORMATION);
    }

    public subCoin(coin: number) {
        if (coin > DataMgr.coin) {
            DataMgr.coin = 0;
        } else {
            DataMgr.coin -= coin;
        }
        LocalDataMgr.GameInfo.coin = DataMgr.coin;
        LocalDataMgr.saveGameInfoData();
        egf.EventMgr.emit(Constants.EVENT_NAME.UPDATE_FORMATION);
        egf.EventMgr.emit("coin_changed");
    }

    public get level() {
        return this.userData.level + 1;
    }

    public set level(value: number) {
        this.userData.level = value;
    }

    public nextLevel() {
        this.userData.level++;
        if (this.userData.level > Constants.MAX_LEVEL) {
            this.userData.level = Constants.MAX_LEVEL;
        }
        LocalDataMgr.GameInfo.level = this.userData.level;
        LocalDataMgr.saveGameInfoData();
    }
}

export const DataMgr = DataManager.inst;
