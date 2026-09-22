import { isValid, Vec3 } from "cc";
import { Constants } from "../../scripts/Constants";
import { DataMgr } from "../../scripts/DataMgr";
import { Layout_Fighter } from "./Layout_Fighter";
import { GameMgr } from "../game/scripts/GameMgr";
import { GameCfg } from "../game/scripts/GameConfig";
import { UI_Settlement } from "../ui_settlement/UI_Settlement";

export class UI_Fighter extends egf.UIController {
    private _gold: number = 0; //金币数量
    private _factor: number = 1; //系数：每个士兵掉落金币乘以本关加成系数

    constructor() {
        super("ui_fighter/UI_Fighter", egf.UILayers.GAME, Layout_Fighter);
    }

    protected onCreated(params?: any): void {
        let layout = this.layout as Layout_Fighter;
        this.onButtonEvent(layout.btnSkill, this.clickSkill, this);

        egf.EventMgr.on(Constants.EVENT_NAME.DROP_COIN, this.onDropCoin, this);
        egf.EventMgr.on(Constants.EVENT_NAME.GAME_OVER, this.onGameOver, this);

        //本局的金币加成系数
        this._updateFactor();

        layout.showInfo();
        let myCount = GameMgr.getFighterFight(true);
        let enemyCount = GameMgr.getFighterFight(false);
        layout.updateFighterNum(myCount, enemyCount);
    }

    /**
     * 读取本关的金币加成系数（配置表 level 的 coefficient 列）
     * 界面每个实例对应一局，实例创建时读取一次，不会跨关残留
     */
    private _updateFactor() {
        const levelInfo = GameCfg.queryByID("level", DataMgr.level.toString());
        //取不到配置或策划没填系数时，按1倍处理
        this._factor = levelInfo && levelInfo.coefficient ? levelInfo.coefficient : 1;
        egf.Logger.log("UI_Fighter _updateFactor:", DataMgr.level, this._factor);
    }

    protected onDispose(): void {
        egf.EventMgr.off(Constants.EVENT_NAME.DROP_COIN, this.onDropCoin, this);
        egf.EventMgr.off(Constants.EVENT_NAME.GAME_OVER, this.onGameOver, this);
    }

    private clickSkill() {
        const layout = this.layout as Layout_Fighter;
        layout.showSkillStatus(true);
        egf.EventMgr.emit(Constants.EVENT_NAME.USE_FIRE_BALL);
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
            // egf.Logger.log("onDropCoin:", layout.nodeCoin, uiPos, layout.nodeCoin);
            if (isValid(layout.nodeCoin)) {
                layout.nodeCoin.position = uiPos;
                egf.TweenUtils.goldFlyAction(layout.nodeCoin, layout.labelCoin.node.worldPosition, coin);
            }

            //2. 更新获得金币数
            this._gold += coin;
            layout.updateCoin(this._gold);
        }

        //3.更新UI上的敌我双方人数和进度条
        let myCount = GameMgr.getFighterFight(true);
        let enemyCount = GameMgr.getFighterFight(false);
        layout.updateFighterNum(myCount, enemyCount);
    }

    /**
     * 结束结束
     * @param isWin
     */
    private onGameOver(isWin: boolean) {
        egf.Logger.log("onGameOver isWin:", isWin, this._gold);
        setTimeout(() => {
            this.close();
            egf.UIMgr.showUI(UI_Settlement, null, this, { coin: this._gold, bWin: isWin });
        }, 2000);
    }
}
