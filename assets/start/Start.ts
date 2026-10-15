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
        director.loadScene(SceneDef.GAME.name);
        PlatformMgr.reportEvent("loading_time", { time: game.totalTime });
    }

    private login() {
        const params = {
            failCb: () => {
                egf.Logger.log("login fail");
            },
            successCb: (code: string) => {
                egf.Logger.log("platform login success");
                // 微信平台使用 wx.login 的 code 进行 oauthlogin
                // 其他平台使用 guest + device_id 游客登录
                if (PlatformMgr.platform == EPlatform.WeChat) {
                    ClientApi.inst.oauthLogin(
                        "wechat",
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

        // 拉取广告配置（无需认证）
        let channel = "wechat";
        if (PlatformMgr.platform == EPlatform.Android) {
            channel = "admob";
        }
        ClientApi.inst.getAdConfig(
            channel,
            (data: IAdConfigData) => {
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
        DataMgr.userData = data.user_info;
        // ClientApi 内部已设置 Authorization Header
        LocalDataMgr.loadCloud(() => {
            this.dataReady = true;
            this.tryEnterGame();
        });
    }

    private onLoginFail(errcode: number, errmsg: string) {
        egf.Logger.warn("oauthLogin fail, errcode:", errcode, " errmsg:" + errmsg);
        this.dataReady = true;
        this.tryEnterGame();
    }
}
