import { _decorator, Component, Node, SpriteFrame, UITransformComponent, Vec3, view, Tween, SpriteComponent, Color, EventTouch, find, rect, tween } from "cc";
import { ClientEvent } from "../../framework/clientEvent";
import { GuideManager } from "./guideManager";
const { ccclass, property } = _decorator;
//引导界面脚本
@ccclass("guide")
export class guide extends Component {
    @property(Node)
    public ndBackground: Node = null!;//黑色背景

    @property(Node)
    public ndMask: Node = null!;//遮罩节点

    @property(Node)
    public ndHand: Node = null!;//手势节点

    @property(Node)
    public ndFrame: Node = null!;//可操作区域/可视区节点

    @property(SpriteFrame)
    public sfForce: SpriteFrame = null!;//图标1

    @property(SpriteFrame)
    public sfUnForce: SpriteFrame = null!;//图标2

    private _subGuideInfo: any = null!;//子引导步骤内容
    private _ndTarget: Node = null!;//目标节点
    private _targetContent: any = null!;//目标区域和位置
    private _refreshPosTimer: number = null!;//定时器
    private _spHand: SpriteComponent = null!;//手势节点的sprite组件
    private _ndRecvEvent: Node = null!;//接收事件的节点
    private _curWaitEvent: string = null!;//事件
    private _curWaitResetEvent: string = null!;//事件
    private _isForce: boolean = true;//是否强制指引，就是他不能做其他操作，一定必须点那个之后才能继续
    private _isSkipByAnyWhere: boolean = false;//点击任何区域跳过
    private _isHideBlack: boolean = false;//隐藏黑色背景
    private _isTouchStart: boolean = false;//是否开始点击
    private _isDragStart: boolean = false;//是否开始拖动
    private _isTouch: boolean = false;//是否点击
    private _isShowAni: boolean = false;//是否播放缓动效果
    private _isPlayingAni: boolean = false;//是否正在播放缓动效果
    private _tweenFrame: any = null!;//缓动对象
    private _tweenHand: any = null!;//缓动对象
    private _tweenDrag: any = null!;//缓动对象
    private _tweenFade: any = null!;//缓动对象
    private _colorHand: Color = new Color(255, 255, 255, 255);//手势节点颜色
    private _oldPos: Vec3 = new Vec3();//老位置
    private _endPos: Vec3 = new Vec3();//结束位置
    private _dragScale1: Vec3 = new Vec3(1, 1, 1);//缩放大小1
    private _dragScale2: Vec3 = new Vec3(1.2, 1.2, 1.2);//缩放大小2
    private _handPos1: Vec3 = new Vec3();//手势节点缓动位置1
    private _handPos2: Vec3 = new Vec3();//手势节点缓动位置2
    private _touchPos1: Vec3 = new Vec3();//触碰位置1
    private _touchPos2: Vec3 = new Vec3();//触碰位置2

    start() {
        this._enableIntercept(true);
        this._enableBgBlock(true);
    }

    /**
     * 启动、拦截ndFrame节点触摸事件
     * @param {boolean} enable 是否开启
     */
    private _enableIntercept(enable: boolean) {
        if (!enable) {
            this.ndFrame.off(Node.EventType.TOUCH_START, this._onTouchStart, this);
            this.ndFrame.off(Node.EventType.TOUCH_END, this._onTouchEnd, this);
            this.ndFrame.off(Node.EventType.TOUCH_CANCEL, this._onTouchCancel, this);
        } else {
            this.ndFrame.on(Node.EventType.TOUCH_START, this._onTouchStart, this);
            this.ndFrame.on(Node.EventType.TOUCH_END, this._onTouchEnd, this);
            this.ndFrame.on(Node.EventType.TOUCH_CANCEL, this._onTouchCancel, this);
        }
    }

    /**
     * 启动、拦截本节点触摸事件
     * @param isEnable 是否开启
     */
    private _enableBgBlock(isEnable: boolean) {
        if (isEnable) {
            this.node.on(Node.EventType.TOUCH_START, this._onBgTouchStart, this);
            this.node.on(Node.EventType.TOUCH_MOVE, this._onBgTouchMove, this);
            this.node.on(Node.EventType.TOUCH_END, this._onBgTouchEnd, this);
            this.node.on(Node.EventType.TOUCH_CANCEL, this._onBgTouchCancel, this);
        } else {
            this.node.off(Node.EventType.TOUCH_START, this._onBgTouchStart, this);
            this.node.off(Node.EventType.TOUCH_MOVE, this._onBgTouchMove, this);
            this.node.off(Node.EventType.TOUCH_END, this._onBgTouchEnd, this);
            this.node.off(Node.EventType.TOUCH_CANCEL, this._onBgTouchCancel, this);
        }
    }

    /**
     * 展示界面
     * @param subGuideInfo 子引导步骤内容
     * @param isShowAni 是否播放缓动效果
     * @returns 
     */
    public show(subGuideInfo: any, isShowAni: boolean = true) {
        this._subGuideInfo = subGuideInfo;
        this._ndTarget = null!;
        this._targetContent = null!;
        this._oldPos = null!;
        this._isTouch = false;
        this._ndRecvEvent = null!;
        this._isShowAni = isShowAni;

        //如果有getNodeFun(用于搜索节点的函数)，获取目标节点
        if (subGuideInfo.getNodeFun) {
            let getNodeFun = subGuideInfo.getNodeFun.nodeFun;
            this._ndTarget = getNodeFun.apply(subGuideInfo.getNodeFun.nodeOwner, subGuideInfo.getNodeFun.nodeParam);
        } else if (subGuideInfo.getPosFun) { //如果有getNodeFun(用于搜索位置的函数)，获取目标位置和区域
            let getPosFun = subGuideInfo.getPosFun.posFun;
            this._targetContent = getPosFun.apply(subGuideInfo.getPosFun.posOwner, subGuideInfo.getPosFun.posParam);
        }

        if (!this._ndTarget && !this._targetContent && !subGuideInfo.isShowTextOnly) {
            GuideManager.instance.pauseSubGuide();
            return;
        }

        this._isForce = true;

        if (subGuideInfo.hasOwnProperty("isForce")) {
            this._isForce = subGuideInfo.isForce;
        }

        this._isHideBlack = false;

        if (subGuideInfo.hasOwnProperty("isHideBlack")) {
            this._isHideBlack = subGuideInfo["isHideBlack"];
        }

        this._isSkipByAnyWhere = false;

        if (subGuideInfo.hasOwnProperty("isSkipByAnyWhere")) {
            this._isSkipByAnyWhere = subGuideInfo["isSkipByAnyWhere"];
        }

        if (this._ndTarget || this._targetContent) {
            this._updatePosByTargetNode();
        }

        this._regFinishEvent();
        this._regResetEvent();
    }

    /**
     * 注册完成事件
     */
    private _regFinishEvent() {
        //销毁事件
        if (this._curWaitEvent) {
            ClientEvent.off(this._curWaitEvent, this._onFinishEventTrigger, this);
            this._curWaitEvent = null!;
        }

        //注册“完成事件”
        if (this._subGuideInfo.finishConditionEvent) {
            this._curWaitEvent = this._subGuideInfo.finishConditionEvent;
            ClientEvent.on(this._curWaitEvent, this._onFinishEventTrigger, this);
        }
    }

    /**
     * 注册重置事件
     */
    private _regResetEvent() {
        if (this._curWaitResetEvent) {
            ClientEvent.off(this._curWaitResetEvent, this._onResetEventTrigger, this);
            this._curWaitResetEvent = null!;
        }

        if (this._subGuideInfo.resetConditionEvent) {
            this._curWaitResetEvent = this._subGuideInfo.resetConditionEvent;
            ClientEvent.on(this._curWaitResetEvent, this._onResetEventTrigger, this);
        }
    }

    /**
     * 监听当事件完成后触发该函数
     */
    private _onFinishEventTrigger() {
        this._guideFinish();

        //如果触发了，就删除事件注册
        ClientEvent.off(this._curWaitEvent, this._onFinishEventTrigger, this);
        this._curWaitEvent = null!;
    }

    private _onResetEventTrigger() {
        //如果触发了，就删除事件注册
        ClientEvent.off(this._curWaitResetEvent, this._onResetEventTrigger, this);
        this._curWaitEvent = null!;

        this.show(this._subGuideInfo, false);
    }

    /**
     * 根据目标节点或者目标位置来设置遮罩区域、手势引导、可操作区域节点状态
     * @returns 
     */
    private _updatePosByTargetNode() {
        let maskPos = null;
        let width = 0;
        let height = 0;
        if (this._ndTarget) {
            let uiTransform = this._ndTarget.getComponent(UITransformComponent) as UITransformComponent;
            this._touchPos1.set(0, 0, 0);

            //ndTarget中心的在转成世界坐标
            let worldPos = uiTransform.convertToWorldSpaceAR(this._touchPos1);

            if (this._oldPos && worldPos.equals(this._oldPos)) {
                return;
            }

            this._oldPos.set(worldPos);

            let offsetAnchorPosX = 0.5 - uiTransform.anchorPoint.x;
            let offsetAnchorPosY = 0.5 - uiTransform.anchorPoint.y;
            worldPos.x += offsetAnchorPosX * uiTransform.width;
            worldPos.y += offsetAnchorPosY * uiTransform.height;

            //局部坐标
            maskPos = this.node.getComponent(UITransformComponent)?.convertToNodeSpaceAR(worldPos) as Vec3;

            width = uiTransform.contentSize.width + 4;

            if (this._subGuideInfo.offsetWidth) {
                width += Number(this._subGuideInfo.offsetWidth);
            }

            height = uiTransform.contentSize.height + 4;

            if (this._subGuideInfo.offsetHeight) {
                height += Number(this._subGuideInfo.offsetHeight);
            }

            if (this._subGuideInfo.offsetX) {
                maskPos.x += Number(this._subGuideInfo.offsetX);
            }
            if (this._subGuideInfo.offsetY) {
                maskPos.y += Number(this._subGuideInfo.offsetY);
            }
        } else if (this._targetContent) {
            if (this._oldPos && this._targetContent.pos && this._targetContent.pos.equals(this._oldPos)) {
                return;
            }

            this._oldPos = this._targetContent.pos;

            maskPos = this._targetContent.pos;
            width = this._targetContent.width;
            height = this._targetContent.height;
        }

        this._setMaskRegion(maskPos, width, height);
        this._showHand();
        this._setForce(this._isForce);

        //以下为当要隐藏黑色背景并且还需要接收全局点击时使用
        if (this._isHideBlack) {
            this._setForce(false);
        }
    }

    /**
     * 设置遮罩区域
     * @param pos 位置
     * @param width 宽
     * @param height 高
     */
    private _setMaskRegion(pos: Vec3, width: number, height: number) {
        if (width !== 0 && height !== 0) {
            this.ndMask.active = true;
            this.ndFrame.active = true;
        } else {
            this.ndMask.active = false;
            this.ndFrame.active = false;
        }

        this.ndMask.setPosition(pos);
        this.ndFrame.setPosition(pos);

        if (this._tweenFrame) {
            this._tweenFrame.stop();
            this._tweenFrame = null;
        }

        let UIComNdMask = this.ndMask.getComponent(UITransformComponent) as UITransformComponent;
        let UIComNdFrame = this.ndFrame.getComponent(UITransformComponent) as UITransformComponent;

        //会有个过渡效果,黑色背景逐渐往可视区消失
        if (this._isShowAni) {
            let frameSize = view.getViewportRect();

            UIComNdMask.setContentSize(frameSize.width * 2, frameSize.height * 2);
            UIComNdFrame.setContentSize(frameSize.width * 2, frameSize.height * 2);

            this._isPlayingAni = true;

            tween(UIComNdMask)
            .to(0.5, { width: width, height: height })
            .call(() => {
                this._isPlayingAni = false;
            }).start();

            this._tweenFrame = new Tween(UIComNdFrame).to(0.5, { width: width, height: height })
                .delay(1)
                .call(() => {
                    this.ndBackground.active = false;
                    let spComFrame = this.ndFrame.getComponent(SpriteComponent) as SpriteComponent;
                    spComFrame.spriteFrame = this.sfUnForce;
                    this._tweenFrame = null!;
                })
                .union()
                .start();
        } else {
            UIComNdMask.setContentSize(width, height);
            UIComNdFrame.setContentSize(width, height);
        }

        this.ndBackground.setPosition(-pos.x, -pos.y, 0);
        this.ndBackground.active = true;
    }

    /**
     * 展示合并操作
     * @returns 
     */
    private _showCombineHand() {
        this.ndHand.active = true;
        let spHand = this.ndHand.getComponent(SpriteComponent) as SpriteComponent;
        spHand.color = this._colorHand;

        //如果没有目标区域则返回，且隐藏手势节点
        if (!this._targetContent) {
            this.ndHand.active = false;
            return;
        }

        let posStart = this._targetContent.pos;
        posStart.x -= 110;
        this._endPos.set(posStart.x + 220, posStart.y);

        if (this._targetContent.dragStart) {
            posStart = this._targetContent.dragStart;
            this._endPos = this._targetContent.dragEnd;
        }

        //缓动时长
        let duration = this._endPos.clone().subtract(posStart).length() / 300;

        this.ndHand.position = posStart;
        this.ndHand.setScale(1.2, 1.2, 1.2);

        this._spHand = this.ndHand.getComponent(SpriteComponent) as SpriteComponent;

        //缓动 ：手势节点来回移动，指引合成
        this._tweenDrag = new Tween(this.ndHand)
            .delay(0.2)
            .to(0.2, { scale: this._dragScale1 })
            .delay(0.2)
            .to(duration, { position: this._endPos })
            .delay(0.2)
            .to(0.2, { scale: this._dragScale2 })
            .call(() => {
                if (this._tweenFade) {
                    this._tweenFade.stop();
                    this._tweenFade = null;
                }

                this._tweenFade = new Tween(this._spHand.color).to(0.2, { a: 0 }).start();
            })
            .delay(0.4)
            .call(() => {
                this.ndHand.position = posStart;
                this._spHand.color = Color.WHITE;
            }).union().repeatForever().start();
    }

    /**
     * 展示手势引导
     */
    private _showHand() {
        if (this._tweenHand) {
            this._tweenHand.stop();
            this._tweenHand = null;
        }

        if (this._tweenDrag) {
            this._tweenDrag.stop();
            this._tweenDrag = null;
        }

        if (this._tweenFade) {
            this._tweenFade.stop();
            this._tweenFade = null;
        }

        //特殊引导，特殊展示,用于提示合并的操作
        if (this._subGuideInfo.combineGuide) {
            this._showCombineHand();
            return;
        }

        if (this._subGuideInfo.isIntroduction && !this._subGuideInfo.isShowHandOnTips && !this._subGuideInfo.isShowHandOnFrame) {
            this.ndHand.active = false;
            return;
        }

        this.ndHand.active = true;

        let spHand = this.ndHand.getComponent(SpriteComponent) as SpriteComponent;
        spHand.color = this._colorHand;

        let pos: Vec3 | null = new Vec3();

        if (this.ndFrame) {
            pos = this.ndFrame.getPosition();
        }

        //视窗裁剪区域
        let winSize = view.getViewportRect();

        let UIComHand = this.ndHand.getComponent(UITransformComponent) as UITransformComponent;
        
        //手势节点长宽
        let size = UIComHand.contentSize;

        if (pos.x > winSize.width / 2 - size.width) {
            pos.x = winSize.width / 2 - size.width;
        }

        if (pos.y < - (winSize.height / 2 - size.height)) {
            pos.y = - (winSize.height / 2 - size.height);
        }

        this.ndHand.setPosition(pos);

        this._handPos1.set(pos.x + 20, pos.y - 20, 0);
        this._handPos2.set(pos.x, pos.y, 0);

        //手指从目标点右下角来回指向目标点的一个缓动效果
        this._tweenHand = new Tween(this.ndHand)
            .to(0.5, { position: this._handPos1 })
            .to(0.5, { position: this._handPos2 })
            .union()
            .repeatForever()
            .start();
    }

    /**
     * 设置遮罩和可操作区域节点状态
     * @param isForce 是否强制指引，就是他不能做其他操作，一定必须点那个之后才能继续
     */
    private _setForce(isForce: boolean) {
        this.ndMask.active = isForce;
        let sf = isForce ? this.sfForce : this.sfUnForce;
        let spFrame = this.ndFrame.getComponent(SpriteComponent) as SpriteComponent;
        spFrame.spriteFrame = sf;
    }

    /**
     * 本节点touchStart事件回调
     * @param event 
     * @returns 
     */
    private _onBgTouchStart(event: EventTouch) {
        if (this._isPlayingAni) {
            return;
        }

        this._isTouchStart = false;
        this._isDragStart = false;

        if (this._checkIsTouchNode(event, this._targetContent)) {
            this._isTouchStart = true;

            //模拟点击,由于点击事件会被拦截（可能引擎的BUG,点击事件注册后不会往下传）!!!!
            if (this._subGuideInfo.getPosFun && this._subGuideInfo.getPosFun.posRecvEventNodePath) {
                //接收事件的UI界面节点
                this._ndRecvEvent = find(this._subGuideInfo.getPosFun.posRecvEventNodePath) as Node;
                this._simTouchByEvent(Node.EventType.TOUCH_START, event, this._ndRecvEvent);
            } else {
                this._ndRecvEvent = null!;
            }
            return;
        }
    }

    /**
     * 本节点touchMove事件回调
     * @param event 
     * @returns 
     */
    private _onBgTouchMove(event: EventTouch) {
        if (this._isPlayingAni) {
            return;
        }

        if (this._isTouchStart && (this._subGuideInfo.combineGuide || this._checkIsTouchNode(event, this._targetContent))) {
            if (this._ndRecvEvent) {
                this._simTouchByEvent(Node.EventType.TOUCH_MOVE, event, this._ndRecvEvent);
            }

            return;
        } else if (this._isDragStart) {
            return;
        } else if (this._isForce) {
            event.propagationStopped = true;
        }
    }

    /**
     * 本节点touchCancel事件回调
     * @param event 
     * @returns 
     */
    private _onBgTouchCancel(event: EventTouch) {
        if (this._isPlayingAni) {
            return;
        }

        if (this._isTouchStart || this._isDragStart) {
            if (this._ndRecvEvent) {
                this._simTouchByEvent(Node.EventType.TOUCH_CANCEL, event, this._ndRecvEvent);
            }
        } else if (this._isForce) {
            event.propagationStopped = true;
        }
    }

    /**
     * 本节点touchEnd事件回调
     * @param event 
     * @returns 
     */
    private _onBgTouchEnd(event: EventTouch) {
        if (this._isPlayingAni) {
            return;
        }

        if (this._isTouchStart) {
            if (this._ndRecvEvent) {
                this._simTouchByEvent(Node.EventType.TOUCH_END, event, this._ndRecvEvent);
            }
        } else if (this._isDragStart) {
            // if (!this.subGuide.pushCakeGuide) {
            //     this.afterDrag(event);
            // }
        } else if (this._isForce) {
            if (this._isHideBlack && this._isSkipByAnyWhere) {
                this._guideFinish();
            }

            event.propagationStopped = true;
        }
    }

    /**
     * 完成大步骤引导
     */
    private _guideFinish() {
        //关闭定时器
        if (this._refreshPosTimer) {
            clearInterval(this._refreshPosTimer);
            this._refreshPosTimer = null!;
        }

        GuideManager.instance.finishBigGuide();
    }

    /**
     * 检查是否点击到目标节点/区域
     * @param touchEvent 
     * @param content 
     * @returns 
     */
    private _checkIsTouchNode(touchEvent: EventTouch, content: any) {
        if (!content) {
            return false;
        }

        let pos = touchEvent.getUILocation();
        this._touchPos2.set(content.pos.x, content.pos.y, 0);
        let posContent = this.node.getComponent(UITransformComponent)?.convertToWorldSpaceAR(this._touchPos2) as Vec3;
        //操作区域
        let box = rect(posContent.x - content.width / 2, posContent.y - content.height / 2, content.width, content.height);
        //检查触摸点是否包含在目标范围内
        if (box.contains(pos)) {
            return true;
        }

        return false;
    }

    /**
     * 可操作区域节点touchStart事件回调
     * @param event 
     * @returns 
     */
    private _onTouchStart(event: EventTouch) {
        if (this._isPlayingAni) {
            return;
        }

        console.log("shadows touchStart");

        if (this._isTouch) {
            return;
        }

        //获取目前所要点击的节点，派发点击事件
        if (this._ndTarget) {
            this._simTouchByEvent(Node.EventType.TOUCH_START, event, this._ndTarget);
        }
    }
    
    /**
     * 可操作区域节点touchEnd事件回调
     * @param event 
     * @returns 
     */
    private _onTouchEnd(event: EventTouch) {
        if (this._isPlayingAni) {
            return;
        }

        console.log("shadows touchEnd");

        if (this._isTouch) {
            return;
        }

        this._isTouch = true;

        //获取目前所要点击的节点，派发点击事件
        if (this._ndTarget) {
            this._simTouchByEvent(Node.EventType.TOUCH_END, event, this._ndTarget);
            this._guideFinish();
        }
    }

    /**
     * 可操作区域节点touchCancel事件回调
     * @param event 
     * @returns 
     */
    private _onTouchCancel(event: EventTouch) {
        if (this._isPlayingAni) {
            return;
        }

        console.log("shadows touchCancel");

        //获取目前所要点击的节点，派发点击事件
        if (this._ndTarget) {
            this._simTouchByEvent(Node.EventType.TOUCH_CANCEL, event, this._ndTarget);
        }
    }

    /**
     * 模拟点击
     * @param type 
     * @param oldEvent 
     * @param node 
     */
    private _simTouchByEvent(type: any, oldEvent: EventTouch, node?: Node) {
        if (typeof (oldEvent.getTouches) !== "function") {
            console.error("oldEvent.getTouches is not a function!type(" + typeof (oldEvent.getTouches) + ")");
        }

        // if (cc.sys.isNative && type === cc.Node.EventType.TOUCH_END) {
        //     let randId = this.touchId++;
        //     let frameSize = cc.winSize;
        //     let posLocation = oldEvent.getLocation();
        //     let x = posLocation.x;
        //     let yPos = posLocation.y;
        //     if (cc.sys.isNative) {
        //         yPos = frameSize.height - yPos;
        //     }

        //     let touch = new cc.Touch();
        //     touch.setTouchInfo(randId, x, yPos);

        //     let touchArr = [touch];

        //     let tmpEvent = new cc.Event.EventTouch(touchArr, false);
        //     tmpEvent.type = type;
        //     tmpEvent.touch = touch;
        //     tmpEvent.simulate = true;
        //     node.dispatchEvent(tmpEvent);
        //     return;
        // }

        let endEvent = new EventTouch(oldEvent.getTouches(), oldEvent.bubbles, type) as EventTouch;
        // endEvent.type = type;
        endEvent.touch = oldEvent.touch;
        endEvent.simulate = true;
        if (node) {
            node.dispatchEvent(endEvent);
        } else {
            //@ts-ignore
            endEvent.eventManager.dispatchEvent(endEvent);
        }
    }

    // update (deltaTime: number) {
    //     // Your update function goes here.
    // }
}
