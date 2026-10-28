/** banner 广告位置 */
export enum EBannerPosition {
    /** 底部 */
    Bottom = 0,
    /** 顶部 */
    Top = 1,
}

/** 广告类型 */
export enum EAdType {
    /** 所有广告 */
    All = 0,
    /** 激励视频 */
    RewardedVideo = 1,
    /** 插屏 */
    Interstitial = 2,
    /** Banner */
    Banner = 3,
}

/** 安全区域（竖屏正方向下的 window 坐标系） */
export interface IPlatformSafeArea {
    /** 安全区域左上角横坐标 */
    left: number;
    /** 安全区域右下角横坐标 */
    right: number;
    /** 安全区域左上角纵坐标 */
    top: number;
    /** 安全区域右下角纵坐标 */
    bottom: number;
    /** 安全区域的宽度 */
    width: number;
    /** 安全区域的高度 */
    height: number;
}

/** 平台侧系统信息；字段由各平台接口提供，缺失时为 undefined */
export interface IPlatformSystemInfo {
    /** 手机品牌 */
    brand?: string;
    /** 手机型号 */
    model?: string;
    /** 设备像素比 */
    pixelRatio?: number;
    /** 屏幕宽度 */
    screenWidth?: number;
    /** 屏幕高度，单位px */
    screenHeight?: number;
    /** 可使用窗口宽度，单位px */
    windowWidth?: number;
    /** 可使用窗口高度，单位px */
    windowHeight?: number;
    /** 状态栏的高度，单位px */
    statusBarHeight?: number;
    /** 系统语言，如 zh_CN / zh-CN */
    language?: string;
    /** 客户端基础库版本 */
    coreVersion?: string;
    /** 操作系统版本，如 iOS 15.0 / Android 12 */
    system?: string;
    /** 客户端平台，如 ios / android / devtools */
    platform?: string;
    /** 是否有摄像头权限 */
    cameraAuthorized?: boolean;
    /** 是否有定位权限 */
    locationAuthorized?: boolean;
    /** 是否有麦克风权限 */
    microphoneAuthorized?: boolean;
    /** 是否有通知权限 */
    notificationAuthorized?: boolean;
    /** 地理位置系统开关是否打开 */
    locationEnabled?: boolean;
    /** Wi-Fi 系统开关是否打开 */
    wifiEnabled?: boolean;
    /** 在竖屏正方向下的安全区域，window 坐标系 */
    safeArea?: IPlatformSafeArea;
}

export interface SDKInterface {
    init(params?: any, cb?: Function): boolean;
    initAd(params?: any): boolean;
    /**
     * 获取平台系统信息（含语言）
     * @returns 平台返回的系统信息；当前环境不支持时返回 null
     */
    getSystemInfo(): IPlatformSystemInfo | null;
    showRewardedVideo(startCb?: Function, endCb?: Function): void;
    showInterstitialAd(startCb?: Function, endCb?: Function): void;
    /**
     * 设置 banner 广告显示/隐藏
     * @param visible true=显示, false=隐藏
     * @param position banner 位置 (EBannerPosition, 默认底部)
     * @param cb 操作结果回调 (isSuccess: boolean)
     */
    setBannerAd(visible: boolean, position?: number, cb?: Function): void;
    /**
     * 判断指定类型广告是否已加载
     * @param type 广告类型 (EAdType)
     * @param cb 结果回调 (isLoaded: boolean)
     */
    checkAdLoaded(type: number, cb?: Function): void;
    startRecord(): void;
    stopRecord(): void;
    shareVideo(): void;
    share(params?: any): void;
    vibrate(time: number): void;
    realNameAuth(): void;
    addDesktop(): void;
    addSidebar(): void;
    checkScene(cb: Function): void;
    login(params?: any): void;
    authorize(params?: any): void;
    setUserCloudStorage(params?: any): void;
    getUserCloudStorage(params?: any): void;
    getUserInfo(params?: any): void;
    postMessage(params?: any): void;
    logEvent(params?: any): void;
    reportEvent(name: string, params?: any): void;
    openGameCircle(url?: string): void;
    openSystemSetting(): void;
}

export class SDKBase implements SDKInterface {
    protected _bShared: boolean = false;
    protected _bTimeline: boolean = false;
    protected _shareTag: string = "";
    protected _closeTime: number = 0;
    protected _startCb: Function | null = null;
    protected _endCb: Function | null = null;
    protected _videoAd: any = null;
    protected _interstitialAd: any = null;

    init(params?: any): boolean {
        return true;
    }
    initAd(params?: any): boolean {
        return true;
    }
    /**
     * 默认平台（H5）通过浏览器接口读取系统信息，不依赖引擎接口
     */
    getSystemInfo(): IPlatformSystemInfo | null {
        if (typeof navigator === "undefined") {
            return null;
        }
        const win = typeof window === "undefined" ? undefined : window;
        const nav = navigator as Navigator & { userAgentData?: { brands?: { brand: string }[] } };
        const screenWidth = win?.screen?.width ?? 0;
        const screenHeight = win?.screen?.height ?? 0;
        const windowWidth = win?.innerWidth ?? 0;
        const windowHeight = win?.innerHeight ?? 0;
        return {
            brand: nav.userAgentData?.brands?.[0]?.brand ?? "",
            model: "",
            pixelRatio: win?.devicePixelRatio ?? 1,
            screenWidth,
            screenHeight,
            windowWidth,
            windowHeight,
            statusBarHeight: 0,
            language: nav.language,
            coreVersion: "",
            system: nav.userAgent,
            platform: nav.platform,
            cameraAuthorized: false,
            locationAuthorized: false,
            microphoneAuthorized: false,
            notificationAuthorized: false,
            locationEnabled: false,
            wifiEnabled: false,
            safeArea: {
                left: 0,
                right: windowWidth,
                top: 0,
                bottom: windowHeight,
                width: windowWidth,
                height: windowHeight,
            },
        };
    }
    showRewardedVideo(startCb: Function, endCb?: Function): void {
        egf.Logger.log("已经获得游戏奖励");
        endCb && endCb(true);
    }
    showInterstitialAd(startCb: Function, endCb?: Function): void {
        egf.Logger.log("已经展示插屏广告");
        endCb && endCb(true);
    }

    setBannerAd(visible: boolean, position?: number, cb?: Function): void {
        // 默认平台（H5）不支持 banner 广告，直接回调成功
        cb && cb(true);
    }

    checkAdLoaded(type: number, cb?: Function): void {
        // 默认平台（H5）无广告，直接回调未加载
        cb && cb(false);
    }

    startRecord(): void { }
    stopRecord(): void { }
    shareVideo(): void { }
    share(params?: any): void { }
    vibrate(time: number): void { }
    realNameAuth(): void { }
    addDesktop(): void { }
    addSidebar(): void { }
    checkScene(cb: Function): void { }
    login(params?: any): void {
        const successCb = params.successCb;
        successCb && successCb("123456");
    }
    authorize(params?: any): void {
        const successCb = params.successCb;
        successCb && successCb("123456");
    }
    setUserCloudStorage(params?: any): void { }
    getUserCloudStorage(params?: any): void { }
    getUserInfo(params?: any): void { }
    postMessage(params?: any): void { }
    logEvent(params?: any): void { }
    reportEvent(name: string, params?: any): void { }
    openGameCircle(url?: string): void { }
    openSystemSetting(): void { }
}
