import { DataMgr } from "../../scripts/DataMgr";
import { GameUILayers } from "../../scripts/GameUILayers";
import { i18nMgr } from "../../scripts/i18n/i18nMgr";
import { GameMode, ModuleDef } from "../../scripts/ModuleDef";
import { UI_Help } from "../../scripts/UIDef";
import { Layout_Help } from "./Layout_Help";

@egf_class(ModuleDef.EXTRA, UI_Help)
export class UI_Help_Impl extends UI_Help {
  constructor() {
    super("ui_help/UI_Help", GameUILayers.POPUP2, Layout_Help);
  }

  protected onCreated(params?: any): void {
    let layout = this.layout as Layout_Help;
    this.onButtonEvent(layout.btnClose, () => {
      this.close();
    });
    let cotentTxt = "";
    if (DataMgr.inst.gameMode == GameMode.SortFruits) {
      cotentTxt = i18nMgr._getLabel(
        `怎么玩？\\n\\n点击底部元素，相邻的相同元素会被收集。\\n\\n篮子满了会升级；没有对应篮子时，元素进入临时区。\\n\\n临时区满了就失败。\\n\\n右上角进度到100%就胜利。\\n\\n道具有3种：\\n\\n移除临时区\\n\\n收集全场相同元素\\n\\n增加临时区容量`,
      );
    } else {
      cotentTxt = i18nMgr._getLabel(
        `核心规则\\n规则\\t说明\\n方向决定一切\\t箭头只能往尖头朝向的方向直线滑出\\n前方不能有阻挡\\t如果前方有其他箭头，点了会弹回来，并扣除1颗心（生命值）\\n胜负条件\\n状态\\t条件\\n胜利\\t所有箭头全部滑出屏幕\\n失败\\t3颗心用完或时间结束，关卡重来\\n道具有3种\\n道具\\t效果\\t可用次数\\n提示\\t高亮显示当前可安全点击的箭头\\t\\n消除\\t选择任意1个箭头消除\\t\\n魔法星\\t随机消除任意3个箭头`,
      );
    }
    cotentTxt = cotentTxt.replace(/\\n/g, "\n");
    cotentTxt = cotentTxt.replace(/\\t/g, "\t");
    layout.labelContent.string = cotentTxt;
  }
}
