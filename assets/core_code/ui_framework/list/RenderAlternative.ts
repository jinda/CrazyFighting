import {
    _decorator,
    Node,
    Component,
    UIRenderer,
    Mat4,
    Vec3,
    director,
    UITransform,
    instantiate,
    sys,
    UIOpacity,
    Label,
} from "cc";
import { RenderReactiveHandler } from "./RenderReactiveHandler";

/**
 * 目前该渲染代理功能存在的问题
 * 1.被代理节点的父级不能出现scaleX和scaleY不一致的情况，被代理节点本身没有这个限制
 */
const { ccclass, property } = _decorator;
@ccclass
export default class RenderAlternative extends Component {
    private static _isDirty: WeakMap<Node, boolean> = new WeakMap();
    /** 所有在跑同步的实例 */
    private static _actives: Set<RenderAlternative> = new Set();
    /** 全局唯一的 rAF 句柄（只创建一次，不再每帧 bind） */
    private static _tickHandle: (() => void) | null = null;
    private static _rafId: number = 0;

    private static startLoop(): void {
        if (this._rafId !== 0) {
            return;
        }
        if (!this._tickHandle) {
            this._tickHandle = () => {
                RenderAlternative._rafId = 0;
                // Set.forEach 允许在遍历中删除当前元素（组件在帧内被销毁是常见情况）
                RenderAlternative._actives.forEach((c) => c.frameUpdate());
                if (RenderAlternative._actives.size > 0) {
                    RenderAlternative.startLoop();
                }
            };
        }
        this._rafId = requestAnimationFrame(this._tickHandle);
    }

    public static isDirty(renderLayer: Node): boolean {
        return this._isDirty.get(renderLayer) ?? false;
    }
    public static setDirty(renderLayer: Node) {
        if (renderLayer && !this.isDirty(renderLayer)) {
            this._isDirty.set(renderLayer, true);
            this.sortOnce(renderLayer);
        }
    }
    public static sortOnce(renderLayer: Node) {
        requestAnimationFrame(() => {
            renderLayer.children.sort(this.sortChildren);
            this._isDirty.set(renderLayer, false);
        });
    }
    private static sortChildren(a: Node, b: Node) {
        //@ts-ignore
        let aindex = a._rZIndex,
            //@ts-ignore
            bindex = b._rZIndex;
        if (Number.isFinite(aindex) && Number.isFinite(bindex)) {
            return aindex - bindex;
        } else if (!Number.isFinite(aindex)) {
            return 1;
        } else {
            return -1;
        }
    }
    /**渲染层节点 */
    @property(Node)
    public renderLayer: Node = null!;
    /**渲染的zIndex */
    @property
    public renderZIndex: number = 0;
    /**同步的间隔（帧为单位） */
    @property({
        tooltip: "设置同步的间隔(秒为单位)，0就是每帧都同步，0.1就是隔0.1秒同步一次",
    })
    public syncInv: number = 0.01;
    /**渲染的sIndex */
    public sIndex: number = 0;
    /**非渲染组件 */
    public proxyRender: UIRenderer = null!;
    /**渲染组件 */
    private renderCompnent: UIRenderer = null!;
    /**渲染节点的ui控件 */
    private renderUiTrans: UITransform = null!;
    /**ui控件 */
    private uiTrans: UITransform = null!;
    /**上次更新的数据 */
    public lastWMat4: Mat4 = null!;
    /**上次更新的数据 */
    public lastLMat4: Mat4 = null!;
    /**上次更新的数据 */
    public lastPos: Vec3 = null!;
    /**距离下次刷新累计了多少间隔 */
    public accuTime: number = 0;
    /**最后一次刷新时间 */
    public lastFrameTime: number = null!;
    /**是否进行刷新 */
    public isAttachFrame: boolean = false;

    /**获取总的ZIndex */
    get zIndex() {
        let zIndex = this.renderZIndex + this.sIndex * 0.01;
        let parentNode = this.node.parent;
        while (parentNode && parentNode != this.renderLayer?.parent && parentNode != director.getScene()) {
            let render = parentNode.getComponent(RenderAlternative);
            if (render) {
                zIndex += render.zIndex + 1;
                break;
            }
            parentNode = parentNode.parent;
        }
        return zIndex;
    }

    /**
     * 设置渲染节点层
     * @param layer
     */
    init<T extends UIRenderer>(layer?: Node): T {
        if (layer) {
            this.renderLayer = layer;
        }
        if (!this.renderLayer) {
            egf.Logger.warn(`节点${this.node.name}没有设置渲染层`);
            return null!;
        }
        return this.initRender<T>();
    }
    /**
     * 初始化渲染节点
     */
    private initRender<T extends UIRenderer>(): T {
        let node = this.getRender();
        node.setParent(this.renderLayer ? this.renderLayer : director.getScene()!.getChildByName("Canvas"));
        this.isAttachFrame = true;
        // 注册到静态循环：一个 rAF 驱动全部实例，且不再每帧新建 bind 闭包
        RenderAlternative._actives.add(this);
        RenderAlternative.startLoop();
        return this.doProxy<T>();
    }
    /**生成代理 */
    private doProxy<T extends UIRenderer>(): T {
        this.proxyRender = new Proxy(this.renderCompnent, new RenderReactiveHandler()) as T;
        return this.proxyRender as T;
    }

    protected frameUpdate(): void {
        // 不再自己续帧：由静态循环统一调度
        let now = sys.now();
        if (!this.lastFrameTime) {
            this.lastFrameTime = now;
        }
        let dt = (now - this.lastFrameTime) / 1000;
        this.lastFrameTime = now;
        if (this.proxyRender) {
            this.accuTime += dt;
            if (this.accuTime >= this.syncInv) {
                this.accuTime -= this.syncInv;
                this.updateProp();
            }
        }
    }

    /**更新最新状态 */
    public updateProp() {
        let node = this.renderCompnent.node;
        let uiTrans = this.renderUiTrans;
        if (!this.node.activeInHierarchy) {
            node.active = false;
            return;
        }
        node.active = true;
        uiTrans.anchorX != this.uiTrans.anchorX && (uiTrans.anchorX = this.uiTrans.anchorX);
        uiTrans.anchorY != this.uiTrans.anchorY && (uiTrans.anchorY = this.uiTrans.anchorY);
        if (uiTrans.width != this.uiTrans.width) {
            uiTrans.width = this.uiTrans.width;
            if (this.renderCompnent instanceof Label) {
                requestAnimationFrame(() => {
                    this.uiTrans.width = uiTrans.width;
                });
            }
        }
        if (uiTrans.height != this.uiTrans.height) {
            uiTrans.height = this.uiTrans.height;
            if (this.renderCompnent instanceof Label) {
                requestAnimationFrame(() => {
                    this.uiTrans.height = uiTrans.height;
                });
            }
        }
        node.layer != this.node.layer && (node.layer = this.node.layer);

        let opacity = this.getOpacity(this.node);
        if (opacity != 255) {
            let uiOpacity = node.getComponent(UIOpacity) || node.addComponent(UIOpacity);
            uiOpacity.opacity != opacity && (uiOpacity.opacity = opacity);
        }

        // 用 set() 原地拷贝代替 clone()：equals 需要 Mat4 实例，但不需要新实例
        const wMat4 = this.node.worldMatrix;
        const lMat4 = this.node.matrix;
        if (!this.lastWMat4) {
            this.lastWMat4 = new Mat4();
            this.lastLMat4 = new Mat4();
            this.lastWMat4.set(wMat4);
            this.lastLMat4.set(lMat4);
        } else if (!this.lastWMat4.equals(wMat4) || !this.lastLMat4.equals(lMat4)) {
            this.onAngleChange();
            this.onScaleChange();
            this.onPosChange();
            this.lastWMat4.set(wMat4);
            this.lastLMat4.set(lMat4);
        }
        //@ts-ignore
        let old = node._rZIndex;
        //@ts-ignore
        node._rZIndex = this.zIndex;
        if (old != this.zIndex) {
            RenderAlternative.setDirty(this.renderLayer);
        }
    }

    protected onDestroy(): void {
        RenderAlternative._actives.delete(this);
        this.isAttachFrame = false;
        this.renderCompnent?.node.destroy();
        this.renderCompnent = null!;
        this.proxyRender = null!;
    }

    /**
     * 获取节点透明度
     * @param node
     */
    private getOpacity(node: Node) {
        let opacity = (node.getComponent(UIOpacity)?.opacity || 255) / 255;
        let parentNode = node.parent;
        while (parentNode && parentNode != this.renderLayer.parent && parentNode != director.getScene()) {
            opacity *= (parentNode.getComponent(UIOpacity)?.opacity || 255) / 255;
            parentNode = parentNode.parent;
        }
        return opacity * 255;
    }
    /**位置变化处理（setWorldPosition 内部会拷贝，不必先 clone） */
    private onPosChange() {
        this.renderCompnent.node.setWorldPosition(this.node.worldPosition);
    }
    /**旋转变化处理 */
    private onAngleChange() {
        this.renderCompnent.node.setWorldRotation(this.node.worldRotation);
    }
    /**缩放变化处理 */
    private onScaleChange() {
        this.renderCompnent.node.setWorldScale(this.node.worldScale);
    }
    /**
     * 获取渲染组件
     * @param node
     */
    private getRender() {
        let node = instantiate(this.node);
        node.removeAllChildren();
        this.uiTrans = this.node.getComponent(UITransform)!;
        this.renderUiTrans = node.getComponent(UITransform)!;
        this.renderCompnent = node.getComponent(UIRenderer)!;
        this.node.getComponent(UIRenderer)!.destroy();
        for (let i = 0, len = node.components.length; i < len; ++i) {
            let comp = node.components[i];
            if (!(comp instanceof UIRenderer || comp instanceof UITransform)) {
                comp.destroy();
            }
        }
        return node;
    }
}
