/**
 * 网络数据管理器
 */

import { game, Game } from "cc";
import { EResourceType, type IUserInfo } from "./apiInterface";
import { ClientApi } from "./ClientApi";
import { Constants } from "./Constants";
import { LocalDataMgr } from "./LocalDataMgr";
import { PlatformMgr } from "./SDK/PlatformMgr";

const sanitizeDiagnostic = (value: unknown): string => {
    return String(value ?? "")
        .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [REDACTED]")
        .replace(/([?&](?:token|code|password)=)[^&\s]+/gi, "$1[REDACTED]")
        .replace(/("(?:token|password|identity_token|id_token)"\s*:\s*")[^"]+/gi, "$1[REDACTED]");
};

window.onerror = function (message, _source, lineno, colno, error) {
    const safeMessage = sanitizeDiagnostic(message);
    const safeStack = sanitizeDiagnostic(error?.stack || "");
    egf.Logger.error("捕获到全局错误: ", safeMessage, lineno, colno);
    ClientApi.inst.reportError(
        {
            /** 一次异常的稳定 ID，非空，最多 128 字节；重试必须复用 */
            event_id: ClientApi.createReqId("global_error"),
            error_type: "runtime",
            /** 非空，最多 2 KiB；发送前移除敏感信息 */
            message: safeMessage,
            /** 最多 16 KiB；发送前移除敏感信息 */
            stack: safeStack,
            /** 最多 128 字节 */
            game_version: DataMgr.version,
            /** 最多 128 字节 */
            platform: PlatformMgr.platform.toString(),
        },
        () => {
            egf.Logger.log("reportError success");
        },
        (errcode) => {
            egf.Logger.warn("reportError fail:", errcode);
        },
    );
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
    private _onlineCoin: egf.SecureValue = new egf.SecureValue(0);

    private _userData: IUserInfo = { money: 0, level: 0, coin: 0 }; // 用户数据
    public get userData(): IUserInfo {
        return this._userData;
    }
    public set userData(v: IUserInfo) {
        this._userData = v;
    }
    public onlineGetTime: number = Date.now(); // 在线奖励获取时间
    public bBannerAd: boolean = false; // 是否显示banner
    public isDebugMode: boolean = false; // 调试模式
    public waitingBuy: number = -1; //优先安排购买
    public version: string = "1.0.0"; // 版本号

    public startEnterGame() {
        game.on(Game.EVENT_SHOW, this.onGameShow, this);
        game.on(Game.EVENT_HIDE, this.onGameHide, this);
    }

    public get coin() {
        return this._coin.get();
    }
    public set coin(value: number) {
        this._coin.set(value);
    }

    /** 增加金币：立即显示；在线时由服务器确认，离线时只保存本地。 */
    public addCoin(coin: number, scene: string = Constants.LEDGER_SCENE.UNKNOWN) {
        const amount = this.normalizeCoinAmount(coin);
        if (amount === null || amount === 0) {
            return;
        }
        this.updateCoinBalance(this.coin + amount);

        ClientApi.inst.gainCoin(ClientApi.createReqId("add_coin"), amount, scene);
    }

    /** 扣除金币：余额不足时只扣实际余额，保持现有同步调用方式。 */
    public subCoin(coin: number, scene: string = Constants.LEDGER_SCENE.UNKNOWN) {
        const amount = this.normalizeCoinAmount(coin);
        if (amount === null || amount === 0) {
            return;
        }
        const cost = Math.min(this.coin, amount);
        this.updateCoinBalance(this.coin - cost);

        ClientApi.inst.consumeResource({
            req_id: ClientApi.createReqId("sub_coin"),
            type: EResourceType.Coin,
            amount: cost,
            scene: scene,
        });
    }
    private updateCoinBalance(value: number) {
        this._coin.set(value);
        LocalDataMgr.GameInfo.coin = value;
        LocalDataMgr.saveGameInfoData();
        egf.EventMgr.emit(Constants.EVENT_NAME.UPDATE_FORMATION);
        egf.EventMgr.emit("coin_changed");
    }

    private normalizeCoinAmount(amount: number): number | null {
        if (!Number.isFinite(amount) || amount < 0 || amount > 1000000000) {
            egf.Logger.warn("[DataMgr] 金币变化数量非法:", amount);
            return null;
        }
        return Math.floor(amount);
    }

    public get level() {
        return this._level.get() + 1;
    }

    public set level(value: number) {
        const level = Math.min(Math.max(value, 0), Constants.MAX_LEVEL);
        this._level.set(level);
    }

    public nextLevel() {
        const level = Math.min(Math.max(this.level, 0), Constants.MAX_LEVEL);
        this._level.set(level);
        LocalDataMgr.GameInfo.level = this._level.get();
        LocalDataMgr.saveGameInfoData();

        ClientApi.inst.completeProgress(
            this._level.get(),
            (data) => {
                //服务端返回持久化后的历史最高关，据此清理已确认（≤ 该值）的待上报进度
            },
            (errcode, errmsg) => {
                egf.Logger.warn("[DataMgr] 通关进度上报失败:", this._level.get(), errcode, errmsg);
            },
        );
    }

    private getMaxLevelIndex(): number {
        return Number.isSafeInteger(Constants.MAX_LEVEL) && Constants.MAX_LEVEL > 0
            ? Constants.MAX_LEVEL - 1
            : Number.MAX_SAFE_INTEGER;
    }

    public get onlineCoin() {
        return this._onlineCoin.get();
    }

    public set onlineCoin(value: number) {
        this._onlineCoin.set(value);
    }

    private onGameShow() {
        egf.AudioMgr.resume();
        ClientApi.inst.foreground();
    }

    private onGameHide() {
        egf.AudioMgr.pause();
        ClientApi.inst.background();
    }
}

export const DataMgr = DataManager.inst;
