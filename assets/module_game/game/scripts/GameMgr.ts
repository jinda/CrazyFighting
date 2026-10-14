/**
 * 网络数据管理器
 */

import { Camera, Vec3, Node, geometry, screen, PhysicsSystem } from "cc";
import { Constants } from "db://assets/scripts/Constants";
import { GameCfg } from "./GameConfig";
import { DataMgr } from "db://assets/scripts/DataMgr";
import { LocalDataMgr } from "db://assets/scripts/LocalDataMgr";
import { Fighter } from "./Fighter";
import type { EffectGroup } from "./EeffectGroup";

export interface BattleLifecycleParticipant {
    setBattlePaused(paused: boolean): void;
    cancelBattle?(): void;
}

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
    public dictFighter: any = {}; //存放敌我士兵的字典
    public effectGroup: EffectGroup = null!; //特效管理的脚本
    public timeScale: number = 1; //时间缩放，用于加快攻击及移动速度, 也可以理解成游戏速度

    //暂停请求计数：设置界面、奖励界面、激励视频等多个来源可能同时请求暂停，计数归零才真正恢复
    private _pauseCount: number = 0;
    private _battleGeneration: number = 0; //每次战斗重置递增，隔离上一局遗留的异步回调
    private readonly _lifecycleParticipants = new Set<BattleLifecycleParticipant>();
    private _identity: number = 1; //士兵唯一标识

    /**
     * 游戏是否暂停（只读）
     * 采用计数方式支持多个来源叠加暂停，避免其中一个来源恢复就解除了其他来源的暂停
     */
    public get isGamePause(): boolean {
        return this._pauseCount > 0;
    }

    /** 当前战斗代次，用于拒绝上一局迟到的异步回调。 */
    public get battleGeneration(): number {
        return this._battleGeneration;
    }

    /**
     * 注册仅属于战斗世界的可暂停对象。弹窗和广告 UI 不注册，因此仍可交互。
     */
    public registerBattleLifecycle(participant: BattleLifecycleParticipant) {
        this._lifecycleParticipants.add(participant);
        if (this.isGamePause) {
            participant.setBattlePaused(true);
        }
    }

    public unregisterBattleLifecycle(participant: BattleLifecycleParticipant) {
        this._lifecycleParticipants.delete(participant);
    }

    private _setBattlePaused(paused: boolean) {
        for (const participant of [...this._lifecycleParticipants]) {
            participant.setBattlePaused(paused);
        }
    }

    private _cancelPreviousBattle() {
        for (const participant of [...this._lifecycleParticipants]) {
            participant.cancelBattle?.();
        }
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
                //case 内直接声明变量会触发 ESLint no-case-declarations，这里用块作用域包裹
                //注意：不能用 posCell 原对象做加减（调用方传入的可能是共享对象），一律操作克隆对象
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
        const formation = this.getCurLevelEnemy();
        return formation ? this._getFormationFight(formation) : 0;
    }

    /**
     * 获取当前等级的敌人阵型
     * @returns
     */
    public getCurLevelEnemy(): { [key: number]: number } | null {
        const level = DataMgr.level;
        const levelInfo = GameCfg.queryByID("level", level.toString());
        if (!levelInfo || typeof levelInfo.formation !== "string" || levelInfo.formation.length === 0) {
            egf.Logger.error("[GameMgr] 关卡配置缺失或阵型无效:", level);
            return null;
        }

        const arrEnemyInfo = levelInfo.formation.split("_");

        const dictFormation: { [key: number]: number } = {};
        for (const enemy of arrEnemyInfo) {
            const enemyInfo = enemy.split("#");
            const fighterId = Number(enemyInfo[0]);
            const pos = Number(enemyInfo[1]);
            if (!Number.isSafeInteger(fighterId) || fighterId <= 0 || !Number.isSafeInteger(pos) || pos < 0) {
                egf.Logger.error("[GameMgr] 关卡阵型配置无效:", level, enemy);
                return null;
            }

            dictFormation[pos] = fighterId;
        }

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
            ID: fighterInfo.ID + 1,
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
        if (!Array.isArray(arrLevel)) {
            egf.Logger.error("[GameMgr] 关卡配置表缺失");
            return null;
        }
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
        let minDisSq = Number.MAX_VALUE;
        let enemy: Node = null!;
        const posX = who.node.position.x;
        const posZ = who.node.position.z;

        for (const team in this.dictFighter) {
            if (who.team === Number(team)) {
                continue;
            }

            const objFighters = this.dictFighter[team];
            for (const identity in objFighters) {
                const fighter = objFighters[identity] as Node;
                if (!fighter) {
                    continue;
                }

                const dx = fighter.position.x - posX;
                const dz = fighter.position.z - posZ;
                const disSq = dx * dx + dz * dz;
                if (disSq < minDisSq) {
                    minDisSq = disSq;
                    enemy = fighter;
                }
            }
        }

        if (enemy) {
            //自定义属性：敌人距离自己的最短距离（供攻击范围判定使用）
            const enemyWithDist = enemy as Node & { tmpMinDis?: number };
            enemyWithDist.tmpMinDis = Math.sqrt(minDisSq);
        }

        return enemy;
    }

    reset() {
        egf.Logger.log("GameMgr reset");
        const wasPaused = this.isGamePause;
        this._pauseCount = 0;
        this._battleGeneration++;
        this._cancelPreviousBattle();
        if (wasPaused) {
            this._setBattlePaused(false);
        }
        this.isGameStart = false;
        this.isGameOver = false;
        this.timeScale = 1;
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
        const arrEnemy: Fighter[] = [];
        const rangeSq = range * range;
        const centerX = posWorld.x;
        const centerZ = posWorld.z;

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
            const dx = ndFighter.position.x - centerX;
            const dz = ndFighter.position.z - centerZ;
            if (dx * dx + dz * dz <= rangeSq) {
                arrEnemy.push(fighter);
            }
        }

        return arrEnemy;
    }

    /**
     * 暂停游戏
     * 多个来源（设置界面、奖励界面、激励视频等）可叠加暂停
     */
    public pauseGame() {
        const shouldFreeze = this._pauseCount === 0;
        this._pauseCount++;
        if (shouldFreeze) {
            this._setBattlePaused(true);
        }
        egf.Logger.log("GameMgr pauseGame, pauseCount:", this._pauseCount);
    }

    /**
     * 恢复游戏
     * 暂停计数减到0才算真正恢复，避免多来源暂停被提前解除
     */
    public resumeGame() {
        if (this._pauseCount === 0) {
            egf.Logger.warn("GameMgr resumeGame ignored because pauseCount is already 0");
            return;
        }
        this._pauseCount = Math.max(0, this._pauseCount - 1);
        if (this._pauseCount === 0) {
            this._setBattlePaused(false);
        }
        egf.Logger.log("GameMgr resumeGame, pauseCount:", this._pauseCount);
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
        // egf.Logger.log("addFighter:", this._identity, team, fighterInfo, pos);

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
     * @param team 所属队伍，默认我方以兼容现有调用
     */
    public removeFighter(identity: number, team: number = Constants.PLAYER_TEAM) {
        const teamFighters = this.dictFighter[team];
        if (!teamFighters) {
            return;
        }
        const ndFighter = teamFighters[identity];

        if (ndFighter) {
            const scriptFighter = ndFighter.getComponent(Fighter) as Fighter;
            scriptFighter.recycle();
        }

        delete teamFighters[identity];
    }

    public getFighterUIPos(uiNode: Node, posCell: number): Vec3 {
        const teamFighters = this.dictFighter[Constants.PLAYER_TEAM];
        const ndFighter = Object.values(teamFighters)[posCell] as Node;
        if (ndFighter) {
            const worldPos = ndFighter.worldPosition.clone();
            const uiLocalPos = new Vec3();
            this.mainCamera.convertToUINode(worldPos, uiNode, uiLocalPos);
            return uiLocalPos;
        }
        return new Vec3(0, 0, 0);
    }
}

export const GameMgr = GameManager.inst;
