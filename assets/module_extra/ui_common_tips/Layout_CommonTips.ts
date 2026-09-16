import { _decorator, Button, Component, Label, RichText, Node } from "cc";
import { i18nMgr } from "../../scripts/i18n/i18nMgr";
const { ccclass, property } = _decorator;

@ccclass("Layout_CommonTips")
export class Layout_CommonTips extends Component {
  @property(RichText)
  richTextContent: RichText = null;
  @property(Label)
  labelContent: Label = null;
  @property(Label)
  labelOk: Label = null;
  @property(Label)
  labelCancel: Label = null;
  @property(Label)
  labelTitle: Label = null;
  @property(Label)
  labelCost: Label = null;
  @property(Button)
  btnCancel: Button = null;
  @property(Button)
  btnOK: Button = null;
  @property(Button)
  btnClose: Button = null;
  private _linkUrl: string = "";

  setContent(content: string) {
    this.labelContent.string = content;
  }
  setRichTextContent(content: string) {
    this.richTextContent.string = content;
  }
  setRichTextLink(url?: string) {
    this._linkUrl = url ?? "";
    this.richTextContent.node.off(
      Node.EventType.TOUCH_END,
      this.openRichTextLink,
      this,
    );
    if (url) {
      this.richTextContent.node.on(
        Node.EventType.TOUCH_END,
        this.openRichTextLink,
        this,
      );
    }
  }
  setNodeContent(node: Node) {
    node.parent = this.labelContent.node.parent;
  }
  setTitle(title: string) {
    i18nMgr.setLabelKey(this.labelTitle, title);
  }

  setOkText(text: string) {
    this.btnOK.node.active = text != null;
    i18nMgr.setLabelKey(this.labelOk, text);
  }
  setCancelText(text: string) {
    this.btnCancel.node.active = text != null;
    i18nMgr.setLabelKey(this.labelCancel, text);
  }

  private openRichTextLink() {
    if (!this._linkUrl) return;
    window.open(this._linkUrl, "_blank");
  }
}
