import { Layout_Menu } from "./Layout_Menu";

export class UI_Menu extends egf.UIController {
    constructor() {
        super("ui_menu/UI_Menu", egf.UILayers.GAME, Layout_Menu);
    }

    protected onCreated(params?: any): void {
        let layout = this.layout as Layout_Menu;
        this.onButtonEvent(layout.btnClose, () => {
            this.close();
        });
    }
}
