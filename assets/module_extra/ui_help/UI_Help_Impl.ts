import { ModuleDef } from "../../scripts/ModuleDef";
import { UI_Help } from "../../scripts/UIDef";
import { Layout_Help } from "./Layout_Help";

@egf_class(ModuleDef.EXTRA, UI_Help)
export class UI_Help_Impl extends UI_Help {
    constructor() {
        super("ui_help/UI_Help", egf.UILayers.POPUP2, Layout_Help);
    }

    protected onCreated(params?: any): void {
        let layout = this.layout as Layout_Help;
        this.onButtonEvent(layout.btnClose, () => {
            this.close();
        });
        let cotentTxt = "";

        cotentTxt = cotentTxt.replace(/\\n/g, "\n");
        cotentTxt = cotentTxt.replace(/\\t/g, "\t");
        layout.labelContent.string = cotentTxt;
    }
}
