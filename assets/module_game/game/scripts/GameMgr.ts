/**
 * 网络数据管理器
 */

import { Camera, Vec3, Node, geometry, screen, PhysicsSystem } from "cc";
import { Constants } from "db://assets/scripts/Constants";
import { GameCfg } from "./GameConfig";
import { DataMgr } from "db://assets/scripts/DataMgr";
import { LocalDataMgr } from "db://assets/scripts/LocalDataMgr";
import { Fighter } from "./Fighter";
import { EffectGroup } from "./EeffectGroup";

class GameManager {
    private static _inst: GameManager | null = null;
    public static get inst(): GameManager {
        if (this._inst == null) {
            this._inst = new GameManager();
        }
        return this._inst;
    }
    public mainCamera: Camera = null!; //相机组件
    public isGameStart: boolean = false; //游戏是否开始
    public isGameOver: boolean = false; //游戏是否结束
    public isGamePause: boolean = false; //游戏是否暂停
    public dictFighter: any = {}; //存放敌我士兵的字典
    public effectGroup: EffectGroup = null!; //特效管理的脚本
    public world: any = null; //物理世界对象
    private _identity: number = 1; //士兵唯一标识

    /**
     * 初始化物理世界
     */
    public initWorld() {
        if (this.world) {
            return;
        }
        //@ts-ignore 设置重力
        const gravity = box2d.b2Vec2.ZERO;
        //@ts-ignore 物理世界
        const world = new box2d.b2World(gravity);

        this.world = world;
    }
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

    /**
     * 获取距离士兵最近的对方士兵
     * @param who
     * @returns
     */
    public getNearestEnemy(who: Fighter) {
        let minDistance = 999999;
        let enemy: Node = null!;
        let posWho = who.node.position;

        for (let team in this.dictFighter) {
            if (who.team === Number(team)) {
                continue;
            }

            let objFighters = this.dictFighter[team];
            for (let fPos in objFighters) {
                let fighter = objFighters[fPos];

                let pos = fighter.position.clone();
                let offset = pos.subtract(posWho);
                if (Math.abs(offset.x) < minDistance || Math.abs(offset.y) < minDistance) {
                    let dis = offset.length();

                    if (dis < minDistance) {
                        minDistance = dis;
                        enemy = fighter;

                        //@ts-ignore,自定义属性，敌人距离自己的最短距离
                        enemy["tmpMinDis"] = minDistance;
                    }
                }
            }
        }

        return enemy;
    }

    reset() {
        egf.Logger.log("GameMgr reset");
        this.isGameStart = false;
        this.isGamePause = false;
        this.isGameOver = false;
        this._identity = 1;

        //重置敌我双方士兵状态
        for (const team in this.dictFighter) {
            const dictFighter = this.dictFighter[team];

            for (const pos in dictFighter) {
                const ndFighter = dictFighter[pos] as Node;
                const scriptFighter = ndFighter.getComponent(Fighter)!;
                scriptFighter.resetFighterState();
            }
        }
        this.dictFighter = {};
    }

    /**
     * 检查游戏是否胜利
     * @param team
     * @returns
     */
    public checkWin(team: number) {
        if (this.isGameOver) {
            return;
        }

        let isWin = false;
        const enemyTeam = team === Constants.PLAYER_TEAM ? Constants.ENEMY_TEAM : Constants.PLAYER_TEAM;
        egf.Logger.log("checkWin:", this.isGameOver, this.dictFighter);
        if (Object.keys(this.dictFighter[enemyTeam]).length <= 0) {
            this.isGameOver = true;

            const objFighters = this.dictFighter[team];
            for (const pos in objFighters) {
                const node = objFighters[pos];

                //胜利方的士兵播放胜利动画
                node.getComponent(Fighter).showWin();
            }

            //判断胜利方是否是我方士兵
            isWin = team === Constants.PLAYER_TEAM;

            if (isWin) {
                const outRay = new geometry.Ray();
                const size = screen.windowSize;

                //如果胜利，则利用射线检测，在屏幕中央的地板位置播放胜利特效
                GameMgr.mainCamera.screenPointToRay(size.width / 2, size.height / 2, outRay);
                PhysicsSystem.instance.raycastClosest(outRay, Constants.COLLIDER_GROUP.PLANE, 50, false);
                const hitPoint = PhysicsSystem.instance.raycastClosestResult.hitPoint;

                this.effectGroup.playWinEffect(hitPoint, () => {});
            }
            egf.EventMgr.emit(Constants.EVENT_NAME.GAME_OVER, isWin);
        }
    }
    /**
     * 监听双方士兵阵亡, 以显示金币和刷新UI数据
     * @param who
     */
    public onSomeoneDead(who: Fighter) {
        const team = who.team;

        //先删除，避免进入人数统计
        delete this.dictFighter[team][who.identity];

        if (team !== 1) {
            const coin = who.fighterInfo["coin"];
            if (coin > 0) {
                //展示金币提示
                egf.EventMgr.emit(Constants.EVENT_NAME.DROP_COIN, coin, who.node.worldPosition.clone());
            }
        } else {
            //己方士兵死亡要触发刷新UI人数和进度条
            egf.EventMgr.emit(Constants.EVENT_NAME.DROP_COIN, -1, who.node.worldPosition.clone());
        }
    }

    /**
     * 获取被击中的对方士兵和它附近的同组士兵
     * @param team 本方队伍（1为玩家队伍）
     * @param posWorld 被击中的敌人的世界坐标
     * @param range 范围
     * @returns
     */
    public getEnemyAroundRange(team: number, posWorld: Vec3, range: number) {
        const enemyTeam = team === 1 ? 2 : 1;
        const arrEnemy = [];

        const dictFighters = this.dictFighter[enemyTeam];
        for (const identity in dictFighters) {
            const ndFighter = dictFighters[identity] as Node;
            if (!ndFighter) {
                continue;
            }
            const fighter = ndFighter.getComponent(Fighter) as Fighter;
            if (!fighter || fighter.isDead) {
                continue;
            }
            const pos = ndFighter.position.clone();
            const offset = pos.subtract(posWorld);
            if (offset.x <= range && offset.z <= range) {
                //判定距离是否在一定范围内
                if (offset.x * offset.x + offset.z * offset.z <= range * range) {
                    arrEnemy.push(fighter);
                }
            }
        }

        return arrEnemy;
    }

    /**
     * 暂停游戏
     */
    public pauseGame() {
        this.isGamePause = true;
    }

    /**
     * 恢复游戏
     */
    public resumeGame() {
        this.isGamePause = false;
    }

    /**
     * 获得战力
     * @param isSelf 是否为我方队伍
     */
    public getFighterFight(isSelf: boolean = true) {
        let fight = 0;

        for (const team in this.dictFighter) {
            if ((team === "1" && isSelf) || (team !== "1" && !isSelf)) {
                const tmp = this.dictFighter[team];
                for (const identity in tmp) {
                    fight += tmp[identity].fight;
                }
            }
        }

        return fight;
    }

    /**
     *  增加士兵：生成士兵节点并初始化数据
     * @param {number} team 队伍
     * @param {Vec3} fighterPos
     * @param {*} fighterInfo 士兵数据
     * @param {number} pos 在第几个格子
     */
    public addFighter(ndFighter: Node, team: number, fighterPos: Vec3, fighterInfo: any, pos: number) {
        let identity = this._identity++;
        egf.Logger.log("addFighter:", this._identity, team, fighterInfo, pos);

        const scriptFighter = ndFighter.getComponent(Fighter) as Fighter;
        scriptFighter.init(identity, team, fighterInfo, fighterPos, pos);

        if (team !== Constants.PLAYER_TEAM) {
            ndFighter.active = false;
        }

        if (!this.dictFighter.hasOwnProperty(team)) {
            this.dictFighter[team] = {};
        }

        this.dictFighter[team][identity] = ndFighter;
        // @ts-ignore
        ndFighter["fight"] = fighterInfo["fight"];

        return identity;
    }

    /**
     * 回收士兵节点和刚体
     * @param identity 士兵唯一标识
     */
    public removeFighter(identity: number) {
        const ndFighter = this.dictFighter[Constants.PLAYER_TEAM][identity];

        if (ndFighter) {
            const scriptFighter = ndFighter.getComponent(Fighter) as Fighter;
            scriptFighter.recycle();
        }

        delete this.dictFighter[Constants.PLAYER_TEAM][identity];
    }
}

export const GameMgr = GameManager.inst;
