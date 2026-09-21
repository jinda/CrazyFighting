import { _decorator, Component, director, game, Label, Prefab, sys, ProgressBar } from "cc";
import { ModuleDef } from "../scripts/ModuleDef";
import { SceneDef } from "../scripts/SceneDef";
import { DataMgr } from "../scripts/DataMgr";

import StartResPkg from "../scripts/StartResPkg";
import { ClientApi } from "../scripts/ClientApi";
import { EPlatform, PlatformMgr } from "../scripts/SDK/PlatformMgr";
import { IAdConfigData, ILoginData } from "../scripts/apiInterface";
import { LocalDataMgr } from "../scripts/LocalDataMgr";

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

    start() {
        egf.ModuleContext.setDefaultModule(ModuleDef.GAME);

        game.frameRate = _FPS;
        egf.AudioMgr.bundleName = ModuleDef.SOUNDS;
        egf.UIMgr.setup(this.uiCanvasPrefab!, egf.UILayers.NUM, egf.UILayerNames);
        // 初始化 ClientApi（设置 X-Game-Code Header）
        ClientApi.inst.init();

        PlatformMgr.init((params: any) => {
            egf.Logger.log("Platform init info:", params);
        });

        egf.ResMgr.preloadResPackage("start", StartResPkg, this.onResLoaded.bind(this), () => {
            this.onPreloadingComplete();
        });

        LocalDataMgr.loadData();

        this.login();
    }

    onResLoaded(now: number, total: number) {
        egf.Logger.log("onResLoaded:" + now + "/" + total);

        const percent = ~~((now / total) * 100) + "%";
        this.txtLoading!.string = percent;
        this.loadingBar!.progress = now / total;
    }

    onPreloadingComplete() {
        director.loadScene(SceneDef.GAME.name);
        PlatformMgr.reportEvent("loading_time", { time: game.totalTime });
    }

    login() {
        const params = {
            failCb: function () {
                egf.Logger.log("login fail");
            },
            successCb: function (code: any) {
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
                            const msg = egf.i18nMgr.getText(errmsg);
                            egf.UI_Toast.show(msg);
                        },
                    );
                } else {
                    // 生成或复用设备 ID 作为游客身份
                    let deviceId = sys.localStorage.getItem("device_id");
                    if (!deviceId) {
                        deviceId = "dev-" + Date.now().toString(36) + "-" + Math.random().toString(36).substr(2, 9);
                        sys.localStorage.setItem("device_id", deviceId);
                        LocalDataMgr.GameInfo.deviceID = deviceId;
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
                            const msg = egf.i18nMgr.getText(errmsg);
                            egf.UI_Toast.show(msg);
                        },
                    );
                }
            },
        };

        PlatformMgr.login(params);

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
        ClientApi.inst.getAdConfig(channel, (data: IAdConfigData) => {
            PlatformMgr.initAd(data);
        });
    }
    /**
     * 登录成功后处理
     */
    private static onLoginSuccess(data: ILoginData) {
        // 保存到 DataMgr 兼容旧代码
        DataMgr.userData = data.user_info;

        // ClientApi 内部已设置 Authorization Header
        LocalDataMgr.loadDataFromSever();
        egf.Logger.log("login success, uid:", data.user_info?.uid);
    }
}
