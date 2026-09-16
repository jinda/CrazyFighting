import {
  _decorator,
  Node,
  Button,
  ToggleContainer,
  Toggle,
  Component,
} from "cc";
const { ccclass, property } = _decorator;

@ccclass("Layout_Language")
export class Layout_Language extends Component {
  @property(Button)
  btnClose: Button = null!;

  @property(ToggleContainer)
  tgContainer: ToggleContainer = null!;
}
