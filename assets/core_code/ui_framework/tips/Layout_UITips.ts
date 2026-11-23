import { _decorator, Component, Label, Node } from "cc";
const { ccclass, property } = _decorator;

@ccclass("Layout_UITips")
export class Layout_UITips extends Component {
  @property(Label)
  labelTips: Label;
  @property(Node)
  nodeTips: Node;
}
