import { _decorator, assetManager, Component, director, game, Label, Prefab, Node, sys, ProgressBar } from "cc";
import { ModuleDef } from "../scripts/ModuleDef";
import { SceneDef } from "../scripts/SceneDef";
import { DataMgr } from "../scripts/DataMgr";

import StartResPkg from "../scripts/StartResPkg";
import { GetEnvConfig } from "../scripts/config/EnvConfig";
import { ClientApi } from "../scripts/ClientApi";
import { EPlatform, PlatformMgr } from "../scripts/SDK/PlatformMgr";

const { ccclass, property } = _decorator;

const _FPS = 61;

const _loadingText = ["Loading.", "Loading..", "Loading..."];

@ccclass("Start")
export class Start extends Component {
    @property(Label)
    txtLoading: Label;

    @property(Prefab)
    uiCanvasPrefab: Prefab;

    @property(ProgressBar)
    loadingBar: ProgressBar;

    private _percent: string = "";
    start() {
        egf.ModuleContext.setDefaultModule(ModuleDef.BASIC);

        game.frameRate = _FPS;
        egf.AudioMgr.inst.bundleName = ModuleDef.SOUNDS;
        egf.UIMgr.inst.setup(this.uiCanvasPrefab, egf.UILayers.NUM, egf.UILayerNames);
        // 初始化 ClientApi（设置 X-Game-Code Header）
        ClientApi.inst.init();

        DataMgr.inst.loadData();
        let channel = "wechat";
        // 初始化结果回调：解析并打印 JSON 字符串
        const onInit = (res: string) => {
            const config = egf.SafeJSON.parse(res);
            egf.Logger.log("PlatformMgr init:", res);
            DataMgr.inst.platformCfg = config;
        };
        PlatformMgr.init((params: any) => {
            egf.Logger.log("Platform init info:", params);
        });

        const params = {
            failCb: function () {
                egf.Logger.log("login fail");
            },
            successCb: function (code) {
                egf.Logger.log("login success");
                // 微信平台使用 wx.login 的 code 进行 oauthlogin
                // 其他平台使用 guest + device_id 游客登录
                if (PlatformMgr.platform == EPlatform.WeChat) {
                    ClientApi.inst.oauthLogin(
                        "wechat",
                        { code },
                        undefined,
                        undefined,
                        (data) => {
                            Start.onLoginSuccess(data);
                        },
                        (errcode, errmsg) => {
                            const msg = i18nMgr._getLabel(errmsg);
                            egf.UI_Tips.show(msg);
                        },
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
                        (data) => {
                            Start.onLoginSuccess(data);
                        },
                        (errcode, errmsg) => {
                            const msg = egf.i18nMgr.inst.getText(errmsg);
                            egf.UI_Tips.show(msg);
                        },
                    );
                }
            },
        };

        PlatformMgr.login(params);

        // 拉取广告配置（无需认证）
        ClientApi.inst.getAdConfig(channel);

        egf.Logger.log("language:", sys.language, sys.languageCode);

        let land = ELanguage[sys.language] || ELanguage.en;
        if (!DataMgr.inst.Setting.language) {
            DataMgr.inst.Setting.language = land;
        } else {
            land = DataMgr.inst.Setting.language;
        }
        i18nMgr.setLanguage(land);

        ResMgr.inst.preloadResPackage("start", StartResPkg, this.onResLoaded.bind(this), () => {
            this.onPreloadingComplete();
        });
    }

    /**
     * 登录成功后处理
     */
    private static onLoginSuccess(data) {
        // 保存到 DataMgr 兼容旧代码
        DataMgr.inst.userData = {
            uid: data.user_info?.uid,
            nickname: data.user_info?.nickname,
            avatar: data.user_info?.avatar,
        } as any;

        // ClientApi 内部已设置 Authorization Header
        DataMgr.inst.loadServerData();
        egf.Logger.log("login success, uid:", data.user_info?.uid);
    }

    onResLoaded(now: number, total: number) {
        egf.Logger.log("onResLoaded:" + now + "/" + total);

        this._percent = ~~((now / total) * 100) + "%";
        this.loadingBar.progress = now / total;
    }

    onPreloadingComplete() {
        i18nMgr.setLanguage(DataMgr.inst.Setting.language);
        director.loadScene(SceneDef.MAIN_MENU.name);
        PlatformMgr.inst.reportEvent("loading_time", { time: game.totalTime });
    }

    update(deltaTime: number) {
        if (this._percent) {
            this.txtLoading.string = "Loading..." + this._percent;
        } else {
            let idx = Math.floor(game.totalTime / 1000) % 3;
            this.txtLoading.string = _loadingText[idx];
        }
    }
}
