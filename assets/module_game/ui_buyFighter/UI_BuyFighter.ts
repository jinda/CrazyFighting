import { Layout_BuyFighter } from "./Layout_BuyFighter";
import { PlatformMgr } from "../../scripts/SDK/PlatformMgr";
import { DataMgr } from "../../scripts/DataMgr";
import { LocalDataMgr } from "../../scripts/LocalDataMgr";
import { Constants } from "../../scripts/Constants";

export class UI_BuyFighter extends egf.UIController {
    private _fighterId: number = 0;
    private _price: number = 0;
    constructor() {
        super("ui_buyFighter/UI_BuyFighter", egf.UILayers.POPUP, Layout_BuyFighter);
    }

    //子类的所有操作，需要在这个函数之后。
    protected onCreated(params?: any) {
        let layout = this.layout as Layout_BuyFighter;

        this.onButtonEvent(layout.btnBack, this.clickBack, this);
        this.onButtonEvent(layout.btnGet, this.clickGet, this);
        this.onButtonEvent(layout.btnDoubleGet, this.clickDoubleGet, this);

        this._fighterId = this.getRandomBuyFighter();
        this._price = LocalDataMgr.getBuyFighterPrice();
        layout.showInfo(this._fighterId, this._price);
    }

    protected onDispose(): void {}

    clickBack() {
        egf.AudioMgr.playOneShot("tap");
        DataMgr.waitingBuy = this._fighterId;
        this.close();
    }

    clickGet() {
        egf.AudioMgr.playOneShot("tap");
        let pos = LocalDataMgr.getEmptyPos();
        if (pos === -1) {
            //没有空位，不可购买
            egf.UI_Toast.show(egf.i18nMgr.getText("没有空位，不可购买"));
            return;
        }
        if (DataMgr.userData?.money! < this._price) {
            egf.UI_Toast.show(egf.i18nMgr.getText("金币不足，不可购买"));
            return;
        }
        DataMgr.subCoin(this._price);
        this.buySucessful();
        this.close();
    }
    clickDoubleGet() {
        egf.AudioMgr.playOneShot("tap");
        let pos = LocalDataMgr.getEmptyPos();
        if (pos === -1) {
            //没有空位，不可购买
            egf.UI_Toast.show(egf.i18nMgr.getText("没有空位，不可购买"));
            return;
        }
        PlatformMgr.showRewardedVideo(undefined, (ret: boolean) => {
            if (ret) {
                this.buySucessful();
                this.close();
            } else {
                egf.UIAlert.show(egf.i18nMgr.getText("哎呀，广告还没有完成，错失奖励机会！"));
            }
        });
    }

    buySucessful() {
        egf.AudioMgr.playOneShot(Constants.AUDIO_SOUND.BUY_FIGHTER);
        //增加购买次数
        LocalDataMgr.upgradeFighter();
        //数据修改
        let pos = LocalDataMgr.getEmptyPos();
        LocalDataMgr.addFighter(pos, this._fighterId);

        //通知刷新界面
        egf.EventMgr.emit(Constants.EVENT_NAME.BUY_FIGHTER, pos, this._fighterId);
        //顺便更新下战力
        egf.EventMgr.emit(Constants.EVENT_NAME.UPDATE_FORMATION);
    }

    /**
     * 随机获得可购买的士兵
     */
    public getRandomBuyFighter(): number {
        if (DataMgr.waitingBuy > 0) {
            //对于首次解锁，下次优先安排购买
            let ret = DataMgr.waitingBuy;
            DataMgr.waitingBuy = -1;
            return ret;
        }

        let unlock = LocalDataMgr.getUnlockFighters();

        return unlock[Math.floor(Math.random() * unlock.length)];
    }
}
