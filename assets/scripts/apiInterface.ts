// ==================== 新 API (client-api.md) 接口定义 ====================

/**
 * 通用响应格式
 */
export interface IApiResponse<T = any> {
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
    uid: string;
    /**
     * 昵称
     */
    nickname: string;
    /**
     * 头像 URL
     */
    avatar: string;
    /**
     * 等级
     */
    level: number;
    /**
     * 金币/金钱
     */
    money: number;
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
