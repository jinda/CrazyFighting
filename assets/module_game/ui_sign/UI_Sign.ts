import { Layout_Sign } from "./Layout_Sign";
import { ModuleDef } from "../../scripts/ModuleDef";
import { Sprite, sys } from "cc";
import { Constants } from "../../scripts/Constants";
import { DataMgr } from "../../scripts/DataMgr";
import { UI_CommonTips } from "../../scripts/UIDef";
import { LocalDataMgr } from "../../scripts/LocalDataMgr";
import { PlatformMgr } from "../../scripts/SDK/PlatformMgr";

const AWARD_LIST = [100, 200, 300, 400, 500, 600, 700, 1000];

@egf_class(ModuleDef.GAME)
export class UI_Sign extends egf.UIController {
    private _currentAward: number[] = [];
    constructor() {
        super("ui_sign/UI_Sign", egf.UILayers.POPUP2, Layout_Sign);
    }

    //子类的所有操作，需要在这个函数之后。
    protected onCreated(params?: any) {
        let layout = this.layout as Layout_Sign;
        params = params || { toolType: 0 };

        this.onButtonEvent(layout.btnBack, this.clickBack, this);
        this.onButtonEvent(layout.btnGet, this.clickGet, this);
        this.onButtonEvent(layout.btnDoubleGet, this.clickDoubleGet, this);
        AWARD_LIST.forEach((value) => {
            const addCoin = Math.floor(value * LocalDataMgr.getCoinRate());
            this._currentAward.push(value + addCoin);
        });
        layout.showInfo(this._currentAward);
        this.updateSignState();
    }

    private updateSignState() {
        let layout = this.layout as Layout_Sign;
        const signedRewardDay = LocalDataMgr.getSignedRewardDayToday();
        const currentDay = signedRewardDay || LocalDataMgr.getSignProgress();
        for (let day = 1; day <= 7; day++) {
            let status = 0;
            if (day < currentDay || (signedRewardDay > 0 && day === currentDay)) {
                status = 1;
            } else if (day === currentDay && signedRewardDay === 0) {
                status = 2;
            }
            egf.Logger.log("updateItemState:", day, status, currentDay);
            layout.updateItemState(day, status);
        }
        layout.btnGet.getComponent(Sprite)!.grayscale = LocalDataMgr.isSignToday();
        layout.btnDoubleGet.getComponent(Sprite)!.grayscale = LocalDataMgr.isSignToday();
    }

    private getReward(day: number): number {
        if (day < 1 || day > 7) {
            egf.Logger.warn("签到奖励档位非法:", day);
            return 0;
        }
        if (day === 7) {
            return egf.Utils.getRandomInt(this._currentAward[6], this._currentAward[7]);
        }
        return this._currentAward[day - 1];
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
            return;
        }
        if (LocalDataMgr.isSignToday()) {
            egf.UI_Toast.show(egf.i18nMgr.getText("今天已经签到过了！"));
            return;
        }
        const day = LocalDataMgr.doSign();
        if (day <= 0) {
            return;
        }
        const coin = this.getReward(day);
        DataMgr.addCoin(coin, Constants.LEDGER_SCENE.SIGN);
        egf.EventMgr.emit("add_coin_fly", { coin });
        this.updateSignState();
        this.close();
        PlatformMgr.reportEvent("game_sign", {
            day: day,
        });
    }

    clickDoubleGet() {
        egf.AudioMgr.playOneShot("tap");
        if (LocalDataMgr.isSignToday()) {
            egf.UI_Toast.show(egf.i18nMgr.getText("今天已经签到过了！"));
            return;
        }
        const callback = (ret: boolean) => {
            if (ret) {
                const day = LocalDataMgr.doSign();
                if (day > 0) {
                    const coin = this.getReward(day);
                    DataMgr.addCoin(coin * 2, Constants.LEDGER_SCENE.SIGN_AD_DOUBLE);
                    egf.EventMgr.emit("add_coin_fly", { coin: coin * 2 });
                    this.updateSignState();
                    this.close();
                    PlatformMgr.reportEvent("game_sign_ad", {
                        day: day,
                    });
                }
            } else {
                egf.UIAlert.show(egf.i18nMgr.getText("哎呀，广告还没有完成，错失奖励机会！"));
            }
        };
        PlatformMgr.showRewardedVideo(undefined, callback);
    }
}
