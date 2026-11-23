import { UIOpacity, instantiate, tween, v3 } from "cc";
import { Layout_UITips } from "./Layout_UITips";
import { UIController } from "../UIController";

export class UI_Tips extends UIController {
  public static show(contentStr?: string) {
    egf.UIMgr.showUI(UI_Tips, (ui: UI_Tips) => {
      ui.showAction(contentStr);
    });
  }

  protected onCreated(): void {}

  public showAction(contentStr?: string) {
    egf.Logger.log("show tips:", contentStr, this.layout);

    const layout = this.layout as Layout_UITips;
    layout.labelTips.string = contentStr;
    const nodeContent = instantiate(layout.nodeTips);
    nodeContent.active = true;
    nodeContent.parent = this.node;
    tween(nodeContent)
      .delay(2)
      .by(0.5, { position: v3(0, 100, 0) })
      .call(() => {
        nodeContent.destroy();
      })
      .start();
    tween(nodeContent.getComponent(UIOpacity))
      .delay(1)
      .to(0.5, { opacity: 0 })
      .start();
  }
}
