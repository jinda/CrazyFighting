import { EAdType, EBannerPosition, SDKBase } from "./SDKInterface";

const tt = typeof window === "undefined" ? undefined : Reflect.get(window, "tt");

const adUnitIdVideo = "2h7689m9d1e77pu0je";
const adUnitIdInterstitial = "ea3hf01o6ao3h4xw9t";
const adUnitIdBanner = "adunit-xxxxxxxxxxxxxxxx";

export class ITT extends SDKBase {
    private recorder: any = null; //录屏
    private videoPath: string = ""; //录屏地址
    private _bannerAd: any = null;
    private _bannerCb: Function | null = null;
    private _videoAdLoaded = false;
    private _interstitialLoaded = false;
    private _bannerLoaded = false;
    private _banner_ad_id: string = adUnitIdBanner;

    init(params?: any, cb?: Function): boolean {
        egf.Logger.log("TT init:", params);
        cb && cb('{"success":true}');
        return true;
    }

    /**
     * 初始化广告（激励视频、插屏），使用服务器配置，回退本地硬编码
     */
    initAd(params?: any): boolean {
        var self = this;
        egf.Logger.log("TT initAd:", params);

        this._banner_ad_id = params?.banner_ad_id || adUnitIdBanner;
        // 创建激励视频广告实例，优先使用服务器配置，回退本地硬编码
        this._videoAd = tt?.createRewardedVideoAd({
            adUnitId: params?.reward_video_ad_id || adUnitIdVideo,
            multitonRewardMsg: ["获得对应道具奖励"], //多个奖励道具名
            progressTip: true, //代表需要进度提示
        });

        this._videoAd?.onLoad(() => {
            egf.Logger.log("激励视频 广告加载成功");
            self._videoAdLoaded = true;
        });

        this._videoAd?.onError((err: any) => {
            egf.Logger.log("激励视频展示失败");
            egf.Logger.log(err);
            self._videoAdLoaded = false;
            self._endCb && self._endCb(false);
        });

        this._videoAd?.onClose((res: any) => {
            // 用户点击了【关闭广告】按钮
            // 小于 2.1.0 的基础库版本，res 是一个 undefined
            self._videoAdLoaded = false;
            if ((res && res.isEnded) || res === undefined) {
                self._endCb && self._endCb(true);
            } else {
                self._endCb && self._endCb(false);
            }
        });

        //插屏广告
        this._interstitialAd = tt?.createInterstitialAd({
            adUnitId: params?.interstitial_ad_id || adUnitIdInterstitial,
        });
        //  this.interstitialAd.load()
        this._interstitialAd?.onLoad(() => {
            egf.Logger.log("插屏 广告加载成功");
            self._interstitialLoaded = true;
        });
        this._interstitialAd?.onError((err: Error) => {
            egf.Logger.log("插屏 广告加载失败:", err);
            self._interstitialLoaded = false;
        });
        this._interstitialAd?.onClose(() => {
            self._interstitialLoaded = false;
            self._interstitialAd.load();
            self._endCb && self._endCb(true);
        });

        return true;
    }
    showRewardedVideo(startCb: Function, endCb?: Function): void {
        if (!this._videoAd) {
            console.error("videoAd not found");
            endCb && endCb(false);
            return;
        }
        this._startCb = startCb;
        this._endCb = endCb!;
        this._startCb && this._startCb();

        this._videoAd.show().catch(() => {
            // 失败重试
            this._videoAd
                .load()
                .then(() => this._videoAd.show())
                .catch((err: Error) => {
                    egf.Logger.log("激励视频 广告显示失败:", err);
                    this._endCb && this._endCb(false);
                });
        });
    }
    showInterstitialAd(startCb: Function, endCb?: Function): void {
        if (!this._interstitialAd) {
            console.error("interstitialAd not found");
            endCb && endCb(false);
            return;
        }
        this._startCb = startCb;
        this._endCb = endCb!;
        this._startCb && this._startCb();

        this._interstitialAd
            .load()
            .then(() => {
                this._interstitialAd.show().then(() => {
                    egf.Logger.log("插屏广告展示成功");
                    this._endCb && this._endCb(true);
                });
            })
            .catch((err: Error) => {
                egf.Logger.log("插屏广告展示失败:", err);
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

        if (!tt) {
            console.error("TT not found");
            cb && cb(false);
            return;
        }
        if (!tt.createBannerAd) {
            console.error("tt.createBannerAd not supported");
            cb && cb(false);
            return;
        }

        this._bannerCb = cb!;

        if (!this._bannerAd) {
            // 创建 banner 广告实例（懒加载），优先使用服务器配置
            this._bannerAd = tt.createBannerAd({
                adUnitId: this._banner_ad_id || adUnitIdBanner,
                style: {
                    left: 0,
                    top: position === EBannerPosition.Top ? 0 : undefined,
                    width: 300,
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

            this._bannerAd.onResize((res: any) => {
                egf.Logger.log("banner 广告尺寸变化:", res);
            });
        }

        // 加载后展示
        if (visible) {
            this._bannerAd
                .load()
                .then(() => this._bannerAd.show())
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
        if (!tt) {
            console.error("TT not found");
            return;
        }
        egf.Logger.log("share params:", params);

        const self = this;
        this._bShared = true;
        this._shareTag = params.tag;
        this._endCb = params.endCb;
        this._startCb = params.startCb;
        const channel = params.channel;

        this._startCb && this._startCb();
        let extra = undefined;
        let title = "这款萌果收集王，太可爱了。";
        let desc = "这个萌果收集王有难度，多数人卡在了第三关。";

        if (channel == "video") {
            extra = {
                videoPath: self.videoPath, // 可用录屏得到的本地文件路径
                videoTopics: params.topics || [
                    "解压小游戏",
                    "休闲游戏",
                    "烧脑挑战大游戏",
                    "怀旧游戏",
                    "手游",
                    "战斗",
                    "快乐消除",
                ],
            };
        } else if (channel == "invite") {
            title = params.title || title;
            desc = params.content || desc;
        }

        tt.shareAppMessage({
            title: title,
            channel: channel,
            desc: desc,
            extra: extra,
            success(res: any) {
                self._endCb && self._endCb(true);
                self.videoPath = "";
                tt.showToast({
                    title: "分享成功",
                });
            },
            fail(e: Error) {
                self._endCb && self._endCb(false);
                tt.showToast({
                    title: "分享失败",
                });
            },
        });
    }

    vibrate(time: number): void {
        if (!tt) {
            console.error("TT not found");
            return;
        }
        let success = () => {};
        let fail = () => {
            egf.Logger.log("震动失败");
        };
        let complete = () => {};

        if (time < 400) {
            tt.vibrateShort({
                success: success,
                fail: fail,
                complete: complete,
            });
        } else {
            tt.vibrateLong({
                success: success,
                fail: fail,
                complete: complete,
            });
        }
    }
    // 实名认证
    public realNameAuth() {
        if (!tt) {
            console.error("tt not found");
            return;
        }
        tt.authenticateRealName({
            success(_res: any) {
                egf.Logger.log("用户实名认证成功");
            },
            fail(res: any) {
                egf.Logger.log("用户实名认证失败", res.errMsg);
            },
        });
    }
    public startRecord(): void {
        if (!tt) {
            console.error("tt not found");
            return;
        }
        var self = this;
        tt.getSystemInfo({
            success(res: any) {
                egf.Logger.log("getSystemInfo:", res);
                const screenWidth = res.screenWidth;
                const screenHeight = res.screenHeight;
                self.recorder = tt.getGameRecorderManager();
                var maskInfo = self.recorder.getMark();
                var x = (screenWidth - maskInfo.markWidth) / 2; //提出来
                var y = (screenHeight - maskInfo.markHeight) / 2; //提出来

                egf.Logger.log("recorder:", self.recorder);

                self.recorder.onStart((res: any) => {
                    egf.Logger.log("录屏开始");
                    // do something;
                    tt.showToast({
                        title: "录屏开始",
                    });
                });
                self.recorder?.onStop((res: any) => {
                    egf.Logger.log("地址：" + res.videoPath);
                    self.videoPath = res.videoPath;
                    // do somethine;
                });
                //添加水印并且居中处理
                self.recorder?.start({
                    // duration: 300,
                    isMarkOpen: true,
                    locLeft: x, //提出来
                    locTop: y, //提出来
                });
            },
            fail(res: any) {
                egf.Logger.log("getSystemInfo fail:", res);
            },
            complete() {
                egf.Logger.log("getSystemInfo complete");
            },
        });
    }
    public stopRecord(): void {
        if (!tt) {
            console.error("tt not found");
            return;
        }
        if (this.recorder) {
            this.recorder.stop();
            this.recorder = null;
        }
    }

    public addDesktop(): void {
        if (!tt) {
            console.error("tt not found");
            return;
        }
        tt.addDesktop();
    }

    public addSidebar(): void {
        if (!tt) {
            console.error("tt not found");
            return;
        }
        egf.Logger.log("addSidebar:", tt + ", " + tt.getSidebarActivity);

        tt.navigateToScene({
            scene: "sidebar",
            success: (data: any) => {
                egf.Logger.log("navigateToScene:", data);
            },
            fail: (data: any) => {
                egf.Logger.log("navigateToScene:", data);
            },
        });
    }

    /**
     * 打开系统设置界面
     */
    public openSystemSetting(): void {
        if (!tt) {
            console.error("tt not found");
            return;
        }
        tt.openSetting({
            success(res: any) {
                egf.Logger.log("打开系统设置成功:", res);
            },
            fail(res: any) {
                egf.Logger.log("打开系统设置失败:", res.errMsg);
            },
        });
    }

    public checkScene(cb: Function): void {
        if (!tt) {
            console.error("tt not found");
            return;
        }
        tt.checkScene({
            scene: "sidebar",
            success: (data: any) => {
                egf.Logger.log("checkScene:", data);
                cb && cb(true);
            },
            fail: (data: any) => {
                egf.Logger.log("checkScene fail:", data);
                cb && cb(false);
            },
        });
    }
}
