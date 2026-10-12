import { _decorator, Component, director, game, Label, Prefab, sys, ProgressBar } from "cc";
import { ModuleDef } from "../scripts/ModuleDef";
import { SceneDef } from "../scripts/SceneDef";
import { DataMgr } from "../scripts/DataMgr";

import StartResPkg from "../scripts/StartResPkg";
import { ClientApi } from "../scripts/ClientApi";
import { EPlatform, PlatformMgr } from "../scripts/SDK/PlatformMgr";
import { IAdConfigData, ILoginData } from "../scripts/apiInterface";
import { LocalDataMgr } from "../scripts/LocalDataMgr";
import { GetEnvConfig } from "../scripts/config/EnvConfig";

const { ccclass, property } = _decorator;

const _FPS = 61;

@ccclass("Start")
export class Start extends Component {
    @property(Label)
    txtLoading: Label = null!;

    @property(Prefab)
    uiCanvasPrefab: Prefab = null!;

    @property(ProgressBar)
    loadingBar: ProgressBar = null!;

    private resourcesReady = false;
    private dataReady = false;
    private sceneLoadStarted = false;

    protected onLoad(): void {
        PlatformMgr.reportEvent("game_show", {
            time: game.totalTime,
        });
    }

    start() {
        egf.ModuleContext.setDefaultModule(ModuleDef.GAME);

        game.frameRate = _FPS;
        egf.AudioMgr.bundleName = ModuleDef.SOUNDS;
        egf.i18nMgr.bundleName = ModuleDef.I18N;
        egf.UIMgr.setup(this.uiCanvasPrefab!, egf.UILayers.NUM, egf.UILayerNames);

        const { version } = GetEnvConfig();
        DataMgr.version = version;
        // 初始化 ClientApi（设置 X-Game-Code Header）
        ClientApi.inst.init();

        PlatformMgr.init(() => {
            egf.Logger.log("Platform init complete");
        });

        egf.ResMgr.preloadResPackage("start", StartResPkg, this.onResLoaded.bind(this), () => {
            this.onPreloadingComplete();
        });

        void LocalDataMgr.prepareInitialData(() => DataMgr.startCoinSync(Start.loginServer))
            .then((result) => {
                egf.Logger.log("[Start] data ready:", result.source, result.state);
                this.dataReady = true;
                this.tryEnterGame();
            })
            .catch((error: unknown) => {
                egf.Logger.error("[Start] data preparation failed:", error);
                this.dataReady = true;
                this.tryEnterGame();
            });

        this.login();
    }

    onResLoaded(now: number, total: number) {
        egf.Logger.log("onResLoaded:" + now + "/" + total);

        const percent = ~~((now / total) * 100) + "%";
        this.txtLoading!.string = percent;
        this.loadingBar!.progress = now / total;
        if (now == 1) {
            egf.i18nMgr.setLanguage(LocalDataMgr.Setting.language);
        }
    }

    onPreloadingComplete() {
        this.resourcesReady = true;
        this.tryEnterGame();
    }

    private tryEnterGame() {
        if (!this.resourcesReady || !this.dataReady || this.sceneLoadStarted) {
            return;
        }
        this.sceneLoadStarted = true;
        egf.i18nMgr.setLanguage(LocalDataMgr.Setting.language);
        director.loadScene(SceneDef.GAME.name);
        PlatformMgr.reportEvent("loading_time", { time: game.totalTime });
    }

    login() {
        let channel = "wechat";
        switch (PlatformMgr.platform) {
            case EPlatform.WeChat:
                channel = "wechat";
                break;
            case EPlatform.Android:
                channel = "admob";
                break;
            case EPlatform.TT:
                channel = "tt";
                break;
            default:
                break;
        }
        // 拉取广告配置（无需认证）
        ClientApi.inst.getAdConfig(
            channel,
            (data: IAdConfigData) => {
                PlatformMgr.initAd(data);
            },
            (errcode, errmsg) => {
                egf.Logger.warn("getAdConfig fail:", errcode, errmsg);
                PlatformMgr.initAd(null);
            },
        );
    }
    /** 登录回调不捕获启动组件，切换场景后仍可用于自动重连。 */
    private static loginServer(onSuccess: (data: ILoginData) => void, onFailure: () => void) {
        const onError = (errcode: number, errmsg: string) => {
            egf.Logger.warn("[Start] 登录失败，继续使用本地数据:", errcode, errmsg);
            onFailure();
        };
        PlatformMgr.login({
            failCb: () => onError(-1, "平台登录失败"),
            successCb: (code: string) => {
                if (PlatformMgr.platform === EPlatform.WeChat) {
                    ClientApi.inst.oauthLogin("wechat", { code }, undefined, undefined, onSuccess, onError);
                    return;
                }
                let deviceId = sys.localStorage.getItem("device_id");
                if (!deviceId) {
                    deviceId = "dev-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 9);
                    sys.localStorage.setItem("device_id", deviceId);
                    LocalDataMgr.GameInfo.deviceID = deviceId;
                }
                ClientApi.inst.oauthLogin("guest", { device_id: deviceId }, undefined, undefined, onSuccess, onError);
            },
        });
    }
}
