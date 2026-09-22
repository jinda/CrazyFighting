import { _decorator, Button, Component, Label, Node, Sprite } from "cc";
import { LocalDataMgr } from "../../scripts/LocalDataMgr";
const { ccclass, property } = _decorator;

@ccclass("Layout_Sign")
export class Layout_Sign extends Component {
    @property(Button)
    btnBack: Button = null!;
    @property(Button)
    btnGet: Button = null!;
    @property(Button)
    btnDoubleGet: Button = null!;
    @property(Node)
    nodeSign: Node = null!;

    showInfo(awards: number[]) {
        this.nodeSign.children.forEach((node, idx) => {
            this.showItemInfo(node, idx + 1, awards[idx], awards[idx + 1]);
        });
        this.btnGet.getComponent(Sprite)!.grayscale = LocalDataMgr.isSignToday();
        this.btnDoubleGet.getComponent(Sprite)!.grayscale = LocalDataMgr.isSignToday();
    }

    showItemInfo(node: Node, day: number, coin: number = 0, ext?: number) {
        const labelDay = node.getChildByName("LabelDay")?.getComponent(Label);
        const labelCoin = node.getChildByName("LabelCoin")?.getComponent(Label);
        if (labelDay) {
            labelDay.string = egf.i18nMgr.getText("第#0天", ["" + day]);
        }
        if (labelCoin) {
            if (day == 7) {
                labelCoin.string = `x${coin}~${ext}`;
            } else {
                labelCoin.string = "x" + coin;
            }
        }
    }

    /**
     * Updates the state of a sign item based on its day and status.
     * @param day
     * @param status 0: not signed, 1: signed, 2: can signed
     */
    updateItemState(day: number, status: number) {
        const node = this.nodeSign.children[day - 1];
        const nodeGet = node.getChildByName("SpriteSelect")!;
        nodeGet.active = status == 1;
        const nodeGuangdi = node.getChildByName("guangdi")!;
        nodeGuangdi.active = status == 2;
    }
}
