import { _decorator, Button, Color, Component, Label, Node, RichText, Sprite, SpriteFrame } from "cc";
import { GameCfg } from "../game/scripts/GameConfig";
import { ModuleDef } from "../../scripts/ModuleDef";
import { DataMgr } from "../../scripts/DataMgr";
const { ccclass, property } = _decorator;

@ccclass("Layout_BuyFighter")
export class Layout_BuyFighter extends Component {
    @property(Button)
    btnBack: Button = null!;
    @property(Button)
    btnGet: Button = null!;
    @property(Button)
    btnDoubleGet: Button = null!;
    @property(RichText)
    labelTips: RichText = null!;
    @property(Label)
    labelCoin: Label = null!;
    @property(Sprite)
    spriteItem: Sprite = null!;

    public showInfo(fighterId: number, price: number) {
        const fighter = GameCfg.queryByID("fighter", fighterId.toString());

        this.labelTips.string = egf.i18nMgr.getText("战力提升") + `<color=#2EFF11>${fighter["fight"]}%</color>`;
        this.labelCoin.string = price.toString();
        if (DataMgr.userData?.money! < price) {
            this.btnGet.getComponent(Sprite)!.grayscale = true;
            this.labelCoin.color = new Color().fromHEX("#f23160");
        }
        //展示对应卡片
        egf.ResMgr.getAsset(ModuleDef.GAME, `texture/card/${fighter["type"]}/spriteFrame`, (sp: SpriteFrame) => {
            if (this.spriteItem.node.isValid) {
                this.spriteItem.spriteFrame = sp;
            }
        });
    }
}
