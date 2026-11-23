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
        const layout = this.layout as Layout_Settlement;
        this.onButtonEvent(layout.btnBack, this.clickBack, this);
        this.onButtonEvent(layout.btnNext, this.clickNext, this);
        this.onButtonEvent(layout.btnRetry, this.clickRetry, this);
        this.onButtonEvent(layout.btnShare, this.clickShare, this);
        layout.btnShare.node.active = PlatformMgr.platform === EPlatform.WeChat;

        this._bWin = params.bWin;
        const settledLevel = DataMgr.level;
        const levelInfo = this._bWin ? GameCfg.queryByID("level", settledLevel.toString()) : null;
        const coin = params.coin + (levelInfo?.gold || 0);
        const addCoin = Math.floor(coin * LocalDataMgr.getCoinRate());
        const totalCoin = coin + addCoin;
        layout.showInfo(this._bWin, settledLevel, coin, addCoin);

        if (this._bWin) {
            this.checkUnlock(Number(levelInfo?.unlock));
            if (DataMgr.nextLevel()) {
                PlatformMgr.setUserCloudStorage({ key: Constants.LeaderboardMode, score: settledLevel });
            }
        }
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

    private checkUnlock(unlock: number) {
        if (!Number.isSafeInteger(unlock) || unlock <= 0 || LocalDataMgr.GameInfo.unlock.includes(unlock)) {
            return;
        }
        const fighter = GameCfg.queryByID("fighter", unlock.toString());
        if (!fighter) {
            egf.Logger.error("[UI_Settlement] 缺少解锁兵种配置:", unlock);
            return;
        }

        LocalDataMgr.GameInfo.unlock.push(unlock);
        DataMgr.bSyncCloudData = true;
        DataMgr.waitingBuy = unlock;
        const layout = this.layout as Layout_Settlement;
        layout.showUnlockHero(fighter.model, fighter.name);
    }
}
