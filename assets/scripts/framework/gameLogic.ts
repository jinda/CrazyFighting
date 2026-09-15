import { _decorator, CameraComponent, Vec3, SpriteFrame, SpriteComponent } from "cc";
import { PlayerData } from "./playerData";
import Constants from "./constants";
import { ClientEvent } from "./clientEvent";
const { ccclass, property } = _decorator;
//游戏逻辑脚本
@ccclass("GameLogic")
export class GameLogic {
    public static mainCamera: CameraComponent = null!;//相机组件
    public static isDebugMode: boolean = false;//是否是调试模式
    public static onlineInterval: number = -1;//离线定时器
    public static isEnableVibrate: boolean = true;//是否开启震动

    /**
     * 更新离线奖励
     */
    public static startOnlineReward () {
        this.onlineInterval = setInterval(()=>{
            PlayerData.instance.updateOnlineReward(1000);
            ClientEvent.dispatchEvent(Constants.EVENT_NAME.UPDATE_ONLINE_REWARD);
        }, 1000);
    }

    /**
     * 增加金币
     * @param gold 
     */
    public static addGold (gold: number) {
        PlayerData.instance.updatePlayerInfo('gold', gold);
        ClientEvent.dispatchEvent(Constants.EVENT_NAME.UPDATE_GOLD);
    }

    /**
     * 根据人数获取士兵位置
     * @param posCell 
     * @param num 
     * @returns 
     */
    public static getFighterPosByNum (posCell: Vec3, num: number) {
        switch (num) {
            case 1: //1个人
                return [posCell];
            case 2: //2个人
                let left = posCell.clone();
                left.z -= Constants.CELL_FIGHTER_SPACING;
                posCell.z += Constants.CELL_FIGHTER_SPACING;

                return [left, posCell];
            case 4:
                let lt = new Vec3(posCell.x - Constants.CELL_FIGHTER_SPACING, posCell.y, posCell.z - Constants.CELL_FIGHTER_SPACING);
                let rt = new Vec3(posCell.x + Constants.CELL_FIGHTER_SPACING, posCell.y, posCell.z - Constants.CELL_FIGHTER_SPACING);
                let lb = new Vec3(posCell.x - Constants.CELL_FIGHTER_SPACING, posCell.y, posCell.z + Constants.CELL_FIGHTER_SPACING);
                let rb = new Vec3(posCell.x + Constants.CELL_FIGHTER_SPACING, posCell.y, posCell.z + Constants.CELL_FIGHTER_SPACING);
                return [lt, rt, lb, rb];
            default:
                return [posCell];
        }
    }

    /**
     * 震动
     */
    public static vibrateShort () {
        if (GameLogic.isEnableVibrate) {
            //@ts-ignore
            if (window.wx) {
                //@ts-ignore
                window.wx.vibrateShort();
            }
        }
    }
}
