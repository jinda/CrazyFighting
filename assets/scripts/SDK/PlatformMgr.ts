import { sys } from "cc";
import { SDKBase, SDKInterface } from "./SDKInterface";
import { IWeChat } from "./IWeChat";
import { ITT } from "./ITT";
import { IAndroid } from "./IAndroid";
import { LocalDataMgr } from "../LocalDataMgr";

export enum EPlatform {
    Unkown = 0,
    WeChat = 1,
    TT = 2,
    Android = 3,
}

export const PlatformStr = {
    [EPlatform.Unkown]: "h5",
    [EPlatform.WeChat]: "wechat",
    [EPlatform.TT]: "tt",
    [EPlatform.Android]: "Android",
};

class PlatformManager {
    private static _inst: PlatformManager;
    public static isInitFinished: boolean = false;
    public static get inst(): PlatformManager {
        if (this._inst == null) {
            this._inst = new PlatformManager();
        }
        return this._inst;
    }
    private _platform: number = 0; // 平台标识
    private _sdkInterface: SDKInterface | null = null;

    public set platform(v: number) {
        this._platform = v;
    }

    public get platform(): number {
        return this._platform;
    }

    // 初始化
    public init(cb?: Function): void {
        if (sys.platform == sys.Platform.WECHAT_GAME) {
            this.platform = EPlatform.WeChat;
        } else if (sys.platform == sys.Platform.BYTEDANCE_MINI_GAME) {
            this.platform = EPlatform.TT;
        } else if (sys.platform == sys.Platform.ANDROID) {
            this.platform = EPlatform.Android;
        } else {
            this.platform = EPlatform.Unkown;
        }

        if (sys.os === sys.OS.ANDROID && sys.isNative) {
            this._sdkInterface = new IAndroid();
        } else {
            switch (this.platform) {
                case EPlatform.WeChat:
                    this._sdkInterface = new IWeChat();
                    break;
                case EPlatform.TT:
                    this._sdkInterface = new ITT();
                    break;
                case EPlatform.Android:
                    this._sdkInterface = new IAndroid();
                    break;
                default:
                    this._sdkInterface = new SDKBase();
                    break;
            }
        }

        if (this._sdkInterface) {
            this._sdkInterface.init(null, cb);
        }

        egf.Logger.log("PlatformMgr load finish:", sys.platform, this.platform);
        PlatformManager.isInitFinished = true;
    }

    /**
     * 初始化广告（激励视频、插屏等），使用服务端下发的广告配置
     * @param params 广告配置数据
     */
    public initAd(params?: any) {
        this._sdkInterface?.initAd(params);
    }

    /**
     * 显示激励广告
     * @param startCb 开始播放回调
     * @param endCb 完成播放回调
     */
    public showRewardedVideo(startCb: Function, endCb?: Function) {
        //暂停游戏
        egf.EventMgr.emit("GamePause");
        egf.AudioMgr.pause();
        this._sdkInterface?.showRewardedVideo(
            () => {
                startCb && startCb();
            },
            (bSuccess: boolean) => {
                //恢复游戏
                egf.AudioMgr.resume();
                endCb && endCb(bSuccess);
            },
        );
    }

    /**
     * 显示插屏广告
     */
    public showInterstitialAd(startCb: Function, endCb?: Function) {
        this._sdkInterface?.showInterstitialAd(startCb, endCb);
    }

    /**
     * 设置 banner 广告显示/隐藏
     * @param visible true=显示, false=隐藏
     * @param position banner 位置 (EBannerPosition, 默认底部)
     * @param cb 操作结果回调 (isSuccess: boolean)
     */
    public setBannerAd(visible: boolean, position?: number, cb?: Function) {
        this._sdkInterface?.setBannerAd(visible, position, cb);
    }

    /**
     * 判断指定类型广告是否已加载
     * @param type 广告类型 (EAdType)
     * @param cb 结果回调 (isLoaded: boolean)
     */
    public checkAdLoaded(type: number, cb?: Function) {
        if (!this._sdkInterface) {
            cb && cb(false);
            return;
        }
        this._sdkInterface.checkAdLoaded(type, cb);
    }

    /**
     * 日志上报
     */
    public logEvent(params?: any) {
        this._sdkInterface?.logEvent(params);
    }
    /**
     * 事件上报
     */
    public reportEvent(name: string, params?: any) {
        this._sdkInterface?.reportEvent(name, params);
    }

    /**
     * 开始录屏
     */
    public setRecord(bRecord: boolean) {
        if (bRecord) {
            this._sdkInterface?.startRecord();
        } else {
            this._sdkInterface?.stopRecord();
        }
    }

    /**
     * 分享
     */
    public share(params?: any) {
        this._sdkInterface?.share(params);
    }

    public vibrate(time: number) {
        const shakeSwith = LocalDataMgr.Setting.shakeSwith;
        if (shakeSwith) {
            this._sdkInterface?.vibrate(time);
        }
    }

    public addSidebar() {
        this._sdkInterface?.addSidebar();
    }

    public checkScene(cb: Function) {
        this._sdkInterface?.checkScene(cb);
    }

    /**
     * 登录
     */
    public login(params?: any) {
        this._sdkInterface?.login(params);
    }
    /**
     * 授权
     */
    public authorize(params?: any) {
        this._sdkInterface?.authorize(params);
    }

    /**
     * 获取用户信息
     */
    public getUserInfo(params?: any) {
        this._sdkInterface?.getUserInfo(params);
    }

    /**
     * 上报排行榜数据
     */
    public setUserCloudStorage(params: any) {
        this._sdkInterface?.setUserCloudStorage(params);
    }
    /**
     * 获取上报排行榜数据
     * @param params
     */
    public getUserCloudStorage(params: any) {
        // 数据到服务器
        this._sdkInterface?.getUserCloudStorage(params);
    }

    /**
     * 向子域发送消息
     */
    public postMessage(params: any) {
        this._sdkInterface?.postMessage(params);
    }

    /**
     * 显示游戏圈
     */
    public showGameCircle() {
        this._sdkInterface?.openGameCircle();
    }

    /**
     * 打开系统设置界面
     */
    public openSystemSetting() {
        this._sdkInterface?.openSystemSetting();
    }
    //退出游戏
    public exitApp() {}
}

export const PlatformMgr = PlatformManager.inst;
