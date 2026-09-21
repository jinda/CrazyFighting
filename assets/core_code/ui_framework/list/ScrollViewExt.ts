// // Learn TypeScript:
// //  - https://docs.cocos.com/creator/2.4/manual/en/scripting/typescript.html
// // Learn Attribute:
// //  - https://docs.cocos.com/creator/2.4/manual/en/scripting/reference/attributes.html
// // Learn life-cycle callbacks:
// //  - https://docs.cocos.com/creator/2.4/manual/en/scripting/life-cycle-callbacks.html

import { _decorator, Component, ScrollView, Node, UITransform, size, EventTouch, Vec2, EventMouse } from "cc";
const { ccclass, property } = _decorator;

enum ScrollDirection {
    None = 0,
    Down = 1,
    Up = 2,
    Left = 3,
    Right = 4,
}

enum ScrollBoundary {
    None = 0,
    Left = 1,
    Right = 2,
    Top = 3,
    Bottom = 4,
    LeftTop = 5,
    LeftBottom = 6,
    RightTop = 7,
    RightBottom = 8,
}

const _tempVec2 = new Vec2();
const _tempVec2_1 = new Vec2();

@ccclass("ScrollViewExt")
export class ScrollViewExt extends Component {
    @property(Node)
    Parent: Node = null!;

    ScrollParent: ScrollViewExt = null!;

    // LIFE-CYCLE CALLBACKS:
    private _scrollView: ScrollView = null!;
    private _onScrollViewTouchStart: Function = null!;
    private _onScrollViewTouchMove: Function = null!;
    private _onScrollViewTouchEnd: Function = null!;
    private _onScrollViewTouchCancelled: Function = null!;
    private _onScrollViewMouseWheel: Function = null!;

    private _isTouchStart: boolean = false;
    private _scrollDirection: ScrollDirection = ScrollDirection.None;
    //------------

    protected onLoad() {
        this._scrollView = this.node.getComponent(ScrollView)!;
        if (this._scrollView && this.Parent) {
            this._scrollView.elastic = false;
        }
        if (this.Parent) {
            this.ScrollParent = this.Parent.getComponent(ScrollViewExt)!;
        }
        this._onScrollViewTouchStart = this._scrollView["_onTouchBegan"].bind(this._scrollView);
        this._onScrollViewTouchMove = this._scrollView["_onTouchMoved"].bind(this._scrollView);
        this._onScrollViewTouchEnd = this._scrollView["_onTouchEnded"].bind(this._scrollView);
        this._onScrollViewTouchCancelled = this._scrollView["_onTouchCancelled"].bind(this._scrollView);
        this._onScrollViewMouseWheel = this._scrollView["_onMouseWheel"].bind(this._scrollView);

        this._scrollView["_onTouchBegan"] = function (event, captureListeners) {};
        this._scrollView["_onTouchMoved"] = function (event, captureListeners) {};
        this._scrollView["_onTouchEnded"] = function (event, captureListeners) {};
        this._scrollView["_onTouchCancelled"] = function (event, captureListeners) {};
        this._scrollView["_onMouseWheel"] = function (event, captureListeners) {};

        this.node.on(Node.EventType.TOUCH_START, this._onTouchStart, this);
        this.node.on(Node.EventType.TOUCH_MOVE, this._onTouchMove, this);
        this.node.on(Node.EventType.TOUCH_END, this._onTouchEnd, this);
        this.node.on(Node.EventType.TOUCH_CANCEL, this._onTouchCancel, this);
        this.node.on(Node.EventType.MOUSE_WHEEL, this._onMouseWheel, this);
    }

    protected onDestroy() {
        this.node.off(Node.EventType.TOUCH_START, this._onTouchStart, this);
        this.node.off(Node.EventType.TOUCH_MOVE, this._onTouchMove, this);
        this.node.off(Node.EventType.TOUCH_END, this._onTouchEnd, this);
        this.node.off(Node.EventType.TOUCH_CANCEL, this._onTouchCancel, this);
        this.node.off(Node.EventType.MOUSE_WHEEL, this._onMouseWheel, this);
    }

    private _getContentSize(node: Node | null) {
        if (!node) {
            return size(0, 0);
        }
        let ut = node.getComponent(UITransform);
        if (!ut) {
            return size(0, 0);
        }
        return size(ut.width, ut.height);
    }

    private _isBoundary(scrollView: ScrollView, boundary: ScrollBoundary): boolean {
        if (scrollView.content) {
            let view = scrollView.content.parent!;
            let viewSize = this._getContentSize(view);

            let vut = view.getComponent(UITransform)!;

            let anchorX = viewSize.width * vut.anchorX;
            let anchorY = viewSize.height * vut.anchorY;

            let leftBoundary = -anchorX;
            let bottomBoundary = -anchorY;
            let rightBoundary = leftBoundary + viewSize.width;
            let topBoundary = bottomBoundary + viewSize.height;

            if (boundary == ScrollBoundary.RightBottom) {
                let r = this._getContentRightBoundary(scrollView);
                let b = this._getContentBottomBoundary(scrollView);
                return r <= leftBoundary && b >= topBoundary;
            } else if (boundary == ScrollBoundary.RightTop) {
                let r = this._getContentRightBoundary(scrollView);
                let t = this._getContentTopBoundary(scrollView);
                return r <= leftBoundary && t <= topBoundary;
            } else if (boundary == ScrollBoundary.LeftBottom) {
                let l = this._getContentLeftBoundary(scrollView);
                let b = this._getContentBottomBoundary(scrollView);
                return l >= leftBoundary && b >= topBoundary;
            } else if (boundary == ScrollBoundary.LeftTop) {
                let l = this._getContentLeftBoundary(scrollView);
                let t = this._getContentTopBoundary(scrollView);
                return l >= leftBoundary && t <= topBoundary;
            } else if (boundary == ScrollBoundary.Right) {
                let r = this._getContentRightBoundary(scrollView);
                return r <= rightBoundary;
            } else if (boundary == ScrollBoundary.Left) {
                let l = this._getContentLeftBoundary(scrollView);
                return l >= leftBoundary;
            } else if (boundary == ScrollBoundary.Bottom) {
                let b = this._getContentBottomBoundary(scrollView);
                return b >= bottomBoundary;
            } else if (boundary == ScrollBoundary.Top) {
                let t = this._getContentTopBoundary(scrollView);
                return t <= topBoundary;
            }
        }
        return false;
    }

    private _getContentLeftBoundary(scrollView: ScrollView) {
        let contentPos = scrollView.getContentPosition();
        let scut = scrollView.content!.getComponent(UITransform)!;
        return contentPos.x - scut.anchorX * scut.width;
    }

    private _getContentRightBoundary(scrollView: ScrollView) {
        let scut = scrollView.content!.getComponent(UITransform)!;
        return this._getContentLeftBoundary(scrollView) + scut.width;
    }

    private _getContentTopBoundary(scrollView: ScrollView) {
        let scut = scrollView.content!.getComponent(UITransform)!;
        return this._getContentBottomBoundary(scrollView) + scut.height;
    }

    private _getContentBottomBoundary(scrollView: ScrollView) {
        let contentPos = scrollView.getContentPosition();
        let scut = scrollView.content!.getComponent(UITransform)!;
        return contentPos.y - scut.anchorY * scut.height;
    }

    private _checkScrollDirection(event: EventTouch): ScrollDirection {
        let touch = event.touch;
        if (!touch) {
            return ScrollDirection.None;
        }
        const deltaMove = touch.getUILocation(_tempVec2);
        deltaMove.subtract(touch.getUIStartLocation(_tempVec2_1));
        if (deltaMove.length() > 7) {
            let ax = Math.abs(deltaMove.x);
            let ay = Math.abs(deltaMove.y);
            if (ax < ay) {
                if (deltaMove.y > 0) {
                    return ScrollDirection.Up;
                } else {
                    return ScrollDirection.Down;
                }
            } else if (ax > ay) {
                if (deltaMove.x > 0) {
                    return ScrollDirection.Right;
                } else {
                    return ScrollDirection.Left;
                }
            }
        }
        return ScrollDirection.None;
    }

    private _scrollHorizontal(direction: ScrollDirection, event: EventTouch, captureListeners: Node[]) {
        if (
            this._isBoundary(this._scrollView, ScrollBoundary.Left) &&
            this._isBoundary(this._scrollView, ScrollBoundary.Right)
        ) {
            this.ScrollParent._onTouchMove(event, captureListeners);
        } else if (direction == ScrollDirection.Left && this._isBoundary(this._scrollView, ScrollBoundary.Left)) {
            this._onScrollViewTouchMove(event, captureListeners);
        } else if (direction == ScrollDirection.Right && this._isBoundary(this._scrollView, ScrollBoundary.Right)) {
            this._onScrollViewTouchMove(event, captureListeners);
        } else {
            if (
                this._isBoundary(this._scrollView, ScrollBoundary.Left) ||
                this._isBoundary(this._scrollView, ScrollBoundary.Right)
            ) {
                this.ScrollParent._onTouchMove(event, captureListeners);
            } else {
                this._onScrollViewTouchMove(event, captureListeners);
            }
        }
    }

    private _scrollVertical(direction: ScrollDirection, event: EventTouch, captureListeners: Node[]) {
        if (
            this._isBoundary(this._scrollView, ScrollBoundary.Top) &&
            this._isBoundary(this._scrollView, ScrollBoundary.Bottom)
        ) {
            this.ScrollParent._onTouchMove(event, captureListeners);
        } else if (direction == ScrollDirection.Down && this._isBoundary(this._scrollView, ScrollBoundary.Bottom)) {
            this._onScrollViewTouchMove(event, captureListeners);
        } else if (direction == ScrollDirection.Up && this._isBoundary(this._scrollView, ScrollBoundary.Top)) {
            this._onScrollViewTouchMove(event, captureListeners);
        } else {
            if (
                this._isBoundary(this._scrollView, ScrollBoundary.Top) ||
                this._isBoundary(this._scrollView, ScrollBoundary.Bottom)
            ) {
                this.ScrollParent._onTouchMove(event, captureListeners);
            } else {
                this._onScrollViewTouchMove(event, captureListeners);
            }
        }
    }

    private _onTouchStart(event: EventTouch, captureListeners: Node[]) {
        if (!this.enabledInHierarchy) return;

        this._isTouchStart = true;

        this._scrollDirection = ScrollDirection.None;

        if (this.ScrollParent == null) {
            this._onScrollViewTouchStart(event, captureListeners);
            event.propagationStopped = true;
            return;
        }

        this._onScrollViewTouchStart(event, captureListeners);
        this.ScrollParent._onTouchStart(event, captureListeners);

        event.propagationStopped = true;
    }

    private _onTouchMove(event: EventTouch, captureListeners: Node[]) {
        if (!this.enabledInHierarchy) return;
        if (!this._isTouchStart) {
            return;
        }
        if (this.ScrollParent == null) {
            this._onScrollViewTouchMove(event, captureListeners);
            event.propagationStopped = true;
            return;
        }

        if (this._scrollDirection != ScrollDirection.None) {
            if (
                this._scrollView.horizontal &&
                (this._scrollDirection == ScrollDirection.Left || this._scrollDirection == ScrollDirection.Right)
            ) {
                let direction = this._checkScrollDirection(event);
                this._scrollHorizontal(direction, event, captureListeners);
            } else if (
                this._scrollView.vertical &&
                (this._scrollDirection == ScrollDirection.Down || this._scrollDirection == ScrollDirection.Up)
            ) {
                let direction = this._checkScrollDirection(event);
                this._scrollVertical(direction, event, captureListeners);
            } else {
                this.ScrollParent._onTouchMove(event, captureListeners);
            }
            event.propagationStopped = true;
            return;
        }

        let direction = this._checkScrollDirection(event);
        if (direction == ScrollDirection.None) {
            this._onScrollViewTouchMove(event, captureListeners);
            event.propagationStopped = true;
            return;
        }
        this._scrollDirection = direction;

        if (this._scrollView.horizontal) {
            this._scrollHorizontal(direction, event, captureListeners);
        } else if (this._scrollView.vertical) {
            this._scrollVertical(direction, event, captureListeners);
        }
        event.propagationStopped = true;
    }

    private _onTouchEnd(event: EventTouch, captureListeners: Node[]) {
        if (!this.enabledInHierarchy) return;
        if (!this._isTouchStart) {
            return;
        }

        if (this.ScrollParent == null) {
            this._onScrollViewTouchEnd(event, captureListeners);
            this._scrollDirection = ScrollDirection.None;
            event.propagationStopped = true;
            return;
        }

        this._onScrollViewTouchEnd(event, captureListeners);
        this.ScrollParent._onTouchEnd(event, captureListeners);

        this._scrollDirection = ScrollDirection.None;

        event.propagationStopped = true;
    }

    private _onTouchCancel(event: EventTouch, captureListeners: Node[]) {
        if (!this.enabledInHierarchy) return;
        if (!this._isTouchStart) {
            return;
        }

        if (this.ScrollParent == null) {
            this._onScrollViewTouchCancelled(event, captureListeners);
            this._scrollDirection = ScrollDirection.None;
            event.propagationStopped = true;
            return;
        }

        this._onScrollViewTouchCancelled(event, captureListeners);
        this.ScrollParent._onTouchCancel(event, captureListeners);

        this._scrollDirection = ScrollDirection.None;

        event.propagationStopped = true;
    }

    private _onMouseWheel(event: EventMouse, captureListeners: Node[]) {
        if (!this.enabledInHierarchy) return;

        if (this.ScrollParent == null) {
            this._onScrollViewMouseWheel(event, captureListeners);
            event.propagationStopped = true;
            return;
        }

        if (this._scrollView.vertical) {
            if (
                this._isBoundary(this._scrollView, ScrollBoundary.Bottom) &&
                this._isBoundary(this._scrollView, ScrollBoundary.Top)
            ) {
                this.ScrollParent._onMouseWheel(event, captureListeners);
            } else if (event.getScrollY() > 0 && this._isBoundary(this._scrollView, ScrollBoundary.Bottom)) {
                this._onScrollViewMouseWheel(event, captureListeners);
            } else if (event.getScrollY() < 0 && this._isBoundary(this._scrollView, ScrollBoundary.Top)) {
                this._onScrollViewMouseWheel(event, captureListeners);
            } else {
                if (
                    this._isBoundary(this._scrollView, ScrollBoundary.Top) ||
                    this._isBoundary(this._scrollView, ScrollBoundary.Bottom)
                ) {
                    this.ScrollParent._onMouseWheel(event, captureListeners);
                } else {
                    this._onScrollViewMouseWheel(event, captureListeners);
                }
            }
        } else if (this._scrollView.horizontal) {
            if (
                this._isBoundary(this._scrollView, ScrollBoundary.Left) &&
                this._isBoundary(this._scrollView, ScrollBoundary.Right)
            ) {
                this.ScrollParent._onMouseWheel(event, captureListeners);
            } else if (event.getScrollY() > 0 && this._isBoundary(this._scrollView, ScrollBoundary.Left)) {
                this._onScrollViewMouseWheel(event, captureListeners);
            } else if (event.getScrollY() < 0 && this._isBoundary(this._scrollView, ScrollBoundary.Right)) {
                this._onScrollViewMouseWheel(event, captureListeners);
            } else {
                if (
                    this._isBoundary(this._scrollView, ScrollBoundary.Left) ||
                    this._isBoundary(this._scrollView, ScrollBoundary.Right)
                ) {
                    this.ScrollParent._onMouseWheel(event, captureListeners);
                } else {
                    this._onScrollViewMouseWheel(event, captureListeners);
                }
            }
        }
        event.propagationStopped = true;
    }

    // update (dt) {}
}
