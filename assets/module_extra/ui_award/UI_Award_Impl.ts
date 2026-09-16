import { Layout_Award } from "./Layout_Award";
import { ModuleDef } from "../../scripts/ModuleDef";
import { EPlatform, PlatformMgr } from "../../scripts/SDK/PlatformMgr";
import { game, sys } from "cc";
import { DataMgr } from "../../scripts/DataMgr";
import { UI_Award, UI_CommonTips } from "../../scripts/UIDef";

@egf_class(ModuleDef.EXTRA, UI_Award)
export class UI_Award_Impl extends egf.UIController {
    private _params = { bOnline: false, coin: 0, bDailyGift: false };
    constructor() {
        super("ui_award/UI_Award", GameUILayers.ALERT, Layout_Award);
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
        egf.EventDispatcher.inst.emit("game_pause");
    }

    protected onDispose(): void {
        egf.EventDispatcher.inst.emit("game_resume");
    }

    clickBack() {
        egf.AudioMgr.inst.playOneShot("tap");
        this.close();
    }

    clickGet() {
        egf.AudioMgr.inst.playOneShot("tap");
        if (sys.getNetworkType() == sys.NetworkType.NONE) {
            const commonParam = {
                content: i18nMgr._getLabel("网络连接不可用，请连接网络后再尝试领取"),
                bCancel: true,
            };
            egf.UIMgr.inst.showUI(UI_CommonTips, null, this, commonParam);
        }
        if (this._params.bOnline) {
            DataMgr.inst.addCoin(this._params.coin);
            egf.EventDispatcher.inst.emit("add_coin_fly", this._params.coin);
            DataMgr.inst.onlineGetTime = Date.now();
            this.close();
        } else if (this._params.bDailyGift) {
            if (PlatformMgr.inst.platform == EPlatform.Android) {
                PlatformMgr.inst.showInteractiveAd((ret: boolean) => {
                    game.resume();
                    if (ret) {
                        DataMgr.inst.markDailyGiftClaimed();
                        DataMgr.inst.addCoin(this._params.coin);
                        egf.EventDispatcher.inst.emit("add_coin_fly", this._params.coin);
                        egf.EventDispatcher.inst.emit("finish_task", "daily_gift");
                        this.close();
                    } else {
                        egf.UIAlert.show(i18nMgr._getLabel("哎呀，广告还没有完成，错失奖励机会！"));
                    }
                });
            } else {
                PlatformMgr.inst.showRewardedVideo(
                    () => {
                        game.pause();
                    },
                    (ret: boolean) => {
                        game.resume();
                        if (ret) {
                            DataMgr.inst.markDailyGiftClaimed();
                            DataMgr.inst.addCoin(this._params.coin);
                            egf.EventDispatcher.inst.emit("add_coin_fly", this._params.coin);
                            egf.EventDispatcher.inst.emit("finish_task", "daily_gift");
                            this.close();
                        } else {
                            egf.UIAlert.show(i18nMgr._getLabel("哎呀，广告还没有完成，错失奖励机会！"));
                        }
                    },
                );
            }
        } else {
            PlatformMgr.inst.showRewardedVideo(
                () => {
                    game.pause();
                },
                (ret: boolean) => {
                    game.resume();
                    if (ret) {
                        DataMgr.inst.addCoin(this._params.coin);
                        egf.EventDispatcher.inst.emit("add_coin_fly", this._params.coin);
                        this.close();
                    } else {
                        egf.UIAlert.show(i18nMgr._getLabel("哎呀，广告还没有完成，错失奖励机会！"));
                    }
                },
            );
        }
    }
    clickDoubleGet() {
        egf.AudioMgr.inst.playOneShot("tap");
        if (sys.getNetworkType() == sys.NetworkType.NONE) {
            const commonParam = {
                content: i18nMgr._getLabel("网络连接不可用，请连接网络后再尝试领取"),
                bCancel: true,
            };
            egf.UIMgr.inst.showUI(UI_CommonTips, null, this, commonParam);
            return;
        }
        PlatformMgr.inst.showRewardedVideo(
            () => {
                game.pause();
            },
            (ret: boolean) => {
                game.resume();
                if (ret) {
                    DataMgr.inst.addCoin(this._params.coin * 2);
                    egf.EventDispatcher.inst.emit("add_coin_fly", this._params.coin * 2);
                    DataMgr.inst.onlineGetTime = Date.now();
                    this.close();
                } else {
                    egf.UIAlert.show(i18nMgr._getLabel("哎呀，广告还没有完成，错失奖励机会！"));
                }
            },
        );
    }
}
