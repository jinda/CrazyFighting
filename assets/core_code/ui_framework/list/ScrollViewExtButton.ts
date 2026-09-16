// // Learn TypeScript:
// //  - https://docs.cocos.com/creator/2.4/manual/en/scripting/typescript.html
// // Learn Attribute:
// //  - https://docs.cocos.com/creator/2.4/manual/en/scripting/reference/attributes.html
// // Learn life-cycle callbacks:
// //  - https://docs.cocos.com/creator/2.4/manual/en/scripting/life-cycle-callbacks.html

import {
    _decorator,
    Component,
    ScrollView,
    Event,
    Node,
    UITransform,
    size,
    EventTouch,
    Vec2,
    EventMouse,
    Button,
    v2,
    sys,
} from "cc";
import { ScrollViewExt } from "./ScrollViewExt";
const { ccclass, property } = _decorator;

@ccclass("ScrollViewExtButton")
export default class ScrollViewExtButton extends Component {
    @property(ScrollViewExt)
    ScrollParent: ScrollViewExt;

    // LIFE-CYCLE CALLBACKS:

    private _button: Button;
    private _touchMoved: boolean = false;

    //------------

    protected onLoad() {
        if (!this.ScrollParent) {
            let node = this.node;
            while (node) {
                this.ScrollParent = node.getComponent(ScrollViewExt);
                if (this.ScrollParent) {
                    break;
                }
                node = node.parent;
            }
        }

        this._button = this.node.getComponent(Button);

        if (this.ScrollParent && this._button) {
            this.node.on(Node.EventType.TOUCH_START, this._onTouchStart, this);
            this.node.on(Node.EventType.TOUCH_MOVE, this._onTouchMove, this);
            this.node.on(Node.EventType.TOUCH_END, this._onTouchEnd, this);
            this.node.on(Node.EventType.TOUCH_CANCEL, this._onTouchCancel, this);
            // this.node.on(Node.EventType.MOUSE_WHEEL, this._onMouseWheel, this);
        }
    }

    protected onDestroy() {
        if (this.ScrollParent && this._button) {
            this.node.off(Node.EventType.TOUCH_START, this._onTouchStart, this);
            this.node.off(Node.EventType.TOUCH_MOVE, this._onTouchMove, this);
            this.node.off(Node.EventType.TOUCH_END, this._onTouchEnd, this);
            this.node.off(Node.EventType.TOUCH_CANCEL, this._onTouchCancel, this);
            // this.node.off(Node.EventType.MOUSE_WHEEL, this._onMouseWheel, this);
        }
    }

    private _onTouchStart(event: EventTouch, captureListeners: Node[]) {
        if (!this.enabledInHierarchy) return;

        this.ScrollParent["_onTouchStart"](event, captureListeners);

        // event.propagationStopped = true;
    }

    private _onTouchMove(event: EventTouch, captureListeners: Node[]) {
        if (!this.enabledInHierarchy) return;

        if (this._touchMoved) {
            this.ScrollParent["_onTouchMove"](event, captureListeners);
        } else {
            let touch = event.touch;
            let deltaMove = touch.getLocation().subtract(touch.getStartLocation());
            if (deltaMove.length() > 7) {
                if (!this._touchMoved) {
                    this._button["_pressed"] = false;
                    this._button["_updateState"]();
                    this._touchMoved = true;
                }
                this.ScrollParent["_onTouchMove"](event, captureListeners);
            }
        }

        // event.propagationStopped = true;
    }

    private _onTouchEnd(event: EventTouch, captureListeners: Node[]) {
        if (!this.enabledInHierarchy) return;

        if (this._touchMoved) {
            this._button["_pressed"] = false;
            this._button["_updateState"]();
            this._touchMoved = false;
        }

        this.ScrollParent["_onTouchEnd"](event, captureListeners);
        // event.propagationStopped = true;
    }

    private _onTouchCancel(event: EventTouch, captureListeners: Node[]) {
        if (!this.enabledInHierarchy) return;

        this.ScrollParent["_onTouchCancel"](event, captureListeners);
        // event.propagationStopped = true;
    }

    // private _onMouseWheel(event: EventMouse, captureListeners: Node[]) {
    //     if (!this.enabledInHierarchy) return;

    //         if (this._touchMoved) {
    //         this.ScrollParent["_onMouseWheel"](event, captureListeners);
    //     }
    //     else {
    //         let deltaMove = v2(0, 0);
    //         let wheelPrecision = -0.1;

    //         deltaMove = v2(0, event.getScrollY() * wheelPrecision);
    //         if (deltaMove.length() > 7) {
    //             if (!this._touchMoved) {
    //                 this._button["_pressed"] = false;
    //                 this._button["_updateState"]();
    //                 this._touchMoved = true;
    //             }
    //             this.ScrollParent["_onMouseWheel"](event, captureListeners);
    //         }
    //     }

    //     // event.propagationStopped = true;
    // }

    // update (dt) {}
}
