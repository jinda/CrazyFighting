import type { IAdConfigData } from "../apiInterface";
import { EAdType, EBannerPosition, SDKBase } from "./SDKInterface";

const adConfig = {
  reward_video_ad_id: "2110937662884458498",
  interstitial_ad_id: "2110937769920659457",
  banner_ad_id: "2114903718943768578",
};

interface SudError {
  errCode?: number;
  errMsg?: string;
}

interface SudCallbacks<T> {
  success: (result: T) => void;
  fail: (error: SudError) => void;
}

interface PlatformCallbacks<T> {
  successCb?: (result: T) => void;
  failCb?: (message: string) => void;
}

interface SudUserInfo {
  nickname: string;
  avatar: string;
}

interface PlatformUserInfo extends SudUserInfo {
  nickName: string;
  avatarUrl: string;
}

interface SudAd {
  onLoad(callback: () => void): void;
  offLoad(callback: () => void): void;
  onError(callback: (error: SudError) => void): void;
  offError(callback: (error: SudError) => void): void;
  show(): Promise<void>;
  destroy(): void;
}

interface SudFullscreenAd extends SudAd {
  load(): Promise<void>;
  onClose(callback: (result?: { isEnded?: boolean }) => void): void;
  offClose(callback: (result?: { isEnded?: boolean }) => void): void;
}

interface SudBannerStyle {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface SudBannerAd extends SudAd {
  style: SudBannerStyle;
  hide(): void;
  onResize(callback: (size: { width: number; height: number }) => void): void;
  offResize(callback: (size: { width: number; height: number }) => void): void;
}

interface SudRuntime {
  login(options: SudCallbacks<{ code: string }>): void;
  getUserInfo?: (options: SudCallbacks<SudUserInfo>) => void;
  authorize?: (options: SudCallbacks<unknown> & { scope: string }) => void;
  vibrateShort?: (options: { fail: (error: SudError) => void }) => void;
  vibrateLong?: (options: { fail: (error: SudError) => void }) => void;
  createRewardedVideoAd?: (options: { adUnitId: string }) => SudFullscreenAd;
  createInterstitialAd?: (options: { adUnitId: string }) => SudFullscreenAd;
  createBannerAd?: (options: {
    adUnitId: string;
    style: SudBannerStyle;
  }) => SudBannerAd;
  getContainerInfo?: () => {
    containerWidth: number;
    containerHeight: number;
    pixelRatio: number;
  };
}

//SUD 由小游戏运行时注入；使用 typeof，保证普通浏览器预览时也能安全加载本模块。
declare const sud: SudRuntime | undefined;

export function isSudRuntime(): boolean {
  return (
    typeof sud !== "undefined" &&
    sud !== null &&
    typeof sud.login === "function"
  );
}

function getErrorMessage(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "errMsg" in error &&
    typeof error.errMsg === "string"
  ) {
    return error.errMsg;
  }
  return error instanceof Error ? error.message : "SUD 接口调用失败";
}

/** 激励视频与插屏共用单次展示、监听清理和加载节流；两种广告各自持有回调。 */
class FullscreenAdController {
  private ad: SudFullscreenAd | null = null;
  private cleanup: (() => void) | null = null;
  private pending: {
    startCb?: () => void;
    endCb?: (success: boolean) => void;
  } | null = null;
  private reloadTimer: ReturnType<typeof setTimeout> | null = null;
  private lastLoadTime = -Infinity;
  private disposed = false;
  public loaded = false;

  constructor(
    private readonly createAd: () => SudFullscreenAd,
    private readonly rewarded: boolean,
  ) {}

  public prepare(): void {
    if (this.disposed || this.ad || this.reloadTimer !== null) {
      return;
    }
    //官方当前限制为 10 秒内不能重复加载；只延迟一次预加载，不循环重试失败请求。
    const remaining = 10000 - (Date.now() - this.lastLoadTime);
    if (remaining > 0) {
      this.reloadTimer = setTimeout(() => {
        this.reloadTimer = null;
        this.prepare();
      }, remaining);
      return;
    }

    this.lastLoadTime = Date.now();
    try {
      const ad = this.createAd();
      this.ad = ad;
      const onLoad = () => {
        if (this.ad === ad && this.pending === null) {
          this.loaded = true;
        }
      };
      const onError = (_error: SudError) => {
        egf.Logger.warn("[SUD] 全屏广告加载或展示失败");
        this.finish(ad, false);
      };
      const onClose = (result?: { isEnded?: boolean }) => {
        if (this.ad !== ad) {
          return;
        }
        this.finish(ad, !this.rewarded || result?.isEnded === true);
        this.prepare();
      };
      this.cleanup = () => {
        ad.offLoad(onLoad);
        ad.offError(onError);
        ad.offClose(onClose);
      };
      ad.onLoad(onLoad);
      ad.onError(onError);
      ad.onClose(onClose);
      //Promise 成功仅表示请求受理；只有 onLoad 才能将 loaded 置为 true。
      ad.load().catch(onError);
    } catch {
      egf.Logger.error("[SUD] 全屏广告创建或加载调用失败");
      if (this.ad) {
        this.finish(this.ad, false);
      }
    }
  }

  public show(startCb?: () => void, endCb?: (success: boolean) => void): void {
    const ad = this.ad;
    if (this.disposed || this.pending || !ad || !this.loaded) {
      //未就绪时继续游戏，不排队到之后突然展示；下一次用户触发时再检查。
      this.prepare();
      endCb?.(false);
      return;
    }
    const request = { startCb, endCb };
    this.pending = request;
    this.loaded = false;
    try {
      ad.show().then(
        () => {
          if (this.ad === ad && this.pending === request) {
            try {
              startCb?.();
            } catch {
              egf.Logger.error("[SUD] 广告开始回调执行失败");
              this.finish(ad, false);
            }
          }
        },
        () => this.finish(ad, false),
      );
    } catch {
      egf.Logger.error("[SUD] 全屏广告展示调用失败");
      this.finish(ad, false);
    }
  }

  private finish(ad: SudFullscreenAd, success: boolean): void {
    if (this.ad !== ad) {
      return;
    }
    const callback = this.pending?.endCb;
    this.pending = null;
    this.ad = null;
    this.loaded = false;
    try {
      this.cleanup?.();
    } catch {
      egf.Logger.warn("[SUD] 全屏广告监听清理失败");
    }
    this.cleanup = null;
    try {
      ad.destroy();
    } catch {
      egf.Logger.warn("[SUD] 全屏广告销毁失败");
    }
    try {
      callback?.(success);
    } catch {
      egf.Logger.error("[SUD] 广告结束回调执行失败");
    }
  }

  public dispose(): void {
    this.disposed = true;
    if (this.reloadTimer !== null) {
      clearTimeout(this.reloadTimer);
      this.reloadTimer = null;
    }
    if (this.ad) {
      this.finish(this.ad, false);
    }
  }
}

interface BannerState {
  ad: SudBannerAd;
  loaded: boolean;
  visible: boolean;
  showing: boolean;
  shown: boolean;
  position: number;
  containerHeight: number;
  requestId: number;
  callback?: (success: boolean) => void;
  cleanup: () => void;
}

/** SUD OpenPaaS 实现；保持 PlatformMgr 现有的参数与回调约定。 */
export class ISud extends SDKBase {
  private runtime: SudRuntime | null = null;
  private rewardedAd: FullscreenAdController | null = null;
  private interstitialAd: FullscreenAdController | null = null;
  private banner: BannerState | null = null;
  private adConfig: IAdConfigData | null = null;
  private generation = 0;

  public init(_params?: unknown, cb?: (result: string) => void): boolean {
    this.dispose();
    this.runtime = isSudRuntime() && typeof sud !== "undefined" ? sud : null;
    const success = this.runtime !== null;
    if (!success) {
      egf.Logger.error("[SUD] 小游戏运行时不存在");
    }
    cb?.(JSON.stringify({ success }));
    return success;
  }

  public initAd(params?: IAdConfigData | null): boolean {
    this.disposeAds();
    this.adConfig = params ?? adConfig;
    const runtime = this.runtime;
    if (!runtime || !this.adConfig) {
      return false;
    }
    const createRewarded = runtime.createRewardedVideoAd;
    const createInterstitial = runtime.createInterstitialAd;
    if (createRewarded && this.adConfig.reward_video_ad_id) {
      this.rewardedAd = new FullscreenAdController(
        () =>
          createRewarded.call(runtime, {
            adUnitId: this.adConfig.reward_video_ad_id,
          }),
        true,
      );
      this.rewardedAd.prepare();
    }
    if (createInterstitial && this.adConfig.interstitial_ad_id) {
      this.interstitialAd = new FullscreenAdController(
        () =>
          createInterstitial.call(runtime, {
            adUnitId: this.adConfig.interstitial_ad_id,
          }),
        false,
      );
      this.interstitialAd.prepare();
    }
    return !!(
      this.rewardedAd ||
      this.interstitialAd ||
      (runtime.createBannerAd && this.adConfig.banner_ad_id)
    );
  }

  public showRewardedVideo(
    startCb: () => void,
    endCb?: (success: boolean) => void,
  ): void {
    if (!this.rewardedAd) {
      endCb?.(false);
      return;
    }
    this.rewardedAd.show(startCb, endCb);
  }

  public showInterstitialAd(
    startCb: () => void,
    endCb?: (success: boolean) => void,
  ): void {
    if (!this.interstitialAd) {
      endCb?.(false);
      return;
    }
    this.interstitialAd.show(startCb, endCb);
  }

  public checkAdLoaded(type: number, cb?: (loaded: boolean) => void): void {
    const rewarded = this.rewardedAd?.loaded ?? false;
    const interstitial = this.interstitialAd?.loaded ?? false;
    const banner = this.banner?.loaded ?? false;
    const states: Record<number, boolean> = {
      [EAdType.All]: rewarded && interstitial && banner,
      [EAdType.RewardedVideo]: rewarded,
      [EAdType.Interstitial]: interstitial,
      [EAdType.Banner]: banner,
    };
    cb?.(states[type] ?? false);
  }

  public setBannerAd(
    visible: boolean,
    position: number = EBannerPosition.Bottom,
    cb?: (success: boolean) => void,
  ): void {
    if (!visible) {
      const state = this.banner;
      if (state) {
        state.visible = false;
        state.showing = false;
        state.shown = false;
        state.requestId++;
        this.finishBannerRequest(state, false);
        try {
          state.ad.hide();
        } catch {
          egf.Logger.warn("[SUD] Banner 隐藏失败");
          cb?.(false);
          return;
        }
      }
      cb?.(true);
      return;
    }

    if (!this.banner && !this.createBanner(position)) {
      cb?.(false);
      return;
    }
    const state = this.banner;
    if (!state) {
      cb?.(false);
      return;
    }
    this.finishBannerRequest(state, false);
    state.position = position;
    state.ad.style.top =
      position === EBannerPosition.Top
        ? 0
        : state.containerHeight - state.ad.style.height;
    state.visible = true;
    state.callback = cb;
    if (state.shown) {
      this.finishBannerRequest(state, true);
    } else if (state.loaded) {
      this.showBanner(state);
    }
  }

  private createBanner(position: number): boolean {
    const runtime = this.runtime;
    const adUnitId = this.adConfig?.banner_ad_id;
    if (!runtime?.createBannerAd || !runtime.getContainerInfo || !adUnitId) {
      return false;
    }
    try {
      const { containerWidth, containerHeight } = runtime.getContainerInfo();
      if (
        !Number.isFinite(containerWidth) ||
        !Number.isFinite(containerHeight) ||
        containerWidth <= 0 ||
        containerHeight <= 0
      ) {
        egf.Logger.warn("[SUD] Banner 容器尺寸无效");
        return false;
      }
      //SUD 广告使用容器逻辑像素，不使用屏幕尺寸，也不乘除 pixelRatio。
      const height = Math.min(100, containerHeight);
      const ad = runtime.createBannerAd({
        adUnitId,
        style: {
          left: 0,
          top: position === EBannerPosition.Top ? 0 : containerHeight - height,
          width: containerWidth,
          height,
        },
      });
      const state: BannerState = {
        ad,
        loaded: false,
        visible: false,
        showing: false,
        shown: false,
        position,
        containerHeight,
        requestId: 0,
        cleanup: () => {
          ad.offLoad(onLoad);
          ad.offError(onError);
          ad.offResize(onResize);
        },
      };
      const onLoad = () => {
        if (this.banner === state) {
          state.loaded = true;
          if (state.visible) {
            this.showBanner(state);
          }
        }
      };
      const onError = (_error: SudError) => {
        if (this.banner === state) {
          egf.Logger.warn("[SUD] Banner 加载或展示失败");
          this.destroyBanner();
        }
      };
      const onResize = (size: { width: number; height: number }) => {
        if (
          this.banner === state &&
          Number.isFinite(size.height) &&
          size.height > 0
        ) {
          ad.style.top =
            state.position === EBannerPosition.Top
              ? 0
              : Math.max(0, containerHeight - size.height);
        }
      };
      this.banner = state;
      ad.onLoad(onLoad);
      ad.onError(onError);
      ad.onResize(onResize);
      return true;
    } catch {
      egf.Logger.error("[SUD] Banner 创建失败");
      this.destroyBanner();
      return false;
    }
  }

  private showBanner(state: BannerState): void {
    if (this.banner !== state || !state.visible || state.showing) {
      return;
    }
    state.showing = true;
    const requestId = ++state.requestId;
    const fail = () => {
      if (this.banner === state && requestId === state.requestId) {
        egf.Logger.warn("[SUD] Banner 展示调用失败");
        this.destroyBanner();
      }
    };
    try {
      state.ad.show().then(() => {
        if (
          this.banner === state &&
          state.visible &&
          requestId === state.requestId
        ) {
          state.shown = true;
          this.finishBannerRequest(state, true);
        }
      }, fail);
    } catch {
      fail();
    }
  }

  private finishBannerRequest(state: BannerState, success: boolean): void {
    const callback = state.callback;
    state.callback = undefined;
    try {
      callback?.(success);
    } catch {
      egf.Logger.error("[SUD] Banner 回调执行失败");
    }
  }

  private destroyBanner(): void {
    const state = this.banner;
    this.banner = null;
    if (!state) {
      return;
    }
    try {
      state.cleanup();
    } catch {
      egf.Logger.warn("[SUD] Banner 监听清理失败");
    }
    try {
      state.ad.destroy();
    } catch {
      egf.Logger.warn("[SUD] Banner 销毁失败");
    }
    this.finishBannerRequest(state, false);
  }

  public login(params: PlatformCallbacks<string> = {}): void {
    const runtime = this.runtime;
    if (!runtime) {
      params.failCb?.("SUD 运行时不可用");
      return;
    }
    this.request<{ code: string }>(
      "login",
      (callbacks) => runtime.login(callbacks),
      {
        failCb: params.failCb,
        successCb: (result) => {
          if (
            typeof result?.code !== "string" ||
            result.code.trim().length === 0
          ) {
            egf.Logger.warn("[SUD] 登录凭证为空");
            params.failCb?.("SUD 登录凭证为空");
            return;
          }
          //一次性 code 原样交给业务服务端，不缓存、不输出到日志。
          params.successCb?.(result.code);
        },
      },
    );
  }

  public authorize(
    params: PlatformCallbacks<unknown> & { scope?: string } = {},
  ): void {
    const runtime = this.runtime;
    if (!runtime?.authorize || !params.scope) {
      params.failCb?.("SUD 授权接口或 scope 不可用");
      return;
    }
    const scope = params.scope;
    this.request(
      "authorize",
      (callbacks) => runtime.authorize?.({ ...callbacks, scope }),
      params,
    );
  }

  public getUserInfo(
    params: PlatformCallbacks<PlatformUserInfo> & { destroy?: boolean } = {},
  ): void {
    if (params.destroy) {
      return;
    }
    const runtime = this.runtime;
    if (!runtime?.getUserInfo) {
      params.failCb?.("SUD 用户信息接口不可用");
      return;
    }
    this.request<SudUserInfo>(
      "getUserInfo",
      (callbacks) => runtime.getUserInfo?.(callbacks),
      {
        failCb: params.failCb,
        successCb: (result) => {
          if (
            typeof result?.nickname !== "string" ||
            typeof result.avatar !== "string"
          ) {
            params.failCb?.("SUD 用户信息格式无效");
            return;
          }
          params.successCb?.({
            ...result,
            nickName: result.nickname,
            avatarUrl: result.avatar,
          });
        },
      },
    );
  }

  private request<T>(
    name: string,
    invoke: (callbacks: SudCallbacks<T>) => void,
    params: PlatformCallbacks<T>,
  ): void {
    let settled = false;
    const generation = this.generation;
    const fail = (error: unknown) => {
      if (settled || generation !== this.generation) {
        return;
      }
      settled = true;
      egf.Logger.warn("[SUD] 接口调用失败:", name);
      try {
        params.failCb?.(getErrorMessage(error));
      } catch {
        egf.Logger.error("[SUD] 接口失败回调执行失败:", name);
      }
    };
    try {
      invoke({
        success: (result) => {
          if (!settled && generation === this.generation) {
            settled = true;
            try {
              params.successCb?.(result);
            } catch {
              egf.Logger.error("[SUD] 接口成功回调执行失败:", name);
            }
          }
        },
        fail,
      });
    } catch (error) {
      if (settled) {
        egf.Logger.error("[SUD] 接口回调执行失败:", name);
      } else {
        fail(error);
      }
    }
  }

  public vibrate(time: number): void {
    const runtime = this.runtime;
    const vibrate = time > 300 ? runtime?.vibrateLong : runtime?.vibrateShort;
    if (!runtime || !vibrate) {
      return;
    }
    try {
      vibrate.call(runtime, {
        fail: () => egf.Logger.warn("[SUD] 震动调用失败"),
      });
    } catch {
      egf.Logger.warn("[SUD] 震动调用失败");
    }
  }

  public share(
    params: {
      endCb?: (success: boolean) => void;
      failCb?: (message: string) => void;
    } = {},
  ): void {
    egf.Logger.warn("[SUD] 当前接入未提供分享能力");
    params.failCb?.("当前平台不支持分享");
    params.endCb?.(false);
  }

  public checkScene(cb: (success: boolean) => void): void {
    cb(false);
  }

  private disposeAds(): void {
    this.rewardedAd?.dispose();
    this.interstitialAd?.dispose();
    this.rewardedAd = null;
    this.interstitialAd = null;
    this.destroyBanner();
    this.adConfig = null;
  }

  public dispose(): void {
    this.generation++;
    this.disposeAds();
    this.runtime = null;
  }
}
