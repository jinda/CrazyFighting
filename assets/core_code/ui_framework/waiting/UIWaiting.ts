import { UIController } from "../UIController";
import { UIMgr } from "../UIMgr";
import { Layout_UIWaiting } from "./Layout_UIWaiting";

export class UIWaiting extends UIController {
    private static _inst: UIWaiting | null = null;
    private _contentStr: string = "Loading";

    public static show(contentStr?: string) {
        if (!this._inst) {
            UIMgr.showUI(UIWaiting, (ui: UIWaiting | any) => {
                this._inst = ui;
                this._inst?.setContentStr(contentStr || "Loading");
            });
        } else {
            this._inst.setContentStr(contentStr || "Loading");
        }
    }

    public static hide(): void {
        if (this._inst) {
            this._inst.close();
            this._inst = null;
        }
    }

    protected onCreated(): void {}

    public setContentStr(contentStr: string) {
        let layout = this.layout as Layout_UIWaiting;
        if (layout && layout.loadingTxt) {
            this._contentStr = contentStr;
            egf.i18nMgr.setLabelKey(layout.loadingTxt, this._contentStr);
        } else {
            egf.Logger.error("Layout_UIWaiting not loaded:", contentStr);
            UIWaiting.hide();
        }
        if (layout.loadingTxt) {
            layout.schedule(() => {
                let str = layout.loadingTxt!.string;
                if (str.includes("...")) {
                    str = str.replace("...", "");
                }
                layout.loadingTxt!.string = str + ".";
            }, 1);
        }
    }

    protected onUpdate(dt: number) {
        let layout = this.layout as Layout_UIWaiting;
        if (layout.loadingIcon) {
            let euler = layout.loadingIcon.eulerAngles;
            let rot = (Date.now() / 1000) * 90;
            layout.loadingIcon.setRotationFromEuler(euler.x, euler.y, rot);
        }

        if (layout.loadingTxt && Date.now() % 1000 == 0) {
            let str = layout.loadingTxt.string;
            if (str.includes("...")) {
                str = str.replace("...", "");
            }
            layout.loadingTxt.string = str + ".";
        }
    }

    onDispose() {
        UIWaiting._inst = null;
    }
}
