import { Constants } from "../../scripts/Constants";
import { DataMgr } from "../../scripts/DataMgr";
import { LocalDataMgr } from "../../scripts/LocalDataMgr";
import { EPlatform, PlatformMgr } from "../../scripts/SDK/PlatformMgr";
import { UI_Award } from "../../scripts/UIDef";
import { GameCfg } from "../game/scripts/GameConfig";
import { GameMgr } from "../game/scripts/GameMgr";
import { UI_BuyFighter } from "../ui_buyFighter/UI_BuyFighter";
import { UI_Fighter } from "../ui_fighter/UI_Fighter";
import { UI_Guide } from "../ui_guide/UI_Guide";
import { UI_Rank } from "../ui_rank/UI_Rank";
import { UI_Sign } from "../ui_sign/UI_Sign";
import { Layout_Menu } from "./Layout_Menu";
import { EventTouch, Node, Vec2 } from "cc";

export class UI_Menu extends egf.UIController {
    constructor() {
        super("ui_menu/UI_Menu", egf.UILayers.GAME, Layout_Menu);
    }

    protected onCreated(params?: any): void {
        let layout = this.layout as Layout_Menu;
        this.onButtonEvent(layout.btnOnline, this.clickOnline, this);
        this.onButtonEvent(layout.btnSign, this.clickSign, this);
        this.onButtonEvent(layout.btnStart, this.clickStart, this);
        this.onButtonEvent(layout.btnCoin, this.clickCoin, this);
        this.onButtonEvent(layout.btnSoldier, this.clickSoldier, this);
        this.onButtonEvent(layout.btnLand, this.clickLand, this);
        this.onButtonEvent(layout.btnRank, this.clickRank, this);
        this.onButtonEvent(layout.btnGameCircle, this.clickGameCircle, this);
        this.onButtonEvent(layout.btnShare, this.clickShare, this);

        egf.EventMgr.on(Constants.EVENT_NAME.UPDATE_FORMATION, this.onUpdateFormation, this);
        egf.EventMgr.on(Constants.EVENT_NAME.UPDATE_LEVEL, this.onUpdateLevel, this);
        egf.EventMgr.on(Constants.EVENT_NAME.SHOW_LEVEL_TIPS, this.showFighterLvTips, this);
        egf.EventMgr.on(Constants.EVENT_NAME.REC_ONLINE_REWARD, this.onUpdateFormation, this);
        egf.EventMgr.on(Constants.EVENT_NAME.BUY_FIGHTER, this.onFighterPowerTips, this);
        egf.EventMgr.on(Constants.EVENT_NAME.COMBINE_SUCCEED, this.onCombineSucceed, this);
        egf.EventMgr.on(Constants.EVENT_NAME.CLICK_BUY_CELL, this.clickLand, this);
        egf.EventMgr.on(Constants.EVENT_NAME.CLICK_START, this.clickStart, this);
        egf.EventMgr.on(Constants.EVENT_NAME.SHARE_SUCCESS, this.onShareSuccess, this);

        this.node.on(Node.EventType.TOUCH_START, this.onTouchEvent, this);
        this.node.on(Node.EventType.TOUCH_MOVE, this.onTouchEvent, this);
        this.node.on(Node.EventType.TOUCH_END, this.onTouchEvent, this);
        this.node.on(Node.EventType.TOUCH_CANCEL, this.onTouchEvent, this);

        layout.btnShare.node.active = PlatformMgr.platform == EPlatform.WeChat;
        if (layout.btnShare.node.active) {
            layout.btnShare.node.active = !LocalDataMgr.GameInfo.bShare;
        }
        layout.showInfo(GameMgr.getCurLevelEnemyFight());
        layout.updateMyPower(GameMgr.getFormationFight());
        layout.updateCoinCost();

        let objNextUnlock = GameMgr.getNextUnlock();

        if (!objNextUnlock) {
            layout.richTextTips.node.active = false;
        } else {
            let unlock = objNextUnlock.unlock;

            let fighter = GameCfg.queryByID("fighter", unlock.toString());
            if (fighter) {
                layout.richTextTips.node.active = true;
                layout.richTextTips.string = `<outline color=#5C3118 size=2>${egf.i18nMgr.getText("第#0关解锁#1", [
                    objNextUnlock.level + "",
                    `<color=#00ff00>${egf.i18nMgr.getText(fighter.name)}</color>`,
                ])}</outline>`;
            }
        }

        layout.btnGameCircle.node.active = PlatformMgr.platform == EPlatform.WeChat;

        if (params?.bStartGame) {
            this.clickStart();
        } else {
            if (!LocalDataMgr.isSignToday()) {
                egf.UIMgr.showUI(UI_Sign);
            }
        }

        // LocalDataMgr.GameInfo.guideStep = Constants.GUIDE_STEP.START - 1;
        // UI_Guide.showGuideStep(Constants.GUIDE_STEP.START, {
        //     content: egf.i18nMgr.getText("你的战力已经提升，点击开始游戏吧！"),
        //     worldPos: layout.btnStart.node.worldPosition,
        //     nodeBtn: layout.btnStart.node,
        // });
        UI_Guide.showGuideStep(Constants.GUIDE_STEP.LAST_GUIDE, {
            content: egf.i18nMgr.getText("你已经学会了如何战斗，尽情游戏吧！"),
            worldPos: layout.btnStart.node.worldPosition,
        });
    }

    protected onDispose(): void {
        egf.EventMgr.off(Constants.EVENT_NAME.UPDATE_FORMATION, this.onUpdateFormation, this);
        egf.EventMgr.off(Constants.EVENT_NAME.UPDATE_LEVEL, this.onUpdateLevel, this);
        egf.EventMgr.off(Constants.EVENT_NAME.SHOW_LEVEL_TIPS, this.showFighterLvTips, this);
        egf.EventMgr.off(Constants.EVENT_NAME.REC_ONLINE_REWARD, this.onUpdateFormation, this);
        egf.EventMgr.off(Constants.EVENT_NAME.BUY_FIGHTER, this.onFighterPowerTips, this);
        egf.EventMgr.off(Constants.EVENT_NAME.COMBINE_SUCCEED, this.onCombineSucceed, this);
        egf.EventMgr.off(Constants.EVENT_NAME.CLICK_BUY_CELL, this.clickLand, this);
        egf.EventMgr.off(Constants.EVENT_NAME.CLICK_START, this.clickStart, this);
        egf.EventMgr.off(Constants.EVENT_NAME.SHARE_SUCCESS, this.onShareSuccess, this);

        this.node.off(Node.EventType.TOUCH_START, this.onTouchEvent, this);
        this.node.off(Node.EventType.TOUCH_MOVE, this.onTouchEvent, this);
        this.node.off(Node.EventType.TOUCH_END, this.onTouchEvent, this);
        this.node.off(Node.EventType.TOUCH_CANCEL, this.onTouchEvent, this);
    }

    private clickOnline() {
        egf.AudioMgr.playOneShot("tap");
        egf.UIMgr.showUI(UI_Award, null, this, { type: 1, coin: DataMgr.onlineCoin, bAD: false });
    }
    private clickSign() {
        egf.AudioMgr.playOneShot("tap");
        egf.UIMgr.showUI(UI_Sign);
    }
    private clickStart() {
        egf.AudioMgr.playOneShot("tap");
        const layout = this.layout as Layout_Menu;
        layout.btnStart.interactable = false;

        layout.scheduleOnce(() => {
            layout.btnSign.interactable = true;
        }, 2);

        const angleZ = layout.stopPointer();
        this.showStart(angleZ);
        PlatformMgr.reportEvent("game_start", {
            mode: 0,
        });
    }
    private clickCoin() {
        egf.AudioMgr.playOneShot("tap");
        const coin = LocalDataMgr.getBuyCoinPrice();
        if (DataMgr.coin > coin) {
            DataMgr.subCoin(coin, Constants.LEDGER_SCENE.UPGRADE_COIN);
            LocalDataMgr.upgradeCoin();
            const layout = this.layout as Layout_Menu;
            layout.updateCoinCost();
        } else {
            egf.UIMgr.showUI(UI_Award, null, this, { type: 0, coin: Constants.awardCoin });
        }
        PlatformMgr.reportEvent("lvup_prop", {
            prop_type: 1,
            level: LocalDataMgr.GameInfo.coinLv,
        });
    }

    private clickSoldier() {
        egf.AudioMgr.playOneShot("tap");
        egf.UIMgr.showUI(UI_BuyFighter);
    }

    private clickLand() {
        egf.AudioMgr.playOneShot("tap");
        const land = LocalDataMgr.getBuyCellPrice();
        if (DataMgr.coin > land) {
            DataMgr.subCoin(land, Constants.LEDGER_SCENE.UPGRADE_LAND);
            LocalDataMgr.upgradeLand();
            this.addCell();
            const layout = this.layout as Layout_Menu;
            layout.updateCoinCost();
            PlatformMgr.reportEvent("lvup_prop", {
                prop_type: 3,
                level: LocalDataMgr.GameInfo.landLv,
            });
        } else {
            egf.UIMgr.showUI(UI_Award, null, this, { type: 0, coin: Constants.awardCoin });
        }
    }

    private clickRank() {
        egf.AudioMgr.playOneShot("tap");
        egf.UIMgr.showUI(UI_Rank);
    }

    private clickGameCircle() {
        egf.AudioMgr.playOneShot("tap");
        PlatformMgr.showGameCircle();
    }

    private clickShare() {
        egf.AudioMgr.playOneShot("tap");
        egf.UIMgr.showUI(UI_Award, null, this, { type: 2, coin: Constants.shareCoin });
    }

    private onUpdateFormation() {
        const layout = this.layout as Layout_Menu;
        layout.updateMyPower(GameMgr.getFormationFight());

        layout.updateCoinCost();
    }
    private onUpdateLevel() {
        const layout = this.layout as Layout_Menu;
        layout.showInfo(GameMgr.getCurLevelEnemyFight());
    }
    /**
     * 展示士兵等级提示节点
     * @param isShow
     * @param pos 当前触摸点
     * @param fighterId 士兵编号
     * @param type 提示类型
     */
    private showFighterLvTips(bShow: boolean, pos: Vec2, fighterId: number, type: number) {
        const layout = this.layout as Layout_Menu;
        layout.levelTips.node.active = bShow;
        if (bShow) {
            layout.levelTips.show(pos, fighterId, type);
        }
    }
    private onFighterPowerTips(pos: number, fighterId: number) {
        let fighterInfo = GameCfg.queryByID("fighter", fighterId.toString());
        const layout = this.layout as Layout_Menu;
        layout.showPowerTips(fighterInfo.fight);

        UI_Guide.showGuideStep(Constants.GUIDE_STEP.START, {
            content: egf.i18nMgr.getText("你的战力已经提升，点击开始游戏吧！"),
            worldPos: layout.btnStart.node.worldPosition,
            nodeBtn: layout.btnStart.node,
        });
    }

    private onCombineSucceed(targetPos: number, selectPos: number) {
        const layout = this.layout as Layout_Menu;
        egf.UIMgr.closeUI(UI_Guide);
        UI_Guide.showGuideStep(Constants.GUIDE_STEP.BUY_CELL, {
            content: egf.i18nMgr.getText("购买格子后，容纳更多士兵！"),
            worldPos: layout.btnLand.node.worldPosition,
            nodeBtn: layout.btnLand.node,
        });
    }

    private onShareSuccess() {
        const layout = this.layout as Layout_Menu;
        layout.btnShare.node.active = false;
    }

    /**
     * 监听触摸点并派发出去
     * @param even
     */
    private onTouchEvent(event: EventTouch) {
        egf.EventMgr.emit(Constants.EVENT_NAME.HOME_UI_TOUCH, event.type, event.getLocation());
    }

    /**
     * 展示开始游戏前的文字提示、并计算出攻击加成
     */
    private showStart(angleZ: number) {
        let power = 1;
        let tipsStr = "";
        if (angleZ >= -5 && angleZ <= 5) {
            //暴走
            power = 1.5; //攻击力提升1.5倍
            const statusStr = egf.i18nMgr.getText("暴走！");
            tipsStr = egf.i18nMgr.getText("#0攻击力提升#1", [
                `<size=50><color=#f94d2a>${statusStr}</color></size>`,
                power * 100 + "%",
            ]);
            egf.EventMgr.emit(Constants.EVENT_NAME.SHOW_SPRINT);
            egf.AudioMgr.playOneShot(Constants.AUDIO_SOUND.RAMPAGE);
        } else if (angleZ >= -35 && angleZ <= 35) {
            //真棒
            power = 1.2; //攻击力提升1.2倍
            const statusStr = egf.i18nMgr.getText("真棒！");
            tipsStr = egf.i18nMgr.getText("#0攻击力提升#1", [
                `<size=50><color=#ffb12f>${statusStr}</color></size>`,
                power * 100 + "%",
            ]);
        } else {
            power = 1; //攻击力提升1倍
            tipsStr = egf.i18nMgr.getText("普通！");
        }
        egf.UI_Toast.show(tipsStr, 2);
        egf.Logger.log("showStart:", angleZ, power);

        const layout = this.layout as Layout_Menu;
        layout.scheduleOnce(() => {
            //开始游戏
            egf.EventMgr.emit(Constants.EVENT_NAME.FIGHT_START, power);
            egf.AudioMgr.playOneShot(Constants.AUDIO_SOUND.FIGHT_START);
            egf.UIMgr.showUI(UI_Fighter);
            this.close();
        }, 2);
    }

    /**
     * 增加格子
     */
    private addCell() {
        //添加格子
        let cellPos = LocalDataMgr.addCell();
        //通知刷新界面
        egf.EventMgr.emit(Constants.EVENT_NAME.BUY_CELL, cellPos);
        //播放购买格子音效
        egf.AudioMgr.playOneShot(Constants.AUDIO_SOUND.BUY_CELL);
        const layout = this.layout as Layout_Menu;

        layout.updateCoinCost();

        UI_Guide.showGuideStep(Constants.GUIDE_STEP.SHOW_FIGHTER, {
            content: egf.i18nMgr.getText("购买士兵，增加战力！"),
            worldPos: layout.btnSoldier.node.worldPosition,
            nodeBtn: layout.btnSoldier.node,
        });
    }
}
