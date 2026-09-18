import { _decorator, Button, Component, Label, Node, Widget } from "cc";
const { ccclass, property } = _decorator;

@ccclass("Layout_UI_HUD")
export class Layout_UI_HUD extends Component {
    @property(Button)
    btnSetting: Button = null!;
    @property(Button)
    btnHelp: Button = null!;
    @property(Button)
    btnCoin: Button = null!;
    @property(Label)
    labelCoin: Label = null!;
    @property(Node)
    nodeCoin: Node = null!;
    @property(Node)
    nodeStamina: Node = null!;
    @property(Widget)
    widgetTop: Widget = null!;
    @property(Button)
    btnStamina: Button = null!;
    @property(Label)
    labelStamina: Label = null!;
    @property(Label)
    labelStaminaTime: Label = null!;
}
