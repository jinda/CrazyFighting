import {
    _decorator,
    Prefab,
    Button,
    find,
    EventHandler,
    Toggle,
    ToggleContainer,
    Node,
    Component,
    EventTouch,
    Slider,
    Tween,
} from "cc";
import { DoubleList, DoubleListItem } from "../base/DoubleList";
import { NetMgr } from "../network/NetMgr";
const { ccclass } = _decorator;

/** EventHandler 上附加的自定义透传字段：注册时写入（onButtonEvent/onToggleEvent/onSlideEvent），事件转发时读取 */
interface IHandlerExtras {
    $cb$?: Function;
    $target$?: any;
    $args$?: any;
    $interval$?: number;
    $lastClickTime$?: number;
}
/** 以 IHandlerExtras 视角访问 EventHandler（这些字段运行时动态挂载，不在 cc 类型声明里） */
const handlerExtras = (h: EventHandler): IHandlerExtras => h as unknown as IHandlerExtras;
/***
 * @en internal class, used for handling node event.
 * @zh 内部类，用于节点事件监听
 *
 *  */
@ccclass("NodeEventAgent")
export class __NodeEventAgent__ extends Component {
    /***
     * @en recieve button click event and deliver them to the real handlers.
     * @zh 接受按钮事件，并转发给真正的处理函数
     * */
    onButtonClicked(evt: EventTouch, customEventData: any) {
        const btn = (evt.target as Node).getComponent(Button);
        const clickEvents = btn!.clickEvents;
        for (let i = 0; i < clickEvents.length; ++i) {
            const h = clickEvents[i];
            if (h.customEventData == customEventData) {
                const ex = handlerExtras(h);
                const cb = ex.$cb$!;
                const target = ex.$target$;
                const interval = ex.$interval$!;
                const lastClickTime = ex.$lastClickTime$;
                if (interval > 0) {
                    const currentTime = Date.now();
                    if (lastClickTime && currentTime - lastClickTime < interval) {
                        return;
                    }
                    ex.$lastClickTime$ = currentTime;
                }
                cb.apply(target, [btn, ex.$args$]);
            }
        }
    }

    /***
     * @en recieve toggle event and deliver them to the real handlers.
     * @zh 接受Toggle事件，并转发给真正的处理函数
     * */
    onToggleEvent(toggle: Toggle, customEventData: any) {
        // Toggle 自身与父容器会分别派发事件，必须按注册 ID 查找对应的回调。
        const handler =
            toggle.checkEvents.find((h) => h.customEventData === customEventData) ??
            toggle.node.parent
                ?.getComponent(ToggleContainer)
                ?.checkEvents.find((h) => h.customEventData === customEventData);
        if (!handler) return;
        const ex = handlerExtras(handler);
        ex.$cb$!.apply(ex.$target$, [toggle, ex.$args$]);
    }

    /***
     * @en recieve slide event and deliver them to the real handlers.
     * @zh 接受 Slide 事件，并转发给真正的处理函数
     * */
    onSlideEvent(slider: Slider, customEventData: any) {
        let slideEvents = slider.slideEvents;
        for (let i = 0; i < slideEvents.length; ++i) {
            let h = slideEvents[i];
            if (h.customEventData == customEventData) {
                const ex = handlerExtras(h);
                ex.$cb$!.apply(ex.$target$, [slider, ex.$args$]);
            }
        }
    }
}

/**
 * @en base class of UI Panel
 * @zh 各类UI面板基类
 * */
export class UIController {
    /** 实例 id 计数器（只用于 instId） */
    private static _instIdBase = 1000;
    /** 事件 id 计数器（只用于 EventHandler.customEventData，与 instId 解耦） */
    private static _eventIdBase = 1;

    private static _controllers: DoubleList = new DoubleList();
    /**
     * 需要逐帧更新的控制器。
     * 原来 updateAll 每帧遍历全部 controller 并调用空实现的 onUpdate，
     * 现在只登记真正覆写了 onUpdate 的实例（基于原型比较，只判一次）。
     */
    private static _updaters: Set<UIController> = new Set();

    private _listItem: DoubleListItem | null = null;
    private _instId: number = 0;
    private _prefab: string | Prefab;
    private _layer: number;
    private _layout: any;
    private _layoutCls: any;
    protected _node: Node | null = null;
    protected _destroyed: boolean = false;
    protected _ingoreCloseAll: boolean = false;
    constructor(prefab: string | Prefab, layer: number, layoutCls: any) {
        this._prefab = prefab;
        this._layer = layer;
        this._layoutCls = layoutCls;
        this._instId = UIController._instIdBase++;
        this._listItem = UIController._controllers.addToTail(this);
    }

    /***
     * @en the instance id to indicate an unique ui panel.
     * @zh 实例ID，用于标记一个唯一面板实例
     *  */
    public get instId(): number {
        return this._instId;
    }

    /***
     * @en url of the prefab used by this ui panel.
     * @zh 本UI使用prefab路径
     *  */
    public get prefab(): string | Prefab {
        return this._prefab;
    }

    /***
     * @en layer of this ui panel.
     * @zh 本UI所在的UI层级
     *  */
    public get layer(): number {
        return this._layer;
    }

    /***
     * @en layout of this ui panel.
     * @zh 本UI所在的UI层级
     *  */
    public get layout(): any {
        return this._layout;
    }

    /***
     * @en layout of this ui panel.
     * @zh 本UI所在的UI层级
     *  */
    public set layout(layout) {
        this._layout = layout;
    }

    /***
     * @en node of this ui node.
     * @zh 本UI的Node节点
     *  */
    public get node(): Node {
        return this._node!;
    }

    /***
     * @en hide and destroy all ui panel.
     * @zh 隐藏并销毁所有UI面板
     *  */
    public static closeAll() {
        this._controllers.forEach((v) => {
            let c = v.data as UIController;
            if (!c._ingoreCloseAll && c.close) {
                c.close();
            }
        });
    }

    /** 只驱动真正需要逐帧更新的界面 */
    public static updateAll(dt: number) {
        const updaters = this._updaters;
        if (updaters.size === 0) {
            return;
        }
        // Set.forEach 允许在遍历中删除当前元素（界面在 onUpdate 里 close 自己是常见写法）
        updaters.forEach((c) => {
            if (c._node) {
                c.onUpdate(dt);
            }
        });
    }

    //setup this ui,called by UIMgr.
    public setup(node: Node, params: any) {
        this._node = node;

        if (this._layoutCls) {
            this._layout = this.node.getComponent(this._layoutCls);
        }

        // 只在真正覆写了 onUpdate 时登记，避免每帧调用空实现
        if (this.onUpdate !== UIController.prototype.onUpdate) {
            UIController._updaters.add(this);
        }

        //notify sub class to handle something.
        //节点创建完毕，调用子类的处理函数。
        this.onCreated(params);

        if (this._destroyed) {
            this.close();
        }

        this.checkClose();
    }

    /**
     * @en hide and destroy this ui panel.
     * @zh 隐藏并销毁此UI面板
     *  */
    public close() {
        this._destroyed = true;
        UIController._updaters.delete(this);
        this._listItem?.dispose();
        this._listItem = null;
        NetMgr.clearHandlerTarget(this);
        // 按 target 兜底清理事件总线：界面漏写 EventMgr.off 也不会把 controller 钉在事件表里
        egf.EventMgr.offTarget(this);

        if (this.node) {
            this.layout?.unscheduleAllCallbacks();
            // 停掉整棵子树上的补间。
            // 原来只 unschedule 定时器，repeatForever 的 tween（如 Layout_Menu 的指针摇摆、
            // 按钮呼吸缩放）在节点销毁后仍常驻 ActionManager，并持有已销毁节点的引用。
            this.stopTweens(this.node);
            this.node.removeFromParent();
            this.onDispose();
            this.node.destroy();
            this._node = null;
        }
    }

    /** 递归停掉节点及其子节点上的所有补间 */
    private stopTweens(node: Node) {
        Tween.stopAllByTarget(node);
        const children = node.children;
        for (let i = 0, len = children.length; i < len; ++i) {
            this.stopTweens(children[i]);
        }
    }

    /**
     * @en add button event handler
     * @zh 添加按钮事件
     * @param relativeNodePath to indicate a button node, can pass `string`|`Node`|`Button` here.
     * @param cb will be called when event emits. method format:(btn:Button,args:any)=>void
     * @param target the `this` argument of `cb`
     *  */
    onButtonEvent(
        relativeNodePath: string | Node | Button,
        cb: Function,
        target?: any,
        args?: any,
        interval: number = 500,
    ) {
        if (!relativeNodePath || relativeNodePath == "") {
            egf.Logger.error("onButtonEvent: relativeNodePath is empty:", relativeNodePath);
            return;
        }
        let buttonNode: Node | null = null;
        if (relativeNodePath instanceof Node) {
            buttonNode = relativeNodePath;
        } else if (relativeNodePath instanceof Button) {
            buttonNode = relativeNodePath.node;
        } else {
            buttonNode = find(relativeNodePath, this.node);
        }

        if (!buttonNode) {
            return;
        }

        //添加转发器
        let agent = this.node.getComponent(__NodeEventAgent__);
        if (!agent) {
            agent = this.node.addComponent(__NodeEventAgent__);
        }

        let btn = buttonNode.getComponent(Button);
        if (!btn) {
            btn = buttonNode.addComponent(Button);
        }
        let clickEvents = btn.clickEvents;
        let handler = new EventHandler();
        handler.target = this.node;
        handler.component = "NodeEventAgent";
        handler.handler = "onButtonClicked";
        handler.customEventData = "" + UIController._eventIdBase++;

        //附加额外信息 供事件转发使用
        const ex = handlerExtras(handler);
        ex.$cb$ = cb;
        ex.$target$ = target;
        ex.$args$ = args;
        ex.$interval$ = interval;

        clickEvents.push(handler);
        btn.clickEvents = clickEvents;
    }

    /**
     * @en remove button event handler
     * @zh 移除按钮事件
     * @param relativeNodePath to indicate a button node, can pass `string`|`Node`|`Button` here.
     * @param cb will be called when event emits.
     * @param target the `this` argument of `cb`
     *  */
    offButtonEvent(relativeNodePath: string | Node | Button, cb?: Function, target?: any) {
        if (!relativeNodePath || relativeNodePath == "") {
            egf.Logger.error("onButtonEvent: relativeNodePath is empty:", relativeNodePath);
            return;
        }
        let buttonNode: Node | null = null;
        if (relativeNodePath instanceof Node) {
            buttonNode = relativeNodePath;
        } else if (relativeNodePath instanceof Button) {
            buttonNode = relativeNodePath.node;
        } else {
            buttonNode = find(relativeNodePath, this.node);
        }

        if (!buttonNode) {
            return;
        }

        let agent = this.node.getComponent(__NodeEventAgent__);
        if (!agent) {
            return;
        }
        let btn = buttonNode.getComponent(Button);
        if (!btn) {
            return;
        }
        let clickEvents = btn.clickEvents;
        if (cb && target) {
            for (let i = 0; i < clickEvents.length; ++i) {
                let h = clickEvents[i];
                const ex = handlerExtras(h);
                if (ex.$cb$ == cb && ex.$target$ == target) {
                    clickEvents.splice(i, 1);
                    btn.clickEvents = clickEvents;
                    break;
                }
            }
        } else {
            btn.clickEvents.length = 0;
        }
    }

    /**
     * @en add toggle event handler
     * @zh 添加Toggle事件
     * @param relativeNodePath to indicate a button node, can pass `string`|`Node`|`Button` here.
     * @param cb will be called when event emits. method format:(btn:Toggle,args:any)=>void
     * @param target the `this` argument of `cb`
     *  */

    onToggleEvent(relativeNodePath: string | Node | Toggle | ToggleContainer, cb: Function, target?: any, args?: any) {
        let buttonNode: Node | null = null;
        if (relativeNodePath instanceof Node) {
            buttonNode = relativeNodePath;
        } else if (relativeNodePath instanceof Toggle) {
            buttonNode = relativeNodePath.node;
        } else if (relativeNodePath instanceof ToggleContainer) {
            buttonNode = relativeNodePath.node;
        } else {
            buttonNode = find(relativeNodePath, this.node);
        }

        if (!buttonNode) {
            egf.Logger.error("onToggleEvent: buttonNode is empty:", relativeNodePath);
            return;
        }

        //添加转发器
        let agent = this.node.getComponent(__NodeEventAgent__);
        if (!agent) {
            agent = this.node.addComponent(__NodeEventAgent__);
        }

        let btn = buttonNode.getComponent(Toggle) as any;
        if (!btn) {
            btn = buttonNode.getComponent(ToggleContainer) as any;
        }
        let checkEvents = btn.checkEvents;
        let handler = new EventHandler();
        handler.target = this.node;
        handler.component = "NodeEventAgent";
        handler.handler = "onToggleEvent";
        handler.customEventData = "" + UIController._eventIdBase++;

        //附加额外信息 供事件转发使用
        const ex = handlerExtras(handler);
        ex.$cb$ = cb;
        ex.$target$ = target;
        ex.$args$ = args;

        checkEvents.push(handler);
        btn.checkEvents = checkEvents;
    }

    /**
     * @en remove toggle event handler
     * @zh 移除Toggle事件
     * @param relativeNodePath to indicate a button node, can pass `string`|`Node`|`Button` here.
     * @param cb will be called when event emits. method format:(btn:Toggle,args:any)=>void
     * @param target the `this` argument of `cb`
     *  */
    offToggleEvent(relativeNodePath: string | Node | Toggle | ToggleContainer, cb: Function, target: any) {
        let buttonNode: Node | null = null;
        if (relativeNodePath instanceof Node) {
            buttonNode = relativeNodePath;
        } else if (relativeNodePath instanceof Toggle) {
            buttonNode = relativeNodePath.node;
        } else if (relativeNodePath instanceof ToggleContainer) {
            buttonNode = relativeNodePath.node;
        } else {
            buttonNode = find(relativeNodePath, this.node);
        }

        if (!buttonNode) {
            return;
        }

        //添加转发器
        let agent = this.node.getComponent(__NodeEventAgent__);
        if (!agent) {
            return;
        }
        let btn = buttonNode.getComponent(Toggle) as any;
        if (!btn) {
            btn = buttonNode.getComponent(ToggleContainer) as any;
        }
        let checkEvents = btn.checkEvents;
        for (let i = 0; i < checkEvents.length; ++i) {
            let h = checkEvents[i];
            const ex = handlerExtras(h);
            if (ex.$cb$ == cb && ex.$target$ == target) {
                checkEvents.splice(i, 1);
                btn.checkEvents = checkEvents;
                break;
            }
        }
    }

    onSlideEvent(relativeNodePath: string | Node | Slider, cb: Function, target?: any, args?: any) {
        let sliderNode: Node | null = null;
        if (relativeNodePath instanceof Node) {
            sliderNode = relativeNodePath;
        } else if (relativeNodePath instanceof Slider) {
            sliderNode = relativeNodePath.node;
        } else {
            sliderNode = find(relativeNodePath, this.node);
        }

        if (!sliderNode) {
            return;
        }

        //添加转发器
        let agent = this.node.getComponent(__NodeEventAgent__);
        if (!agent) {
            agent = this.node.addComponent(__NodeEventAgent__);
        }

        let slider = sliderNode.getComponent(Slider)!;
        let slideEvents = slider.slideEvents;
        let handler = new EventHandler();
        handler.target = this.node;
        handler.component = "NodeEventAgent";
        handler.handler = "onSlideEvent";
        handler.customEventData = "" + UIController._eventIdBase++;

        //附加额外信息 供事件转发使用
        const ex = handlerExtras(handler);
        ex.$cb$ = cb;
        ex.$target$ = target;
        ex.$args$ = args;

        slideEvents.push(handler);
        slider.slideEvents = slideEvents;
    }

    offSlideEvent(relativeNodePath: string | Node | Slider, cb: Function, target: any) {
        let sliderNode: Node | null = null;
        if (relativeNodePath instanceof Node) {
            sliderNode = relativeNodePath;
        } else if (relativeNodePath instanceof Slider) {
            sliderNode = relativeNodePath.node;
        } else {
            sliderNode = find(relativeNodePath, this.node);
        }

        if (!sliderNode) {
            return;
        }

        //添加转发器
        let agent = this.node.getComponent(__NodeEventAgent__);
        if (!agent) {
            return;
        }
        let slider = sliderNode.getComponent(Slider)!;
        let slideEvents = slider.slideEvents;
        for (let i = 0; i < slideEvents.length; ++i) {
            let h = slideEvents[i];
            const ex = handlerExtras(h);
            if (ex.$cb$ == cb && ex.$target$ == target) {
                slideEvents.splice(i, 1);
                slider.slideEvents = slideEvents;
                break;
            }
        }
    }

    /***
     * @en the extra resource needed by this ui panel.the ui will not be created until these res loaded.
     * @zh 本UI使用的依赖资源.UI会等这些资源加载完成后才创建。
     *  */
    public getRes(): Array<string> {
        return [];
    }
    /**
     * @en check if this ui panel can be closed by clicking blank.
     * @zh 检查本UI面板是否可以点击空白关闭。
     */
    private checkClose() {
        let btnBack = this.node?.getChildByName("BtnBack");
        if (btnBack) {
            if (!btnBack.getComponent(Button)) {
                btnBack.addComponent(Button);
            }
            this.onButtonEvent(btnBack, this.close, this);
        }
    }

    //子类的所有操作，需要在这个函数之后。
    protected onCreated(params?: any) {}
    //销毁
    protected onDispose() {}
    //
    protected onUpdate(dt: number) {}
}
