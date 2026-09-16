import { ModuleDef } from "../../scripts/ModuleDef";

@egf_class(ModuleDef.EXTRA, egf.UIAlert)
export class UIAlert_Impl extends egf.UIAlert {
    constructor() {
        super("ui_alert/UI_Alert", egf.UILayers.ALERT, egf.Layout_UIAlert);
    }
}
