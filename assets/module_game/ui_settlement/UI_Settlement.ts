import { Constants } from "../../scripts/Constants";
import { DataMgr } from "../../scripts/DataMgr";
import { GameCfg } from "../game/scripts/GameConfig";
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

        let coin = params.coin;
        const bWin = params.bWin;

        if (bWin) {
            let levelInfo = GameCfg.queryByID("level", DataMgr.level.toString());
            let winCoin = 0;
            if (levelInfo && levelInfo.gold) {
                winCoin += levelInfo.gold;
            }
            coin += winCoin;
            layout.showInfo(bWin, DataMgr.level, coin);
            DataMgr.nextLevel();
            //播放胜利音效
            egf.AudioMgr.playOneShot(Constants.AUDIO_SOUND.WIN);
        } else {
            layout.showInfo(bWin, DataMgr.level, coin);
            //播放失败音效
            egf.AudioMgr.playOneShot(Constants.AUDIO_SOUND.FAIL);
        }
        egf.EventMgr.emit("add_coin_fly", { coin: coin });
        DataMgr.addCoin(coin);
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
}
