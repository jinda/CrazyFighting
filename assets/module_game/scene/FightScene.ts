import { _decorator, Component } from "cc";
import { UI_HUD } from "../../scripts/UIDef";
import { GameMgr } from "../game/scripts/GameMgr";
import { Constants } from "../../scripts/Constants";
const { ccclass } = _decorator;

@ccclass("FightScene")
export class FightScene extends Component {
    start() {
        egf.Logger.log("game enter");
        // egf.UIMgr.inst.showUI(ArrowController);
        egf.UIMgr.showUI(UI_HUD, null, this, {
            bHelp: false,
            bGameing: GameMgr.isGameStart,
        });
        egf.AudioMgr.play(Constants.AUDIO_SOUND.BACKGROUND, 0.8);
    }

    protected onDisable(): void {
        egf.AudioMgr.stop();
    }
}
