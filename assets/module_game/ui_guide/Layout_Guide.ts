import {
    _decorator,
    Label,
    Component,
    Sprite,
    Node,
    SpriteFrame,
    UITransform,
    v3,
    Vec3,
    tween,
    Tween,
    Button,
    view,
    instantiate,
} from "cc";
const { ccclass, property } = _decorator;

@ccclass("Layout_Guide")
export class Layout_Guide extends Component {
    @property(Button)
    btnBlackBg: Button = null!;
    @property(Node)
    nodeContent: Node = null!;
    @property(Sprite)
    spriteHand: Sprite = null!;
    @property(Label)
    labelContent: Label = null!;

    showGuideBtn(targetNode: Node) {
        const worldPos = targetNode.worldPosition;
        const nodeBtn = instantiate(targetNode);
        console.log("worldPos:", worldPos);

        nodeBtn.parent = this.node;
        nodeBtn.active = true;
        nodeBtn.worldPosition = worldPos;
        // 技能图标特殊处理
        if (nodeBtn.getChildByName("SpriteMask")) {
            nodeBtn.getChildByName("SpriteMask")!.active = false;
        }
        this.showHand(worldPos);
        return nodeBtn;
    }

    showGuideContent(worldPos: Vec3, content: string) {
        this.nodeContent.active = true;

        this.labelContent.string = content;
        this.nodeContent.updateWorldTransform();
        const height = this.nodeContent.getComponent(UITransform)!.height;
        let posX = worldPos.x;
        let posY = worldPos.y + height;
        if (posY > view.getVisibleSize().height - 200) {
            posY = worldPos.y - height * 2;
        }
        if (posX < 200) {
            posX = 200;
        }
        const rightX = view.getVisibleSize().width - 200;
        if (posX > rightX) {
            posX = rightX;
        }
        this.nodeContent.worldPosition = v3(posX, posY, worldPos.z);
    }

    showHand(worldPos: Vec3) {
        this.spriteHand.node.setSiblingIndex(5);
        this.spriteHand.node.active = true;
        this.spriteHand.node.worldPosition = worldPos;
        Tween.stopAllByTarget(this.spriteHand.node);
        const rightX = view.getVisibleSize().width - 150;

        if (this.spriteHand.node.worldPosition.x > rightX) {
            const scaleAction = tween()
                .to(0.5, { scale: v3(-0.8, 0.8, 0.8) })
                .to(0.5, { scale: v3(-1, 1, 1) });
            tween(this.spriteHand.node).repeatForever(scaleAction).start();
        } else {
            const scaleAction = tween()
                .to(0.5, { scale: v3(0.8, 0.8, 0.8) })
                .to(0.5, { scale: v3(1, 1, 1) });
            tween(this.spriteHand.node).repeatForever(scaleAction).start();
        }
    }
}
