import { _decorator, Button, Component, Toggle, Label } from "cc";
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
    @property(Button)
    btnLanguage: Button = null!;

    @property(Toggle)
    tgMusic: Toggle = null!;
    @property(Toggle)
    tgEffect: Toggle = null!;
    @property(Toggle)
    tgShake: Toggle = null!;

    @property(Label)
    labelVer: Label = null!;
    @property(Label)
    labelLanguage: Label = null!;
}
