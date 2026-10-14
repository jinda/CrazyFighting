import { ModuleDef } from "../../scripts/ModuleDef";

@egf_class(ModuleDef.EXTRA, egf.UIWaiting)
export class UIWaiting_Impl extends egf.UIWaiting {
    constructor() {
        super("ui_waiting/UI_Waiting", egf.UILayers.LOADING, egf.Layout_UIWaiting);
    }
}
