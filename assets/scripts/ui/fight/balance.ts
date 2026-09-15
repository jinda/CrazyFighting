import { _decorator, Component, Node, LabelComponent, SpriteComponent, SpriteFrame, Vec3, Tween, WidgetComponent } from "cc";
import { GameLogic } from "../../framework/gameLogic";
import { PlayerData } from "../../framework/playerData";
import { fightUI } from "./fightUI";
import { UIManager } from "../../framework/uiManager";
import { localConfig } from "../../framework/localConfig";
const { ccclass, property } = _decorator;
//结算界面脚本
@ccclass("balance")
export class balance extends Component {
    /* class member could be defined like this */
    // dummy = '';

    /* use `property` decorator if your want the member to be serializable */
    // @property
    // serializableDummy = 0;

    @property(SpriteComponent)
    public spResultBg: SpriteComponent = null!;//胜负结果图标组件

    @property(SpriteComponent)
    public spResultTitle: SpriteComponent = null!;//胜负结果标题

    @property(Node)
    public ndHalo: Node = null!;//亮光节点，胜利时用到

    @property(SpriteFrame)
    public sfBgWin: SpriteFrame = null!;//胜利图标

    @property(SpriteFrame)
    public sfBgFailed: SpriteFrame = null!;//失败图标

    @property(SpriteFrame)
    public sfTitleWin: SpriteFrame = null!;//胜利标题

    @property(SpriteFrame)
    public sfTitleFailed: SpriteFrame = null!;//失败标题

    @property(LabelComponent)
    public lbGold: LabelComponent = null!;//金币文本组件

    @property(LabelComponent)
    public lbLevel: LabelComponent = null!;//等级文本组件

    private _rewardCoin: number = 0;//奖励的金币数量
    private _isWin: boolean = false;//是否胜利
    private _parent: fightUI = null!;//fightUI脚本
    private _tweenRotate: any = null!;//缓动对象
    private _oriEuler: Vec3 = new Vec3();//当前角度
    private _targetEuler: Vec3 = new Vec3(0, 0, -360);//目标角度

    start () {
        // Your initialization goes here.
    }

    onDisable () {
        //重置缓动对象
        if (this._tweenRotate) {
            this._tweenRotate.stop();
            this._tweenRotate = null!;
        }
    }

    /**
     * 展示
     * @param isWin 是否胜利
     * @param coin 金币值
     * @param parent fightUI脚本
     * @returns 
     */
    public show (isWin: boolean, coin: number, parent: fightUI) {
        let sfBg = this.sfBgWin;
        let sfTitle = this.sfTitleWin;

        PlayerData.instance.isLastFightWin = isWin;

        if (!isWin) {
            // AudioManager.instance.playSound(Constants.AUDIO_SOUND.FAIL);

            sfBg = this.sfBgFailed;
            sfTitle = this.sfTitleFailed;
            this.ndHalo.active = false;
        } else {
            // AudioManager.instance.playSound(Constants.AUDIO_SOUND.WIN);

            this.ndHalo.active = true;

            if (this._tweenRotate) {
                this._tweenRotate.stop();
                this._tweenRotate = null;
            }

            this._oriEuler.set(0, 0, 0);
            this.ndHalo.eulerAngles = this._oriEuler;
            this._tweenRotate = new Tween(this.ndHalo)
                    .by(2, {eulerAngles: this._targetEuler})
                    .repeatForever()
                    .start();

            let levelInfo = localConfig.instance.queryByID('level', PlayerData.instance.playerInfo.level.toString());
            if (levelInfo && levelInfo.gold) {
                coin += levelInfo.gold;
            }
        }

        this.lbGold.string = coin.toString();

        this.spResultBg.spriteFrame = sfBg;
        this.spResultTitle.spriteFrame = sfTitle;

        this.lbLevel.string = `第 ${PlayerData.instance.playerInfo.level} 关`;

        this._rewardCoin = coin;
        this._isWin = isWin;

        this._parent = parent;

        if (PlayerData.instance.playerInfo.level < 3) {
            this.reward(false);
            return;
        }
    }

    /**
     * 点击再来一局
     */
    public onBtnNextClick () {
        this.reward(false); //奖励并返回主界面
    }

    /**
     * 下发奖励
     * @param isDouble 是否双倍
     */
    public reward (isDouble: boolean) {
        let reward = isDouble?this._rewardCoin*3:this._rewardCoin;

        //增加金币
        GameLogic.addGold(reward);

        if (this._isWin) {
            //胜利的话还需要通过关卡
            PlayerData.instance.passLevel();
        }

        //关闭界面，回到开始界面
        UIManager.instance.hideDialog('fight/balance');
        this._parent.reset();
    }

    // update (deltaTime: number) {
    //     // Your update function goes here.
    // }
}
