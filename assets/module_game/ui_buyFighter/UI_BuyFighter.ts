import { Layout_BuyFighter } from "./Layout_BuyFighter";
import { game, sys } from "cc";
import { PlatformMgr } from "../../scripts/SDK/PlatformMgr";

export class UI_BuyFighter extends egf.UIController {
    private _params = { bOnline: false, coin: 0, bDailyGift: false };
    constructor() {
        super("ui_buyFighter/UI_BuyFighter", egf.UILayers.POPUP, Layout_BuyFighter);
    }

    //子类的所有操作，需要在这个函数之后。
    protected onCreated(params?: any) {
        let layout = this.layout as Layout_BuyFighter;
        this._params = params || this._params;
        egf.Logger.log("UI_Award onCreated", this._params);

        this.onButtonEvent(layout.btnBack, this.clickBack, this);
        this.onButtonEvent(layout.btnGet, this.clickGet, this);
        this.onButtonEvent(layout.btnDoubleGet, this.clickDoubleGet, this);

        layout.showInfo();
    }

    protected onDispose(): void {}

    clickBack() {
        egf.AudioMgr.playOneShot("tap");
        this.close();
    }

    clickGet() {
        egf.AudioMgr.playOneShot("tap");
    }
    clickDoubleGet() {
        egf.AudioMgr.playOneShot("tap");

        PlatformMgr.showRewardedVideo(undefined, (ret: boolean) => {
            game.resume();
            if (ret) {
                this.close();
            } else {
                egf.UIAlert.show(egf.i18nMgr.getText("哎呀，广告还没有完成，错失奖励机会！"));
            }
        });
    }
}
