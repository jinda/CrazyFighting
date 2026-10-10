// ==================== 新 API (client-api.md) 接口定义 ====================

/**
 * 通用响应格式
 */
export interface IApiResponse<T = unknown> {
    /**
     * 错误码: 0=成功
     */
    errcode: number;
    /**
     * 错误信息
     */
    errmsg: string;
    /**
     * 数据
     */
    data: T;
}

/**
 * 玩家信息
 */
export interface IUserInfo {
    /**
     * 玩家唯一 ID
     */
    uid?: string;
    /**
     * 昵称
     */
    nickname?: string;
    /**
     * 头像 URL
     */
    avatar?: string;
    /**
     * 等级
     */
    level: number;
    /**
     * 金币/金钱
     */
    money: number;
    /**
     * 金币（整数，资源账本中的 coin）
     */
    coin?: number;
}

/**
 * 登录响应数据
 */
export interface ILoginData {
    /**
     * JWT token
     */
    token: string;
    /**
     * 玩家信息
     */
    user_info: IUserInfo;
    /**
     * true=自动注册, false=已存在
     */
    is_new: boolean;
}

/**
 * 前台/后台会话状态
 */
export enum ESessionStatus {
    /**
     * 前台会话正在计时
     */
    Active = "active",
    /**
     * 已配对结束并记录时长
     */
    Completed = "completed",
    /**
     * 未结束会话已被新前台替换，不计入时长
     */
    Discarded = "discarded",
    /**
     * 后台请求没有匹配的会话，已忽略
     */
    Ignored = "ignored",
}

/**
 * 游戏进入前台 / 后台上报响应数据
 */
export interface ISessionData {
    /**
     * 会话 ID（回显本次上报的 UUID）
     */
    session_id: string;
    /**
     * 会话状态，见 ESessionStatus
     */
    status: string;
}

/**
 * 玩法榜单列表项
 */
export interface ILeaderboardMode {
    /**
     * 玩法标识
     */
    mode: string;
    /**
     * 玩法名称
     */
    name: string;
    /**
     * 开启的周期: 1=日榜 2=周榜 3=月榜 4=总榜
     */
    periods: number[];
    /**
     * 计分类型: 0=自定义分数 1=最高关（客户端按此决定 pushScore 的 score 传什么）
     */
    score_type: number;
}

/**
 * 玩法榜单列表响应数据
 */
export interface ILeaderboardsData {
    list: ILeaderboardMode[];
}

/**
 * 上传分数响应数据
 */
export interface IPushScoreResp {
    /**
     * 玩法标识
     */
    mode: string;
    /**
     * 分数
     */
    score: number;
    /**
     * 各开启周期的当前排名 (key: daily/weekly/monthly/alltime, 1-based)
     */
    ranks: { [key: string]: number };
}

/**
 * 排行榜条目
 */
export interface ILeaderboardEntry {
    /**
     * 玩家 UID (string)
     */
    uid: string;
    /**
     * 玩家昵称
     */
    nickname: string;
    /**
     * 玩家头像 URL
     */
    avatar: string;
    /**
     * 分数
     */
    score: number;
    /**
     * 排名 (1-based)
     */
    rank: number;
}

/**
 * 排行榜响应数据
 */
export interface ILeaderboardData {
    list: ILeaderboardEntry[];
    my: ILeaderboardEntry;
}

/**
 * 广告配置数据
 */
export interface IAdConfigData {
    /**
     * 激励视频广告单元 ID
     */
    reward_video_ad_id: string;
    /**
     * 插屏广告单元 ID
     */
    interstitial_ad_id: string;
    /**
     * Banner 广告单元 ID
     */
    banner_ad_id: string;
}

/**
 * 存档条目
 */
export interface ISaveDataItem {
    /**
     * 存档 key
     */
    key: string;
    /**
     * 存档内容 (JSON 字符串等)
     */
    value: string;
}

/**
 * 全部存档响应数据
 */
export interface IAllData {
    list: ISaveDataItem[];
}

/**
 * 计分类型
 */
export enum EScoreType {
    /**
     * 自定义分数榜
     */
    Custom = 0,
    /**
     * 最高关榜
     */
    MaxLevel = 1,
}

/**
 * 资源类型
 */
export enum EResourceType {
    /**
     * 金币（整数）
     */
    Coin = "coin",
    /**
     * 体力
     */
    Stamina = "stamina",
    /**
     * 道具（需同时传 item_id）
     */
    Item = "item",
}

/**
 * 接口失败回调
 * errcode 为服务端错误码；网络层失败时为 -1
 */
export type TApiErrCallback = (errcode: number, errmsg: string) => void;

/**
 * 请求参数（POST JSON Body / GET Query 通用）
 */
export type TRequestParams = { [key: string]: unknown };

/**
 * GET 请求 Query 参数
 */
export type TQueryParams = { [key: string]: string | number | boolean };

/**
 * 上报通关进度响应数据
 */
export interface IProgressCompleteData {
    /**
     * 持久化后的历史最高关
     */
    level: number;
    /**
     * 各最高关玩法(score_type=1)及其已配置周期的当前排名
     * key 为 mode, 值为 { daily/weekly/monthly/alltime: 排名 }
     */
    ranks?: { [mode: string]: { [period: string]: number } };
}

/**
 * 上报游戏事件响应数据
 */
export interface IReportEventData {
    /**
     * 回显本次上报的幂等 ID
     */
    event_id: string;
    /**
     * true=重试/重复上报，保留首次写入的内容
     */
    duplicate: boolean;
}

/**
 * 查询资源响应数据
 */
export interface IResourceData {
    /**
     * 金币（整数）
     */
    coin: number;
    /**
     * 当前体力（已含自然恢复结算）
     */
    stamina: number;
    /**
     * 体力上限
     */
    stamina_max: number;
    /**
     * 体力恢复间隔（秒）
     */
    stamina_recover_seconds: number;
    /**
     * 下次恢复 1 点体力的 unix 秒；满体力时为 0
     */
    stamina_next_regen_at: number;
    /**
     * 道具背包（数量 > 0 的条目）
     */
    items: IResourceItem[];
}

/**
 * 资源道具条目
 */
export interface IResourceItem {
    /**
     * 道具标识
     */
    item_id: string;
    /**
     * 道具名称
     */
    name: string;
    /**
     * 数量
     */
    num: number;
}

/**
 * 消耗资源请求参数
 */
export interface IConsumeResourceParams {
    /**
     * 客户端生成的幂等键（≤64，如 uuid），重复请求返回相同结果不重复扣
     */
    req_id: string;
    /**
     * 资源类型，见 EResourceType
     */
    type: EResourceType | string;
    /**
     * 消耗数量，1 ~ 1e9
     */
    amount: number;
    /**
     * 道具标识，type=item 时必填
     */
    item_id?: string;
    /**
     * 场景标识（≤32，仅审计，如 level_enter）
     */
    scene?: string;
}

/**
 * 消耗资源响应数据
 * coin/stamina 返回 balance；item 返回 num
 */
export interface IConsumeResourceData {
    /**
     * 消耗后的余额（coin/stamina）
     */
    balance?: number;
    /**
     * 消耗后的道具数量（item）
     */
    num?: number;
}

/**
 * 上报获得金币响应数据
 */
export interface IGainCoinData {
    /**
     * 发放后的金币余额
     */
    coin: number;
}

/**
 * 兑换码兑换响应数据（发放清单）
 */
export interface IRedeemCodeData {
    /**
     * 发放的金币
     */
    coin?: number;
    /**
     * 发放的体力
     */
    stamina?: number;
    /**
     * 发放的道具 (key: 道具标识)
     */
    items?: { [itemId: string]: number };
}

/**
 * 邮件摘要（列表项，不含正文与附件明细）
 */
export interface IMailSummary {
    /**
     * 邮件 ID（正十进制字符串，不能当 JSON number 传）
     */
    id: string;
    /**
     * 标题
     */
    title: string;
    /**
     * 发件人
     */
    sender: string;
    /**
     * 是否带附件
     */
    has_rewards: boolean;
    /**
     * 是否已读
     */
    is_read: boolean;
    /**
     * 附件是否已领取
     */
    is_claimed: boolean;
    /**
     * 创建时间，如 "2026-09-15 12:00:00"
     */
    created_at: string;
}

/**
 * 邮件列表响应数据
 */
export interface IMailListData {
    /**
     * 邮件总数
     */
    total: number;
    /**
     * 当前页码
     */
    page: number;
    /**
     * 每页数量
     */
    limit: number;
    /**
     * 邮件摘要列表（按 created_at desc 稳定排序）
     */
    list: IMailSummary[];
}

/**
 * 邮件附件条目
 */
export interface IMailReward {
    /**
     * 奖励 key（道具标识 / 资源标识）
     */
    key: string;
    /**
     * 奖励数量
     */
    value: number;
}

/**
 * 邮件详情响应数据
 */
export interface IMailDetail {
    /**
     * 邮件 ID
     */
    id: string;
    /**
     * 标题
     */
    title: string;
    /**
     * 正文
     */
    content: string;
    /**
     * 发件人
     */
    sender: string;
    /**
     * 附件明细
     */
    rewards: IMailReward[];
    /**
     * 是否已读
     */
    is_read: boolean;
    /**
     * 附件是否已领取
     */
    is_claimed: boolean;
    /**
     * 创建时间
     */
    created_at: string;
}

/**
 * 领取邮件附件响应数据
 */
export interface IMailClaimData {
    /**
     * 实际发放的道具 (key: 道具标识)
     */
    items: { [itemId: string]: number };
}

/**
 * 批量删除邮件响应数据
 */
export interface IMailDeleteData {
    /**
     * 本次新增删除数（重复删除不计入）
     */
    deleted_count: number;
}

/**
 * 服务端错误码（对应 client-api.md 的错误码表）
 */
export enum EApiErrcode {
    /**
     * 成功
     */
    Success = 0,
    /**
     * 未登录/token 无效
     */
    NotLogin = 2,
    /**
     * 系统繁忙
     */
    SystemBusy = 10000,
    /**
     * 参数错误
     */
    ParamError = 10001,
    /**
     * 用户不存在
     */
    UserNotExist = 10004,
    /**
     * 该登录方式未配置
     */
    LoginTypeNotConfigured = 10007,
    /**
     * 第三方登录校验失败
     */
    ThirdPartyLoginFailed = 10008,
    /**
     * 资源余额不足
     */
    NotEnoughResource = 10031,
    /**
     * 账号已冻结
     */
    AccountFrozen = 10034,
    /**
     * 兑换码不存在或已失效
     */
    RedeemCodeInvalid = 10040,
    /**
     * 兑换码已被使用（同一玩家）
     */
    RedeemCodeUsed = 10041,
    /**
     * 兑换码已被兑换完
     */
    RedeemCodeExhausted = 10042,
    /**
     * 道具不存在或未配置
     */
    ItemNotExist = 10043,
    /**
     * 请求正在处理中，请稍后重试（复用同一请求体与幂等键重试）
     */
    Processing = 10044,
    /**
     * 邮件不存在或不可用
     */
    MailNotExist = 10060,
    /**
     * 邮件附件尚未领取
     */
    MailUnclaimed = 10062,
    /**
     * 邮件无可领取附件
     */
    MailNoReward = 10063,
    /**
     * 前台会话创建过于频繁，请稍后重试
     */
    SessionTooFrequent = 10064,
}
