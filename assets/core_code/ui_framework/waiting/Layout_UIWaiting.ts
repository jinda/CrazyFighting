import { _decorator, Component, Label, Node } from "cc";
const { ccclass, property } = _decorator;

@ccclass("Layout_UIWaiting")
export class Layout_UIWaiting extends Component {
    @property(Node)
    loadingIcon: Node | null = null;

    @property(Label)
    loadingTxt: Label | null = null;
}
