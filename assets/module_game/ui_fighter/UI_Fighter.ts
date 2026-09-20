import { Vec3 } from "cc";
import { Constants } from "../../scripts/Constants";
import { Layout_Fighter } from "./Layout_Fighter";
import { FighterManager } from "../game/scripts/FighterManager";
import { UI_Setting } from "../../scripts/UIDef";
import { DataMgr } from "../../scripts/DataMgr";
import { GameMgr } from "../game/scripts/GameMgr";

export class UI_Fighter extends egf.UIController {
    private _gold: number = 0; //金币数量
    private _factor: number = 1; //系数：每个士兵掉落金币乘以本关加成系数
    private _manager: FighterManager = null!; //“管理所有士兵”的脚本

    constructor() {
        super("ui_fighter/UI_Fighter", egf.UILayers.GAME, Layout_Fighter);
    }

    protected onCreated(params?: any): void {
        let layout = this.layout as Layout_Fighter;
        this.onButtonEvent(layout.btnSkill, this.clickSkill, this);

        egf.EventMgr.on(Constants.EVENT_NAME.DROP_COIN, this.onDropCoin, this);
        egf.EventMgr.on(Constants.EVENT_NAME.GAME_OVER, this.onGameOver, this);

        layout.showInfo();
        let myCount = this._manager.getFighterFight(true);
        let enemyCount = this._manager.getFighterFight(false);
        layout.updateFighterNum(myCount, enemyCount);
    }

    protected onDispose(): void {
        egf.EventMgr.off(Constants.EVENT_NAME.DROP_COIN, this.onDropCoin, this);
        egf.EventMgr.off(Constants.EVENT_NAME.GAME_OVER, this.onGameOver, this);
    }

    private clickSkill() {
        const layout = this.layout as Layout_Fighter;
        layout.showSkillStatus(true);
    }

    /**
     * 在士兵头上展示金币
     * @param coin
     * @param posWorld
     */
    private onDropCoin(coin: number, posWorld: Vec3) {
        //策划需求，每个士兵掉落金币乘以本关加成系数
        coin = this._factor * coin;
        const layout = this.layout as Layout_Fighter;

        if (coin > 0) {
            //1. 展示获得金币提示
            let uiPos = new Vec3();
            GameMgr.mainCamera.convertToUINode(posWorld, this.node, uiPos);
            layout.nodeCoin.position = uiPos;
            egf.TweenUtils.goldFlyAction(layout.nodeCoin, layout.labelCoin.node.worldPosition, coin);

            //2. 更新获得金币数
            this._gold += coin;
            layout.updateCoin(this._gold);
        }

        //3.更新UI上的敌我双方人数和进度条
        let myCount = this._manager.getFighterFight(true);
        let enemyCount = this._manager.getFighterFight(false);
        layout.updateFighterNum(myCount, enemyCount);
    }

    /**
     * 结束结束
     * @param isWin
     */
    private onGameOver(isWin: boolean) {
        setTimeout(() => {
            egf.UIMgr.showUI(UI_Setting, null, this, { coin: this._gold, isWin: isWin });
        }, 2000);
    }
}
