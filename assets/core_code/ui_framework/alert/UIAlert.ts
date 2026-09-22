import { UIController } from "../UIController";
import { UIMgr } from "../UIMgr";
import { _decorator, Button, Component, Label } from "cc";
const { ccclass, property } = _decorator;

type ClickFunc = (isOK: boolean) => void;

@ccclass("Layout_UIAlert")
export class Layout_UIAlert extends Component {
    @property(Label)
    title: Label | null = null;

    @property(Label)
    contentText: Label | null = null;

    @property(Button)
    btnOK: Button | null = null;

    @property(Button)
    btnCancel: Button | null = null;
}

export class UIAlertOptions {
    protected _title: string = "";
    protected _contentText: string = "";
    protected _showCancel: boolean = false;
    protected _cbClick?: ClickFunc;
    protected _cbClickThisArg?: any;

    setTitle(title: string): this {
        this._title = title;
        return this;
    }

    setContentText(contentText: string): this {
        this._contentText = contentText;
        return this;
    }

    setShowCancel(showCancel: boolean): this {
        this._showCancel = showCancel;
        return this;
    }

    onClick(cb: (isOK: boolean) => void, thisArg?: any): this {
        this._cbClick = cb;
        this._cbClickThisArg = thisArg;
        return this;
    }
}

export class UIAlert extends UIController {
    protected _options: UIAlertOptions | null = null;

    public static show(contentText: string, showCancel: boolean = false): UIAlertOptions {
        const opts = new UIAlertOptions().setContentText(contentText).setShowCancel(showCancel);
        UIMgr.showUI(this, (uiInstance: UIAlert | any) => {
            uiInstance.init(opts);
        });
        return opts;
    }

    protected getLayout(): Layout_UIAlert {
        return this.layout as Layout_UIAlert;
    }

    protected init<T extends UIAlertOptions>(opts: T): void {
        this._options = opts;
        this.applyOptions(this._options);
    }

    protected applyOptions<T extends UIAlertOptions>(options: T): void {
        const { _title, _contentText, _showCancel } = options as any;
        const layout = this.getLayout();
        layout.title!.string = _title;
        layout.contentText!.string = _contentText;
        layout.btnCancel!.node.active = _showCancel;

        if (!_showCancel) {
            const pos = layout.btnOK!.node.position;
            layout.btnOK!.node.setPosition(0, pos.y, pos.z);
        }
    }

    protected onCreated(params?: any): void {
        this.setupButtonEvents();
    }

    protected setupButtonEvents(): void {
        const layout = this.getLayout();
        const handleClick = (isOK: boolean): void => {
            this.close();
            egf.AudioMgr.playOneShot("tap");
            const { _cbClick, _cbClickThisArg } = this._options as any;
            _cbClick?.call(_cbClickThisArg, isOK);
        };

        this.onButtonEvent(layout.btnOK!, () => handleClick(true));
        this.onButtonEvent(layout.btnCancel!, () => handleClick(false));
    }
}
