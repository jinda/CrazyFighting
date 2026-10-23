import { GetEnvConfig } from "./config/EnvConfig";
import type {
    IAdConfigData,
    IAllData,
    IApiResponse,
    IConsumeResourceData,
    IConsumeResourceParams,
    IGainCoinData,
    ILeaderboardData,
    ILeaderboardsData,
    ILoginData,
    IMailClaimData,
    IMailDeleteData,
    IMailDetail,
    IMailListData,
    IMoreGamesData,
    IOAuthLoginCredentials,
    IProgressCompleteData,
    IPushScoreResp,
    IRedeemCodeData,
    IReportErrorData,
    IReportErrorParams,
    IReportEventData,
    IResourceData,
    ISaveDataItem,
    ISessionData,
    ITaskClaimData,
    ITaskCompleteData,
    ITaskListData,
    IUserInfo,
    TApiErrCallback,
    TGainResourceData,
    TGainResourceParams,
    TLeaderboardRegion,
    TQueryParams,
    TRequestParams,
    TOAuthLoginType,
} from "./apiInterface";
import { NetworkTips } from "./NetworkTips";

const UnURIs = [
    "/client/adconfig",
    "/client/leaderboards",
    "/client/login",
    "/client/more-games",
    "/client/oauthlogin",
];

/**
 * 客户端 API 客户端（对应 client-api.md）
 * Base URL: http://{host}:10001/client
 * 通用 Header: X-Game-Code, Content-Type, Authorization: Bearer {token}
 */
export class ClientApi {
    private static _inst: ClientApi | null = null;
    public static get inst(): ClientApi {
        if (this._inst === null) {
            this._inst = new ClientApi();
        }
        return this._inst;
    }

    /**
     * 生成客户端幂等键（消耗资源 / 上报金币使用）
     * 同一笔业务重试必须复用同一个 req_id，不能重新生成
     * @param prefix 业务前缀，如 "level_enter"、"level_complete"
     */
    public static createReqId(prefix: string): string {
        const random = Math.random().toString(36).slice(2, 10);
        return `${prefix}-${Date.now().toString(36)}-${random}`;
    }

    private _gameCode: string = "default";
    private _token: string = "";
    private _userInfo: IUserInfo | null = null;
    private _adConfig: IAdConfigData | null = null;
    private _sessionId: string = "";

    public get token(): string {
        return this._token;
    }

    public get userInfo(): IUserInfo {
        return this._userInfo!;
    }

    public get adConfig(): IAdConfigData | null {
        return this._adConfig;
    }

    /**
     * 初始化：读取配置中的 game_code 并设置 X-Game-Code Header
     */
    public init() {
        const { url, game_code } = GetEnvConfig();
        if (game_code) {
            this._gameCode = game_code;
        }
        egf.HttpMgr.init(url, new NetworkTips());
        egf.HttpMgr.addHeaders("X-Game-Code", this._gameCode);
        egf.Logger.log("[ClientApi] init, game_code:", this._gameCode);
    }

    /**
     * 设置 token 并添加 Authorization Header
     */
    public setToken(token: string) {
        this._token = token || "";
        if (this._token) {
            egf.HttpMgr.addHeaders("Authorization", `Bearer ${this._token}`);
        } else {
            egf.HttpMgr.removeHeaders("Authorization");
        }
        egf.Logger.log("[ClientApi] authentication state changed:", this._token.length > 0);
    }

    /**
     * 统一请求封装（对应 client-api.md 的通用响应格式 { errcode, errmsg, data }）
     * @param uri 接口地址（相对 Base URL）
     * @param params 请求参数：POST 作为 JSON Body，GET 作为 Query 参数
     * @param cb 成功回调（errcode=0 时返回响应中的 data）
     * @param errCb 失败回调（服务端 errcode，或网络失败时的 -1）
     * @param isGet true=GET 请求，false=POST 请求
     */
    private request<T>(
        uri: string,
        params: TRequestParams = {},
        cb?: (data: T) => void,
        errCb?: TApiErrCallback,
        isGet: boolean = false,
    ) {
        if (this._token === "" && !UnURIs.includes(uri)) {
            if (errCb) {
                errCb(-1, "没有登陆不支持网络请求");
            }
            return;
        }

        const onComplete = (resp: IApiResponse) => {
            if (resp && resp.errcode === 0) {
                if (cb) {
                    cb(resp.data as T);
                }
                return;
            }
            egf.Logger.error(`[ClientApi] ${uri} error:`, resp?.errcode);
            if (errCb) {
                errCb(resp?.errcode, resp?.errmsg);
            }
        };

        const onError = (_error: unknown) => {
            egf.Logger.error(`[ClientApi] ${uri} request failed`);
            if (errCb) {
                errCb(-1, "网络请求失败");
            }
        };

        if (isGet) {
            egf.HttpMgr.get(uri, params as TQueryParams, onComplete, onError);
        } else {
            egf.HttpMgr.post(uri, params, onComplete, onError);
        }
    }

    // ---------- 1. 登录 / 注册 ----------

    /**
     * uid 登录（自动注册）
     * 每次登录创建 24 小时有效会话并替换旧 token；业务请求不会续期。
     * @param uid 玩家唯一 ID（snowflake 超过 JS 2^53，必须按字符串传，否则丢精度）
     * @param nickname 昵称（新用户必填，缺省 player_{uid}）
     * @param avatar 头像 URL
     */
    public login(
        uid: string,
        nickname?: string,
        avatar?: string,
        cb?: (data: ILoginData) => void,
        errCb?: TApiErrCallback,
    ) {
        const params: TRequestParams = { uid };
        if (nickname) {
            params.nickname = nickname;
        }
        if (avatar) {
            params.avatar = avatar;
        }
        this.request<ILoginData>(
            "/client/login",
            params,
            (data) => {
                this.handleLoginData(data);
                if (cb) {
                    cb(data);
                }
            },
            errCb,
        );
    }

    /**
     * 多渠道登录（游客/微信/Google/Apple/SUD），每次登录成功都会替换该玩家旧会话。
     * SUD 仅提交 sud.login 的原始 code，不提交 openid 或 Game Secret。
     * @param loginType guest / wechat / google / apple / sud
     * @param extra 各渠道必填参数：guest=device_id；wechat/sud=code；google=id_token；apple=identity_token
     */
    public oauthLogin<T extends TOAuthLoginType>(
        loginType: T,
        extra: IOAuthLoginCredentials[T],
        nickname?: string,
        avatar?: string,
        cb?: (data: ILoginData) => void,
        errCb?: TApiErrCallback,
    ): void;
    /** 兼容已有字符串渠道调用；新增调用优先使用上方带渠道凭据类型的签名。 */
    public oauthLogin(
        loginType: string,
        extra?: TRequestParams,
        nickname?: string,
        avatar?: string,
        cb?: (data: ILoginData) => void,
        errCb?: TApiErrCallback,
    ): void;
    public oauthLogin(
        loginType: string,
        extra: TRequestParams = {},
        nickname?: string,
        avatar?: string,
        cb?: (data: ILoginData) => void,
        errCb?: TApiErrCallback,
    ) {
        const params: TRequestParams = { ...extra, login_type: loginType };
        if (nickname) {
            params.nickname = nickname;
        }
        if (avatar) {
            params.avatar = avatar;
        }
        this.request<ILoginData>(
            "/client/oauthlogin",
            params,
            (data) => {
                this.handleLoginData(data);
                if (cb) {
                    cb(data);
                }
            },
            errCb,
        );
    }

    /**
     * 登录成功后统一处理：保存 token 与用户信息
     */
    private handleLoginData(data: ILoginData) {
        if (data) {
            this.setToken(data.token || "");
            this._userInfo = data.user_info || null;
            egf.Logger.log("[ClientApi] login success, is_new:", data.is_new);
        }
    }

    // ---------- 1.1 游戏进入前台 / 后台 ----------

    /**
     * 生成前台/后台会话 UUID（每次进入前台调用一次；上报失败重试必须沿用同一 UUID，不能重新生成）
     * 版本 4（variant 10xx）格式，例如 "12345678-1234-4234-8234-123456789abc"
     */
    public static createSessionId(): string {
        return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
            const r = (Math.random() * 16) | 0;
            const v = c === "x" ? r : (r & 0x3) | 0x8;
            return v.toString(16);
        });
    }

    /**
     * 上报游戏进入前台（需要登录 token）
     * 登录成功后，每次应用进入前台生成新的 UUID 调用；收到成功响应后，进入后台时复用同一 session_id
     * @param sessionId 新前台会话的 UUID；省略时自动生成，重试须显式传入同一 UUID
     */
    public foreground(cb?: (data: ISessionData) => void, errCb?: TApiErrCallback, sessionId?: string) {
        this._sessionId = sessionId ?? ClientApi.createSessionId();
        this.request<ISessionData>("/client/foreground", { session_id: this._sessionId }, cb, errCb);
    }

    /**
     * 上报游戏进入后台（需要登录 token）
     * 前台上报成功收到响应后，进入后台时用同一个 session_id 调用；请求失败重试沿用原 UUID
     * @param sessionId 与前台上报一致的会话 UUID
     */
    public background(cb?: (data: ISessionData) => void, errCb?: TApiErrCallback, sessionId?: string) {
        this.request<ISessionData>("/client/background", { session_id: sessionId ?? this._sessionId }, cb, errCb);
    }

    // ---------- 2. 获取玩家信息 ----------

    /**
     * 获取当前登录玩家信息（POST 方式），身份仅由 Authorization token 确定。
     */
    public getUserInfo(cb: (data: IUserInfo) => void, errCb?: TApiErrCallback): void;
    /** @deprecated uid 不再参与认证，兼容旧调用但不会发送该字段。 */
    public getUserInfo(uid?: string, cb?: (data: IUserInfo) => void, errCb?: TApiErrCallback): void;
    public getUserInfo(
        uidOrCallback?: string | ((data: IUserInfo) => void),
        callbackOrError?: ((data: IUserInfo) => void) | TApiErrCallback,
        legacyErrorCallback?: TApiErrCallback,
    ) {
        // 保留 getUserInfo(undefined, cb, errCb) 的旧式占位调用；新调用直接传成功回调。
        const isLegacyCall = typeof uidOrCallback !== "function";
        const cb =
            typeof uidOrCallback === "function"
                ? uidOrCallback
                : (callbackOrError as ((data: IUserInfo) => void) | undefined);
        const errCb = isLegacyCall ? legacyErrorCallback : (callbackOrError as TApiErrCallback | undefined);
        this.request<IUserInfo>(
            "/client/userinfo",
            {},
            (data) => {
                this._userInfo = data;
                if (cb) {
                    cb(data);
                }
            },
            errCb,
        );
    }

    // ---------- 2.1 更新昵称/头像 ----------

    /**
     * 更新昵称/头像
     * @param nickname 昵称，非空，≤32 字符
     * @param avatar 头像 URL，≤512 字节，传空字符串可清空头像
     */
    public updateProfile(nickname?: string, avatar?: string, cb?: () => void, errCb?: TApiErrCallback) {
        const params: TRequestParams = {};
        if (nickname !== undefined && nickname !== "") {
            params.nickname = nickname;
        }
        if (avatar !== undefined) {
            params.avatar = avatar;
        }
        this.request<unknown>(
            "/client/updateprofile",
            params,
            () => {
                // 服务端更新成功后，同步本地缓存
                if (this._userInfo) {
                    if (nickname) {
                        this._userInfo.nickname = nickname;
                    }
                    if (avatar !== undefined) {
                        this._userInfo.avatar = avatar;
                    }
                }
                if (cb) {
                    cb();
                }
            },
            errCb,
        );
    }

    // ---------- 3. 获取玩法榜单列表 ----------

    /**
     * 获取当前游戏所有启用中的玩法及开启的周期（无需登录）
     * score_type：0=自定义分数、1=最高关、2=通过的关卡数（仅通过 completeProgress 更新）
     */
    public getLeaderboards(cb?: (data: ILeaderboardsData) => void, errCb?: TApiErrCallback) {
        this.request<ILeaderboardsData>("/client/leaderboards", {}, cb, errCb);
    }

    // ---------- 4. 上传分数 ----------

    /**
     * 上传分数（写入该玩法所有开启周期的榜单）
     * 服务器只保留历史最高分；低分上报被忽略但仍返回当前排名
     * 最高关分数同步全部启用的最高关玩法；通过关卡数榜禁止调用本接口。
     * @param mode 玩法标识
     * @param score score_type=0 传自定义分数；score_type=1 传当前最高关（整数，如 52）
     * @param region 榜单地区；省略时服务端默认 cn
     */
    public pushScore(mode: string, score: number, cb?: (data: IPushScoreResp) => void, errCb?: TApiErrCallback): void;
    public pushScore(
        mode: string,
        score: number,
        region: TLeaderboardRegion,
        cb?: (data: IPushScoreResp) => void,
        errCb?: TApiErrCallback,
    ): void;
    public pushScore(
        mode: string,
        score: number,
        regionOrCallback?: TLeaderboardRegion | ((data: IPushScoreResp) => void),
        callbackOrError?: ((data: IPushScoreResp) => void) | TApiErrCallback,
        regionError?: TApiErrCallback,
    ) {
        const params: TRequestParams = { mode, score };
        if (typeof regionOrCallback === "string") {
            params.region = regionOrCallback;
        }
        const cb =
            typeof regionOrCallback === "string"
                ? (callbackOrError as ((data: IPushScoreResp) => void) | undefined)
                : regionOrCallback;
        const errCb = typeof regionOrCallback === "string" ? regionError : (callbackOrError as TApiErrCallback);
        this.request<IPushScoreResp>("/client/pushscore", params, cb, errCb);
    }

    // ---------- 4.1 上报通关进度 ----------

    /**
     * 上报实际完成的关卡，同步最高关榜（score_type=1）和通过关卡数榜（score_type=2）。
     * 最高关只增不减，通过关卡数按各周期对关卡编号去重，不推断遗漏关卡已完成。
     * 临时失败须用相同 level 在同周期重试，避免遗漏通过关卡数或误计入其他业务日。
     * @param level 已通关关卡，范围 1..9006，必须是整数（不接受浮点数或字符串）
     * @param region 榜单地区；省略时服务端默认 cn
     */
    public completeProgress(level: number, cb?: (data: IProgressCompleteData) => void, errCb?: TApiErrCallback): void;
    public completeProgress(
        level: number,
        region: TLeaderboardRegion,
        cb?: (data: IProgressCompleteData) => void,
        errCb?: TApiErrCallback,
    ): void;
    public completeProgress(
        level: number,
        regionOrCallback?: TLeaderboardRegion | ((data: IProgressCompleteData) => void),
        callbackOrError?: ((data: IProgressCompleteData) => void) | TApiErrCallback,
        regionError?: TApiErrCallback,
    ) {
        const params: TRequestParams = { level };
        if (typeof regionOrCallback === "string") {
            params.region = regionOrCallback;
        }
        const cb =
            typeof regionOrCallback === "string"
                ? (callbackOrError as ((data: IProgressCompleteData) => void) | undefined)
                : regionOrCallback;
        const errCb = typeof regionOrCallback === "string" ? regionError : (callbackOrError as TApiErrCallback);
        this.request<IProgressCompleteData>("/client/progress/complete", params, cb, errCb);
    }

    // ---------- 4.2 上报游戏事件 ----------

    /**
     * 上报游戏事件：逐条记录已登录玩家的行为事件，仅用于分析，不触发奖励/资源/任务
     * 同一游戏、同一玩家、同一 event_id 重试返回 duplicate=true，不覆盖首次写入
     * @param eventId 客户端生成的幂等 ID，非空，最多 128 字节（可用 ClientApi.createReqId 生成）
     * @param eventName 自由事件名称，非空，最多 128 字节
     * @param properties 自由 JSON 对象，省略时为 {}；JSON 原始编码最多 16 KiB
     * @param occurredAt RFC3339 发生时间，省略时取服务端接收时间
     */
    public reportEvent(
        eventId: string,
        eventName: string,
        properties?: { [key: string]: unknown },
        occurredAt?: string,
        cb?: (data: IReportEventData) => void,
        errCb?: TApiErrCallback,
    ) {
        const params: TRequestParams = { event_id: eventId, event_name: eventName };
        if (properties !== undefined) {
            params.properties = properties;
        }
        if (occurredAt) {
            params.occurred_at = occurredAt;
        }
        this.request<IReportEventData>("/client/event/report", params, cb, errCb);
    }

    // ---------- 4.3 上报客户端异常 ----------

    /**
     * 上报客户端异常（登录后使用），请求体最多 32 KiB，不接受 uid/game_code 或自定义上下文。
     * 调用方须先移除消息、堆栈中的 token、密码和请求凭据；不能再次上报本接口自身的失败。
     * 临时依赖失败（10000/网络失败）由调用方采用有上限的退避重试，沿用相同 event_id；
     * 参数错误（10001）、认证错误（2/10071）、限流（10065）不立即重试。
     * @param params 异常信息；event_id 可用 ClientApi.createReqId 生成，同一次异常重试不得重新生成
     */
    public reportError(params: IReportErrorParams, cb?: (data: IReportErrorData) => void, errCb?: TApiErrCallback) {
        const body: TRequestParams = {
            event_id: params.event_id,
            error_type: params.error_type,
            message: params.message,
        };
        //逐项构造请求，避免运行时对象携带文档不允许的身份字段或其他上下文。
        const optionalKeys = ["stack", "game_version", "platform", "scene", "occurred_at"] as const;
        for (const key of optionalKeys) {
            if (params[key] !== undefined) {
                body[key] = params[key];
            }
        }
        this.request<IReportErrorData>("/client/error/report", body, cb, errCb);
    }

    // ---------- 5. 获取排行榜 ----------

    /**
     * 获取排行榜
     * my 为请求者自己的数据（rank 为全榜真实排名，不在前 N 也有值）
     * 该榜没有自己的分数时 my.score=0 且 my.rank=10000，客户端按此判断"未上榜"
     * @param mode 玩法标识
     * @param type 周期类型: 1=日榜 2=周榜 3=月榜 4=总榜
     * @param top 返回前 N 名，默认 50，上限 100
     * @param region 榜单地区；省略时服务端默认 cn
     */
    public getLeaderboard(
        mode: string,
        type: number,
        top?: number,
        cb?: (data: ILeaderboardData) => void,
        errCb?: TApiErrCallback,
    ): void;
    public getLeaderboard(
        mode: string,
        type: number,
        top: number,
        region: TLeaderboardRegion,
        cb?: (data: ILeaderboardData) => void,
        errCb?: TApiErrCallback,
    ): void;
    public getLeaderboard(
        mode: string,
        type: number,
        top: number = 50,
        regionOrCallback?: TLeaderboardRegion | ((data: ILeaderboardData) => void),
        callbackOrError?: ((data: ILeaderboardData) => void) | TApiErrCallback,
        regionError?: TApiErrCallback,
    ) {
        const params: TRequestParams = { mode, type, top };
        if (typeof regionOrCallback === "string") {
            params.region = regionOrCallback;
        }
        const cb =
            typeof regionOrCallback === "string"
                ? (callbackOrError as ((data: ILeaderboardData) => void) | undefined)
                : regionOrCallback;
        const errCb = typeof regionOrCallback === "string" ? regionError : (callbackOrError as TApiErrCallback);
        this.request<ILeaderboardData>("/client/leaderboard", params, cb, errCb);
    }

    // ---------- 6. 资源（金币/体力/道具） ----------

    /**
     * 6.1 查询资源（服务端会先结算体力自然恢复）
     * 体力上限 30，每 5 分钟恢复 1 点
     */
    public getResource(cb?: (data: IResourceData) => void, errCb?: TApiErrCallback) {
        this.request<IResourceData>("/client/resource", {}, cb, errCb, true);
    }

    /**
     * 6.2 消耗资源（余额不足返回 errcode 10031）
     * 一次请求只消耗一种资源，多资源请多次调用并各自使用独立 req_id
     * @param params req_id=客户端幂等键（≤64，可用 ClientApi.createReqId 生成）
     *               type=coin/stamina/item（item 时需传 item_id）
     *               amount=消耗数量(1~1e9)；scene=场景标识（≤32，仅审计）
     */
    public consumeResource(
        params: IConsumeResourceParams,
        cb?: (data: IConsumeResourceData) => void,
        errCb?: TApiErrCallback,
    ) {
        const body: TRequestParams = {
            req_id: params.req_id,
            type: params.type,
            amount: params.amount,
        };
        if (params.item_id !== undefined) {
            body.item_id = params.item_id;
        }
        if (params.scene !== undefined) {
            body.scene = params.scene;
        }
        this.request<IConsumeResourceData>("/client/resource/consume", body, cb, errCb);
    }

    /**
     * 6.3 上报获得金币（只增加 coin，不会修改 money）
     * 收到 10044（处理中）或 10000（存储错误）时，必须用完全相同的 req_id/amount/scene 重试
     * @param reqId 幂等键（≤64 字节，同一笔奖励重试必须复用，可用 ClientApi.createReqId 生成）
     * @param amount 增加的金币，范围 1 ~ 1,000,000,000
     * @param scene 场景标识（≤32 字节，仅审计，如 level_complete）
     */
    public gainCoin(
        reqId: string,
        amount: number,
        scene?: string,
        cb?: (data: IGainCoinData) => void,
        errCb?: TApiErrCallback,
    ) {
        const params: TRequestParams = { req_id: reqId, amount };
        if (scene) {
            params.scene = scene;
        }
        this.request<IGainCoinData>("/client/resource/gain", params, cb, errCb);
    }

    /**
     * 6.3 上报获得一种资源（金币、体力或道具）。
     * 10044/10000 重试时须保持 req_id、type、item_id、amount 和 scene 不变。
     */
    public gainResource(params: TGainResourceParams, cb?: (data: TGainResourceData) => void, errCb?: TApiErrCallback) {
        const body: TRequestParams = { req_id: params.req_id, amount: params.amount };
        if (params.type !== undefined) {
            body.type = params.type;
        }
        if (params.type === "item") {
            body.item_id = params.item_id;
        }
        if (params.scene !== undefined) {
            body.scene = params.scene;
        }
        this.request<TGainResourceData>("/client/resource/gain", body, cb, errCb);
    }

    // ---------- 7. 兑换码兑换 ----------

    /**
     * 兑换码兑换（10040 不存在/失效；10041 已使用；10042 已兑换完；10043 道具未配置）
     * @param code 兑换码
     */
    public redeemCode(code: string, cb?: (data: IRedeemCodeData) => void, errCb?: TApiErrCallback) {
        this.request<IRedeemCodeData>("/client/code/redeem", { code }, cb, errCb);
    }

    // ---------- 8. 获取广告配置 ----------

    /**
     * 获取广告配置（无需认证）
     * 渠道未配置或已禁用时 data 为空，客户端需降级处理
     * @param channel 广告渠道代码，缺省 wechat（AdMob 为 admob，其他渠道用后台创建的代码）
     */
    public getAdConfig(channel?: string, cb?: (data: IAdConfigData | undefined) => void, errCb?: TApiErrCallback) {
        const params: TRequestParams = {};
        if (channel) {
            params.channel = channel;
        }
        this.request<IAdConfigData | null | undefined>(
            "/client/adconfig",
            params,
            (data) => {
                this._adConfig = data ?? null;
                if (!data) {
                    egf.Logger.warn("[ClientApi] adConfig empty, channel:", channel);
                } else {
                    egf.Logger.log("[ClientApi] adConfig:", data);
                }
                if (cb) {
                    cb(data ?? undefined);
                }
            },
            errCb,
        );
    }

    // ---------- 9. 玩家存档(key-value) ----------

    /**
     * 保存存档（同 key 覆盖写入）
     * 约束：key ≤64 字节；value ≤65536 字节(64KB)；每玩家每游戏最多 500 个 key
     */
    public saveData(key: string, value: string, cb?: () => void, errCb?: TApiErrCallback) {
        this.request<unknown>("/client/savedata", { key, value }, cb, errCb);
    }

    /**
     * 读取存档（key 不存在时 errcode 0 且 data 为空）
     */
    public getData(key: string, cb?: (data?: ISaveDataItem) => void, errCb?: TApiErrCallback) {
        this.request<ISaveDataItem | undefined>("/client/getdata", { key }, cb, errCb);
    }

    /**
     * 删除存档（删除不存在的 key 同样返回成功，幂等）
     */
    public deleteData(key: string, cb?: () => void, errCb?: TApiErrCallback) {
        this.request<unknown>("/client/delsavedata", { key }, cb, errCb);
    }

    /**
     * 读取全部存档
     */
    public getAllData(cb?: (data: IAllData) => void, errCb?: TApiErrCallback) {
        this.request<IAllData>("/client/getalldata", {}, cb, errCb);
    }

    // ---------- 11. 玩家邮件 ----------

    /**
     * 11.1 邮件列表（只返回摘要，按 created_at desc 稳定排序）
     * @param page 页码，缺省 1
     * @param limit 每页数量，缺省 20，上限 100
     */
    public getMailList(
        page: number = 1,
        limit: number = 20,
        cb?: (data: IMailListData) => void,
        errCb?: TApiErrCallback,
    ) {
        this.request<IMailListData>("/client/mail/list", { page, limit }, cb, errCb);
    }

    /**
     * 11.2 读取邮件（幂等标记当前玩家已读）
     * 邮件不可见、属于其他玩家或游戏、已被当前玩家删除时返回 10060
     * @param mailId 邮件 ID，必须为正十进制字符串
     */
    public readMail(mailId: string, cb?: (data: IMailDetail) => void, errCb?: TApiErrCallback) {
        this.request<IMailDetail>("/client/mail/read", { mail_id: mailId }, cb, errCb);
    }

    /**
     * 11.3 领取邮件附件（重复请求返回同一流水，不会重复发放）
     * 并发处理中返回 10044；道具不存在或停用返回 10043；没有附件返回 10063
     * @param mailId 邮件 ID，必须为正十进制字符串
     */
    public claimMail(mailId: string, cb?: (data: IMailClaimData) => void, errCb?: TApiErrCallback) {
        this.request<IMailClaimData>("/client/mail/claim", { mail_id: mailId }, cb, errCb);
    }

    /**
     * 11.4 批量删除邮件（成功返回本次新增删除数）
     * 存在不可见邮件返回 10060；存在尚未领取的附件返回 10062；这两类失败都不会删除本批其他邮件
     * @param mailIds 1–100 个互不重复的合法邮件 ID
     */
    public deleteMails(mailIds: string[], cb?: (data: IMailDeleteData) => void, errCb?: TApiErrCallback) {
        this.request<IMailDeleteData>("/client/mail/delete", { mail_ids: mailIds }, cb, errCb);
    }

    // ---------- 12. 每日任务 ----------

    /** 获取当天任务；使用响应的北京时间业务日和服务端重置时间，不依赖设备日期。 */
    public getTaskList(cb?: (data: ITaskListData) => void, errCb?: TApiErrCallback) {
        this.request<ITaskListData>("/client/task/list", {}, cb, errCb);
    }

    /**
     * 声明任务完成，只保存完成记录和奖励快照，不发放奖励；领奖需另行调用 claimTask。
     * 重试必须沿用同一 taskId/taskDate；已完成记录支持跨日重放，返回 replay=true 且保留领取状态。
     * 未领取时 reward_result 为空结果，不代表玩家当前余额；10066/10067 需刷新任务。
     * @param taskId 列表中的任务 ID
     * @param taskDate 列表中的 task_date（Asia/Shanghai，YYYY-MM-DD），不可在重试时改为设备当天日期
     */
    public completeTask(
        taskId: string,
        taskDate: string,
        cb?: (data: ITaskCompleteData) => void,
        errCb?: TApiErrCallback,
    ) {
        this.request<ITaskCompleteData>("/client/task/complete", { task_id: taskId, task_date: taskDate }, cb, errCb);
    }

    /**
     * 领取已完成任务奖励，按完成时保存的奖励快照发放，支持跨日领取。
     * 重试必须沿用同一 taskId/taskDate；成功重放返回 replay=true 和首次领取时的余额结果，不重复发奖。
     * reward_result 是余额快照，调用方不得将其作为增量累加；未完成返回 10072。
     * 10044 可用相同请求稍后重试；10069/10070 不立即重试。
     * @param taskId 完成记录中的任务 ID
     * @param taskDate 完成记录原始的 task_date（Asia/Shanghai，YYYY-MM-DD），跨日后仍须保留
     */
    public claimTask(taskId: string, taskDate: string, cb?: (data: ITaskClaimData) => void, errCb?: TApiErrCallback) {
        this.request<ITaskClaimData>("/client/task/claim", { task_id: taskId, task_date: taskDate }, cb, errCb);
    }

    // ---------- 13. 更多游戏 ----------

    /** 获取当前游戏配置的上架推荐；无需登录，列表顺序由服务端确定。 */
    public getMoreGames(cb?: (data: IMoreGamesData) => void, errCb?: TApiErrCallback) {
        this.request<IMoreGamesData>("/client/more-games", {}, cb, errCb, true);
    }
}
