import { _decorator, Component, LabelComponent } from "cc";
import { ClientEvent } from "../../framework/clientEvent";
import Constants from "../../framework/constants";
import { GameLogic } from "../../framework/gameLogic";
import { PlayerData } from "../../framework/playerData";
import { UIManager } from "../../framework/uiManager";
import { homeUI } from "./homeUI";
const { ccclass, property } = _decorator;
//在线奖励脚本
@ccclass("homeUIOnline")
export class homeUIOnline extends Component {
    /* class member could be defined like this */
    // dummy = '';

    /* use `property` decorator if your want the member to be serializable */
    // @property
    // serializableDummy = 0;

    @property(LabelComponent)
    public lbGold: LabelComponent = null!;//金币文本组件

    @property(homeUI)
    public home: homeUI = null!;//homeUI脚本

    start () {
        // Your initialization goes here.

        GameLogic.startOnlineReward();

        this._updateReward();
    }

    onEnable () {
        ClientEvent.on(Constants.EVENT_NAME.UPDATE_ONLINE_REWARD, this._updateReward, this);
    }

    onDisable () {
        ClientEvent.off(Constants.EVENT_NAME.UPDATE_ONLINE_REWARD, this._updateReward, this);
    }

    /*
     * 更新在线奖励的值
     */
    private _updateReward () {
        this.lbGold.string = PlayerData.instance.getOnlineReward().toString();
    }

    /**
     * 点击领取按钮
     */
    public onBtnOnlineClick () {
        //显示奖励界面
        UIManager.instance.showDialog('home/online', [()=>{
        }]);

        this.home.hideHand();
    }

    // update (deltaTime: number) {
    //     // Your update function goes here.
    // }
}
