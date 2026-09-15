import { _decorator, Component, SpriteComponent } from "cc";
import { PlayerData } from "../../framework/playerData";
import { UIManager } from "../../framework/uiManager";
import { GuideManager } from "../guide/guideManager";
import { AudioManager } from "../../framework/audioManager";
import Constants from "../../framework/constants";
import { ClientEvent } from "../../framework/clientEvent";
import { ResourceUtil } from "../../framework/resourcesUtils";
import { localConfig } from "../../framework/localConfig";
const { ccclass, property } = _decorator;
//购买士兵界面
@ccclass("buyFighter")
export class buyFighter extends Component {
    @property(SpriteComponent)
    public spCardDouble: SpriteComponent = null!;//士兵图标组件

    private _fighterId: number = 0;//士兵编号/种类
    private _pos: number = 0;//购买后士兵放在指定格子的位置
    private _callback: Function = null!;//回调函数

    start () {
        // Your initialization goes here.
    }

    /**
     * 展示界面
     * @param fighterId 士兵编号/种类
     * @param pos 阵型上格子的位置
     * @param callback 回调函数
     * @returns 
     */
    public show (fighterId: number, pos: number, callback: Function) {
        this._fighterId = fighterId;
        this._pos = pos;
        this._callback = callback;

        if (GuideManager.instance.isPlayingBuyGuide()) {
            this.onBtnNormalClick();
            return;
        }
        
        let fighter = localConfig.instance.queryByID('fighter', this._fighterId.toString());

        //展示对应卡片
        ResourceUtil.getCard(fighter['type'], (err: any, sf: any)=>{
            if (this.spCardDouble.node.isValid) {
                this.spCardDouble.spriteFrame = sf;
            }
        });
    }

    /**
     * 点击购买按钮
     */
    public onBtnNormalClick () {

        //关闭自身界面
        UIManager.instance.hideDialog('home/buyFighter');

        //数据修改
        PlayerData.instance.addFighter(this._pos, this._fighterId);

        //通知刷新界面
        ClientEvent.dispatchEvent(Constants.EVENT_NAME.BUY_FIGHTER, this._pos, this._fighterId);

        AudioManager.instance.playSound(Constants.AUDIO_SOUND.BUY_FIGHTER);

        //增加购买次数
        PlayerData.instance.addBuyTimes();

        //顺便更新下战力
        ClientEvent.dispatchEvent(Constants.EVENT_NAME.UPDATE_FORMATION);

        this._callback && this._callback();
    }

    // update (deltaTime: number) {
    //     // Your update function goes here.
    // }
}
