import { Button, Node, Tween, tween, v3 } from "cc";
import { LocalDataMgr } from "../../scripts/LocalDataMgr";
import { Layout_Guide } from "./Layout_Guide";
import { Constants } from "../../scripts/Constants";
import { GameMgr } from "../game/scripts/GameMgr";
import { UI_BuyFighter } from "../ui_buyFighter/UI_BuyFighter";

const ShowSaveStep: number[] = [];

export class UI_Guide extends egf.UIController {
    private _nodeBtn: Node = null!;

    public static showGuideStep(step: number, params: any, delay: number = 0.1, bSame: boolean = false): boolean {
        const guideStep = LocalDataMgr.GameInfo.guideStep || 0;
        console.log("guide step:", step, guideStep);
        if (guideStep == step - 1 || (bSame && guideStep == step)) {
            egf.UIWaiting.show(" ");
            LocalDataMgr.GameInfo.guideStep = step;
            setTimeout(() => {
                egf.UIMgr.showUI(UI_Guide, null, this, params);
            }, delay);

            if (ShowSaveStep.includes(step)) {
                LocalDataMgr.saveGameInfoData();
            }
            return true;
        }
        return false;
    }

    constructor() {
        super("ui_guide/UI_Guide", egf.UILayers.OVERLAY, Layout_Guide);
    }

    public getRes(): [] {
        return [];
    }

    //子类的所有操作，需要在这个函数之后。
    protected onCreated(params?: any) {
        egf.UIWaiting.hide();
        const layout = this.layout as Layout_Guide;
        this._nodeBtn = params.nodeBtn;
        const worldPos = params.worldPos;
        const content = params.content;

        layout.btnBlackBg.node.active = params.bShowBlackBg == undefined ? true : params.bShowBlackBg;
        layout.nodeContent.active = false;
        this.offButtonEvent(layout.btnBlackBg, this.clickBtn, this);
        if (this._nodeBtn) {
            layout.spriteHand.node.active = true;
            const nodeBtn = layout.showGuideBtn(this._nodeBtn);
            if (nodeBtn) {
                const btn = nodeBtn.getComponent(Button);
                if (btn) {
                    btn.interactable = true;
                    btn.clickEvents = [];
                    nodeBtn.off("click");
                }
                this.onButtonEvent(nodeBtn, this.clickBtn, this);
                this.onButtonEvent(layout.btnBlackBg, this.clickBtn, this);
            }
        } else {
            layout.showHand(worldPos);
        }
        if (content) {
            layout.nodeContent.active = true;
            layout.showGuideContent(worldPos, content);
            this.onButtonEvent(layout.btnBlackBg, this.clickBtn, this);
        }
        if (LocalDataMgr.GameInfo.guideStep === Constants.GUIDE_STEP.COMBINE_ONE) {
            layout.spriteHand.node.active = true;
            const pos = GameMgr.getFighterUIPos(this.node, 0);
            Tween.stopAllByTarget(layout.spriteHand.node);
            tween(layout.spriteHand.node)
                .to(1, {
                    position: v3(pos.x + 100, pos.y, pos.z),
                })
                .to(0, {
                    position: v3(pos.x, pos.y, pos.z),
                })
                .union()
                .repeatForever()
                .start();
        }
    }

    protected onDispose(): void {}

    clickBtn() {
        console.log("clickBtn:", LocalDataMgr.GameInfo.guideStep);
        LocalDataMgr.saveGameInfoData();
        this.close();

        // 战斗引导
        switch (LocalDataMgr.GameInfo.guideStep) {
            case Constants.GUIDE_STEP.START:
                egf.EventMgr.emit(Constants.EVENT_NAME.CLICK_START);
                break;
            case Constants.GUIDE_STEP.BUY_CELL:
                egf.EventMgr.emit(Constants.EVENT_NAME.CLICK_BUY_CELL);
                break;
            case Constants.GUIDE_STEP.SHOW_FIGHTER:
                egf.UIMgr.showUI(UI_BuyFighter);
                break;
            case Constants.GUIDE_STEP.BUY_FIGHTER:
                egf.EventMgr.emit(Constants.EVENT_NAME.CLICK_BUY_FIGHTER);

                break;
            case Constants.GUIDE_STEP.USE_SKILL:
                egf.EventMgr.emit(Constants.EVENT_NAME.CLICK_USE_SKILL);
                break;
        }
    }
}
