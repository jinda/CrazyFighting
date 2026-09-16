import { _decorator, Button, Component, Toggle, Label } from "cc";
const { ccclass, property } = _decorator;

@ccclass("Layout_Setting")
export class Layout_Setting extends Component {
  @property(Button)
  btnClose: Button;
  @property(Button)
  btnMenu: Button;
  @property(Button)
  btnRestart: Button;
  @property(Button)
  btnContinue: Button;
  @property(Button)
  btnLanguage: Button;

  @property(Toggle)
  tgMusic: Toggle;
  @property(Toggle)
  tgEffect: Toggle;
  @property(Toggle)
  tgShake: Toggle;

  @property(Label)
  labelVer: Label;
  @property(Label)
  labelLanguage: Label;
}
