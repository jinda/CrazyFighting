import { _decorator, Node, Button, ToggleContainer, Toggle, Component, Label } from "cc";
const { ccclass, property } = _decorator;

@ccclass("Layout_Fighter")
export class Layout_Fighter extends Component {
    @property(Button)
    btnClose: Button = null!;
    @property(Label)
    labelContent: Label = null!;
}
