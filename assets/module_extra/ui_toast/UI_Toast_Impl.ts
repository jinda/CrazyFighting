import { ModuleDef } from "../../scripts/ModuleDef";

@egf_class(ModuleDef.EXTRA, egf.UI_Toast)
export class UI_Toast_Impl extends egf.UI_Toast {
    constructor() {
        super("ui_toast/UI_Toast", egf.UILayers.NOTICE, egf.Layout_Toast);
    }
}
