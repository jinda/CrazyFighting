import { Util } from './../../framework/util';
import { _decorator, Component, Node, Vec3, LabelComponent, ProgressBarComponent, SpriteFrame, SpriteComponent, ButtonComponent, AnimationComponent, UITransformComponent } from "cc";
import { UIManager } from "../../framework/uiManager";
import { coinTipsManager } from "./coinTipsManager";
import { PlayerData } from "../../framework/playerData";
import { FighterManager } from "../../fight/fighterManager";
import Constants from "../../framework/constants";
import { ClientEvent } from "../../framework/clientEvent";
import { localConfig } from "../../framework/localConfig";
const { ccclass, property } = _decorator;
//战斗界面脚本
@ccclass("fightUI")
export class fightUI extends Component {

    @property(coinTipsManager)
    public coinTips: coinTipsManager = null!;//金币提示脚本

    @property(LabelComponent)
    public lbGold: LabelComponent = null!;//金币文本组件

    @property(LabelComponent)
    public lbSelf: LabelComponent = null!;//我方战力文本组件

    @property(LabelComponent)
    public lbEnemy: LabelComponent = null!;//敌方战力文本组件

    @property(LabelComponent)
    public lbLevel: LabelComponent = null!;//等级文本组件

    @property(ProgressBarComponent)
    public progressFighter: ProgressBarComponent = null!;//进度条组件

    @property(Node)
    public ndVS: Node = null!; //VS节点

    @property(Node)
    public ndTips: Node = null!;//火球技能提示节点

    @property(ButtonComponent)
    public btnSkillBtn: ButtonComponent = null!;//火球技能按钮组件

    @property(SpriteComponent)
    public spSkillBtn: SpriteComponent = null!;//火球技能图标

    @property(SpriteFrame)
    public sfSkillNormal: SpriteFrame = null!;//技能可使用状态的图标

    @property(SpriteFrame)
    public sfSkillDisable: SpriteFrame = null!;//技能不可使用状态的图标

    @property(Node)
    public ndCoolTime: Node = null!;//技能冷却文本提示节点

    @property(LabelComponent)
    public lbCoolTime: LabelComponent = null!;//技能冷却文本组件

    @property(Node)
    public ndReset: Node = null!;//左上角重玩按钮
    
    @property(Node)
    public ndHand: Node = null!;//手指提示节点

    //设置技能按钮是否可以点击
    public set skillBtnEnable (enable: boolean) {
        this.btnSkillBtn.interactable = enable;
        this.spSkillBtn.spriteFrame = enable?this.sfSkillNormal:this.sfSkillDisable;
        this.ndCoolTime.active = !enable;
    }

    private _coolTime: number = 0;//技能冷却时间
    private _isUseFireBall: boolean = false;//是否已经使用火球技能
    private _currentTime: number = 0;//当前累加的时间
    private _preTime: number = 0;//之前的时间
    private _tweenHand: any = null!;//缓动对象
    private _gold: number = 0;//金币数量
    private _factor: number = 1;//系数：每个士兵掉落金币乘以本关加成系数
    private _manager: FighterManager = null!;//“管理所有士兵”的脚本
    private _vsPos: Vec3 = new Vec3();//vs进度条的位置

    start () {
        // Your initialization goes here.
    }

    onEnable () {
        ClientEvent.on(Constants.EVENT_NAME.DROP_COIN, this._dropCoin, this);
        ClientEvent.on(Constants.EVENT_NAME.GAME_OVER, this._gameOver, this);
    }

    onDisable () {
        ClientEvent.off(Constants.EVENT_NAME.DROP_COIN, this._dropCoin, this);
        ClientEvent.off(Constants.EVENT_NAME.GAME_OVER, this._gameOver, this);
    }

    /**
     * 展示界面
     * @param manager 
     */
    public show (manager: FighterManager) {
        this._manager = manager;

        this.lbLevel.string = `第 ${PlayerData.instance.playerInfo.level} 关`
        
        this.ndReset.active = PlayerData.instance.playerInfo.level >= 3; //重置按钮 3关以后才会展示

        this._updateFighterNum();

        this._gold = 0;

        let levelInfo = localConfig.instance.queryByID('level', PlayerData.instance.playerInfo.level.toString());
        if (levelInfo && levelInfo.coefficient) {
            this._factor = levelInfo.coefficient;
        } else {
            this._factor = 1;
        }

        this._updateGold();

        this._coolTime = 0;
        this.skillBtnEnable = true;

        this._isUseFireBall = false;

        this._currentTime = 0;
        this._preTime = 0;

        this.ndTips.active = false;
        this.ndTips.getComponent(AnimationComponent)?.stop();
        this.ndHand.active = false;
        if (this._tweenHand) {
            this._tweenHand.stop();
            this._tweenHand = null;
        }
    }

    /**
     * 更新UI界面上的敌我双方战力和进度条
     */
    private _updateFighterNum () {
        let numSelf = this._manager.getFighterFight(true);
        this.lbSelf.string = numSelf.toString();

        let numEnemy = this._manager.getFighterFight(false);
        this.lbEnemy.string = numEnemy.toString();

        let progress = numSelf * 1.0 / (numSelf + numEnemy);
        this.progressFighter.progress = progress;

        this._vsPos.set(this.ndVS.position);
        let UIComProgressFighter = this.progressFighter.node.getComponent(UITransformComponent) as UITransformComponent;
        this._vsPos.x = UIComProgressFighter.contentSize.width * (progress - 0.5);
        this.ndVS.position = this._vsPos;
    }

    /**
     * 更新金币数值
     */
    private _updateGold () {
        this.lbGold.string = this._gold.toString();
    }

    /**
     * 在士兵头上展示金币
     * @param coin 
     * @param posWorld 
     */
    private _dropCoin (coin: number, posWorld: Vec3) {
        //策划需求，每个士兵掉落金币乘以本关加成系数
        coin = this._factor * coin;

        if (coin > 0) {
            //1. 展示获得金币提示
            this.coinTips.dropCoin(coin, posWorld);

            //2. 更新获得金币数
            this._gold += coin;
            this._updateGold();
        }

        //3.更新UI上的敌我双方人数和进度条
        this._updateFighterNum();
    }

    /**
     * 点击重置按钮
     */
    public onBtnResetClick () {
        this.reset();
    }

    /**
     * 重置游戏
     *
     * @memberof fightUI
     */
    public reset () {
        this.coinTips.recycle();

        ClientEvent.dispatchEvent(Constants.EVENT_NAME.FIGHT_RESET);

        UIManager.instance.hideDialog('fight/fightUI');
        UIManager.instance.showDialog('home/homeUI');
    }

    /**
     * 结束结束
     * @param isWin 
     */
    private _gameOver (isWin: boolean) {
        this.scheduleOnce(()=>{
            UIManager.instance.showDialog('fight/balance', [isWin, this._gold, this]);
        }, 2);
    }

    /**
     * 使用火球技能
     */
    private _useFillBall () {
        this._isUseFireBall = true;
        this.skillBtnEnable = false;
        this._coolTime = 10;

        ClientEvent.dispatchEvent(Constants.EVENT_NAME.USE_FIRE_BALL);
    }

    /**
     *  点击技能按钮
     * @memberof fightUI
     */
    public onBtnSkillClick () {
        this._isUseFireBall = true;
        if (this.ndTips.active) {
            this.ndTips.active = false;
            this.ndTips.getComponent(AnimationComponent)?.stop();
        }

        if (this.ndHand.active) {
            this.ndHand.active = false;
            if (this._tweenHand) {
                this._tweenHand.stop();
                this._tweenHand = null;
            }
        }

        this._useFillBall();

        if (!PlayerData.instance.playerInfo.hasUsedFireBall) {
            PlayerData.instance.markUseFireBall();
        } 
    }

    update (deltaTime: number) {
        this._currentTime += deltaTime;

        if (this._preTime !== Math.floor(this._currentTime) && !this._isUseFireBall) {
            this._preTime = Math.floor(this._currentTime);
        }

        if (this._coolTime > 0 && this.ndCoolTime.active) {
            this._coolTime -= deltaTime;
            let time = Math.round(this._coolTime);

            this.lbCoolTime.string = Util.formatTimeForSecond(time);

            if (this._coolTime <= 0) {
                this._coolTime = 0;
                this.skillBtnEnable = true;
            }
        }
    }
}
