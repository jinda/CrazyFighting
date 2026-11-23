import { UIOpacity, instantiate, isValid, tween, v3, Tween } from "cc";
import { Layout_Toast } from "./Layout_Toast";
import { UIController } from "../UIController";

export class UI_Toast extends UIController {
    public static show(contentStr: string, duration: number = 1) {
        const toast = egf.UIMgr.getUI(UI_Toast);
        if (toast) {
            (toast as UI_Toast).showAction(contentStr, duration);
        } else {
            egf.UIMgr.showUI(UI_Toast, (ui: UI_Toast | any) => {
                ui.showAction(contentStr, duration);
            });
        }
    }

    protected onCreated(): void {}

    public showAction(contentStr: string, duration: number = 1) {
        // egf.Logger.log('show tips:', contentStr, this.layout);
        const layout = this.layout as Layout_Toast;
        if (!layout) {
            return;
        }
        if (layout.richTextTips) {
            layout.richTextTips.string = contentStr;
        }
        if (!isValid(layout.nodeTips)) {
            egf.Logger.error("toast show action error tip is null!");
            return;
        }
        const nodeContent = instantiate(layout.nodeTips)!;
        nodeContent.active = true;
        nodeContent.parent = this.node;

        // UIOpacity 只取一次（原来取了两次，其中一次在 if 判断里）
        const opacity = nodeContent.getComponent(UIOpacity);

        tween(nodeContent)
            .delay(1.5)
            .by(0.25, { position: v3(0, 100, 0) })
            .call(() => {
                // 界面可能已关闭：节点随父节点销毁后不要再 destroy 一次
                if (nodeContent.isValid) {
                    Tween.stopAllByTarget(nodeContent);
                    nodeContent.destroy();
                }
            })
            .start();

        if (opacity) {
            tween(opacity).delay(duration).to(0.25, { opacity: 0 }).start();
        }
    }
}
