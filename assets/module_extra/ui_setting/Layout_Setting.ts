import { _decorator, Button, Component, Toggle, Label, Node } from "cc";
import { Layout_DownSelect } from "./Layout_DownSelect";
const { ccclass, property } = _decorator;

@ccclass("Layout_Setting")
export class Layout_Setting extends Component {
    @property(Button)
    btnClose: Button = null!;
    @property(Button)
    btnMenu: Button = null!;
    @property(Button)
    btnRestart: Button = null!;
    @property(Button)
    btnContinue: Button = null!;

    @property(Toggle)
    tgMusic: Toggle = null!;
    @property(Toggle)
    tgEffect: Toggle = null!;
    @property(Toggle)
    tgShake: Toggle = null!;

    @property(Label)
    labelVer: Label = null!;

    @property(Layout_DownSelect)
    languageSelect: Layout_DownSelect = null!;

    @property(Node)
    nodeBottom: Node = null!;
}
