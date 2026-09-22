import { _decorator, Button, Component, Label, Node } from "cc";
const { ccclass, property } = _decorator;

@ccclass("Layout_Award")
export class Layout_Award extends Component {
    @property(Button)
    btnBack: Button = null!;
    @property(Button)
    btnGet: Button = null!;
    @property(Button)
    btnDoubleGet: Button = null!;
    @property(Label)
    labelContent: Label = null!;
    @property(Label)
    labelCoin: Label = null!;
    @property(Label)
    labelCoinAdd: Label = null!;
    @property(Node)
    nodeAd: Node = null!;

    public showInfo(bOnline: boolean, coin: number, addCoin: number, bDailyGift: boolean) {
        if (bOnline) {
            this.labelContent.string = egf.i18nMgr.getText("获得在线时长金币奖励");
            this.btnDoubleGet.node.active = true;
        } else if (bDailyGift) {
            this.labelContent.string = egf.i18nMgr.getText("获得每日金币奖励");
            this.btnDoubleGet.node.active = false;
        } else {
            this.labelContent.string = egf.i18nMgr.getText("观看广告获得金币奖励");
            this.btnDoubleGet.node.active = false;
        }
        this.labelCoin.string = "x" + coin;
        this.labelCoinAdd.string = "+" + addCoin;
        this.nodeAd.active = !bOnline;
    }
}
