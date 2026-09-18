import { _decorator, Button, Component, Label, Node } from "cc";
const { ccclass, property } = _decorator;

@ccclass("Layout_BuyFighter")
export class Layout_BuyFighter extends Component {
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
    @property(Node)
    nodeAd: Node = null!;

    public showInfo() {}
}
