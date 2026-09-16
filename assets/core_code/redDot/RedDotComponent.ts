import { _decorator, CCString, Component, Label, Sprite, tween, Vec3 } from "cc";
import { EVENT_RED_DOT_REFRESH } from "./RedDotStaticConfig";
import { EventMgr } from "../base/EventMgr";
import { RedDotMgr } from "./RedDotMgr";

const { ccclass, property } = _decorator;

@ccclass
export default class RedDotComponent extends Component {
    // @property({ tooltip: CC_DEV && '红点名称，全局唯一' })
    // get dotName() {
    //   return this._dotName;
    // }
    // set dotName(v) {
    //   this._dotName = v;
    //   this.refresh();
    // }
    @property({ type: CCString, tooltip: "红点名称，全局唯一" })
    dotName: string = "";

    @property({ type: Label, tooltip: "数字文本" })
    numLabel: Label;

    @property({ type: Sprite, tooltip: "底图" })
    sprite: Sprite;

    setDotName(name: string) {
        this.dotName = name;
        this.refresh();
    }

    /** 正常应该直接绑定refresh, 这里是为了区别刷新做了一个动画 */
    protected onLoad(): void {
        EventMgr.on(EVENT_RED_DOT_REFRESH, this.doAction, this);
        this.refresh();
    }

    protected onDestroy(): void {
        EventMgr.off(EVENT_RED_DOT_REFRESH, this.doAction, this);
    }

    refresh() {
        let redDot = RedDotMgr.inst.getNodeByName(this.dotName);
        let show = false,
            num = 0;
        if (redDot) {
            [show, num] = redDot.getResult();
        }
        if (this.numLabel) {
            this.numLabel.string = num.toString();
        }
        // egf.Logger.log('RedDot refresh:', this.dotName, show, num);

        this.node.active = show;
    }

    doAction() {
        let redDot = RedDotMgr.inst.getNodeByName(this.dotName);
        let show = false,
            num = 0;
        if (redDot) {
            [show, num] = redDot.getResult();
        }
        let str = num.toString();

        if (this.numLabel && str != this.numLabel.string) {
            this.node.scale = Vec3.ONE;
            tween(this.node)
                .to(0.2, { scale: Vec3.ZERO })
                .call(() => {
                    this.refresh();
                })
                .to(0.2, { scale: Vec3.ONE })
                .start();
        } else {
            this.refresh();
        }
    }
}
