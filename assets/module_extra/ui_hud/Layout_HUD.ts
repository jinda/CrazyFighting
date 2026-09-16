import { _decorator, Button, Component, Label, Node, Widget } from "cc";
const { ccclass, property } = _decorator;

@ccclass("Layout_UI_HUD")
export class Layout_UI_HUD extends Component {
  @property(Button)
  btnSetting: Button;
  @property(Button)
  btnHelp: Button;
  @property(Button)
  btnCoin: Button;
  @property(Label)
  labelCoin: Label;
  @property(Node)
  nodeCoin: Node;
  @property(Node)
  nodeStamina: Node;
  @property(Widget)
  widgetTop: Widget;
  @property(Button)
  btnStamina: Button;
  @property(Label)
  labelStamina: Label;
  @property(Label)
  labelStaminaTime: Label;
}
