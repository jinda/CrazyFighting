import { UIController } from "../UIController";
import { UIMgr } from "../UIMgr";
import { Layout_UIWaiting } from "./Layout_UIWaiting";

/** 点号动画的刷新间隔（秒） */
const DOT_INTERVAL = 0.3;
/** 最多显示几个点 */
const DOT_MAX = 3;
/** 图标每秒旋转角度 */
const ICON_SPEED = 90;

export class UIWaiting extends UIController {
    private static _inst: UIWaiting | null = null;

    private _contentStr: string = "Loading";
    /** 点号动画累加器：按 dt 累加，替代 Date.now() 取模 */
    private _dotAcc: number = 0;
    private _dots: number = 0;

    public static show(contentStr?: string) {
        egf.Logger.log("waiting show");
        if (!this._inst) {
            UIMgr.showUI(UIWaiting, (ui: UIWaiting | any) => {
                this._inst = ui;
                this._inst?.setContentStr(contentStr || "Loading");
                egf.Logger.log("waiting show finish");
            });
        } else {
            this._inst.setContentStr(contentStr || "Loading");
        }
    }

    public static hide(): void {
        egf.Logger.log("waiting hide");
        if (this._inst) {
            this._inst.close();
            this._inst = null;
        } else {
            egf.Logger.log("waiting hide null");
        }
    }

    protected onCreated(): void {}

    /**
     * 设置文案。
     * 原实现每次调用都 layout.schedule(...,1)，而 show() 每次都会调本函数，
     * 于是每显示一次等待框就多一个"每秒追加一个点"的定时回调，且永不注销。
     * 现在点号动画统一由 onUpdate 的累加器驱动，零定时器。
     */
    public setContentStr(contentStr: string) {
        const layout = this.layout as Layout_UIWaiting;
        if (!layout || !layout.loadingTxt) {
            egf.Logger.error("Layout_UIWaiting not loaded:", contentStr);
            UIWaiting.hide();
            return;
        }
        this._contentStr = contentStr;
        // 语言切换时仍由 i18n 接管 key
        egf.i18nMgr.setLabelKey(layout.loadingTxt, this._contentStr);
        // 换文案时重置点号，避免上一次的 dots 残留
        this._dotAcc = 0;
        this._dots = 0;
        this.applyDots(layout);
    }

    protected onUpdate(dt: number) {
        const layout = this.layout as Layout_UIWaiting;
        if (!layout) {
            return;
        }

        if (layout.loadingIcon) {
            // eulerAngles 返回节点内部 Vec3，不分配；只改 z 保持原有基准朝向
            const euler = layout.loadingIcon.eulerAngles;
            layout.loadingIcon.setRotationFromEuler(euler.x, euler.y, (Date.now() / 1000) * ICON_SPEED);
        }

        if (layout.loadingTxt) {
            this._dotAcc += dt;
            if (this._dotAcc >= DOT_INTERVAL) {
                this._dotAcc -= DOT_INTERVAL;
                this._dots = this._dots >= DOT_MAX ? 0 : this._dots + 1;
                this.applyDots(layout);
            }
        }
    }

    private applyDots(layout: Layout_UIWaiting) {
        if (!layout.loadingTxt) {
            return;
        }
        const base = egf.i18nMgr.getText(this._contentStr);
        layout.loadingTxt.string = this._dots > 0 ? base + ".".repeat(this._dots) : base;
    }

    onDispose() {
        UIWaiting._inst = null;
    }
}
