import { DataMgr } from "../../scripts/DataMgr";
import { UI_Menu } from "../ui_menu/UI_Menu";
import { Layout_Settlement } from "./Layout_Settlement";

export class UI_Settlement extends egf.UIController {
    constructor() {
        super("ui_settlement/UI_Settlement", egf.UILayers.POPUP, Layout_Settlement);
    }

    protected onCreated(params?: any): void {
        let layout = this.layout as Layout_Settlement;
        this.onButtonEvent(layout.btnBack, this.clickBack, this);
        this.onButtonEvent(layout.btnNext, this.clickNext, this);
        this.onButtonEvent(layout.btnRetry, this.clickRetry, this);
        const coin = params.coin;
        const bWin = params.bWin;
        layout.showInfo(bWin, DataMgr.level, coin);
    }

    private clickBack() {
        egf.AudioMgr.playOneShot("tap");
        this.close();
        egf.UIMgr.showUI(UI_Menu);
    }
    private clickNext() {
        egf.AudioMgr.playOneShot("tap");
        this.close();
        egf.UIMgr.showUI(UI_Menu, null, this, { bStartGame: true });
    }
    private clickRetry() {
        egf.AudioMgr.playOneShot("tap");
        this.close();
        egf.UIMgr.showUI(UI_Menu, null, this, { bStartGame: true });
    }
}
