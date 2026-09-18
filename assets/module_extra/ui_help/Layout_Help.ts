import { _decorator, Node, Button, ToggleContainer, Toggle, Component, Label } from "cc";
const { ccclass, property } = _decorator;

@ccclass("Layout_Help")
export class Layout_Help extends Component {
    @property(Button)
    btnClose: Button = null!;
    @property(Label)
    labelContent: Label = null!;
}
