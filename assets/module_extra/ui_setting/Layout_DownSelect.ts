import { _decorator, Component, Node, Button, Label, instantiate, Color, find, Sprite } from "cc";

const { ccclass, property } = _decorator;

export interface selectNames {
    name1: string;
    name2?: string;
    color?: string;
    selectId: number | string;
}

@ccclass("Layout_DownSelect")
export class Layout_DownSelect extends Component {
    @property(Button)
    btnSelect: Button = null!;
    @property(Button)
    btnBack: Button = null!;
    @property(Sprite)
    sprite1: Sprite = null!;
    @property(Label)
    label1: Label = null!;
    @property(Label)
    label2: Label = null!;
    @property(Node)
    nodeSelect: Node = null!;
    @property(Node)
    nodeDowwnSelect: Node = null!;

    private _selectId: number | string = 0;

    showInfo(selectId: number | string, selects: selectNames[] = [], cb: (selectId: number | string) => void) {
        this._selectId = selectId;
        // clog.log('Layout_DownSelect showInfo', this.node.name, idx, selects);
        const idx = selects.findIndex((select) => select.selectId == selectId);
        if (selects[idx]) {
            this.showSelectName(selects[idx].name1, selects[idx].name2, selects[idx].color);
        } else {
            this.showSelectName("", "--");
        }

        this.nodeDowwnSelect.active = false;
        this.btnBack.node.active = false;

        this.btnSelect.node.on(Button.EventType.CLICK, this.showDownSelect, this);
        this.btnBack.node.on(Button.EventType.CLICK, this.showDownSelect, this);

        this.nodeDowwnSelect.removeAllChildren();
        selects.forEach((select) => {
            const nodeSelect = instantiate(this.nodeSelect);
            nodeSelect.parent = this.nodeDowwnSelect;
            nodeSelect.name = select.selectId.toString();
            const label1 = find("Layout/Label1", nodeSelect);
            const sprite1 = find("Layout/Sprite1", nodeSelect);
            if (label1) {
                label1!.getComponent(Label)!.string = egf.i18nMgr.getText(select.name1);
                if (select.color) {
                    Color.fromHEX(label1.getComponent(Label)!.color, select.color);
                }
            } else if (sprite1) {
                // ViewUtil.loadSpriteFrame(sprite1.getComponent(Sprite), select.name1);
            }
            // clog.log('showInfo:', select.selectId, selectId);

            if (select.selectId == selectId) {
                const select = find("SpriteSelect", nodeSelect)!;
                select.active = true;
            }

            const label2 = find("Layout/Label2", nodeSelect)!.getComponent(Label)!;
            label2.node.active = select.name2 != null;
            if (select.name2 != null) {
                label2.string = egf.i18nMgr.getText(select.name2);
            }

            nodeSelect.addComponent(Button);
            nodeSelect.on(
                Button.EventType.CLICK,
                () => {
                    cb && cb(select.selectId);
                    this._selectId = select.selectId;
                    egf.Logger.log("select:", select);
                    this.showSelectName(select.name1, select.name2, select.color);
                    this.showDownSelect();
                },
                this,
            );
        });

        this.nodeDowwnSelect.active = false;
        this.btnBack.node.active = this.nodeDowwnSelect.active;
    }

    showSelectName(name1: string, name2?: string, color1?: string) {
        if (this.label1) {
            this.label1.string = egf.i18nMgr.getText(name1);
        } else if (this.sprite1) {
            if (name1) {
                // ViewUtil.loadSpriteFrame(this.sprite1, name1);
            } else {
                this.sprite1.spriteFrame = null;
            }
        }
        this.label2.node.active = name2 != null;
        if (name2 != null) {
            this.label2.string = egf.i18nMgr.getText(name2);
        }

        if (color1) {
            Color.fromHEX(this.label1.color, color1);
        }
    }

    showDownSelect() {
        egf.Logger.log("showDownSelect:", this._selectId);
        egf.AudioMgr.playOneShot("tap");
        this.nodeDowwnSelect.active = !this.nodeDowwnSelect.active;
        this.btnBack.node.active = this.nodeDowwnSelect.active;
        if (this.nodeDowwnSelect.active) {
            this.nodeDowwnSelect.children.forEach((nodeSelect) => {
                const select = find("SpriteSelect", nodeSelect)!;
                const bSelect = nodeSelect.name == this._selectId.toString();
                select.active = bSelect;
            });
        }
    }
}
