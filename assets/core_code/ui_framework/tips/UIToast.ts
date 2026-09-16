import { RichText, UIOpacity, instantiate, tween, v3 } from "cc";
import { Layout_Toast } from "./Layout_Toast";
import { UIController } from "../UIController";

export class UIToast extends UIController {
    public static show(contentStr?: string, duration: number = 1) {
        const toast = egf.UIMgr.getUI(UIToast);
        if (toast) {
            (toast as UIToast).showAction(contentStr, duration);
        } else {
            egf.UIMgr.showUI(UIToast, (ui: UIToast | any) => {
                ui.showAction(contentStr, duration);
            });
        }
    }

    protected onCreated(): void {}

    public showAction(contentStr?: string, duration: number = 1) {
        // egf.Logger.log('show tips:', contentStr, this.layout);
        const layout = this.layout as Layout_Toast;
        const nodeContent = instantiate(layout.nodeTips)!;
        nodeContent.active = true;
        nodeContent.parent = this.node;
        if (nodeContent.getChildByName("RichTextTips")) {
            nodeContent.getChildByName("RichTextTips")!.getComponent(RichText)!.string = contentStr!;
        }
        tween(nodeContent)
            .delay(1.5)
            .by(0.25, { position: v3(0, 100, 0) })
            .call(() => {
                nodeContent.destroy();
            })
            .start();
        if (nodeContent.getComponent(UIOpacity)) {
            tween(nodeContent.getComponent(UIOpacity)!).delay(duration).to(0.25, { opacity: 0 }).start();
        }
    }
}
