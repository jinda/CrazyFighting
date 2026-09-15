import { AudioManager } from './framework/audioManager';
import { _decorator, Component, game, profiler } from "cc";
import { UIManager } from "./framework/uiManager";
import { PlayerData } from "./framework/playerData";
import { GuideManager } from "./ui/guide/guideManager";
import { GameLogic } from "./framework/gameLogic";
import { ClientEvent } from "./framework/clientEvent";
import { localConfig } from "./framework/localConfig";
import Constants from './framework/constants';
const { ccclass, property } = _decorator;
//入口文件：挂载到fight场景的canvas节点下
@ccclass("main")
export class main extends Component {
    /* class member could be defined like this */
    // dummy = '';

    /* use `property` decorator if your want the member to be serializable */
    // @property
    // serializableDummy = 0;

    onLoad () {
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

        //加载csv 相关配置
        localConfig.instance.loadConfig(()=>{
            this._loadFinish();
        })

        //引导
        GuideManager.instance.startGuide();

        //音效初始化
        AudioManager.instance.init();

        //@ts-ignore
        if (window.wx) {
            //@ts-ignore
            window.wx.getSystemInfo({
                success: (res: any)=>{
                    if (res.platform === 'android') {
                        GameLogic.isEnableVibrate = false;
                    }
                }
            })
        }
    }

    /**
     * 加载结束
     */
    private _loadFinish () {
        PlayerData.instance.isLoadFinished = true;

        ClientEvent.dispatchEvent(Constants.EVENT_NAME.GAME_INIT);

        //显示主界面
        //第1关不展示，直接开始游戏
        if (PlayerData.instance.playerInfo.level !== 1) {
            UIManager.instance.showDialog('home/homeUI');
        }
    }
}
