import { ModuleDef } from "../../scripts/ModuleDef";
import { UI_CommonTips } from "../../scripts/UIDef";
import { Layout_CommonTips } from "./Layout_CommonTips";
import { Node } from "cc";
export interface ICommonTip {
  content: string;
  bRichText?: boolean;
  nodeContent?: Node;
  title?: string;
  okTxt?: string;
  cancelTxt?: string;
  bOk?: boolean;
  bCancel?: boolean;
  costTxt?: string;
  linkUrl?: string;
  callback?: (ok: boolean) => void;
}
@egf_class(ModuleDef.EXTRA, UI_CommonTips)
export class UI_CommonTips_impl extends UI_CommonTips {
  private _params: ICommonTip;
  constructor() {
    super(
      "ui_common_tips/UI_CommonTips",
      egf.UILayers.OVERLAY,
      Layout_CommonTips,
    );
  }

  protected onCreated(params: ICommonTip): void {
    this._params = params;
    const layout = this.layout as Layout_CommonTips;
    this.onButtonEvent(layout.btnOK, this.clickOk, this, true);
    this.onButtonEvent(layout.btnCancel, this.clickOk, this, false);
    this.onButtonEvent(layout.btnClose, this.clickOk, this, false);

    if (this._params.title) {
      layout.setTitle(this._params.title);
    }
    if (this._params.bRichText) {
      layout.setRichTextContent(this._params.content);
      layout.setRichTextLink(this._params.linkUrl);
    } else {
      layout.setContent(this._params.content);
    }
    if (this._params.nodeContent) {
      layout.setNodeContent(this._params.nodeContent);
    }
    if (this._params.okTxt) {
      layout.btnClose.node.active = true;
      layout.setOkText(this._params.okTxt);
    }
    if (this._params.cancelTxt) {
      layout.btnClose.node.active = true;
      layout.setCancelText(this._params.cancelTxt);
    }
    if (this._params.bOk != undefined) {
      layout.btnOK.node.active = this._params.bOk;
    }
    if (this._params.bCancel != undefined) {
      layout.btnCancel.node.active = this._params.bCancel;
    }
    layout.labelCost.node.parent.active = this._params.costTxt != null;
    if (this._params.costTxt) {
      layout.labelCost.string = this._params.costTxt;
    }
  }

  clickOk(button: any, ok: boolean) {
    this._params.callback && this._params.callback(ok);
    this.close();
  }
}
