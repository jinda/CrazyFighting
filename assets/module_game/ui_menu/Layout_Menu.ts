import { _decorator, Node, Button, Component, Label, RichText, tween, v3, Vec3, Tween, Color } from "cc";
import { DataMgr } from "../../scripts/DataMgr";
import { LocalDataMgr } from "../../scripts/LocalDataMgr";
import { LevelTips } from "./LevelTips";
import { Constants } from "../../scripts/Constants";
const { ccclass, property } = _decorator;

@ccclass("Layout_Menu")
export class Layout_Menu extends Component {
    @property(Button)
    btnOnline: Button = null!;
    @property(Button)
    btnSign: Button = null!;
    @property(Button)
    btnStart: Button = null!;
    @property(Button)
    btnCoin: Button = null!;
    @property(Button)
    btnSoldier: Button = null!;
    @property(Button)
    btnLand: Button = null!;
    @property(Button)
    btnRank: Button = null!;
    @property(Button)
    btnGameCircle: Button = null!;
    @property(Label)
    labelLevel: Label = null!;
    @property(Label)
    labelMyPower: Label = null!;
    @property(Label)
    labelEnemyPower: Label = null!;
    @property(Label)
    labelCoinLv: Label = null!;
    @property(Label)
    labelCoinCost: Label = null!;
    @property(Label)
    labelSoldierLv: Label = null!;
    @property(Label)
    labelSoldierCost: Label = null!;
    @property(Label)
    labelLandLv: Label = null!;
    @property(Label)
    labelLandCost: Label = null!;
    @property(Label)
    labelOnlineCoin: Label = null!;
    @property(RichText)
    richTextTips: RichText = null!;
    @property(Node)
    nodePointer: Node = null!;
    @property(Node)
    nodeCoinCost: Node = null!;
    @property(Node)
    nodeSoldierCost: Node = null!;
    @property(Node)
    nodeLandCost: Node = null!;
    @property(Node)
    nodeCoinAd: Node = null!;
    @property(Node)
    nodeSoldierAd: Node = null!;
    @property(Node)
    nodeLandAd: Node = null!;
    @property(Node)
    nodePowerTips: Node = null!;
    @property(Label)
    labelPowerAdd: Label = null!;
    @property(LevelTips)
    levelTips: LevelTips = null!;

    private bCanOnline: boolean = false;

    public showInfo(enemyPower: number) {
        this.labelLevel.string = egf.i18nMgr.getText("第#0关", [DataMgr.level.toString()]);
        this.labelEnemyPower.string = enemyPower.toString();

        this.stopPointer();
        this.nodePointer.eulerAngles = v3(0, 0, egf.Utils.getRandomInt(-70, 70));
        tween(this.nodePointer)
            .to(0.8, { eulerAngles: v3(0, 0, -70) })
            .to(0.8, { eulerAngles: v3(0, 0, 70) })
            .union()
            .repeatForever()
            .start();
        this.unscheduleAllCallbacks();
        this.schedule(() => {
            const time = Date.now() - DataMgr.onlineGetTime;
            DataMgr.onlineCoin = Math.floor(time / 60000);
            if (DataMgr.onlineCoin > Constants.maxOnlineCoin) {
                DataMgr.onlineCoin = Constants.maxOnlineCoin;
            }
            this.labelOnlineCoin.string = DataMgr.onlineCoin.toString();
            if (DataMgr.onlineCoin > 10 && !this.bCanOnline) {
                this.bCanOnline = true;
                tween(this.btnOnline.node)
                    .to(0.5, { scale: new Vec3(1.2, 1.2, 1.2) })
                    .to(0.5, { scale: new Vec3(1, 1, 1) })
                    .union()
                    .repeatForever()
                    .start();
            }
        }, 1);
    }

    public updateMyPower(power: number) {
        this.labelMyPower.string = power.toString();
    }

    public stopPointer(): number {
        Tween.stopAllByTarget(this.nodePointer);
        return this.nodePointer.eulerAngles.z;
    }

    public updateCoinCost() {
        const coin = LocalDataMgr.getBuyCoinPrice();
        const fighter = LocalDataMgr.getBuyFighterPrice();
        const land = LocalDataMgr.getBuyCellPrice();

        this.labelCoinCost.string = "x" + coin;
        this.labelSoldierCost.string = "x" + fighter;
        this.labelLandCost.string = "x" + land;

        const bEnoughCoin = DataMgr.coin > coin;
        this.labelCoinCost.color = bEnoughCoin ? new Color().fromHEX("#FFFFFF") : new Color().fromHEX("#f23160");
        // this.nodeCoinCost.active = bEnoughCoin;
        // this.nodeCoinAd.active = !bEnoughCoin;

        const bEnoughFighter = DataMgr.coin > fighter;
        this.labelSoldierCost.color = bEnoughFighter ? new Color().fromHEX("#FFFFFF") : new Color().fromHEX("#f23160");
        // this.nodeSoldierCost.active = bEnoughFighter;
        // this.nodeSoldierAd.active = !bEnoughFighter;

        const bEnoughLand = DataMgr.coin > land;
        this.labelLandCost.color = bEnoughLand ? new Color().fromHEX("#FFFFFF") : new Color().fromHEX("#f23160");
        // this.nodeLandCost.active = bEnoughLand;
        // this.nodeLandAd.active = !bEnoughLand;

        egf.Logger.log("updateCoinCost:", DataMgr.coin, coin, fighter, land);

        this.labelCoinLv.string = "Lv." + LocalDataMgr.GameInfo.coinLv;
        this.labelSoldierLv.string = "Lv." + LocalDataMgr.GameInfo.fighterLv;
        this.labelLandLv.string = "Lv." + LocalDataMgr.GameInfo.landLv;
    }

    public showPowerTips(fighterPower: string) {
        this.nodePowerTips.active = true;
        this.labelPowerAdd.string = "+" + fighterPower;
        this.nodePowerTips.scale = v3(1, 1, 1);
        tween(this.nodePowerTips)
            .by(0.5, { position: v3(0, 50, 0) })
            .delay(0.3)
            .to(0.2, { scale: v3(0.5, 0.5, 1) })
            .call(() => {
                this.nodePowerTips.active = false;
            })
            .start();
    }
}
