import { AudioManager } from "./framework/audioManager";
import { _decorator, BlockInputEvents, Color, Component, find, game, Label, Node, UITransform } from "cc";
import { UIManager } from "./framework/uiManager";
import { PlayerData } from "./framework/playerData";
import { GuideManager } from "./ui/guide/guideManager";
import { GameLogic } from "./framework/gameLogic";
import { ClientEvent } from "./framework/clientEvent";
import { localConfig } from "./framework/localConfig";
import { StorageManager } from "./framework/storageManager";
import Constants from "./framework/constants";
const { ccclass } = _decorator;
//入口文件：挂载到fight场景的canvas节点下
@ccclass("main")
export class main extends Component {
    /* class member could be defined like this */
    // dummy = '';

    /* use `property` decorator if your want the member to be serializable */
    // @property
    // serializableDummy = 0;

    onLoad() {
        //设置游戏帧率
        game.frameRate = 60;

        //开启调试
        // profiler.showStats();

        //加载玩家相关数据
        PlayerData.instance.loadGlobalCache();
        if (!PlayerData.instance.userId) {
            //生成个随机账号
            PlayerData.instance.generateRandomAccount();
            PlayerData.instance.createPlayerInfo();
        }

        //加载本地缓存数据
        PlayerData.instance.loadFromCache();

        //加载csv 相关配置（失败/超时统一走 errCb，成功回调不接收错误参数）
        localConfig.instance.loadConfig(
            () => {
                this._loadFinish();
            },
            (err: Error) => {
                this._showLoadError(err);
            },
        );

        //引导
        GuideManager.instance.startGuide();

        //音效初始化
        AudioManager.instance.init();

        //@ts-ignore
        if (window.wx) {
            //@ts-ignore
            window.wx.getSystemInfo({
                success: (res: any) => {
                    if (res.platform === "android") {
                        GameLogic.isEnableVibrate = false;
                    }
                },
            });
        }
    }

    onDestroy() {
        //场景销毁/退出时清理全局计时器：避免残留的 interval 在场景重建后继续叠加或后台空跑
        GameLogic.stopOnlineReward();
        StorageManager.instance.dispose();
    }

    /**
     * 配置表加载失败/超时时的兜底提示（运行时生成，不依赖额外预制体）
     * 原来失败会静默卡在黑屏，玩家无法自助恢复
     */
    private _showLoadError(err: any) {
        console.error("[BOOT] 配置表加载失败，游戏无法继续：", err);

        let ndCanvas = find("Canvas");
        if (!ndCanvas || ndCanvas.getChildByName("loadErrorTips")) {
            return;
        }

        let ndTips = new Node("loadErrorTips");
        ndTips.layer = ndCanvas.layer; //必须与 Canvas 同 layer，否则 UI 相机会忽略该节点
        ndCanvas.addChild(ndTips);
        ndTips.setPosition(0, 0, 0);

        let uiTransform = ndTips.addComponent(UITransform);
        uiTransform.setContentSize(960, 640);

        //拦截所有触摸，避免玩家点到下层界面
        ndTips.addComponent(BlockInputEvents);

        let label = ndTips.addComponent(Label);
        label.string = "配置加载失败\n请检查网络后重新进入游戏";
        label.fontSize = 44;
        label.lineHeight = 56;
        label.color = Color.WHITE;
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        label.overflow = Label.Overflow.RESIZE_HEIGHT;
    }

    /**
     * 加载结束
     */
    private _loadFinish() {
        PlayerData.instance.isLoadFinished = true;

        ClientEvent.dispatchEvent(Constants.EVENT_NAME.GAME_INIT);

        //显示主界面
        //第1关不展示，直接开始游戏
        if (PlayerData.instance.playerInfo.level !== 1) {
            UIManager.instance.showDialog("home/homeUI");
        }
    }
}
