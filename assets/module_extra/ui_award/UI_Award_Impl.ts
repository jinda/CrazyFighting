import { Layout_Award } from "./Layout_Award";
import { Constants } from "../../scripts/Constants";
import { ModuleDef } from "../../scripts/ModuleDef";
import { PlatformMgr } from "../../scripts/SDK/PlatformMgr";
import { DataMgr } from "../../scripts/DataMgr";
import { UI_Award, UI_CommonTips } from "../../scripts/UIDef";
import { sys } from "cc";

@egf_class(ModuleDef.EXTRA, UI_Award)
export class UI_Award_Impl extends egf.UIController {
    private _params = { bOnline: false, coin: 0, bDailyGift: false };
    constructor() {
        super("ui_award/UI_Award", egf.UILayers.ALERT, Layout_Award);
    }

    //子类的所有操作，需要在这个函数之后。
    protected onCreated(params?: any) {
        let layout = this.layout as Layout_Award;
        this._params = params || this._params;
        egf.Logger.log("UI_Award onCreated", this._params);

        this.onButtonEvent(layout.btnBack, this.clickBack, this);
        this.onButtonEvent(layout.btnGet, this.clickGet, this);
        this.onButtonEvent(layout.btnDoubleGet, this.clickDoubleGet, this);

        layout.showInfo(this._params.bOnline, this._params.coin, this._params.bDailyGift);
        //本界面打开时暂停战斗，关闭时恢复（与 onDispose 成对派发，GameMgr 内部按计数处理叠加暂停）
        egf.EventMgr.emit(Constants.EVENT_NAME.GAME_PAUSE);
    }

    protected onDispose(): void {
        egf.EventMgr.emit(Constants.EVENT_NAME.GAME_RESUME);
    }

    clickBack() {
        egf.AudioMgr.playOneShot("tap");
        this.close();
    }

    clickGet() {
        egf.AudioMgr.playOneShot("tap");
        if (sys.getNetworkType() == sys.NetworkType.NONE) {
            const commonParam = {
                content: egf.i18nMgr.getText("网络连接不可用，请连接网络后再尝试领取"),
                bCancel: true,
            };
            egf.UIMgr.showUI(UI_CommonTips, null, this, commonParam);
        }
        if (this._params.bOnline) {
            DataMgr.addCoin(this._params.coin);
            egf.EventMgr.emit("add_coin_fly", { coin: this._params.coin });
            DataMgr.onlineGetTime = Date.now();
            this.close();
        } else if (this._params.bDailyGift) {
            PlatformMgr.showRewardedVideo(undefined, (ret: boolean) => {
                if (ret) {
                    DataMgr.addCoin(this._params.coin);
                    egf.EventMgr.emit("add_coin_fly", { coin: this._params.coin });
                    egf.EventMgr.emit("finish_task", "daily_gift");
                    this.close();
                } else {
                    egf.UIAlert.show(egf.i18nMgr.getText("哎呀，广告还没有完成，错失奖励机会！"));
                }
            });
        } else {
            PlatformMgr.showRewardedVideo(undefined, (ret: boolean) => {
                if (ret) {
                    DataMgr.addCoin(this._params.coin);
                    egf.EventMgr.emit("add_coin_fly", { coin: this._params.coin });
                    this.close();
                } else {
                    egf.UIAlert.show(egf.i18nMgr.getText("哎呀，广告还没有完成，错失奖励机会！"));
                }
            });
        }
    }
    clickDoubleGet() {
        egf.AudioMgr.playOneShot("tap");
        if (sys.getNetworkType() == sys.NetworkType.NONE) {
            const commonParam = {
                content: egf.i18nMgr.getText("网络连接不可用，请连接网络后再尝试领取"),
                bCancel: true,
            };
            egf.UIMgr.showUI(UI_CommonTips, null, this, commonParam);
            return;
        }
        PlatformMgr.showRewardedVideo(undefined, (ret: boolean) => {
            if (ret) {
                DataMgr.addCoin(this._params.coin * 2);
                egf.EventMgr.emit("add_coin_fly", { coin: this._params.coin * 2 });
                DataMgr.onlineGetTime = Date.now();
                this.close();
            } else {
                egf.UIAlert.show(egf.i18nMgr.getText("哎呀，广告还没有完成，错失奖励机会！"));
            }
        });
    }
}
