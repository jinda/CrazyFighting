import { native, sys } from "cc";
import { EBannerPosition, SDKBase } from "./SDKInterface";

/**
 * Android 平台 SDK 接口实现
 * 对应 android_imp.md 规范
 */
export class IAndroid extends SDKBase {
    // Java 类全路径 (需与 AppActivity.java 一致)
    private static JAVA_CLASS = "com/cocos/game/AppActivity";

    init(params?: any, cb?: Function): boolean {
        egf.Logger.log("Android SDK Initializing...");
        // 注册原生初始化结果回调，等待原生平台异步回调
        (window as any).onAndroidInitCallback = (result: string) => {
            egf.Logger.log("Android Init Callback:", result);
            cb && cb(result);
        };
        this.callNative("init", "(Ljava/lang/String;)V", JSON.stringify(params || {}));
        return true;
    }

    /**
     * 显示激励视频广告
     */
    showRewardedVideo(startCb: Function, endCb?: Function): void {
        this._startCb = startCb;
        this._endCb = endCb!;

        // 注册开始回调
        (window as any).onAndroidVideoStart = () => {
            egf.Logger.log("Android Video Started");
            this._startCb && this._startCb();
        };

        // 注册结束回调
        (window as any).onAndroidVideoCallback = (isFinished: boolean) => {
            egf.Logger.log("Android Video Finished:", isFinished);
            this._endCb && this._endCb(isFinished);
        };

        this.callNative("showRewardedVideo", "()V");
    }

    /**
     * 显示插屏广告
     */
    showInterstitialAd(startCb: Function, endCb?: Function): void {
        this._startCb = startCb;
        this._endCb = endCb!;

        // 注册开始回调
        (window as any).onAndroidInterstitialStart = () => {
            egf.Logger.log("Android Interstitial Started");
            this._startCb && this._startCb();
        };

        // 注册结束回调
        (window as any).onAndroidInterstitialCallback = () => {
            egf.Logger.log("Android Interstitial Finished");
            this._endCb && this._endCb(true);
        };

        this.callNative("showInterstitialAd", "()V");
    }

    /**
     * 显示互动广告(激励插屏)
     */
    showInteractiveAd(endCb: Function): void {
        this._endCb = endCb;

        // 注册结束回调
        (window as any).onAndroidInteractiveAdCallback = (isFinished: boolean) => {
            egf.Logger.log("Android Interactive Ad Finished:", isFinished);
            this._endCb && this._endCb(isFinished);
        };

        this.callNative("showInteractiveAd", "()V");
    }

    /**
     * 设置 banner 广告显示/隐藏
     * @param visible true=显示, false=隐藏
     * @param position banner 位置 (EBannerPosition, 默认底部)
     * @param cb 操作结果回调 (isSuccess: boolean)
     */
    setBannerAd(visible: boolean, position?: number, cb?: Function): void {
        position = position == null ? EBannerPosition.Bottom : position;

        // 注册 banner 操作结果回调
        (window as any).onAndroidBannerCallback = (isSuccess: boolean) => {
            egf.Logger.log("Android Banner Result:", isSuccess);
            cb && cb(isSuccess);
        };

        this.callNative("setBannerAd", "(ZI)V", visible, position);
    }

    /**
     * 判断指定类型广告是否已加载
     * @param type 广告类型 (EAdType: 0=所有, 1=激励视频, 2=插屏, 3=Banner)
     * @param cb 结果回调 (isLoaded: boolean)
     */
    checkAdLoaded(type: number, cb?: Function): void {
        (window as any).onAndroidAdLoadedCallback = (isLoaded: boolean) => {
            egf.Logger.log("Android Ad Loaded Check:", type, isLoaded);
            cb && cb(!!isLoaded);
        };
        this.callNative("checkAdLoaded", "(I)V", type);
    }

    /**
     * 设备震动
     */
    vibrate(time: number): void {
        this.callNative("vibrate", "(I)V", time);
    }

    /**
     * 打开系统设置界面
     */
    openSystemSetting(): void {
        this.callNative("openSystemSetting", "()V");
    }

    /**
     * 登录
     */
    login(params?: any): void {
        (window as any).onAndroidLoginCallback = (code: string) => {
            if (code) {
                params?.successCb && params.successCb(code);
            } else {
                params?.failCb && params.failCb();
            }
        };
        this.callNative("login", "()V");
    }

    /**
     * 分享
     * params 格式: { title: string, content: string }
     */
    share(params?: any): void {
        this.callNative("share", "(Ljava/lang/String;)V", JSON.stringify(params || {}));
    }

    /**
     * 统一上报接口
     * @param name 事件名
     * @param params 扩展参数
     */
    reportEvent(name: string, params?: any): void {
        this.callNative("logEvent", "(Ljava/lang/String;Ljava/lang/String;)V", name, JSON.stringify(params || {}));
    }

    /**
     * 封装反射调用
     */
    private callNative(methodName: string, signature: string, ...args: any[]) {
        if (sys.isNative && sys.os === sys.OS.ANDROID) {
            try {
                return native.reflection.callStaticMethod(IAndroid.JAVA_CLASS, methodName, signature, ...args);
            } catch (e) {
                console.error(`[IAndroid] Call native method ${methodName} failed:`, e);
            }
        } else {
            console.warn(`[IAndroid] Skipping native call ${methodName} (Non-Android environment)`);
        }
    }
}
