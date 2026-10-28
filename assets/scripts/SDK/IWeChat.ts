import { view } from "cc";
import { EAdType, EBannerPosition, SDKBase, type IPlatformSystemInfo } from "./SDKInterface";

const wx = typeof window === "undefined" ? undefined : Reflect.get(window, "wx");

const adunitVideo = "adunit-1299ee38a033d8ab";
const adunitInterstitial = "adunit-827bfde533614675";
const adunitBanner = "adunit-846ab3de180c263c";
const gamelink =
    "-SSEykJvFV3pORt5kTNpSyVVfsEg4nDw2GllMERzeP4TmfV8ASA0tdIi46W1-QRVKUP0kIOfZgju_zZ1JpdBbz8rFFQy5t6K3Sn6nnRUzK0zsAjVrWSnlxtzvzUGGgScyczD369VU22NbgPYtXRDOuCzfcm1h90I5jtq2DBGFnjqTTnS8KLdi1Z1kvHUDASBzq-nCOl4Bn3gPcLYr0mGcpWo6xdR2bA-qxa0IqRPVV35a3JmM7rawn481oJYxtN2DxysMhaszYv1XPBpUYQRdouk29mjPyBnFBhY5PZ4cFANfd_I6psV3qDOinJbl3cH-Tc4UM5sgsLcSCI_1RswuQ";
export class IWeChat extends SDKBase {
    private _bannerAd: any = null;
    private _bannerCb: Function | null = null;
    private _userInfoBtn: any = null;
    private _videoAdLoaded = false;
    private _interstitialLoaded = false;
    private _bannerLoaded = false;
    private _banner_ad_id: string = adunitBanner;

    init(params?: any, cb?: Function): boolean {
        var self = this;
        egf.Logger.log("WeChat init:", params);
        if (!wx) {
            console.error("WeChat not found");
            cb && cb('{"success":false}');
            return false;
        }
        // 右上角分享按钮
        wx.showShareMenu({
            withShareTicket: true,
            menus: ["shareAppMessage", "shareTimeline"],
        });
        // 分享给朋友内容
        wx.onShareAppMessage(function () {
            self._closeTime = new Date().getTime();
            self._bShared = true;
            return {
                title: "这款超级棒的游戏，非常减压，快点来玩吧！",

                //转发显示图片的链接,图片长宽比是 5:4
                //网路图片=>'https://...'
                //  imageUrl: cc.url.raw('resources/img/gamePlaying/1.png'),
                imageUrl: "",
            };
        });
        // 分享给朋友圈内容
        wx.onShareTimeline(function () {
            // self.isShared=true
            self._closeTime = new Date().getTime();
            self._bShared = true;
            return {
                title: "这款超级棒的游戏，非常减压，快点来玩吧！",

                //转发显示图片的链接,图片长宽比是 5:4
                //网路图片=>'https://...'
                //  imageUrl: cc.url.raw('resources/img/gamePlaying/1.png'),
                imageUrl: "",
            };
        });

        //开启监听 返回小程序启动参数（只有第一次激活生效）
        let launchOption = wx.getLaunchOptionsSync();
        egf.Logger.log("首次开启 launchOption:", launchOption);

        wx.onShow((res: any) => {
            egf.Logger.log("回到前台onShow", "是否分享：" + self._bShared + ", 分享的key:" + self._shareTag);
            let curTime = new Date().getTime();
            if (!this._bShared) {
                return;
            }
            self._bShared = false;
            self._shareTag = "";
            self._closeTime = curTime;
            if (curTime - self._closeTime <= 3000) {
                egf.Logger.log("分享不成功提示<3000");
                self._endCb && self._endCb(false);
            } else {
                self._endCb && self._endCb(true);
            }
        });

        cb && cb('{"success":true}');
        return true;
    }

    /**
     * 通过微信接口获取系统信息
     */
    getSystemInfo(): IPlatformSystemInfo | null {
        if (!wx) {
            return null;
        }
        try {
            const info = wx.getSystemInfoSync();
            const safeArea = info?.safeArea;
            const left = safeArea?.left ?? 0;
            const right = safeArea?.right ?? 0;
            const top = safeArea?.top ?? 0;
            const bottom = safeArea?.bottom ?? 0;
            return {
                brand: info.brand,
                model: info.model,
                pixelRatio: info.pixelRatio,
                screenWidth: info.screenWidth,
                screenHeight: info.screenHeight,
                windowWidth: info.windowWidth,
                windowHeight: info.windowHeight,
                statusBarHeight: info.statusBarHeight,
                language: info.language,
                coreVersion: info.SDKVersion || info.version,
                system: info.system,
                platform: info.platform,
                cameraAuthorized: !!info.cameraAuthorized,
                locationAuthorized: !!info.locationAuthorized,
                microphoneAuthorized: !!info.microphoneAuthorized,
                notificationAuthorized: !!info.notificationAuthorized,
                locationEnabled: !!info.locationEnabled,
                wifiEnabled: !!info.wifiEnabled,
                safeArea: safeArea
                    ? {
                        left,
                        right,
                        top,
                        bottom,
                        width: safeArea.width ?? right - left,
                        height: safeArea.height ?? bottom - top,
                    }
                    : undefined,
            };
        } catch (error) {
            egf.Logger.warn("wx.getSystemInfoSync failed:", error);
            return null;
        }
    }

    /**
     * 初始化广告（激励视频、插屏），使用服务器配置，回退本地硬编码
     */
    initAd(params?: any): boolean {
        var self = this;
        egf.Logger.log("WeChat initAd:", params);
        if (!wx) {
            console.error("WeChat not found");
            return false;
        }

        this._banner_ad_id = params?.banner_ad_id || adunitBanner;
        // 创建激励视频广告实例，优先使用服务器配置，回退本地硬编码
        this._videoAd = wx.createRewardedVideoAd({
            adUnitId: params?.reward_video_ad_id || adunitVideo,
        });

        this._videoAd.onLoad(() => {
            egf.Logger.log("激励视频 广告加载成功");
            self._videoAdLoaded = true;
        });

        this._videoAd.onError((err: Error) => {
            egf.Logger.log("激励视频展示失败:", err);
            self._videoAdLoaded = false;
            self._endCb && self._endCb(false);
        });

        this._videoAd.onClose((res: any) => {
            self._videoAdLoaded = false;
            if ((res && res.isEnded) || res === undefined) {
                egf.Logger.log("播放成功");
                self._endCb && self._endCb(true);
            } else {
                egf.Logger.log("播放中途退出");
                self._endCb && self._endCb(false);
            }
        });

        // 创建插屏广告实例，优先使用服务器配置
        if (wx.createInterstitialAd) {
            egf.Logger.log("广告被创建");
            this._interstitialAd = wx.createInterstitialAd({
                adUnitId: params?.interstitial_ad_id || adunitInterstitial,
            });
        }

        this._interstitialAd.onClose((res: any) => {
            egf.Logger.log("插屏 广告关闭");
            self._interstitialLoaded = false;
            self._endCb && self._endCb(true);
        });

        this._interstitialAd.onLoad(() => {
            egf.Logger.log("插屏 广告加载成功");
            self._interstitialLoaded = true;
            self._startCb && self._startCb();
        });
        this._interstitialAd.onError((err: Error) => {
            egf.Logger.log("插屏 广告加载失败 err:", err);
            self._interstitialLoaded = false;
            self._endCb && self._endCb(false);
        });

        return true;
    }

    showRewardedVideo(startCb: Function, endCb?: Function): void {
        if (!this._videoAd) {
            console.error("videoAd not found");
            //必须回调结束，否则调用方（已暂停的游戏）无法恢复
            if (endCb) {
                endCb(false);
            }
            return;
        }
        this._startCb = startCb;
        this._endCb = endCb!;
        this._startCb && this._startCb();
        this._videoAd.show().catch((err: Error) => {
            this._videoAd
                .load()
                .then(() => this._videoAd.show())
                .catch((err: Error) => {
                    egf.Logger.log("激励视频 广告显示失败:", err);
                    //重试仍失败：按未完成处理，保证调用方恢复游戏，并清空避免迟到回调重复通知
                    if (this._endCb) {
                        this._endCb(false);
                        this._endCb = null;
                    }
                });
        });
    }
    showInterstitialAd(startCb: Function, endCb?: Function): void {
        if (!this._interstitialAd) {
            console.error("interstitialAd not found");
            return;
        }
        this._startCb = startCb;
        this._endCb = endCb!;
        this._startCb && this._startCb();
        this._interstitialAd.show().catch((err: Error) => {
            egf.Logger.log("插屏 广告拉取失败:", err);
            this._endCb && this._endCb(false);
        });
    }

    /**
     * 设置 banner 广告显示/隐藏
     * @param visible true=显示, false=隐藏
     * @param position banner 位置 (EBannerPosition, 默认底部)
     * @param cb 操作结果回调 (isSuccess: boolean)
     */
    setBannerAd(visible: boolean, position?: number, cb?: Function): void {
        position = position == null ? EBannerPosition.Bottom : position;

        if (!wx) {
            console.error("WeChat not found");
            cb && cb(false);
            return;
        }
        if (!wx.createCustomAd) {
            console.error("wx.createBannerAd not supported");
            cb && cb(false);
            return;
        }

        this._bannerCb = cb!;

        if (!this._bannerAd) {
            // 创建 banner 广告实例（懒加载），优先使用服务器配置
            this._bannerAd = wx.createCustomAd({
                adUnitId: this._banner_ad_id || adunitBanner,
                style: {
                    left: 0,
                    top: position === EBannerPosition.Top ? 0 : undefined,
                    width: 350,
                },
            });

            this._bannerAd.onLoad(() => {
                egf.Logger.log("banner 广告加载成功");
                this._bannerLoaded = true;
            });

            this._bannerAd.onError((err: Error) => {
                egf.Logger.log("banner 广告加载失败:", err);
                this._bannerLoaded = false;
                this._bannerCb && this._bannerCb(false);
            });

            this._bannerAd.onResize(() => {
                egf.Logger.log("banner 广告尺寸变化");
            });
        }

        if (visible) {
            this._bannerAd
                .show()
                .then(() => {
                    egf.Logger.log("banner 广告显示成功");
                    cb && cb(true);
                })
                .catch((err: Error) => {
                    egf.Logger.log("banner 广告显示失败:", err);
                    cb && cb(false);
                });
        } else {
            this._bannerAd.hide();
            egf.Logger.log("banner 广告已隐藏");
            cb && cb(true);
        }
    }

    /**
     * 判断指定类型广告是否已加载
     * @param type 广告类型 (EAdType)
     * @param cb 结果回调 (isLoaded: boolean)
     */
    checkAdLoaded(type: number, cb?: Function): void {
        let loaded = false;
        if (type === EAdType.RewardedVideo) {
            loaded = this._videoAdLoaded;
        } else if (type === EAdType.Interstitial) {
            loaded = this._interstitialLoaded;
        } else if (type === EAdType.Banner) {
            loaded = this._bannerLoaded;
        } else if (type === EAdType.All) {
            loaded = this._videoAdLoaded && this._interstitialLoaded && this._bannerLoaded;
        }
        cb && cb(loaded);
    }

    share(params?: any): void {
        if (!wx) {
            console.error("WeChat not found");
            return;
        }
        this._bShared = true;
        this._closeTime = new Date().getTime();
        this._shareTag = params.tag;
        this._endCb = params.endCb;
        this._startCb = params.startCb;

        wx.shareAppMessage({
            title: params.content,
        });
    }

    vibrate(time: number): void {
        if (!wx) {
            console.error("WeChat not found");
            return;
        }
        let success = () => { };
        let fail = () => {
            egf.Logger.log("震动失败");
        };
        let complete = () => { };

        if (time <= 100) {
            wx.vibrateShort({
                type: "light",
                success: success,
                fail: fail,
                complete: complete,
            });
        } else if (time <= 200) {
            wx.vibrateShort({
                type: "medium",
                success: success,
                fail: fail,
                complete: complete,
            });
        } else if (time <= 300) {
            wx.vibrateShort({
                type: "heavy",
                success: success,
                fail: fail,
                complete: complete,
            });
        } else {
            wx.vibrateLong({
                success: success,
                fail: fail,
                complete: complete,
            });
        }
    }
    login(params?: any): void {
        const failCb = params.failCb;
        if (!wx) {
            console.error("WeChat not found");
            failCb && failCb("WeChat not found");
            return;
        }
        const successCb = params.successCb;
        wx.login({
            success(res: any) {
                if (res.code) {
                    egf.Logger.log("登录成功！");
                    successCb && successCb(res.code);
                } else {
                    egf.Logger.log("登录失败！", res.errMsg);
                    failCb && failCb(res.errMsg);
                }
            },
        });
    }

    authorize(params?: any): void {
        const failCb = params.failCb;
        if (!wx) {
            console.error("WeChat not found");
            failCb && failCb("WeChat not found");
            return;
        }
        const successCb = params.successCb;
        wx.getSetting({
            success(res: any) {
                if (!res.authSetting[params.scope]) {
                    wx.authorize({
                        scope: params.scope,
                        success() {
                            egf.Logger.log("授权成功！");
                            successCb && successCb();
                        },
                        fail(res: any) {
                            egf.Logger.log("授权失败！", res.errMsg);
                            failCb && failCb(res.errMsg);
                        },
                    });
                } else {
                    successCb && successCb();
                }
            },
        });
    }

    setUserCloudStorage(params?: any): void {
        if (!wx) {
            console.error("WeChat not found");
            return;
        }
        const failCb = params.failCb;
        const successCb = params.successCb;
        wx.setUserCloudStorage({
            // 调用微信接口上报关卡等级信息，用于好友圈排行
            KVDataList: [{ key: params.key, value: `${params.score}` }],

            success: () => {
                egf.Logger.log("report score success:", params.key + ", score:" + params.score);
                successCb && successCb();
            },

            fail: (err: any) => {
                egf.Logger.log("report score error:", err);
                failCb && failCb();
            },
        });
    }

    getUserCloudStorage(params?: any): void {
        if (!wx) {
            console.error("WeChat not found");
            return;
        }
        const failCb = params.failCb;
        const successCb = params.successCb;
        wx.getUserCloudStorage({
            // 调用微信接口上报关卡等级信息，用于好友圈排行
            keyList: [params.key],

            success: (data: any) => {
                egf.Logger.log("get score success:", data);
                successCb && successCb(data);
            },

            fail: (err: any) => {
                egf.Logger.log("get score error:", err);
                failCb && failCb();
            },
        });
    }

    getUserInfo(params?: any): void {
        if (!wx) {
            console.error("WeChat not found");
            return;
        }
        const self = this;
        if (params?.destroy) {
            egf.Logger.log("destroy userInfo button:", self._userInfoBtn);
            if (self._userInfoBtn) {
                try {
                    self._userInfoBtn.destroy(); // 用完销毁按钮
                } catch (error) {
                    self._userInfoBtn.hide(); // 用完销毁按钮
                }
                self._userInfoBtn = null;
            }
            return;
        }
        const failCb = params.failCb;
        const successCb = params.successCb;
        wx.getSetting({
            success(res: any) {
                egf.Logger.log("authSetting:", res.authSetting);
                if (res.authSetting["scope.userInfo"]) {
                    // 已经授权，可以直接调用 getUserInfo 获取头像昵称
                    wx.getUserInfo({
                        success: (res: any) => {
                            egf.Logger.log("获取用户信息成功");
                            successCb && successCb(res.userInfo);
                        },
                        fail: (err: any) => {
                            egf.Logger.log("获取用户信息失败!", err.errMsg);
                            failCb && failCb(res.errMsg);
                        },
                    });
                } else {
                    // 否则，先通过 wx.createUserInfoButton 接口发起授权
                    const systemInfo = wx.getSystemInfoSync();
                    const screenWidth = systemInfo.windowWidth;
                    const screenHeight = systemInfo.windowHeight;
                    // 计算缩放比例
                    const designSize = view.getDesignResolutionSize();
                    const scaleX = screenWidth / designSize.width;
                    const scaleY = screenHeight / designSize.height;
                    self._userInfoBtn = wx.createUserInfoButton({
                        type: "text",
                        text: "点击授权用户信息",
                        style: {
                            left: (scaleX * screenWidth) / 2,
                            top: scaleY * screenHeight + 200,
                            width: 200,
                            height: 60,
                            lineHeight: 60,
                            backgroundColor: "#EDFF24",
                            color: "#000000",
                            textAlign: "center",
                            fontSize: 16,
                            borderRadius: 4,
                        },
                    });
                    self._userInfoBtn.onTap((res: any) => {
                        if (res.errMsg.indexOf(":ok") > -1 && !!res.rawData) {
                            // 用户同意授权后回调，通过回调可获取用户头像昵称信息
                            egf.Logger.log("用户同意授权！", res);
                            self._userInfoBtn.destroy(); // 用完销毁按钮
                            self._userInfoBtn = null;
                            wx.getUserInfo({
                                success(res: any) {
                                    egf.Logger.log("获取用户信息成功");
                                    successCb && successCb(res.userInfo);
                                },
                                fail(err: any) {
                                    egf.Logger.log("获取用户信息失败!", err.errMsg);
                                    failCb && failCb(res.errMsg);
                                },
                            });
                        } else {
                            // 用户取消授权
                            egf.Logger.log("用户取消授权！");
                            failCb && failCb("用户取消授权！");
                        }
                    });
                }
            },
        });
    }

    postMessage(params?: any): void {
        if (!wx) {
            console.error("WeChat not found");
            return;
        }
        const openContext = wx.getOpenDataContext();
        openContext.postMessage({
            type: "engine",
            event: params.event,
            data: params.data,
        });
    }
    reportEvent(name: string, params: any) {
        if (!wx) {
            console.error("WeChat not found");
            return;
        }
        wx.reportEvent(name, params);
    }

    logEvent(params?: any): void {
        if (!wx) {
            console.error("WeChat not found");
            return;
        }
        let Logger = null;
        if (wx.getGameLogManager) {
            Logger = wx.getGameLogManager({
                commonInfo: {
                    version: "1.0.0",
                    env: "prod",
                },
            });
        }
        if (!Logger) return; // 防止低版本基础库调用报错
        Logger.log(params);
    }

    /**
     * 打开系统设置界面
     */
    openSystemSetting(): void {
        if (!wx) {
            console.error("WeChat not found");
            return;
        }
        wx.openSetting({
            success(res: any) {
                egf.Logger.log("打开系统设置成功:", res);
            },
            fail(err: Error) {
                egf.Logger.log("打开系统设置失败:", err);
            },
        });
    }

    // 打开游戏圈
    openGameCircle(url?: string): void {
        if (!wx) {
            console.error("WeChat not found");
            return;
        }
        const pageManager = wx.createPageManager();

        pageManager
            .load({
                openlink: url || gamelink, // 由不同渠道获得的OPENLINK值
            })
            .then((res: any) => {
                // 加载成功，res 可能携带不同活动、功能返回的特殊回包信息（具体请参阅渠道说明）
                egf.Logger.log("openGame:", res);

                // 加载成功后按需显示
                pageManager.show();
            })
            .catch((err: Error) => {
                // 加载失败，请查阅 err 给出的错误信息
                console.error("openGame error:", err);
            });
    }
}
