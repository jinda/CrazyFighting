import { ModuleDef } from "./ModuleDef";

//define UI classes which are not in the basic bundle but be called by other bundles.

@egf_class(ModuleDef.EXTRA)
export class UI_Toast extends egf.UIToast {}
@egf_class(ModuleDef.EXTRA)
export class UI_Setting extends egf.UIController {}
@egf_class(ModuleDef.EXTRA)
export class UI_HUD extends egf.UIController {}
@egf_class(ModuleDef.EXTRA)
export class UI_Language extends egf.UIController {}
@egf_class(ModuleDef.EXTRA)
export class UI_Help extends egf.UIController {}
@egf_class(ModuleDef.EXTRA)
export class UI_Award extends egf.UIController {}
@egf_class(ModuleDef.EXTRA)
export class UI_CommonTips extends egf.UIController {}
