/**
 * 网络数据管理器
 */

import { Game, game } from "cc";
import { EApiErrcode, EResourceType, type ILoginData, type IUserInfo } from "./apiInterface";
import { ClientApi } from "./ClientApi";
import { Constants } from "./Constants";
import { LocalDataMgr, type IPendingLedgerOp } from "./LocalDataMgr";
import { EPlatform, PlatformMgr } from "./SDK/PlatformMgr";

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

type ServerLogin = (onSuccess: (data: ILoginData) => void, onFailure: () => void) => void;

const COIN_SYNC_INTERVAL_MS = 15000;
const COIN_REQUEST_TIMEOUT_MS = 30000;
const MAX_LEDGER_RETRIES = 3;
const MAX_PENDING_COIN_OPS = 50;

class DataManager {
    private static _inst: DataManager | null = null;
    public static get inst(): DataManager {
        if (this._inst == null) {
            this._inst = new DataManager();
        }
        return this._inst;
    }

    public maintenance: IMaintenance = {}; // 维护信息

    private coinOnline = false;
    private coinSyncing = false;
    private coinEpoch = 0;
    private ledgerInFlight = false;
    private ledgerRetries = 0;
    private ledgerRetryAt = 0;
    private pendingCoinOps: IPendingLedgerOp[] = [];
    private coinSyncTimer: ReturnType<typeof setInterval> | null = null;
    private coinRequestTimer: ReturnType<typeof setTimeout> | null = null;
    private serverLogin: ServerLogin | null = null;
    private initialLoginResolver: ((data: ILoginData | null) => void) | null = null;
    private inBackground = false;

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
        this.queueLedgerReport("gain", amount, scene);
        this.updateCoinBalance(this.coin + amount);
        this.flushLedgerOp();
    }

    /** 扣除金币：余额不足时只扣实际余额，保持现有同步调用方式。 */
    public subCoin(coin: number, scene: string = Constants.LEDGER_SCENE.UNKNOWN) {
        const amount = this.normalizeCoinAmount(coin);
        if (amount === null || amount === 0) {
            return;
        }
        const cost = Math.min(this.coin, amount);
        this.queueLedgerReport("consume", cost, scene);
        this.updateCoinBalance(this.coin - cost);
        this.flushLedgerOp();
    }

    private normalizeCoinAmount(amount: number): number | null {
        if (!Number.isFinite(amount) || amount < 0 || amount > 1000000000) {
            egf.Logger.warn("[DataMgr] 金币变化数量非法:", amount);
            return null;
        }
        return Math.floor(amount);
    }

    private isCoinBalance(value: unknown): value is number {
        return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
    }

    private updateCoinBalance(value: number) {
        this._coin.set(value);
        LocalDataMgr.GameInfo.coin = value;
        LocalDataMgr.saveGameInfoData();
        egf.EventMgr.emit(Constants.EVENT_NAME.UPDATE_FORMATION);
        egf.EventMgr.emit("coin_changed");
    }

    public get level() {
        return this._level.get() + 1;
    }

    public set level(value: number) {
        const maxLevelIndex = this.getMaxLevelIndex();
        const normalizedLevel = Number.isSafeInteger(value) ? Math.min(Math.max(value, 0), maxLevelIndex) : 0;
        if (normalizedLevel !== value) {
            egf.Logger.warn("[DataMgr] 关卡索引越界，已归一化:", value, normalizedLevel);
        }
        this._level.set(normalizedLevel);
    }

    public nextLevel() {
        const maxLevelIndex = this.getMaxLevelIndex();
        this._level.set(Math.min(this._level.get() + 1, maxLevelIndex));
        LocalDataMgr.GameInfo.level = this._level.get();
        LocalDataMgr.saveGameInfoData();
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

    // ---------- 在线金币校准与通关进度上报 ----------

    private get canReportServer(): boolean {
        return PlatformMgr.platform !== EPlatform.Android;
    }

    /** 同步由全局数据管理器持有，不依赖已经卸载的启动场景组件。 */
    public startCoinSync(login: ServerLogin): Promise<ILoginData | null> {
        this.stopCoinSync();
        LocalDataMgr.clearPendingLedgerOps();
        if (!this.canReportServer) {
            return Promise.resolve(null);
        }
        const initialLogin = new Promise<ILoginData | null>((resolve) => {
            this.initialLoginResolver = resolve;
        });
        this.serverLogin = login;
        this.inBackground = false;
        game.on(Game.EVENT_SHOW, this.onGameShow, this);
        game.on(Game.EVENT_HIDE, this.onGameHide, this);
        this.coinSyncTimer = setInterval(() => this.retryCoinSync(), COIN_SYNC_INTERVAL_MS);
        this.retryCoinSync();
        return initialLogin;
    }

    /** 重启同步或退出游戏时清理定时器、监听，并使旧回调失效。 */
    public stopCoinSync() {
        if (this.coinSyncTimer !== null) {
            clearInterval(this.coinSyncTimer);
            this.coinSyncTimer = null;
        }
        this.clearCoinRequestTimer();
        game.off(Game.EVENT_SHOW, this.onGameShow, this);
        game.off(Game.EVENT_HIDE, this.onGameHide, this);
        this.serverLogin = null;
        this.resolveInitialLogin(null);
        this.useLocalCoin();
    }

    private onGameShow() {
        this.inBackground = false;
        this.retryCoinSync();

        egf.AudioMgr.resume();
        ClientApi.inst.foreground();
    }

    private onGameHide() {
        this.inBackground = true;
        LocalDataMgr.flushCloudSaves(true);
        egf.AudioMgr.pause();
        ClientApi.inst.background();
    }

    private retryCoinSync() {
        if (this.inBackground || this.coinSyncing || this.ledgerInFlight || !this.serverLogin) {
            return;
        }
        if (this.pendingCoinOps.length > 0) {
            this.flushLedgerOp();
            return;
        }
        if (ClientApi.inst.token) {
            this.syncWithServer();
            return;
        }
        this.coinSyncing = true;
        const epoch = this.coinEpoch;
        let settled = false;
        const onFail = () => {
            if (settled || epoch !== this.coinEpoch) {
                return;
            }
            settled = true;
            this.resolveInitialLogin(null);
            this.useLocalCoin();
        };
        this.coinRequestTimer = setTimeout(onFail, COIN_REQUEST_TIMEOUT_MS);
        this.serverLogin((data) => {
            if (settled || epoch !== this.coinEpoch) {
                return;
            }
            settled = true;
            this.clearCoinRequestTimer();
            this.coinSyncing = false;
            this.userData = data.user_info;
            this.resolveInitialLogin(data);
            ClientApi.inst.foreground();
            LocalDataMgr.flushCloudSaves();
            this.syncWithServer();
        }, onFail);
    }

    private resolveInitialLogin(data: ILoginData | null) {
        if (!this.initialLoginResolver) {
            return;
        }
        const resolve = this.initialLoginResolver;
        this.initialLoginResolver = null;
        resolve(data);
    }

    private clearCoinRequestTimer() {
        if (this.coinRequestTimer !== null) {
            clearTimeout(this.coinRequestTimer);
            this.coinRequestTimer = null;
        }
    }

    private useLocalCoin() {
        this.clearCoinRequestTimer();
        this.coinEpoch++;
        this.coinOnline = false;
        this.coinSyncing = false;
        this.ledgerInFlight = false;
        this.ledgerRetries = 0;
        this.ledgerRetryAt = 0;
        // 离线变化不补报；请求已到服务器但响应丢失的结果，由重连查询确认。
        this.pendingCoinOps = [];
    }

    private queueLedgerReport(op: "gain" | "consume", amount: number, scene: string) {
        if (!this.coinOnline || amount === 0) {
            return;
        }
        if (this.pendingCoinOps.length >= MAX_PENDING_COIN_OPS) {
            egf.Logger.warn("[DataMgr] 在线金币请求积压，改用本地余额等待重新同步");
            this.useLocalCoin();
            return;
        }
        this.pendingCoinOps.push({ req_id: ClientApi.createReqId(scene), op, amount, scene });
    }

    /** 校准时保留尚未发送/确认的在线操作，避免连续操作时余额回退。 */
    private applyServerCoin(balance: number) {
        this.userData.coin = balance;
        const displayCoin = this.pendingCoinOps.reduce(
            (value, op) => (op.op === "gain" ? value + op.amount : Math.max(0, value - op.amount)),
            balance,
        );
        this.updateCoinBalance(displayCoin);
    }

    /** 账本串行发送，确保服务器返回余额与客户端操作顺序一致。 */
    private flushLedgerOp() {
        const op = this.pendingCoinOps[0];
        if (
            !op ||
            !this.coinOnline ||
            this.coinSyncing ||
            this.ledgerInFlight ||
            this.inBackground ||
            Date.now() < this.ledgerRetryAt
        ) {
            return;
        }
        this.ledgerInFlight = true;
        const epoch = this.coinEpoch;
        let settled = false;
        const isCurrent = () => !settled && epoch === this.coinEpoch;
        const onFail = (errcode: number, errmsg: string) => {
            if (!isCurrent()) {
                return;
            }
            settled = true;
            this.clearCoinRequestTimer();
            this.ledgerInFlight = false;
            egf.Logger.warn("[DataMgr] 在线金币操作失败:", errcode, errmsg);
            if (errcode === EApiErrcode.SystemBusy || errcode === EApiErrcode.Processing) {
                if (this.ledgerRetries < MAX_LEDGER_RETRIES) {
                    this.ledgerRetries++;
                    this.ledgerRetryAt = Date.now() + COIN_SYNC_INTERVAL_MS;
                    return;
                }
            } else if (errcode === EApiErrcode.NotEnoughResource || errcode === EApiErrcode.ParamError) {
                this.pendingCoinOps.shift();
                this.ledgerRetries = 0;
                this.ledgerRetryAt = 0;
                this.syncWithServer();
                return;
            }
            if (errcode === EApiErrcode.NotLogin) {
                ClientApi.inst.setToken("");
            }
            this.useLocalCoin();
        };
        const onDone = (balance: unknown) => {
            if (!isCurrent()) {
                return;
            }
            if (!this.isCoinBalance(balance)) {
                onFail(-1, "服务器返回金币余额非法");
                return;
            }
            settled = true;
            this.clearCoinRequestTimer();
            this.ledgerInFlight = false;
            this.ledgerRetries = 0;
            this.ledgerRetryAt = 0;
            this.pendingCoinOps.shift();
            this.applyServerCoin(balance);
            this.flushLedgerOp();
        };
        this.coinRequestTimer = setTimeout(() => onFail(-1, "金币请求超时"), COIN_REQUEST_TIMEOUT_MS);
        if (op.op === "gain") {
            ClientApi.inst.gainCoin(op.req_id, op.amount, op.scene, (data) => onDone(data?.coin), onFail);
        } else {
            ClientApi.inst.consumeResource(
                { req_id: op.req_id, type: EResourceType.Coin, amount: op.amount, scene: op.scene },
                (data) => onDone(data?.balance),
                onFail,
            );
        }
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

    /** 登录、重连及前台恢复时查询账本；离线变化直接由服务器余额覆盖。 */
    public syncWithServer() {
        if (!this.canReportServer || !ClientApi.inst.token || this.coinSyncing || this.ledgerInFlight) {
            return;
        }
        this.coinSyncing = true;
        const epoch = this.coinEpoch;
        let settled = false;
        const onFail = (errcode: number, errmsg: string) => {
            if (settled || epoch !== this.coinEpoch) {
                return;
            }
            settled = true;
            egf.Logger.warn("[DataMgr] 金币同步失败，使用本地余额:", errcode, errmsg);
            if (errcode === EApiErrcode.NotLogin) {
                ClientApi.inst.setToken("");
            }
            this.useLocalCoin();
        };
        this.coinRequestTimer = setTimeout(() => onFail(-1, "金币同步超时"), COIN_REQUEST_TIMEOUT_MS);
        ClientApi.inst.getResource((data) => {
            if (settled || epoch !== this.coinEpoch) {
                return;
            }
            if (!this.isCoinBalance(data?.coin)) {
                onFail(-1, "服务器返回金币余额非法");
                return;
            }
            settled = true;
            this.clearCoinRequestTimer();
            this.coinSyncing = false;
            this.coinOnline = true;
            this.applyServerCoin(data.coin);
            this.flushLedgerOp();
            if (LocalDataMgr.pendingLevels.length > 0) {
                this.reportLevelComplete(Math.max(...LocalDataMgr.pendingLevels), false);
            }
        }, onFail);
    }
}

export const DataMgr = DataManager.inst;
