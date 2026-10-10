import { GetEnvConfig } from "./config/EnvConfig";
import {
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
    IProgressCompleteData,
    IPushScoreResp,
    IRedeemCodeData,
    IReportEventData,
    IResourceData,
    ISaveDataItem,
    ISessionData,
    IUserInfo,
    TApiErrCallback,
    TQueryParams,
    TRequestParams,
} from "./apiInterface";
import { EPlatform, PlatformMgr } from "./SDK/PlatformMgr";

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

    public get adConfig(): IAdConfigData {
        return this._adConfig!;
    }

    /**
     * 初始化：读取配置中的 game_code 并设置 X-Game-Code Header
     */
    public init() {
        const { url, game_code } = GetEnvConfig();
        if (game_code) {
            this._gameCode = game_code;
        }
        egf.HttpMgr.server = url;
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
        }
        egf.Logger.log("[ClientApi] setToken:", this._token.slice(0, 30) + "...");
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
        if (PlatformMgr.platform === EPlatform.Android) {
            return;
        }

        const onComplete = (resp: IApiResponse) => {
            if (resp && resp.errcode === 0) {
                if (cb) {
                    cb(resp.data as T);
                }
                return;
            }
            egf.Logger.error(`[ClientApi] ${uri} error:`, resp?.errcode, resp?.errmsg);
            if (errCb) {
                errCb(resp?.errcode, resp?.errmsg);
            }
        };

        const onError = (err: unknown) => {
            egf.Logger.error(`[ClientApi] ${uri} request failed:`, err);
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
     * 多渠道登录（游客/微信/Google/Apple）
     * @param loginType guest / wechat / google / apple
     * @param extra 各渠道必填参数：guest=device_id；wechat=code；google=id_token；apple=identity_token
     */
    public oauthLogin(
        loginType: string,
        extra: TRequestParams = {},
        nickname?: string,
        avatar?: string,
        cb?: (data: ILoginData) => void,
        errCb?: TApiErrCallback,
    ) {
        const params: TRequestParams = { login_type: loginType, ...extra };
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
            this._token = data.token || "";
            this._userInfo = data.user_info || null;
            if (this._token) {
                egf.HttpMgr.addHeaders("Authorization", `Bearer ${this._token}`);
            }
            egf.Logger.log("[ClientApi] login success is_new:", data.is_new, "uid:", data.user_info?.uid);
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
     * @param sessionId 会话 UUID（可用 ClientApi.createSessionId 生成）
     */
    public foreground(cb?: (data: ISessionData) => void, errCb?: TApiErrCallback) {
        this._sessionId = ClientApi.createSessionId();
        this.request<ISessionData>("/client/foreground", { session_id: this._sessionId }, cb, errCb);
    }

    /**
     * 上报游戏进入后台（需要登录 token）
     * 前台上报成功收到响应后，进入后台时用同一个 session_id 调用；请求失败重试沿用原 UUID
     * @param sessionId 与前台上报一致的会话 UUID
     */
    public background(cb?: (data: ISessionData) => void, errCb?: TApiErrCallback) {
        this.request<ISessionData>("/client/background", { session_id: this._sessionId }, cb, errCb);
    }

    // ---------- 2. 获取玩家信息 ----------

    /**
     * 获取玩家信息（POST 方式）
     * @param uid 玩家 UID；不传时服务端从 Authorization token 派生
     */
    public getUserInfo(uid?: string, cb?: (data: IUserInfo) => void, errCb?: TApiErrCallback) {
        const params: TRequestParams = {};
        if (uid) {
            params.uid = uid;
        }
        this.request<IUserInfo>(
            "/client/userinfo",
            params,
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
     * score_type 决定 pushScore 传什么：0=自定义分数、1=最高关
     */
    public getLeaderboards(cb?: (data: ILeaderboardsData) => void, errCb?: TApiErrCallback) {
        this.request<ILeaderboardsData>("/client/leaderboards", {}, cb, errCb);
    }

    // ---------- 4. 上传分数 ----------

    /**
     * 上传分数（写入该玩法所有开启周期的榜单）
     * 服务器只保留历史最高分；低分上报被忽略但仍返回当前排名
     * @param mode 玩法标识
     * @param score score_type=0 传自定义分数；score_type=1 传当前最高关（整数，如 52）
     */
    public pushScore(mode: string, score: number, cb?: (data: IPushScoreResp) => void, errCb?: TApiErrCallback) {
        this.request<IPushScoreResp>("/client/pushscore", { mode, score }, cb, errCb);
    }

    // ---------- 4.1 上报通关进度 ----------

    /**
     * 上报通关进度：更新历史最高关，并同步当前游戏全部启用的最高关榜（score_type=1）
     * 较低/重复/跳关上报按只增不减处理；失败时用相同或更低的 level 重试可补齐榜单
     * @param level 已通关关卡，范围 1..9006，必须是整数（不接受浮点数或字符串）
     */
    public completeProgress(level: number, cb?: (data: IProgressCompleteData) => void, errCb?: TApiErrCallback) {
        this.request<IProgressCompleteData>("/client/progress/complete", { level }, cb, errCb);
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

    // ---------- 5. 获取排行榜 ----------

    /**
     * 获取排行榜
     * my 为请求者自己的数据（rank 为全榜真实排名，不在前 N 也有值）
     * 该榜没有自己的分数时 my.score=0 且 my.rank=10000，客户端按此判断"未上榜"
     * @param mode 玩法标识
     * @param type 周期类型: 1=日榜 2=周榜 3=月榜 4=总榜
     * @param top 返回前 N 名，默认 50，上限 100
     */
    public getLeaderboard(
        mode: string,
        type: number,
        top: number = 50,
        cb?: (data: ILeaderboardData) => void,
        errCb?: TApiErrCallback,
    ) {
        this.request<ILeaderboardData>("/client/leaderboard", { mode, type, top }, cb, errCb);
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
    public getAdConfig(channel?: string, cb?: (data: IAdConfigData) => void, errCb?: TApiErrCallback) {
        const params: TRequestParams = {};
        if (channel) {
            params.channel = channel;
        }
        this.request<IAdConfigData>(
            "/client/adconfig",
            params,
            (data) => {
                this._adConfig = data;
                if (!data) {
                    egf.Logger.warn("[ClientApi] adConfig empty, channel:", channel);
                } else {
                    egf.Logger.log("[ClientApi] adConfig:", data);
                }
                if (cb) {
                    cb(data);
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
}
