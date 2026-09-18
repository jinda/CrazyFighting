import { Layout_Fighter } from "./Layout_Fighter";

export class UI_Fighter extends egf.UIController {
    constructor() {
        super("ui_fighter/UI_Fighter", egf.UILayers.GAME, Layout_Fighter);
    }

    protected onCreated(params?: any): void {
        let layout = this.layout as Layout_Fighter;
        this.onButtonEvent(layout.btnClose, () => {
            this.close();
        });
    }
}
