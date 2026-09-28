/**
 * 网络数据管理器
 */

import { EApiErrcode, EResourceType, type IUserInfo } from "./apiInterface";
import { ClientApi } from "./ClientApi";
import { Constants } from "./Constants";
import { LocalDataMgr, type IPendingLedgerOp } from "./LocalDataMgr";
import { EPlatform, PlatformMgr } from "./SDK/PlatformMgr";

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

    private _userData: IUserInfo = { money: 0, level: 0, coin: 0 }; // 用户数据
    public get userData(): IUserInfo {
        return this._userData;
    }
    public set userData(v: IUserInfo) {
        this._userData = v;
        // 登录拿到服务器账号信息后，同步进加密字段
        if (v) {
            this._coin.set(v.coin ?? 0);
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

    /**
     * 增加金币（本地立即生效，随后异步上报服务端账本）
     * @param coin 增加数量
     * @param scene 上报场景，见 Constants.LEDGER_SCENE
     */
    public addCoin(coin: number, scene: string = Constants.LEDGER_SCENE.UNKNOWN) {
        this._coin.set(this._coin.get() + coin);
        LocalDataMgr.GameInfo.coin = DataMgr.coin;
        //先入待上报队列，再统一落盘，避免一次加币写两次存档
        this.queueLedgerReport("gain", coin, scene);
        LocalDataMgr.saveGameInfoData();
        egf.EventMgr.emit(Constants.EVENT_NAME.UPDATE_FORMATION);
    }

    /**
     * 扣除金币（本地立即生效，随后异步上报服务端账本）
     * @param coin 期望扣除数量；余额不足时按实际余额扣除
     * @param scene 上报场景，见 Constants.LEDGER_SCENE
     */
    public subCoin(coin: number, scene: string = Constants.LEDGER_SCENE.UNKNOWN) {
        const cur = this._coin.get();
        const cost = cur > coin ? coin : cur;
        this._coin.set(cur - cost);
        LocalDataMgr.GameInfo.coin = DataMgr.coin;
        this.queueLedgerReport("consume", cost, scene);
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

    // ---------- 服务端账本与通关进度上报（本地权威 + 幂等异步上报） ----------

    /**
     * 是否支持服务端上报
     * Android 平台 ClientApi 不发送请求，直接跳过上报，避免待上报队列无限堆积
     */
    private get canReportServer(): boolean {
        return PlatformMgr.platform !== EPlatform.Android;
    }

    /**
     * 记录一笔账本变化：本地数值已生效，异步上报服务端账本
     * req_id 生成后随队列落盘，服务端按幂等键去重，重试不会重复发币
     * @param op 加币(gain) / 扣币(consume)
     * @param amount 数量
     * @param scene 上报场景，见 Constants.LEDGER_SCENE
     */
    private queueLedgerReport(op: "gain" | "consume", amount: number, scene: string) {
        const value = op === "gain" ? Math.floor(amount) : Math.round(amount);
        if (value === 0) {
            //没有实际数量变化，无需上报
            return;
        }
        if (value < 0 || value > 1000000000) {
            egf.Logger.warn("[DataMgr] 账本上报数量非法，跳过:", op, amount, scene);
            return;
        }
        if (!this.canReportServer) {
            return;
        }
        const pendingOp: IPendingLedgerOp = {
            req_id: ClientApi.createReqId(scene),
            op: op,
            amount: value,
            scene: scene,
        };
        //此处不落盘，由调用方（addCoin/subCoin）随金币一起写入存档
        LocalDataMgr.addPendingLedgerOp(pendingOp, false);
        this.flushLedgerOp(pendingOp);
    }

    /**
     * 发送一笔待上报的账本操作
     * 成功后出队；服务端终态拒绝（余额不足/参数错误）也出队，其余保留等待补报
     */
    private flushLedgerOp(op: IPendingLedgerOp) {
        const onDone = () => {
            LocalDataMgr.removePendingLedgerOp(op.req_id);
        };
        const onFail = (errcode: number, errmsg: string) => {
            if (errcode === EApiErrcode.NotEnoughResource || errcode === EApiErrcode.ParamError) {
                LocalDataMgr.removePendingLedgerOp(op.req_id);
                egf.Logger.warn("[DataMgr] 账本上报被服务端拒绝，放弃重试:", op, errmsg);
                return;
            }
            egf.Logger.warn("[DataMgr] 账本上报失败，等待补报:", op, errcode, errmsg);
        };

        if (op.op === "gain") {
            ClientApi.inst.gainCoin(op.req_id, op.amount, op.scene, onDone, onFail);
            return;
        }
        ClientApi.inst.consumeResource(
            {
                req_id: op.req_id,
                type: EResourceType.Coin,
                amount: op.amount,
                scene: op.scene,
            },
            onDone,
            onFail,
        );
    }

    /**
     * 上报通关进度（服务端只增不减，重试安全）
     * @param level 已通关关卡（1-based，取值需在 nextLevel 之前）
     * @param bSave 是否立即落盘；调用方紧接着还会 saveGameInfoData 时可传 false
     */
    public reportLevelComplete(level: number, bSave: boolean = true) {
        if (!this.canReportServer) {
            return;
        }
        if (!Number.isInteger(level) || level <= 0) {
            egf.Logger.warn("[DataMgr] 通关进度非法，跳过上报:", level);
            return;
        }
        LocalDataMgr.addPendingLevel(level, bSave);

        const reportLevel = Math.max(...LocalDataMgr.pendingLevels);
        ClientApi.inst.completeProgress(
            reportLevel,
            (data) => {
                //服务端返回持久化后的历史最高关，据此清理已确认（≤ 该值）的待上报进度
                LocalDataMgr.removePendingLevelsUpTo(data?.level ?? reportLevel);
            },
            (errcode, errmsg) => {
                egf.Logger.warn("[DataMgr] 通关进度上报失败，等待补报:", reportLevel, errcode, errmsg);
            },
        );
    }

    /**
     * 登录成功后同步服务端：先补报失败留存的操作，再拉取一次服务端资源做校准日志
     * 方案约定（本地权威）：服务端数值只用于比对与审计，不覆盖本地金币
     */
    public syncWithServer() {
        if (!this.canReportServer) {
            return;
        }
        for (const op of LocalDataMgr.pendingLedgerOps.slice()) {
            this.flushLedgerOp(op);
        }
        if (LocalDataMgr.pendingLevels.length > 0) {
            this.reportLevelComplete(Math.max(...LocalDataMgr.pendingLevels), false);
        }

        ClientApi.inst.getResource(
            (res) => {
                //注意：服务器存档是异步加载的，此处比对只作近似校准，不覆盖本地数值
                egf.Logger.log("[DataMgr] 服务端资源 coin:", res.coin, "本地金币:", this.coin);
                if (res.coin !== this.coin) {
                    egf.Logger.warn("[DataMgr] 本地金币与服务端账本不一致（方案约定以本地为准）:", this.coin, res.coin);
                }
            },
            (errcode, errmsg) => {
                egf.Logger.warn("[DataMgr] 拉取服务端资源失败:", errcode, errmsg);
            },
        );
    }
}

export const DataMgr = DataManager.inst;
