import { _decorator, Node, Button, Component, Label, Animation, Sprite, v3, UITransform } from "cc";
import { Constants } from "../../scripts/Constants";
import { DataMgr } from "../../scripts/DataMgr";
import { GameMgr } from "../game/scripts/GameMgr";
const { ccclass, property } = _decorator;

@ccclass("Layout_Fighter")
export class Layout_Fighter extends Component {
    @property(Button)
    btnSkill: Button = null!;
    @property(Label)
    labelLevel: Label = null!;
    @property(Label)
    labelMyCount: Label = null!;
    @property(Label)
    labelEnemyCount: Label = null!;
    @property(Sprite)
    spriteMyProgress: Sprite = null!;
    @property(Sprite)
    spriteEnemyProgress: Sprite = null!;
    @property(Animation)
    skillTipsAnim: Animation = null!;
    @property(Label)
    labelSkillCD: Label = null!;
    @property(Sprite)
    spriteSkillGray: Sprite = null!;
    @property(Node)
    nodeHand: Node = null!;
    @property(Node)
    nodeVS: Node = null!;
    @property(Node)
    nodeCoin: Node = null!;
    @property(Label)
    labelCoin: Label = null!;

    private _skillCD: number = 0; //技能冷却时间
    private readonly _skillCountDownCallback = () => this.skillCountDown();

    showInfo() {
        this.labelCoin.string = "x0";
        this.showSkillStatus(false);
        this.labelLevel.string = egf.i18nMgr.getText("第#0关", [DataMgr.level + ""]);
    }

    /**
     * 更新金币数值
     */
    public updateCoin(coin: number) {
        this.labelCoin.string = coin.toString();
    }

    /**
     * 更新UI界面上的敌我双方战力和进度条
     */
    public updateFighterNum(myNum: number, emenyNum: number) {
        this.labelMyCount.string = myNum.toString();
        this.labelEnemyCount.string = emenyNum.toString();

        let progress = (myNum * 1.0) / (myNum + emenyNum);
        this.spriteMyProgress.fillRange = progress;

        const x = this.spriteMyProgress.node.x + this.spriteMyProgress.getComponent(UITransform)!.width * progress;
        this.nodeVS.position = v3(x, this.spriteMyProgress.node.y);
    }

    public showSkillStatus(use: boolean) {
        this.unschedule(this._skillCountDownCallback);
        this._skillCD = use ? Constants.SkillCD : 0;
        this.skillCountDown();
        if (use) {
            this.btnSkill.interactable = false;
            this.schedule(this._skillCountDownCallback, 1);
            if (this.skillTipsAnim.node.active) {
                this.skillTipsAnim.node.active = false;
                this.skillTipsAnim.stop();
            }
            if (this.nodeHand.active) {
                this.nodeHand.active = false;
            }
        } else {
            this.btnSkill.interactable = true;
        }
    }

    protected skillCountDown() {
        if (this._skillCD <= 0) {
            this.btnSkill.interactable = true;
            this.unschedule(this._skillCountDownCallback);
            this.spriteSkillGray.node.active = false;
            this.labelSkillCD.string = "";
            return;
        }

        if (GameMgr.isGamePause) {
            return;
        }

        if (this._skillCD > 0) {
            this._skillCD -= 1;
            this.labelSkillCD.string = this._skillCD + "";
            this.spriteSkillGray.node.active = true;
            this.spriteSkillGray.fillRange = this._skillCD / Constants.SkillCD;
        }
    }

    protected onDisable() {
        this.unschedule(this._skillCountDownCallback);
    }
}
