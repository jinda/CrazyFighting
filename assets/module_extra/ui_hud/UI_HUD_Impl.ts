import { Layout_UI_HUD } from "./Layout_HUD";
import { UI_Award, UI_Help, UI_HUD, UI_Setting } from "../../scripts/UIDef";
import { ModuleDef } from "../../scripts/ModuleDef";
import { DataMgr } from "../../scripts/DataMgr";
import { isValid, Vec3 } from "cc";
import { Constants } from "../../scripts/Constants";

@egf_class(ModuleDef.EXTRA, UI_HUD)
export class UI_HUD_Impl extends egf.UIController {
    private _bGameing: boolean = false;
    constructor() {
        super("ui_hud/UI_HUD", egf.UILayers.POPUP1, Layout_UI_HUD);
    }

    public getRes(): [] {
        return [];
    }

    //子类的所有操作，需要在这个函数之后。
    protected onCreated(params?: any) {
        this._bGameing = params?.bGameing ?? false;
        let layout = this.layout as Layout_UI_HUD;

        this.onButtonEvent(layout.btnSetting, this.clickSetting, this);
        this.onButtonEvent(layout.btnHelp, this.clickHelp, this);
        this.onButtonEvent(layout.btnCoin, this.clickCoin, this);
        this.onButtonEvent(layout.btnStamina, this.clickStamina, this);
        layout.btnHelp.node.active = params?.bHelp ?? true;

        this.onCoinChanged();
        this.onStaminaChanged();

        egf.EventMgr.on("coin_changed", this.onCoinChanged, this);
        egf.EventMgr.on("add_coin_fly", this.showCoinFly, this);
        egf.EventMgr.on("add_stamina_fly", this.showStaminaFly, this);
        egf.EventMgr.on("update_banner", this.onUpdateBanner, this);
        egf.EventMgr.on("stamina_changed", this.onStaminaChanged, this);

        // 每秒刷新体力显示与回复倒计时
        layout.schedule(this.onStaminaChanged.bind(this), 1);

        if (DataMgr.bBannerAd) {
            layout.widgetTop.top = 150;
        } else {
            layout.widgetTop.top = 12;
        }
    }

    protected onDispose() {
        egf.EventMgr.off("coin_changed", this.onCoinChanged, this);
        egf.EventMgr.off("add_coin_fly", this.showCoinFly, this);
        egf.EventMgr.off("add_stamina_fly", this.showStaminaFly, this);
        egf.EventMgr.off("update_banner", this.onUpdateBanner, this);
        egf.EventMgr.off("stamina_changed", this.onStaminaChanged, this);
    }

    clickSetting() {
        egf.AudioMgr.playOneShot("tap");
        egf.UIMgr.showUI(UI_Setting, null, this, { bGame: this._bGameing });
    }

    clickHelp() {
        egf.AudioMgr.playOneShot("tap");
        egf.UIMgr.showUI(UI_Help);
    }

    clickCoin() {
        egf.AudioMgr.playOneShot("tap");
        egf.UIMgr.showUI(UI_Award, null, this, { bOnline: false, coin: Constants.awardCoin });
    }

    clickStamina() {
        egf.AudioMgr.playOneShot("tap");
    }

    private showCoinFly(params: any) {
        let layout = this.layout as Layout_UI_HUD;
        egf.AudioMgr.playOneShot("getCoin");
        const coin = params.coin;
        const pos = params?.pos ? params.pos : Vec3.ZERO;
        // egf.Logger.log("showCoinFly:", params, pos, layout.nodeCoin);
        if (isValid(layout.nodeCoin)) {
            layout.nodeCoin.position = pos;
            egf.TweenUtils.goldFlyAction(layout.nodeCoin, layout.btnCoin.node.worldPosition, coin, 100, null, () => {
                this.onCoinChanged();
            });
        }
    }
    private showStaminaFly(coin: number) {
        let layout = this.layout as Layout_UI_HUD;
        egf.AudioMgr.playOneShot("getCoin");
        if (isValid(layout.nodeStamina)) {
            egf.TweenUtils.goldFlyAction(layout.nodeStamina, layout.btnStamina.node.worldPosition, coin);
        }
    }

    private onCoinChanged() {
        let layout = this.layout as Layout_UI_HUD;
        layout.labelCoin.string = "" + DataMgr.coin;
    }

    private onStaminaChanged() {
        let layout = this.layout as Layout_UI_HUD;
        if (layout.labelStamina) {
            const max = 0;
            layout.labelStamina.string = `${0}/${max}`;
        }
        if (layout.labelStaminaTime) {
            layout.labelStaminaTime.string = this.formatStaminaTime();
        }
    }

    private formatStaminaTime(): string {
        const remainSec = 0;
        if (remainSec <= 0) {
            return "";
        }
        const mm = Math.floor(remainSec / 60);
        const ss = remainSec % 60;
        const pad = (n: number) => (n < 10 ? "0" + n : "" + n);
        return `${pad(mm)}:${pad(ss)}`;
    }

    private onUpdateBanner() {
        let layout = this.layout as Layout_UI_HUD;
        if (DataMgr.bBannerAd) {
            layout.widgetTop.top = 150;
        } else {
            layout.widgetTop.top = 12;
        }
    }
}
