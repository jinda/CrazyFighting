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

export interface SDKInterface {
    init(params?: any, cb?: Function): boolean;
    initAd(params?: any): boolean;
    showRewardedVideo(startCb: Function, endCb?: Function): void;
    showInterstitialAd(startCb: Function, endCb?: Function): void;
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

    startRecord(): void {}
    stopRecord(): void {}
    shareVideo(): void {}
    share(params?: any): void {}
    vibrate(time: number): void {}
    realNameAuth(): void {}
    addDesktop(): void {}
    addSidebar(): void {}
    checkScene(cb: Function): void {}
    login(params?: any): void {
        const successCb = params.successCb;
        successCb && successCb("123456");
    }
    authorize(params?: any): void {
        const successCb = params.successCb;
        successCb && successCb("123456");
    }
    setUserCloudStorage(params?: any): void {}
    getUserCloudStorage(params?: any): void {}
    getUserInfo(params?: any): void {}
    postMessage(params?: any): void {}
    logEvent(params?: any): void {}
    reportEvent(name: string, params?: any): void {}
    openGameCircle(url?: string): void {}
    openSystemSetting(): void {}
}
