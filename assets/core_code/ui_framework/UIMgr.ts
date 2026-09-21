import {
    _decorator,
    Node,
    Prefab,
    instantiate,
    Widget,
    UITransform,
    assetManager,
    AssetManager,
    director,
    error,
    Component,
} from "cc";
import { UIController } from "./UIController";
import { ModuleContext } from "../base/ModuleContext";
import { ResolutionAutoFit } from "../base/ResolutionAutoFit";

const { ccclass } = _decorator;
type ShowFunc = (ui: UIController) => void;

@ccclass("UIMgr.UIUpdater")
class UIUpdater extends Component {
    update(dt: number) {
        UIController.updateAll(dt);
    }
}

/**
 * @en the `User Interface Manager`, handles some stuffs like the ui loads,ui layers,resizing etc.
 * @zh UI管理器，处理UI加载，层级，窗口变化等
 *
 * */
class UIManager {
    private static _inst: UIManager | null = null;
    public static get inst(): UIManager {
        if (this._inst == null) {
            this._inst = new UIManager();
        }
        return this._inst;
    }

    private _uiCanvas: Node | null = null;
    private _uiRoot: Node | null = null;

    private createFullScreenNode() {
        let canvas = this._uiCanvas?.getComponent(UITransform)!;
        let node = new Node();
        node.layer = this._uiCanvas!.layer;
        let uiTransform = node.addComponent(UITransform);
        uiTransform.width = canvas.width;
        uiTransform.height = canvas.height;

        let widget = node.addComponent(Widget);
        widget.isAlignBottom = true;
        widget.isAlignTop = true;
        widget.isAlignLeft = true;
        widget.isAlignRight = true;

        widget.left = 0;
        widget.right = 0;
        widget.top = 0;
        widget.bottom = 0;
        return node;
    }

    /**
     * @en setup this UIMgr,`don't call more than once`.
     * @zh 初始化UIMgr,`不要多次调用`
     *  */
    public setup(uiCanvas: Node | Prefab, maxLayers: number, layerNames?: Array<string>) {
        if (this._uiCanvas) {
            return;
        }

        if (!uiCanvas) {
            throw error("uiCanvas must be a Node or Prefab");
        }
        if (uiCanvas instanceof Node) {
            this._uiCanvas = uiCanvas;
        } else {
            this._uiCanvas = instantiate(uiCanvas);
            director.getScene()?.addChild(this._uiCanvas);
        }

        this._uiCanvas.name = "$UICanvas$";
        director.addPersistRootNode(this._uiCanvas);

        if (!this._uiCanvas.getComponent(UIUpdater)) {
            this._uiCanvas.addComponent(UIUpdater);
        }

        //this.resize();
        this._uiCanvas.addComponent(ResolutionAutoFit);

        layerNames ||= [];

        this._uiRoot = this.createFullScreenNode();
        this._uiRoot.name = "ui_root";
        this._uiCanvas.addChild(this._uiRoot);

        //create layers
        for (let i = 0; i < maxLayers; ++i) {
            let layerNode = this.createFullScreenNode();
            layerNode.name = "ui_layer_" + (layerNames[i] ? layerNames[i] : i);
            this._uiRoot.addChild(layerNode);
        }
    }

    public getLayerNode(layerIndex: number): Node {
        return this._uiRoot!.children[layerIndex] || this._uiRoot;
    }

    public closeAll() {
        UIController.closeAll();
    }

    public closeUI(uiCls: any) {
        let allControllers = (UIController as any)._controllers;
        allControllers.forEach((v: any) => {
            let c = v.data as UIController;
            if (c instanceof uiCls) {
                c.close();
            }
        });
    }

    public getUI<T extends UIController>(uiCls: any): T {
        let allControllers = (UIController as any)._controllers;
        let ui = null;
        allControllers.forEach((v: any) => {
            let c = v.data as UIController;
            if (c instanceof uiCls) {
                ui = c as T;
            }
        });
        return ui as any;
    }

    public isShowing(uiCls: any): boolean {
        let allControllers = (UIController as any)._controllers;
        let bShow = false;
        allControllers.forEach((v: any) => {
            let c = v.data as UIController;

            if (c instanceof uiCls) {
                bShow = true;
                return;
            }
        });
        return bShow;
    }

    /***
     * @en show ui by the given parameters.
     * @zh 显示UI
     * @param uiCls the class, must inherits from the class `UIController`.
     * @param cb will be called after ui created.
     * @param thisArg the this argument for param `cb`.
     * @returns the instance of `uiCls`
     *  */
    public showUI(uiCls: any, cb?: ShowFunc | null, thisArg?: any, params?: any): any {
        if (this.isShowing(uiCls)) {
            const controller = this.getUI(uiCls);
            if (!controller) {
                return;
            }
            const parent = UIMgr.getLayerNode(controller.layer);
            // egf.Logger.log('showUI:', controller.node, parent);
            controller.node?.setSiblingIndex(parent.children.length - 1);
            return;
        }
        let bundleName = ModuleContext.getClassModule(uiCls);
        if (bundleName) {
            const bundle = assetManager.getBundle(bundleName);
            if (!bundle) {
                assetManager.loadBundle(bundleName, null, (err, loadedBundle) => {
                    if (err) {
                        egf.Logger.error(err);
                    } else {
                        this.showUI(uiCls, cb, thisArg, params);
                    }
                });
                return;
            }
        }

        const ui = ModuleContext.createFromModule(uiCls) as UIController;
        const resArr = ui.getRes() || [];
        if (typeof ui.prefab == "string") {
            resArr.push(ui.prefab as never);
        }

        const fnLoadAndCreateFromBundle = (bundle: AssetManager.Bundle) => {
            bundle.load(resArr, (err, data) => {
                if (err) {
                    egf.Logger.log(err);
                }
                let node: Node | null = null;
                let prefab: Prefab = ui.prefab as Prefab;
                if (typeof ui.prefab == "string") {
                    prefab = bundle.get(ui.prefab) as Prefab;
                }
                if (prefab) {
                    node = instantiate(prefab);
                } else {
                    //special for empty ui
                    node = this.createFullScreenNode();
                }
                const parent = UIMgr.getLayerNode(ui.layer);
                parent.addChild(node);
                ui.setup(node, params);
                if (cb) {
                    cb.apply(thisArg, [ui]);
                }
            });
            return ui;
        };

        bundleName = bundleName || "resources";
        let bundle = assetManager.getBundle(bundleName);
        return fnLoadAndCreateFromBundle(bundle!);
    }

    // Go thought the 2-level ui: if it does not contain the target node, hide it
    // if it does, hide the siblings
    // and have a function to restore the previous state
    public toggleExclusiveUI(target: Node | any | any[]): () => void {
        if (!this._uiRoot?.isValid) {
            return () => void 0;
        }

        // Resolve inputs to nodes.
        const targetNodes: Node[] = [];

        if (target instanceof Node) {
            targetNodes.push(target);
        } else if (Array.isArray(target)) {
            for (const uiCls of target) {
                const controller = this.getUI(uiCls);
                if (controller?.node?.isValid) {
                    targetNodes.push(controller.node);
                }
            }
        } else {
            const controller = this.getUI(target);
            if (controller?.node?.isValid) {
                targetNodes.push(controller.node);
            }
        }

        if (!targetNodes.length) {
            return () => void 0;
        }

        const uiRoot = this._uiRoot;
        const prevStates: Map<Node, boolean> = new Map();

        uiRoot.children.forEach((layer) => {
            // If this layer contains any of the target nodes, keep the layer visible and
            // hide its other siblings.
            const layerHasTarget = targetNodes.some((n) => n === layer || n.isChildOf(layer));
            if (layerHasTarget) {
                prevStates.set(layer, layer.active);
                layer.active = true;

                layer.children.forEach((child) => {
                    if (!targetNodes.includes(child)) {
                        prevStates.set(child, child.active);
                        child.active = false;
                    }
                });
            } else {
                prevStates.set(layer, layer.active);
                layer.active = false;
            }
        });

        // Return a function to restore previous states
        return () => {
            prevStates.forEach((active, node) => {
                node.active = active;
            });
        };
    }

    public hideLayerLowerUI(layer: number) {
        for (let i = 0; i < layer; ++i) {
            this._uiRoot!.children[i].active = false;
        }
    }

    public showLayerLowerUI(layer: number) {
        for (let i = 0; i < layer; ++i) {
            this._uiRoot!.children[i].active = true;
        }
    }

    public getLayerLowerUI(layer: number): UIController[] {
        let allControllers = (UIController as any)._controllers;
        let uiList: UIController[] = [];
        allControllers.forEach((v: any) => {
            let c = v.data as UIController;

            if (c.layer < layer) {
                uiList.push(c);
            }
        });
        return uiList;
    }

    public getUICanvas(): Node {
        return this._uiCanvas!;
    }
}

export const UIMgr = UIManager.inst;
