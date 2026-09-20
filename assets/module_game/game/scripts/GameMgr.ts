/**
 * 网络数据管理器
 */

import { Camera, Vec3 } from "cc";
import { Constants } from "db://assets/scripts/Constants";
import { GameCfg } from "./GameConfig";
import { DataMgr } from "db://assets/scripts/DataMgr";
import { LocalDataMgr } from "db://assets/scripts/LocalDataMgr";

class GameManager {
    private static _inst: GameManager;
    public static get inst(): GameManager {
        if (this._inst == null) {
            this._inst = new GameManager();
        }
        return this._inst;
    }
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
    /**
     * 获得当前阵型战力
     */
    public getFormationFight() {
        let formation = LocalDataMgr.GameInfo.formation;
        return this._getFormationFight(formation);
    }

    /**
     * 获得当前阵型战力
     * @param formation
     * @returns
     */
    private _getFormationFight(formation: any) {
        let num = 0;
        for (let pos in formation) {
            let fighterId = formation[pos];

            if (fighterId > 0) {
                let fighter = GameCfg.queryByID("fighter", fighterId);
                num += fighter["num"] * fighter["fight"];
            }
        }

        return num;
    }

    /**
     * 获得当前敌方战力
     */
    public getCurLevelEnemyFight() {
        return this._getFormationFight(this.getCurLevelEnemy());
    }

    /**
     * 获取当前等级的敌人阵型
     * @returns
     */
    public getCurLevelEnemy() {
        let levelInfo = GameCfg.queryByID("level", DataMgr.level.toString());

        let arrEnemyInfo = levelInfo["formation"].split("_");

        let dictFormation: { [key: number]: number } = {};
        arrEnemyInfo.forEach((enemy: any) => {
            let enemyInfo = enemy.split("#");
            let fighterId = enemyInfo[0];
            let pos = enemyInfo[1];

            dictFormation[pos] = fighterId;
        });

        return dictFormation;
    }
    /**
     * 获得下一等级的士兵id
     * @param fighterId
     */
    public getFighterNextId(fighterId: number): number {
        let fighterInfo = GameCfg.queryByID("fighter", fighterId.toString());

        let next = GameCfg.queryOneByCondition("fighter", {
            level: fighterInfo.level + 1,
            type: fighterInfo.type,
        });
        if (next) {
            return Number(next.ID);
        }

        return -1;
    }

    /**
     * 如果下一关有待解锁的兵种，则返回该下一关卡的等级和待解锁的兵种编号
     * @returns
     */
    public getNextUnlock() {
        let level = DataMgr.level;
        let arrLevel = GameCfg.getTableArr("level");
        for (let idx = level - 1; idx < arrLevel.length; idx++) {
            if (arrLevel[idx].unlock) {
                return { level: idx + 1, unlock: arrLevel[idx].unlock };
            }
        }

        return null;
    }
}

export const GameMgr = GameManager.inst;
