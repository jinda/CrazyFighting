import { _decorator, Node, Button, Component, Label, SpriteFrame, Sprite, isValid } from "cc";
import { ModuleDef } from "../../scripts/ModuleDef";
const { ccclass, property } = _decorator;

@ccclass("Layout_Settlement")
export class Layout_Settlement extends Component {
    @property(Button)
    btnBack: Button = null!;
    @property(Button)
    btnNext: Button = null!;
    @property(Button)
    btnRetry: Button = null!;
    @property(Label)
    labelLevel: Label = null!;
    @property(Label)
    labelCoin: Label = null!;
    @property(Label)
    labelCoinAdd: Label = null!;
    @property(Node)
    nodeWin: Node = null!;
    @property(Node)
    nodeLose: Node = null!;
    @property(Node)
    nodeWinEffect1: Node = null!;
    @property(Node)
    nodeWinEffect2: Node = null!;
    @property(Node)
    nodeUnlock: Node = null!;
    @property(Sprite)
    spriteItem: Sprite = null!;
    @property(Label)
    labelHeroName: Label = null!;

    showInfo(bWin: boolean, level: number, coin: number, addCoin: number) {
        this.labelLevel.string = egf.i18nMgr.getText("第#0关", [level + ""]);
        this.labelCoin.string = "x" + coin;
        this.labelCoinAdd.string = "+" + addCoin;

        this.nodeWin.active = bWin;
        this.nodeLose.active = !bWin;
        this.nodeWinEffect1.active = bWin;
        this.nodeWinEffect2.active = bWin;
        this.btnNext.node.active = bWin;
        this.btnRetry.node.active = !bWin;
        this.nodeUnlock.active = false;
    }

    showUnlockHero(model: string, name: string) {
        //展示对应卡片
        this.labelHeroName.string = egf.i18nMgr.getText(name);
        egf.ResMgr.getAsset(ModuleDef.GAME, `texture/card/${model}/spriteFrame`, (sp: SpriteFrame) => {
            if (isValid(this.spriteItem)) {
                this.spriteItem.spriteFrame = sp;
            }
        });
    }
}
