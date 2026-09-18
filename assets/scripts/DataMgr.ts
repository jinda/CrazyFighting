/**
 * 网络数据管理器
 */

import { Camera, Vec3 } from "cc";
import { IUserInfo } from "./apiInterface";
import { Constants } from "./Constants";

window.onerror = function (message, source, lineno, colno, error) {
    egf.Logger.error("捕获到全局错误: ", message, source, lineno, colno, error);
    return true; // 返回true可以阻止错误冒泡
};
export interface IMaintenance {
    isUpdating?: boolean;
    content?: {
        title: string;
        text: string;
    };
    whitelist?: number[];
}

class DataManager {
    private static _inst: DataManager;
    public static get inst(): DataManager {
        if (this._inst == null) {
            this._inst = new DataManager();
        }
        return this._inst;
    }

    public maintenance: IMaintenance = {}; // 维护信息

    public userData: IUserInfo | null = null; // 用户数据
    public onlineGetTime: number = 0; // 在线奖励获取时间
    public bBannerAd: boolean = false; // 是否显示banner
    public isDebugMode: boolean = false; // 调试模式
    public mainCamera: Camera = null!; //相机组件

    /**
     * 根据人数获取士兵位置
     * @param posCell
     * @param num
     * @returns
     */
    public getFighterPosByNum(posCell: Vec3, num: number) {
        switch (num) {
            case 1: //1个人
                return [posCell];
            case 2: {
                //另外：case 内直接声明变量会触发 ESLint no-case-declarations，这里用块作用域包裹 //物理射线结果的共享对象 hitPoint，原地修改会污染后续的格子判定，因此一律操作克隆对象。 //注意：不能用 posCell 原对象做加减。调用方（fighterManager._checkNewCell）传入的可能是 //2个人
                const posClone = posCell.clone();
                const left = posCell.clone();
                left.z -= Constants.CELL_FIGHTER_SPACING;
                posClone.z += Constants.CELL_FIGHTER_SPACING;

                return [left, posClone];
            }
            case 4: {
                const lt = new Vec3(
                    posCell.x - Constants.CELL_FIGHTER_SPACING,
                    posCell.y,
                    posCell.z - Constants.CELL_FIGHTER_SPACING,
                );
                const rt = new Vec3(
                    posCell.x + Constants.CELL_FIGHTER_SPACING,
                    posCell.y,
                    posCell.z - Constants.CELL_FIGHTER_SPACING,
                );
                const lb = new Vec3(
                    posCell.x - Constants.CELL_FIGHTER_SPACING,
                    posCell.y,
                    posCell.z + Constants.CELL_FIGHTER_SPACING,
                );
                const rb = new Vec3(
                    posCell.x + Constants.CELL_FIGHTER_SPACING,
                    posCell.y,
                    posCell.z + Constants.CELL_FIGHTER_SPACING,
                );
                return [lt, rt, lb, rb];
            }
            default:
                return [posCell];
        }
    }
}

export const DataMgr = DataManager.inst;
