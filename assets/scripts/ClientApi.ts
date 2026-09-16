import { GetEnvConfig } from "./config/EnvConfig";
import {
    IAdConfigData,
    IApiResponse,
    ILeaderboardData,
    ILoginData,
    IPushScoreResp,
    ISaveDataItem,
    IUserInfo,
} from "./apiInterface";
import { EPlatform, PlatformMgr } from "./SDK/PlatformMgr";

/**
 * 客户端 API 客户端（对应 client-api.md）
 * Base URL: http://{host}:10001/client
 * 通用 Header: X-Game-Code, Content-Type, Authorization: Bearer {token}
 */
export class ClientApi {
    private static _inst: ClientApi;
    public static get inst(): ClientApi {
        if (this._inst == null) {
            this._inst = new ClientApi();
        }
        return this._inst;
    }

    private _gameCode: string = "default";
    private _token: string = "";
    private _userInfo: IUserInfo | null = null;
    private _adConfig: IAdConfigData | null = null;

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
     * 统一 POST 请求封装
     */
    private request(
        uri: string,
        params: any = {},
        cb?: (data: any) => void,
        errCb?: (errcode: number, errmsg: string) => void,
    ) {
        if (PlatformMgr.platform == EPlatform.Android) {
            return;
        }
        egf.HttpMgr.post(
            uri,
            params,
            (resp: IApiResponse) => {
                if (resp && resp.errcode == 0) {
                    cb && cb(resp.data);
                } else {
                    egf.Logger.error(`[ClientApi] ${uri} error:`, resp?.errcode, resp?.errmsg);
                    errCb && errCb(resp?.errcode, resp?.errmsg);
                }
            },
            (err: any) => {
                egf.Logger.error(`[ClientApi] ${uri} request failed:`, err);
                errCb && errCb(-1, "网络请求失败");
            },
        );
    }

    // ---------- 1. 登录 / 注册 ----------

    /**
     * uid 登录（自动注册）
     */
    public login(
        uid: number,
        nickname?: string,
        avatar?: string,
        cb?: (data: ILoginData) => void,
        errCb?: (errcode: number, errmsg: string) => void,
    ) {
        const params: any = { uid };
        if (nickname) params.nickname = nickname;
        if (avatar) params.avatar = avatar;
        this.request(
            "/client/login",
            params,
            (data) => {
                this.handleLoginData(data);
                cb && cb(data);
            },
            errCb,
        );
    }

    /**
     * 多渠道登录（游客/微信/Google/Apple）
     */
    public oauthLogin(
        loginType: string,
        extra: any = {},
        nickname?: string,
        avatar?: string,
        cb?: (data: ILoginData) => void,
        errCb?: (errcode: number, errmsg: string) => void,
    ) {
        const params: any = { login_type: loginType, ...extra };
        if (nickname) params.nickname = nickname;
        if (avatar) params.avatar = avatar;
        this.request(
            "/client/oauthlogin",
            params,
            (data) => {
                this.handleLoginData(data);
                cb && cb(data);
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

    // ---------- 2. 获取玩家信息 ----------

    /**
     * 获取玩家信息（POST 方式）
     */
    public getUserInfo(
        uid?: number,
        cb?: (data: IUserInfo) => void,
        errCb?: (errcode: number, errmsg: string) => void,
    ) {
        const params: any = {};
        if (uid) params.uid = uid;
        this.request(
            "/client/userinfo",
            params,
            (data) => {
                this._userInfo = data;
                cb && cb(data);
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
    public updateProfile(
        nickname?: string,
        avatar?: string,
        cb?: () => void,
        errCb?: (errcode: number, errmsg: string) => void,
    ) {
        const params: any = {};
        if (nickname !== undefined && nickname !== "") {
            params.nickname = nickname;
        }
        if (avatar !== undefined) {
            params.avatar = avatar;
        }
        this.request(
            "/client/updateprofile",
            params,
            (data) => {
                // 服务端更新成功后，同步本地缓存
                if (this._userInfo) {
                    if (nickname) this._userInfo.nickname = nickname;
                    if (avatar !== undefined) this._userInfo.avatar = avatar;
                }
                cb && cb();
            },
            errCb,
        );
    }

    // ---------- 3. 获取玩法榜单列表 ----------

    /**
     * 获取当前游戏所有启用中的玩法及开启的周期
     */
    public getLeaderboards(
        cb?: (data: { list: Array<{ mode: string; name: string; periods: number[] }> }) => void,
        errCb?: (errcode: number, errmsg: string) => void,
    ) {
        this.request("/client/leaderboards", {}, cb, errCb);
    }

    // ---------- 4. 上传分数 ----------

    /**
     * 上传分数（写入该玩法所有开启周期的榜单）
     */
    public pushScore(
        mode: string,
        score: number,
        cb?: (data: IPushScoreResp) => void,
        errCb?: (errcode: number, errmsg: string) => void,
    ) {
        this.request("/client/pushscore", { mode, score }, cb, errCb);
    }

    // ---------- 5. 获取排行榜 ----------

    /**
     * 获取排行榜
     * @param mode 玩法标识
     * @param type 周期类型: 1=日榜 2=周榜 3=月榜 4=总榜
     * @param top 返回前 N 名，默认 50，上限 100
     */
    public getLeaderboard(
        mode: string,
        type: number,
        top: number = 50,
        cb?: (data: ILeaderboardData) => void,
        errCb?: (errcode: number, errmsg: string) => void,
    ) {
        this.request("/client/leaderboard", { mode, type, top }, cb, errCb);
    }

    // ---------- 6. 获取广告配置 ----------

    /**
     * 获取广告配置（无需认证）
     */
    public getAdConfig(
        channel?: string,
        cb?: (data: IAdConfigData) => void,
        errCb?: (errcode: number, errmsg: string) => void,
    ) {
        this.request(
            "/client/adconfig",
            { channel },
            (data) => {
                this._adConfig = data;
                egf.Logger.log("[ClientApi] adConfig:", data);
                cb && cb(data);
            },
            errCb,
        );
    }

    // ---------- 7. 玩家存档(key-value) ----------

    /**
     * 保存存档（同 key 覆盖写入）
     */
    public saveData(key: string, value: string, cb?: () => void, errCb?: (errcode: number, errmsg: string) => void) {
        this.request("/client/savedata", { key, value }, cb, errCb);
    }

    /**
     * 读取存档（key 不存在时 data 为空缺省）
     */
    public getData(key: string, cb?: (data: ISaveDataItem) => void, errCb?: (errcode: number, errmsg: string) => void) {
        this.request("/client/getdata", { key }, cb, errCb);
    }

    /**
     * 删除存档（幂等）
     */
    public deleteData(key: string, cb?: () => void, errCb?: (errcode: number, errmsg: string) => void) {
        this.request("/client/delsavedata", { key }, cb, errCb);
    }

    /**
     * 读取全部存档
     */
    public getAllData(
        cb?: (data: { list: ISaveDataItem[] }) => void,
        errCb?: (errcode: number, errmsg: string) => void,
    ) {
        this.request("/client/getalldata", {}, cb, errCb);
    }
}
