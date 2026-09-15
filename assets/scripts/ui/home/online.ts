import { _decorator, Component, LabelComponent, SpriteFrame, SpriteComponent } from "cc";
import { PlayerData } from "../../framework/playerData";
import { GameLogic } from "../../framework/gameLogic";
import { UIManager } from "../../framework/uiManager";
import Constants from "../../framework/constants";
import { ClientEvent } from "../../framework/clientEvent";
const { ccclass, property } = _decorator;
//在线奖励脚本
@ccclass("online")
export class online extends Component {
    /* class member could be defined like this */
    // dummy = '';

    /* use `property` decorator if your want the member to be serializable */
    // @property
    // serializableDummy = 0;

    @property(LabelComponent)
    public lbGold: LabelComponent = null!;//金币文本组件

    @property(LabelComponent)
    public lbGoldDouble: LabelComponent = null!;//双倍金币文本组件

    private _gold: number = 0;//金币数量
    private _callback: Function = null!;//回调函数

    start () {
        // Your initialization goes here.
    }

    /**
     * 展示该界面
     * @param callback 
     */
    public show (callback: Function) {
        this._callback = callback;
        this._gold = PlayerData.instance.getOnlineReward();

        this.lbGold.string = this._gold.toString();
        this.lbGoldDouble.string = (this._gold * 3).toString();
    }

    /**
     * 点击普通领取按钮
     */
    public onBtnNormalClick () {
        //显示奖励界面
        this.reward(false);
    }

    /**
     * 点击双倍领取按钮
     * @memberof online
     */
    public onBtnDoubleClick () {
        //双倍奖励
        this.reward(true);
    }

    /**
     * 获得奖励
     * @param isDouble 是否双倍
     */
    public reward (isDouble: boolean) {
        GameLogic.addGold(isDouble? this._gold * 3 : this._gold);

        PlayerData.instance.reduceOnlineReward(this._gold);

        ClientEvent.dispatchEvent(Constants.EVENT_NAME.UPDATE_ONLINE_REWARD);
        ClientEvent.dispatchEvent(Constants.EVENT_NAME.REC_ONLINE_REWARD);

        this._close();
    }

    /**
     * 点击关闭按钮
     */
    public onBtnCloseClick () {
        this._close();
    }

    /**
     * 关闭该界面
     */
    private _close () {
        UIManager.instance.hideDialog('home/online');
        this._callback && this._callback();
    }

    // update (deltaTime: number) {
    //     // Your update function goes here.
    // }
}
