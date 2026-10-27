import { v3 } from "cc";
import { Constants } from "../../scripts/Constants";
import { DataMgr } from "../../scripts/DataMgr";
import { LocalDataMgr } from "../../scripts/LocalDataMgr";
import { GameCfg } from "../game/scripts/GameConfig";
import { UI_Menu } from "../ui_menu/UI_Menu";
import { Layout_Settlement } from "./Layout_Settlement";
import { EPlatform, PlatformMgr } from "../../scripts/SDK/PlatformMgr";

export class UI_Settlement extends egf.UIController {
    private _bWin: boolean = false;
    constructor() {
        super("ui_settlement/UI_Settlement", egf.UILayers.POPUP, Layout_Settlement);
    }

    protected onCreated(params?: any): void {
        let layout = this.layout as Layout_Settlement;
        this.onButtonEvent(layout.btnBack, this.clickBack, this);
        this.onButtonEvent(layout.btnNext, this.clickNext, this);
        this.onButtonEvent(layout.btnRetry, this.clickRetry, this);
        this.onButtonEvent(layout.btnShare, this.clickShare, this);
        layout.btnShare.node.active = PlatformMgr.platform == EPlatform.WeChat;

        let coin = params.coin;
        this._bWin = params.bWin;
        const settledLevel = DataMgr.level;

        if (this._bWin) {
            let levelInfo = GameCfg.queryByID("level", settledLevel.toString());
            let winCoin = 0;
            if (levelInfo && levelInfo.gold) {
                winCoin += levelInfo.gold;
            }
            coin += winCoin;
            this.checkUnlock();
            const scoreData = {
                key: Constants.LeaderboardMode,
                score: settledLevel,
            };
            PlatformMgr.setUserCloudStorage(scoreData);
            DataMgr.nextLevel();
        }
        const addCoin = Math.floor(coin * LocalDataMgr.getCoinRate());
        const totalCoin = coin + addCoin;
        layout.showInfo(this._bWin, settledLevel, coin, addCoin);
        egf.EventMgr.emit("add_coin_fly", { coin: totalCoin });
        DataMgr.addCoin(totalCoin, this._bWin ? Constants.LEDGER_SCENE.LEVEL_WIN : Constants.LEDGER_SCENE.LEVEL_LOSE);
    }

    private clickBack() {
        egf.AudioMgr.playOneShot("tap");
        this.close();
        egf.EventMgr.emit(Constants.EVENT_NAME.FIGHT_RESET);
        egf.UIMgr.showUI(UI_Menu);
    }
    private clickNext() {
        egf.AudioMgr.playOneShot("tap");
        this.close();
        egf.EventMgr.emit(Constants.EVENT_NAME.FIGHT_RESET);
        egf.UIMgr.showUI(UI_Menu, null, this, { bStartGame: true });
    }
    private clickRetry() {
        egf.AudioMgr.playOneShot("tap");
        this.close();
        egf.EventMgr.emit(Constants.EVENT_NAME.FIGHT_RESET);
        egf.UIMgr.showUI(UI_Menu, null, this, { bStartGame: true });
    }

    private clickShare() {
        egf.AudioMgr.playOneShot("tap");
        const params = {
            content: egf.i18nMgr.getText(
                this._bWin ? "我通关了，快来试试这款游戏吧！" : "差一点就过关了，快来帮帮我！",
            ),
            channel: "invite",
        };
        PlatformMgr.share(params);
    }

    checkUnlock() {
        //先判定当前是否有解锁的士兵
        let levelInfo = GameCfg.queryByID("level", DataMgr.level.toString());
        //通关最后一关后（配置表没有对应行）不再有可解锁士兵，直接返回
        if (!levelInfo) {
            return;
        }
        let unlock = levelInfo["unlock"];
        let layout = this.layout as Layout_Settlement;
        layout.nodeUnlock.active = unlock ? true : false;
        layout.nodeWin.position = unlock ? v3(0, 440, 0) : v3(0, 264, 0);

        if (unlock) {
            //有待解锁的士兵
            if (LocalDataMgr.GameInfo.unlock.indexOf(unlock) === -1) {
                LocalDataMgr.GameInfo.unlock.push(unlock);

                DataMgr.bSyncCloudData = true;

                DataMgr.waitingBuy = unlock;
                const fighter = GameCfg.queryByID("fighter", unlock.toString());

                layout.showUnlockHero(fighter["model"], fighter["name"]);
            }
        }
    }
}
