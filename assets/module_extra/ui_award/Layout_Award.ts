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
    @property(Node)
    nodeStamina: Node = null!;
    @property(Node)
    nodeCoin: Node = null!;

    public showInfo(type: number, coin: number, addCoin: number) {
        this.nodeStamina.active = false;
        this.nodeCoin.active = true;
        this.nodeAd.active = false;
        if (type == 1) {
            this.labelContent.string = egf.i18nMgr.getText("获得在线时长金币奖励");
            this.btnDoubleGet.node.active = true;
        } else if (type == 2) {
            this.labelContent.string = egf.i18nMgr.getText("分享获得每日金币奖励");
            this.btnDoubleGet.node.active = false;
        } else if (type == 3) {
            this.labelContent.string = egf.i18nMgr.getText("士兵累啦，看个广告充充电？");
            this.btnDoubleGet.node.active = false;
            this.nodeStamina.active = true;
            this.nodeCoin.active = false;
            this.nodeAd.active = true;
        } else {
            this.labelContent.string = egf.i18nMgr.getText("观看广告获得金币奖励");
            this.btnDoubleGet.node.active = false;
            this.nodeAd.active = true;
        }
        this.labelCoin.string = "x" + coin;
        this.labelCoinAdd.string = "+" + addCoin;

    }
}
