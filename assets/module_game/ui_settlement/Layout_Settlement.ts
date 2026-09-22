import { _decorator, Node, Button, Component, Label } from "cc";
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
    }
}
