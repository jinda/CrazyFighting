import {
    _decorator,
    Component,
    Node,
    Prefab,
    Vec3,
    Vec2,
    geometry,
    PhysicsSystem,
    BoxColliderComponent,
    find,
    view,
} from "cc";
import { Follow } from "./Follow";
import { EffectGroup } from "./EeffectGroup";
import { Constants } from "db://assets/scripts/Constants";
import { DataMgr } from "db://assets/scripts/DataMgr";
import { Fighter } from "./Fighter";
import { FormationCell } from "./FormationCell";
import { LocalDataMgr } from "db://assets/scripts/LocalDataMgr";
import { GameMgr } from "./GameMgr";

const { ccclass, property } = _decorator;
//“管理所有士兵”的脚本
@ccclass("FighterManager")
export class FighterManager extends Component {
    @property(Prefab)
    public pfFighter: Prefab = null!; //士兵预制体

    @property(Prefab)
    public pfFormationCell: Prefab = null!; //单元格预制体

    @property(EffectGroup)
    public effectGroup: EffectGroup = null!; //特效管理的脚本

    @property(Follow)
    public cameraFollow: Follow = null!; //相机绑定的脚本

    @property(BoxColliderComponent)
    public planeCollider: BoxColliderComponent = null!; //地面碰撞器

    public isGameStart: boolean = false; //游戏是否开始
    public isGameOver: boolean = false; //游戏是否结束
    public isGamePause: boolean = false; //游戏是否暂停
    public dictFighter: any = {}; //存放敌我士兵的字典

    private _identity: number = 1; //士兵唯一标识
    private _world: any; //物理世界对象
    private _dictCell: any = {}; //存放我方士兵格子节点的字典
    private _aryCell: any[] = []; //存放敌我双方格子节点的数组
    private _currentSelect: number = -1; //当前选中的格子在_dictCell中的key
    private _currentMoveTarget: number = -1; //当前要移动到的目标格子在_dictCell的key
    private _arySelectFighterIdentity: number[] = []; //存放被选中的格子上的所有士兵的唯一标识的数组
    private _preTime: number = 0; //记录之前的时间
    private _curTime: number = 0; //记录当前的时间
    private _timeScale: number = 1; //时间缩放，可用于提速
    private _isInit: boolean = false; //是否已经初始化
    private _endPos: Vec3 = new Vec3(); //手势引导终点
    private _startPos: Vec3 = new Vec3(); //手势引导起点
    private _outPos: Vec3 = new Vec3(); //格子的世界坐标转化成UI坐标
    private _tempPos: Vec3 = new Vec3(); //临时变量，格子的位置
    private _ballPos: Vec3 = new Vec3(); //火球位置
    private _outRay1: any = new geometry.Ray(); //射线
    private _curTouchPos: Vec2 = new Vec2(); //touchMove触摸移动的位置

    //物理步长累加器：按固定步长推进物理世界，避免设备帧率影响物理速度
    private _physicsAccumulator: number = 0;

    onEnable() {
        egf.EventMgr.on(Constants.EVENT_NAME.FIGHT_START, this._fightStart, this);
        egf.EventMgr.on(Constants.EVENT_NAME.FIGHT_RESET, this._fightReset, this);
        egf.EventMgr.on(Constants.EVENT_NAME.GAME_INIT, this._gameInit, this);
        egf.EventMgr.on(Constants.EVENT_NAME.BUY_FIGHTER, this._buyFighter, this);
        egf.EventMgr.on(Constants.EVENT_NAME.BUY_CELL, this._buyCell, this);
        egf.EventMgr.on(Constants.EVENT_NAME.HOME_UI_TOUCH, this._homeUITouch, this);
        egf.EventMgr.on(Constants.EVENT_NAME.USE_FIRE_BALL, this._useFireBall, this);
        egf.EventMgr.on(Constants.EVENT_NAME.SHOW_SPRINT, this._showSprint, this);
        egf.EventMgr.on(Constants.EVENT_NAME.HIDE_ALL_SIMILAR, this._hideAllSimilar, this);
    }

    onDisable() {
        egf.EventMgr.off(Constants.EVENT_NAME.FIGHT_START, this._fightStart, this);
        egf.EventMgr.off(Constants.EVENT_NAME.FIGHT_RESET, this._fightReset, this);
        egf.EventMgr.off(Constants.EVENT_NAME.GAME_INIT, this._gameInit, this);
        egf.EventMgr.off(Constants.EVENT_NAME.BUY_FIGHTER, this._buyFighter, this);
        egf.EventMgr.off(Constants.EVENT_NAME.BUY_CELL, this._buyCell, this);
        egf.EventMgr.off(Constants.EVENT_NAME.HOME_UI_TOUCH, this._homeUITouch, this);
        egf.EventMgr.off(Constants.EVENT_NAME.USE_FIRE_BALL, this._useFireBall, this);
        egf.EventMgr.off(Constants.EVENT_NAME.SHOW_SPRINT, this._showSprint, this);
        egf.EventMgr.off(Constants.EVENT_NAME.HIDE_ALL_SIMILAR, this._hideAllSimilar, this);
    }

    start() {
        this.planeCollider.setGroup(Constants.COLLIDER_GROUP.PLANE);

        this._gameInit();
    }

    /**
     * 初始化游戏
     * @returns
     */
    private _gameInit() {
        if (this._isInit) {
            return;
        }

        this._isInit = true;

        this._initWorld();
        this._fightReset();

        //首次进来的话检查下是否处于新手引导第一关，直接开始
        if (DataMgr.level === 1) {
            //第一关就直接认定为新手引导关卡，直接开始游戏
            this._fightStart(1.5);
        }
    }

    /**
     * 初始化物理世界
     */
    private _initWorld() {
        //@ts-ignore 设置重力
        const gravity = box2d.b2Vec2.ZERO;

        //@ts-ignore 物理世界
        const world = new box2d.b2World(gravity);

        this._world = world;
    }

    /**
     * 重置战斗相关数据
     */
    private _fightReset() {
        this.isGameStart = false;
        this.isGamePause = false;
        this.isGameOver = false;
        this._preTime = 0;
        this._curTime = 0;
        this._timeScale = 1;
        this._physicsAccumulator = 0;

        //第1关特殊处理
        this.cameraFollow.initCamera(DataMgr.level === 1);

        //重置敌我双方士兵状态
        for (const team in this.dictFighter) {
            const dictFighter = this.dictFighter[team];

            for (const pos in dictFighter) {
                const ndFighter = dictFighter[pos] as Node;
                const scriptFighter = ndFighter.getComponent(Fighter)!;
                scriptFighter.resetFighterState();
            }
        }

        this._aryCell.forEach((node) => {
            node.getComponent(FormationCell).recycle();
        });

        this._aryCell = [];

        //先直接做释放，后续考虑复用
        this.node.destroyAllChildren();

        this.dictFighter = {};
        this._dictCell = {};

        this.initFighters();

        this._checkSimilar();
    }

    /*
     * 初始化敌我双方的士兵
     */
    public initFighters() {
        let fightData: any = {};
        if (!DataMgr.isDebugMode) {
            //获取我方士兵阵型
            let dictFormation = LocalDataMgr.GameInfo.formation;

            //我方士兵id
            let arrSelf = [];

            //敌方士兵id
            let arrEnemy = [];

            for (let idx = 0; idx < 30; idx++) {
                arrSelf[idx] = -1;
                arrEnemy[idx] = -1;
            }

            for (let pos in dictFormation) {
                arrSelf[pos] = dictFormation[pos];
            }

            //获取敌方士兵阵型
            let enemyFormation = GameMgr.getCurLevelEnemy();

            for (let pos in enemyFormation) {
                arrEnemy[pos] = enemyFormation[pos];
            }

            fightData = {
                1: arrSelf,
                2: arrEnemy,
            };
        } else {
            //调试模式下，是模拟数据
            fightData = {
                1: [
                    // 0, 302, 0, 0, 0
                    301, 302, 603, 0, 105, 0, 102, 103, 0, 101, 401, 402, 0, 403, 201, 0, 202, 203, 0, 204, 601, 602, 0,
                    303, 0,
                ],

                2: [
                    // 0, 302, 0, 0, 0
                    104, 0, 303, 302, 301, 101, 102, 103, 0, 0, 401, 0, 403, 402, 201, 203, 202, 0, 0, 204, 601, 0, 603,
                    0, 602,
                ],
            };
        }

        this.dictFighter = {};

        for (let team in fightData) {
            let arrFormation = fightData[team];

            arrFormation.forEach((fighterId: number, index: number) => {
                if (fighterId === -1) {
                    return;
                }

                this._addCell(index, Number(team), fighterId);
            });
        }
    }

    /**
     *  增加士兵：生成士兵节点并初始化数据
     * @param {number} team 队伍
     * @param {Vec3} fighterPos
     * @param {*} fighterInfo 士兵数据
     * @param {number} pos 在第几个格子
     * @returns
     * @memberof FighterManager
     */
    public addFighter(team: number, fighterPos: Vec3, fighterInfo: any, pos: number) {
        let identity = this._identity++;
        let ndFighter = egf.PoolMgr.getNode(this.pfFighter, this.node as Node);

        let scriptFighter = ndFighter.getComponent(Fighter) as Fighter;
        scriptFighter.init(identity, team, fighterInfo, fighterPos, this._world, this, pos);

        if (team !== Constants.PLAYER_TEAM) {
            ndFighter.active = false;
        }

        if (!this.dictFighter.hasOwnProperty(team)) {
            this.dictFighter[team] = {};
        }

        this.dictFighter[team][identity] = ndFighter;
        ndFighter["fight"] = fighterInfo["fight"];

        return identity;
    }

    /**
     * 回收士兵节点和刚体
     * @param identity 士兵唯一标识
     */
    public removeFighter(identity: number) {
        let ndFighter = this.dictFighter[Constants.PLAYER_TEAM][identity];

        if (ndFighter) {
            let scriptFighter = ndFighter.getComponent(Fighter) as Fighter;
            scriptFighter.recycle();
        }

        delete this.dictFighter[Constants.PLAYER_TEAM][identity];
    }

    /**
     * 开始游戏
     * @param power 玩家队伍士兵的专属加成
     */
    private _fightStart(power: number) {
        this.isGameStart = true;
        this._preTime = 0;
        this._curTime = 0;
        this._timeScale = 1;

        //展示战斗界面
        // UIManager.instance.showDialog("fight/fightUI", [this]);

        //相机跟随
        this.cameraFollow.startGame(this);

        //先移动到指定点
        let arrPos = [-3, -1.5, 0, 1.5, 3];
        let arrSelect = [];
        let arrEnemy = [];
        let idxSelect = 0;

        for (let team in this.dictFighter) {
            let dictFighter = this.dictFighter[team];
            let addition = 1;
            if (team === Constants.PLAYER_TEAM.toString()) {
                //有加成
                addition = power;
            }

            for (let pos in dictFighter) {
                let ndFighter = dictFighter[pos];
                ndFighter.active = true;
                let scriptFighter = ndFighter.getComponent(Fighter) as Fighter;

                if (team === Constants.PLAYER_TEAM.toString()) {
                    //行
                    let row = scriptFighter.cellPos % 5;

                    let idx = row;
                    switch (row) {
                        case 0:
                            idx = 1;
                            break;
                        case 4:
                            idx = 3;
                            break;
                    }

                    let arrRandom = [arrPos[idx - 1], arrPos[idx], arrPos[idx + 1]];
                    let rand = Math.floor(Math.random() * arrRandom.length);

                    //每个士兵设置第一次目标位置，然后移动到该位置
                    let posStart = new Vec3(0, 0, arrRandom[rand]);

                    //存储随机位置
                    if (arrSelect.indexOf(arrRandom[rand]) === -1) {
                        arrSelect.push(arrRandom[rand]);
                    }

                    scriptFighter.fightStart(addition, posStart);
                } else {
                    //敌方现修改为 循环点，每个点分配个人
                    arrEnemy.push(scriptFighter);
                }
            }

            //敌方循环占用点坐标
            while (arrEnemy.length > 0) {
                //循环依次去数组种取位置
                let pos = arrSelect[idxSelect];
                idxSelect++;
                idxSelect = idxSelect % arrSelect.length;

                //随机抽取一个敌人的脚本
                let rand = Math.floor(Math.random() * arrEnemy.length);
                let scriptEnemyFighter = arrEnemy.splice(rand, 1)[0];

                //设置敌人第一次移动的目标位置
                let posStart = new Vec3(0, 0, pos);
                scriptEnemyFighter.fightStart(addition, posStart);
            }
        }
    }

    /**
     * 加快时间缩放/游戏速度，士兵的动画播放速度与游戏本局游戏时常成正比
     * @param deltaTime
     */
    private _checkTimeScale(deltaTime: number) {
        if (this.isGameStart && !this.isGamePause && !this.isGameOver) {
            this._curTime += deltaTime;

            let time = Math.floor(this._curTime);
            if (time !== this._preTime) {
                this._preTime = time;

                let timeScale = 1 + Math.floor(time / 10) * 0.5;

                if (timeScale !== this._timeScale) {
                    //提速
                    this._timeScale = timeScale;

                    console.log("提速:", this._timeScale, this._preTime);

                    for (let team in this.dictFighter) {
                        let dictFighter = this.dictFighter[team];

                        for (let identity in dictFighter) {
                            let scriptFighter = dictFighter[identity].getComponent(Fighter) as Fighter;
                            scriptFighter.timeScale = this._timeScale;
                        }
                    }
                }
            }
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
        let enemyTeam = team === 1 ? 2 : 1;
        let arrEnemy = [];

        let dictFighters = this.dictFighter[enemyTeam];
        for (let identity in dictFighters) {
            let ndFighter = dictFighters[identity] as Node;
            if (!ndFighter) {
                continue;
            }
            let fighter = ndFighter.getComponent(Fighter) as Fighter;
            if (!fighter || fighter.isDead) {
                continue;
            }
            let pos = ndFighter.position.clone();
            let offset = pos.subtract(posWorld);
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

    /**
     * 监听双方士兵阵亡, 以显示金币和刷新UI数据
     * @param who
     */
    public onSomeoneDead(who: Fighter) {
        let team = who.team;

        //先删除，避免进入人数统计
        delete this.dictFighter[team][who.identity];

        if (team !== 1) {
            let coin = who.fighterInfo["coin"];
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
     * 检查游戏是否胜利
     * @param team
     * @returns
     */
    public checkWin(team: number) {
        if (this.isGameOver) {
            return;
        }

        let isWin = false;
        let enemyTeam = team === 1 ? 2 : 1;
        if (Object.keys(this.dictFighter[enemyTeam]).length <= 0) {
            this.isGameOver = true;

            let objFighters = this.dictFighter[team];
            for (let pos in objFighters) {
                let node = objFighters[pos];

                //胜利方的士兵播放胜利动画
                node.getComponent(Fighter).showWin();
            }

            //判断胜利方是否是我方士兵
            isWin = team === 1;
            egf.EventMgr.emit(Constants.EVENT_NAME.GAME_OVER, isWin);
        }

        if (isWin) {
            let outRay = new geometry.Ray();
            let size = view.getCanvasSize();

            //如果胜利，则利用射线检测，在屏幕中央的地板位置播放胜利特效
            GameMgr.mainCamera.screenPointToRay(size.width / 2, size.height / 2, outRay);
            PhysicsSystem.instance.raycastClosest(outRay, Constants.COLLIDER_GROUP.PLANE, 50, false);
            const hitPoint = PhysicsSystem.instance.raycastClosestResult.hitPoint;

            this.effectGroup.playWinEffect(hitPoint, () => {});

            //播放胜利音效
            egf.AudioMgr.playOneShot(Constants.AUDIO_SOUND.WIN);
        } else {
            //播放失败音效
            egf.AudioMgr.playOneShot(Constants.AUDIO_SOUND.FAIL);
        }
    }

    /**
     * 获取指定队伍的人数
     * @param isSelf 是否为我方队伍
     * @returns
     */
    public getFighterNum(isSelf: boolean = true) {
        let num = 0;
        if (isSelf) {
            num = Object.keys(this.dictFighter[Constants.PLAYER_TEAM]).length;
        } else {
            for (let team in this.dictFighter) {
                if (team !== "1") {
                    num += Object.keys(this.dictFighter[team]).length;
                }
            }
        }

        return num;
    }

    /**
     * 获得战力
     * @param isSelf 是否为我方队伍
     */
    public getFighterFight(isSelf: boolean = true) {
        let fight = 0;

        for (let team in this.dictFighter) {
            if ((team === "1" && isSelf) || (team !== "1" && !isSelf)) {
                let tmp = this.dictFighter[team];
                for (let identity in tmp) {
                    fight += tmp[identity].fight;
                }
            }
        }

        return fight;
    }

    /**
     * 购买士兵
     * @param pos
     * @param fighterId
     * @returns
     */
    private _buyFighter(pos: number, fighterId: number) {
        if (!this._dictCell[pos]) {
            return;
        }

        let ndFormation = this._dictCell[pos];
        let scriptFormationCell = ndFormation.getComponent(FormationCell) as FormationCell;
        const soldier = LocalDataMgr.GameInfo.formation[pos];
        scriptFormationCell.updateFighter(soldier);

        //更新可合成提示
        this._checkSimilar();
    }

    /**
     * 购买格子
     */
    private _buyCell(cellPos: number) {
        if (this._dictCell[cellPos]) {
            return;
        }
        const soldier = LocalDataMgr.GameInfo.formation[cellPos];
        this._addCell(cellPos, 1, soldier);
    }

    /**
     * 添加格子
     *
     * @param index 索引/位置
     * @param team 属于哪个队伍
     * @param fighterId 士兵ID/角色编号，具体看fighter.csv
     */
    private _addCell(index: number, team: number, fighterId: number) {
        let ndFormation = egf.PoolMgr.getNode(this.pfFormationCell, this.node as Node);
        let scriptFormationCell = ndFormation.getComponent(FormationCell) as FormationCell;
        scriptFormationCell.init(index, Number(team), fighterId, this);

        if (team === Constants.PLAYER_TEAM) {
            //玩家自身队伍
            this._dictCell[index] = ndFormation;
        }

        this._aryCell.push(ndFormation);
    }

    //*************************************
    //阵型相关部分
    //*************************************

    /**
     * 接收主界面的触摸位置
     * @param even
     * @param pos
     */
    private _homeUITouch(event: string, pos: Vec2) {
        if (event === Node.EventType.TOUCH_START) {
            //检查是否选中格子，如果该选中的格子上有士兵则同等级的士兵脚下的格子播放“可合成”提示特效
            this._checkSelectCell(pos);
        } else if (event === Node.EventType.TOUCH_MOVE) {
            //移动触摸时将所选中格子上的士兵统一上移指定坐标
            this._checkNewCell(pos);
        } else {
            // 检测格子是否占用、合并、交换：当玩家手离开屏幕时触发该函数
            this._checkCellOperation(pos);
        }
    }

    /**
     * 检查是否选中格子，如果该选中的格子上有士兵则同等级的士兵脚下的格子播放“可合成”提示特效
     * @param pos
     */
    private _checkSelectCell(pos: Vec2) {
        GameMgr.mainCamera.screenPointToRay(pos.x, pos.y, this._outRay1);
        let isCheck = PhysicsSystem.instance.raycastClosest(this._outRay1, Constants.COLLIDER_GROUP.PLANE, 50, false);

        if (isCheck) {
            const hitPoint = PhysicsSystem.instance.raycastClosestResult.hitPoint;
            let cell = this._getCellByPos(hitPoint);
            //如果第一次点击点到某块格子
            if (cell && cell.aryIdentity.length > 0) {
                this._currentSelect = cell.pos;
                this._arySelectFighterIdentity = egf.Utils.clone(cell.aryIdentity);
                this._currentMoveTarget = this._currentSelect;

                egf.EventMgr.emit(Constants.EVENT_NAME.SHOW_LEVEL_TIPS, true, pos, cell.fighterId, 0);

                let fighterId = cell.fighterId;
                //士兵的下一等级
                let next = GameMgr.getFighterNextId(fighterId);
                //检查士兵是否可以合成更高级的士兵
                if (next > 0) {
                    this._hideAllSimilar();

                    //表示可以升级
                    for (let posCell in this._dictCell) {
                        if (Number(posCell) === cell.pos) {
                            continue;
                        }
                        let ndCell = this._dictCell[posCell];
                        let scriptFormationCell = ndCell.getComponent(FormationCell) as FormationCell;
                        if (scriptFormationCell.fighterId === fighterId) {
                            //同类的士兵显示“可合成”提示特效
                            scriptFormationCell.showSimilar(true);
                        }
                    }
                }

                this._checkNewCell(pos);
            }
        }
    }

    /**
     * 获取被触碰到的格子脚本
     * @param pos
     * @returns
     */
    private _getCellByPos(pos: Vec3) {
        for (let cellPos in this._dictCell) {
            let scriptCell = this._dictCell[cellPos].getComponent(FormationCell) as FormationCell;
            if (scriptCell.checkIsHit(pos)) {
                return scriptCell;
            }
        }

        return null;
    }

    /**
     * 移动触摸时将所选中格子上的士兵统一上移指定坐标
     * @param touchPos
     */
    private _checkNewCell(touchPos: Vec2) {
        this._curTouchPos.set(touchPos);

        if (this._currentSelect >= 0) {
            GameMgr.mainCamera.screenPointToRay(touchPos.x, touchPos.y, this._outRay1);
            //是否点击到地面
            let isCheck = PhysicsSystem.instance.raycastClosest(
                this._outRay1,
                Constants.COLLIDER_GROUP.PLANE,
                50,
                false,
            );
            if (isCheck) {
                //得到在地面的触摸点
                let hitPoint = PhysicsSystem.instance.raycastClosestResult.hitPoint;
                //根据人数获取到士兵位置
                let arrPos = GameMgr.getFighterPosByNum(hitPoint, this._arySelectFighterIdentity.length);

                //选中的格子上的战士的位置始终和到当前触摸点位置保持一致, 但此时坐标并没有真正更新过来
                for (let idx = 0; idx < arrPos.length; idx++) {
                    let worPos = arrPos[idx];

                    //数字1固定表示为自身队伍id
                    let ndFighter = this.dictFighter[Constants.PLAYER_TEAM][this._arySelectFighterIdentity[idx]];

                    if (ndFighter) {
                        ndFighter.setPosition(worPos);
                        let scriptFighter = ndFighter.getComponent(Fighter) as Fighter;
                        //禁用刚体数据同步，等到时候确定了哪个位置，设置过去并启用
                        scriptFighter.rigidBody.enableSync = false;
                    }
                }

                //目标格子脚本
                let scriptTargetCell = this._getCellByPos(hitPoint);

                //判定是否移动到目标格子
                if (scriptTargetCell && scriptTargetCell.pos !== this._currentMoveTarget) {
                    //隐藏之前目标格子节点下的选中提示特效
                    if (this._currentMoveTarget >= 0) {
                        this._dictCell[this._currentMoveTarget].getComponent(FormationCell).select = false;
                        this._currentMoveTarget = -1;
                    }

                    //展示目标格子节点下的选中提示特效
                    scriptTargetCell.select = true;
                    this._currentMoveTarget = scriptTargetCell.pos;

                    //第一次选中的格子的脚本
                    let scriptFormationCell = this._dictCell[this._currentSelect].getComponent(
                        FormationCell,
                    ) as FormationCell;

                    //检查是交换还是更新
                    if (scriptTargetCell.pos === scriptFormationCell.pos || scriptTargetCell.aryIdentity.length === 0) {
                        //如果当前位置和目标位置一样，或者目标位置上没有士兵，则直接占用
                        egf.EventMgr.emit(
                            Constants.EVENT_NAME.SHOW_LEVEL_TIPS,
                            true,
                            this._curTouchPos,
                            scriptFormationCell.fighterId,
                            0,
                        );
                    } else if (scriptTargetCell.fighterId === scriptFormationCell.fighterId) {
                        //编号相同则升级
                        egf.EventMgr.emit(
                            Constants.EVENT_NAME.SHOW_LEVEL_TIPS,
                            true,
                            this._curTouchPos,
                            scriptFormationCell.fighterId,
                            1,
                        );
                    } else {
                        //编号不同则交换
                        egf.EventMgr.emit(
                            Constants.EVENT_NAME.SHOW_LEVEL_TIPS,
                            true,
                            this._curTouchPos,
                            scriptFormationCell.fighterId,
                            2,
                        );
                    }
                } else if (!scriptTargetCell) {
                    //移动到外面出去了
                    if (this._currentMoveTarget !== -1) {
                        //之前是有格子的
                        let scriptFormationCell = this._dictCell[this._currentSelect].getComponent(
                            FormationCell,
                        ) as FormationCell;
                        egf.EventMgr.emit(
                            Constants.EVENT_NAME.SHOW_LEVEL_TIPS,
                            true,
                            this._curTouchPos,
                            scriptFormationCell.fighterId,
                            0,
                        );
                    }

                    //隐藏目标格子节点下的选中提示特效
                    if (this._currentMoveTarget >= 0) {
                        this._dictCell[this._currentMoveTarget].getComponent(FormationCell).select = false;
                        this._currentMoveTarget = -1;
                    }
                }
            }
        }
    }

    /**
     * 选中的士兵重置回选中前的坐标
     */
    private _resetCellFighterPos() {
        this._arySelectFighterIdentity.forEach((identity) => {
            let ndFighter = this.dictFighter[Constants.PLAYER_TEAM][identity];
            let scriptFighter = ndFighter.getComponent(Fighter) as Fighter;
            scriptFighter.rigidBody.enableSync = true;
        });
    }

    /**
     * 格子交换
     *
     * @private
     * @param {FormationCell} cellSelect 玩家拖拽/选中的格子的脚本
     * @param {FormationCell} cellTarget 目标格子的脚本
     * @memberof FighterManager
     */
    private _swapCell(cellSelect: FormationCell, cellTarget: FormationCell) {
        //互换格子上的士兵编号和士兵唯一标识数组
        let tmpAry = egf.Utils.clone(cellTarget.aryIdentity);
        let tmpFighterId = cellTarget.fighterId;
        cellTarget.aryIdentity = egf.Utils.clone(cellSelect.aryIdentity);
        cellTarget.fighterId = cellSelect.fighterId;
        cellSelect.aryIdentity = tmpAry;
        cellSelect.fighterId = tmpFighterId;

        //更新呼唤后的士兵数据到缓存
        LocalDataMgr.swapCell(cellSelect.pos, cellTarget.pos);

        //更新目标格子上的士兵
        if (cellTarget.aryIdentity.length > 0) {
            this._tempPos.set(cellTarget.node.worldPosition);
            let arrPos = GameMgr.getFighterPosByNum(this._tempPos, cellTarget.aryIdentity.length);

            cellTarget.aryIdentity.forEach((identity: any, index: number) => {
                let fighter = this.dictFighter[Constants.PLAYER_TEAM][identity].getComponent(Fighter) as Fighter;
                fighter.cellPos = cellTarget.pos;
                fighter.rigidBody.setWorldPosition(arrPos[index]);
                fighter.rigidBody.enableSync = true;
            });
        }

        //更新玩家拖拽/选中的格子上的士兵
        if (cellSelect.aryIdentity.length > 0) {
            this._tempPos.set(cellSelect.node.worldPosition);
            let arrPos = GameMgr.getFighterPosByNum(this._tempPos, cellSelect.aryIdentity.length);

            cellSelect.aryIdentity.forEach((identity: any, index: number) => {
                let fighter = this.dictFighter[Constants.PLAYER_TEAM][identity].getComponent(Fighter) as Fighter;
                fighter.cellPos = cellSelect.pos;
                fighter.rigidBody.setWorldPosition(arrPos[index]);
                fighter.rigidBody.enableSync = true;
            });
        }

        this._checkSimilar();
    }

    /**
     * 合并格子里面的士兵
     * @param cellSelec
     * @param cellTarge
     */
    private _combineCell(cellSelect: FormationCell, cellTarget: FormationCell) {
        //下一等级的士兵
        let nextId = GameMgr.getFighterNextId(cellSelect.fighterId);

        //有找到，可升级
        if (nextId > 0) {
            //数据更新
            LocalDataMgr.combineCell(cellSelect.pos, cellTarget.pos, nextId);

            //目标格子生成下一等级的士兵
            cellTarget.updateFighter(nextId);
            //清空玩家选中的格子上的士兵
            cellSelect.updateFighter(0);
            cellTarget.showCombineSucceed();

            egf.AudioMgr.playOneShot(Constants.AUDIO_SOUND.COMBINE);

            egf.EventMgr.emit(Constants.EVENT_NAME.COMBINE_SUCCEED, cellTarget.pos, cellSelect.pos); //合并成功
            egf.EventMgr.emit(Constants.EVENT_NAME.UPDATE_FORMATION); //通知界面刷新人数

            this._checkSimilar();
        } else {
            //直接将位置重置
            this._resetCellFighterPos();
        }
    }

    /**
     * 检测格子是否占用、合并、交换：当玩家手离开屏幕时触发该函数
     * @param pos
     */
    private _checkCellOperation(pos: Vec2) {
        if (this._currentSelect >= 0) {
            //玩家手中拖拽的格子的脚本
            let cellSelect = this._dictCell[this._currentSelect].getComponent(FormationCell) as FormationCell;

            GameMgr.mainCamera.screenPointToRay(pos.x, pos.y, this._outRay1);

            let isCheck = PhysicsSystem.instance.raycastClosest(
                this._outRay1,
                Constants.COLLIDER_GROUP.PLANE,
                50,
                false,
            );

            //是否点击到地面
            if (isCheck) {
                //点击到地面的坐标
                const hitPoint = PhysicsSystem.instance.raycastClosestResult.hitPoint;

                //目标格子的脚本：松手前触摸的格子
                let scriptFormationCell = this._getCellByPos(hitPoint);

                if (!scriptFormationCell) {
                    //没有目标则重置回去
                    this._resetCellFighterPos();
                } else {
                    if (this._currentSelect === scriptFormationCell.pos) {
                        //如果目标格子和之前拖拽的格子一样，则士兵又回到了原来的格子
                        this._resetCellFighterPos();
                    } else if (scriptFormationCell.aryIdentity.length === 0) {
                        //目标格子上没有士兵，则直接占领那个位置
                        this._swapCell(cellSelect, scriptFormationCell);
                    } else {
                        //如果目标格子上的士兵和玩家手中拖拽的士兵的编号一样则合并且升级，否则交换位置
                        if (scriptFormationCell.fighterId === cellSelect.fighterId) {
                            this._combineCell(cellSelect, scriptFormationCell);
                        } else {
                            this._swapCell(cellSelect, scriptFormationCell);
                        }
                    }
                }
            }

            this._arySelectFighterIdentity = [];
            this._currentSelect = -1;

            //隐藏目标格子节点下的选中提示特效
            if (this._currentMoveTarget >= 0) {
                this._dictCell[this._currentMoveTarget].getComponent(FormationCell).select = false;
                this._currentMoveTarget = -1;
            }

            this._checkSimilar();
        }

        egf.EventMgr.emit(Constants.EVENT_NAME.SHOW_LEVEL_TIPS, false);
    }

    /**
     * 是否是近战士兵
     * @param {number} type
     * @returns
     * @memberof FighterManager
     */
    private _isCloseFighter(type: number) {
        return (
            type === Constants.FIGHTER_TYPE.CLOSE ||
            type === Constants.FIGHTER_TYPE.BAT ||
            type === Constants.FIGHTER_TYPE.OX
        );
    }

    /**
     * 使用火球技能
     */
    private _useFireBall() {
        let sumClose = 0; //近战士兵数量
        let sumLong = 0; //远程士兵数量
        let closePosX = 0,
            closePosY = 0; //近战士兵x、y的值
        let longPosX = 0,
            longPosY = 0; //远程士兵x、y的值

        for (let team in this.dictFighter) {
            if (team === Constants.PLAYER_TEAM.toString()) {
                continue;
            }

            let objFighters = this.dictFighter[team];
            //遍历敌方的士兵
            for (let identity in objFighters) {
                let ndFighter = objFighters[identity];
                let scriptFighter = ndFighter.getComponent(Fighter) as Fighter;
                let pos = ndFighter.position;

                if (this._isCloseFighter(scriptFighter.fightType)) {
                    sumClose++;

                    closePosX += pos.x;
                    closePosY += pos.z;
                } else {
                    sumLong++;

                    longPosX += pos.x;
                    longPosY += pos.z;
                }
            }
        }

        //哪种兵种多就打谁，炸弹设置在敌人中心点
        if (sumClose > 0) {
            this._ballPos.set(closePosX / sumClose, 0, closePosY / sumClose);
        } else if (sumLong > 0) {
            this._ballPos.set(longPosX / sumLong, 0, longPosY / sumLong);
        }

        //火球伤害面积
        let disSqr = Constants.FIRE_BALL_DISTANCE * Constants.FIRE_BALL_DISTANCE;

        this.effectGroup.playFireBallEffect(this._ballPos, () => {
            //触发后，计算伤害
            egf.AudioMgr.playOneShot(Constants.AUDIO_SOUND.FIRE_BALL);

            //伤害百分比
            let percent = Constants.FIRE_BALL_DAMAGE_PERCENT;

            //如果关卡小于20关则伤害百分比为100%
            if (DataMgr.level < 20) {
                percent = 1;
            }

            for (let team in this.dictFighter) {
                if (team === Constants.PLAYER_TEAM.toString()) {
                    continue;
                }

                let objFighters = this.dictFighter[team];
                //遍历敌人节点
                for (let identity in objFighters) {
                    let ndFighter = objFighters[identity] as Node;

                    let enemyWorPos = ndFighter.worldPosition.clone();

                    //当敌人在火球爆炸范围内则受到百分比伤害
                    if (enemyWorPos.subtract(this._ballPos).lengthSqr() < disSqr) {
                        let fighter = ndFighter.getComponent(Fighter) as Fighter;
                        fighter.onDamage(fighter.hpMax * percent, -1);
                    }
                }
            }
        });
    }

    /**
     * 获取引导合成的起点终点、范围等信息
     *
     * @returns
     * @memberof FighterManager
     */
    public getCombineContentForGuide() {
        //获得位置2的屏幕坐标，然后在做对应换算
        let ndCell = this._dictCell[2];

        let ndCanvas = find("Canvas") as Node;
        GameMgr.mainCamera.convertToUINode(ndCell.getWorldPosition(), ndCanvas, this._outPos);

        //获取适合的点击点
        let cellStart = -1,
            cellEnd = -1;
        let arrCell = [this._dictCell[1], this._dictCell[2], this._dictCell[3]];
        let arrCellScript = [
            arrCell[0].getComponent(FormationCell),
            arrCell[1].getComponent(FormationCell),
            arrCell[2].getComponent(FormationCell),
        ];
        if (arrCellScript[0].fighterId === arrCellScript[1].fighterId) {
            cellStart = 0;
            cellEnd = 1;
        } else if (arrCellScript[0].fighterId === arrCellScript[2].fighterId) {
            cellStart = 0;
            cellEnd = 2;
        } else {
            cellStart = 1;
            cellEnd = 2;
        }

        GameMgr.mainCamera.convertToUINode(arrCell[cellStart].getWorldPosition(), ndCanvas, this._startPos);
        GameMgr.mainCamera.convertToUINode(arrCell[cellEnd].getWorldPosition(), ndCanvas, this._endPos);

        //视窗裁剪区域
        let viewSize = view.getViewportRect();

        //设计分辨率
        let designSize = view.getDesignResolutionSize();

        let scaleX = viewSize.width / designSize.width;
        let scaleY = viewSize.height / designSize.height;
        let maxScale = scaleX >= scaleY ? scaleX : scaleY;

        return {
            pos: this._outPos,
            width: 400 * maxScale,
            height: 150 * maxScale,
            dragStart: this._startPos,
            dragEnd: this._endPos,
        };
    }

    /**
     * 格子上展示冲刺暴走特效
     */
    private _showSprint() {
        for (let pos in this._dictCell) {
            let ndCell = this._dictCell[pos];

            let scriptFormationCell = ndCell.getComponent(FormationCell) as FormationCell;
            if (scriptFormationCell && scriptFormationCell.fighterId) {
                scriptFormationCell.showSprint();
            }
        }
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
     * 隐藏所有的格子上“可合成的”特效提示
     */
    private _hideAllSimilar() {
        for (let pos in this._dictCell) {
            let scriptFormationCell = this._dictCell[pos].getComponent(FormationCell) as FormationCell;
            scriptFormationCell.showSimilar(false);
        }
    }

    /**
     * 检查我方士兵如果可以进行合成，则格子上会展示提示特效
     */
    private _checkSimilar() {
        let dictTmp: any = {};

        //玩家队伍士兵队列
        let formation = LocalDataMgr.GameInfo.formation;

        //将队列上相似的士兵进行分组
        for (let pos in formation) {
            let fighter = formation[pos];

            if (fighter > 0) {
                //即该位置有人
                if (!dictTmp.hasOwnProperty(fighter)) {
                    dictTmp[fighter] = [pos];
                } else {
                    dictTmp[fighter].push(pos);
                }
            }
        }

        //先隐藏所有的格子上的可合成提示特效
        this._hideAllSimilar();

        //展示可以进行士兵合成的格子上的提示特效
        for (let fighter in dictTmp) {
            let arrPos = dictTmp[fighter];
            if (arrPos.length > 1) {
                //至少两个以上
                for (let idxPos = 0; idxPos < arrPos.length; idxPos++) {
                    let pos = arrPos[idxPos];
                    let scriptFormationCell = this._dictCell[pos].getComponent(FormationCell) as FormationCell;
                    scriptFormationCell.showSimilar(true);
                }
            }
        }
    }

    update(deltaTime: number) {
        // Your update function goes here.
        //暂停/结束时物理世界不步进，并清空累加器，避免恢复后一次性补步进
        if (!this.isGameStart || this.isGamePause || this.isGameOver) {
            this._physicsAccumulator = 0;
            return;
        }

        this._checkTimeScale(deltaTime);

        if (this._world) {
            //固定步长 + 累加器：物理推进只与真实时间有关，不受设备帧率影响
            this._physicsAccumulator += deltaTime;

            let steps = 0;
            //参数：1、逻辑帧的时间长度（1秒30帧），2、速度计算迭代次数（迭代的次数越多，碰撞传导的速度越快），3、位移计算迭代次数（迭代的次数越多，解决刚体重叠的速度越快）
            while (this._physicsAccumulator >= Constants.PHYSICS_STEP && steps < Constants.PHYSICS_MAX_STEPS) {
                this._world.Step(Constants.PHYSICS_STEP, 6, 2);
                this._physicsAccumulator -= Constants.PHYSICS_STEP;
                steps++;
            }

            if (steps >= Constants.PHYSICS_MAX_STEPS) {
                //严重卡顿（例如切后台回来）时丢弃剩余时间，避免追帧雪崩
                this._physicsAccumulator = 0;
            }
        }
    }
}
