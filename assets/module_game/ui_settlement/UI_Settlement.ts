import { Layout_Settlement } from "./Layout_Settlement";

export class UI_Settlement extends egf.UIController {
    constructor() {
        super("ui_settlement/UI_Settlement", egf.UILayers.POPUP, Layout_Settlement);
    }

    protected onCreated(params?: any): void {
        let layout = this.layout as Layout_Settlement;
        this.onButtonEvent(layout.btnClose, () => {
            this.close();
        });
    }
}
