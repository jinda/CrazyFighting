import { _decorator, Component, Label, Node, RichText } from "cc";
const { ccclass, property } = _decorator;

@ccclass("Layout_Toast")
export class Layout_Toast extends Component {
    @property(RichText)
    richTextTips: RichText | null = null;
    @property(Node)
    nodeTips: Node | null = null;
}
