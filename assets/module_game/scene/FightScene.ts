import { _decorator, Component } from "cc";
import { UI_HUD } from "../../scripts/UIDef";
import { GameMgr } from "../game/scripts/GameMgr";
const { ccclass, property } = _decorator;

@ccclass("FightScene")
export class FightScene extends Component {
    start() {
        egf.Logger.log("game enter");
        // egf.UIMgr.inst.showUI(ArrowController);
        egf.UIMgr.showUI(UI_HUD, null, this, {
            bHelp: false,
            bGameing: GameMgr.isGameStart,
        });
    }

    protected onDisable(): void {
        egf.AudioMgr.stop();
    }
}
