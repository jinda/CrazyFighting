import { _decorator, Component, director, game, Label, Prefab, sys, ProgressBar, Node } from "cc";
import { ModuleDef } from "../scripts/ModuleDef";
import { SceneDef } from "../scripts/SceneDef";
import { DataMgr } from "../scripts/DataMgr";

import StartResPkg from "../scripts/StartResPkg";
import { ClientApi } from "../scripts/ClientApi";
import { EPlatform, PlatformMgr } from "../scripts/SDK/PlatformMgr";
import { IAdConfigData, ILoginData } from "../scripts/apiInterface";
import { LocalDataMgr } from "../scripts/LocalDataMgr";
import { GetEnvConfig } from "../scripts/config/EnvConfig";
import { ELanguage } from "../core_code/base/i18nMgr";

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

    @property(Node)
    nodeGameHeath: Node = null!;

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
        DataMgr.startEnterGame();
        // 初始化 ClientApi（设置 X-Game-Code Header）
        ClientApi.inst.init();
        LocalDataMgr.loadData();

        PlatformMgr.init(() => {
            egf.Logger.log("Platform init complete");
        });

        egf.ResMgr.preloadResPackage("start", StartResPkg, this.onResLoaded.bind(this), () => {
            this.onPreloadingComplete();
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
            this.nodeGameHeath.active = egf.i18nMgr.language == ELanguage["zh-cn"];
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
        egf.SceneUtil.loadScene(SceneDef.GAME);
        PlatformMgr.reportEvent("loading_time", { time: game.totalTime });
    }

    private login() {
        const params = {
            failCb: () => {
                this.onLoginFail(-1, "平台登录失败");
            },
            successCb: (code: string) => {
                egf.Logger.log("platform login success");
                //微信和 SUD 使用一次性 code；其余平台沿用游客身份。
                if (PlatformMgr.platform === EPlatform.WeChat || PlatformMgr.platform === EPlatform.SUD) {
                    ClientApi.inst.oauthLogin(
                        PlatformMgr.platform === EPlatform.SUD ? "sud" : "wechat",
                        { code },
                        undefined,
                        undefined,
                        this.onLoginSuccess.bind(this),
                        this.onLoginFail.bind(this),
                    );
                } else {
                    // 生成或复用设备 ID 作为游客身份
                    let deviceId = sys.localStorage.getItem("device_id");
                    if (!deviceId) {
                        deviceId = "dev-" + Date.now().toString(36) + "-" + Math.random().toString(36).substr(2, 9);
                        sys.localStorage.setItem("device_id", deviceId);
                    }
                    ClientApi.inst.oauthLogin(
                        "guest",
                        { device_id: deviceId },
                        undefined,
                        undefined,
                        this.onLoginSuccess.bind(this),
                        this.onLoginFail.bind(this),
                    );
                }
            },
        };

        PlatformMgr.login(params);
    }

    private initAd() {
        //在业务登录成功后读取，兼容当前 ClientApi 的本地 token 检查。
        let channel = "wechat";
        if (PlatformMgr.platform === EPlatform.SUD) {
            channel = "sud";
        } else if (PlatformMgr.platform === EPlatform.Android) {
            channel = "admob";
        }
        ClientApi.inst.getAdConfig(
            channel,
            (data: IAdConfigData | undefined) => {
                PlatformMgr.initAd(data);
            },
            () => {
                PlatformMgr.initAd(null);
            },
        );
    }

    /**
     * 登录成功后处理
     */
    private onLoginSuccess(data: ILoginData) {
        this.initAd();
        DataMgr.userData = data.user_info;
        // ClientApi 内部已设置 Authorization Header
        LocalDataMgr.loadCloud(() => {
            this.dataReady = true;
            this.tryEnterGame();
        });
        ClientApi.inst.foreground();
    }

    private onLoginFail(errcode: number, errmsg: string) {
        PlatformMgr.initAd(null);
        egf.Logger.warn("oauthLogin fail, errcode:", errcode, " errmsg:" + errmsg);
        this.dataReady = true;
        this.tryEnterGame();
    }
}
