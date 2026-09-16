import { GameUILayers } from "../../scripts/GameUILayers";
import { ModuleDef } from "../../scripts/ModuleDef";
import { UI_Tips } from "../../scripts/UIDef";

@egf_class(ModuleDef.EXTRA, egf.UI_Tips)
export class UITips_Impl extends egf.UI_Tips {
  constructor() {
    super("ui_tips/UI_Tips", GameUILayers.NOTICE, egf.Layout_UITips);
  }
}
