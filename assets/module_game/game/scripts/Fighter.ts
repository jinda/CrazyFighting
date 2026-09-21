import { _decorator, Component, Node, Vec3, Tween, Prefab, isValid } from "cc";
import { Constants } from "db://assets/scripts/Constants";
import { Effect } from "./Effect";
import { FighterModel } from "./FighterModel";
import { FighterRigidBody } from "./FighterRigidBody";
import { ModuleDef } from "db://assets/scripts/ModuleDef";
import { PlatformMgr } from "db://assets/scripts/SDK/PlatformMgr";
import { GameMgr } from "./GameMgr";

//敌我双方士兵脚本
const { ccclass, property } = _decorator;
@ccclass("Fighter")
export class Fighter extends Component {
    @property(Node)
    public ndModelParent: Node = null!; //模型父节点

    @property(Node)
    public ndShadow: Node = null!; //阴影节点

    public fighterInfo: any; //士兵数据
    public identity: number = 0; //唯一标识
    public rigidBody: FighterRigidBody = null!; //士兵刚体组件
    public fightType: number = 0; //攻击类型/士兵类型（1奥特曼/2牛角/3短剑/4标枪/5投石车/6小丑）
    public team: number = 0; //队伍
    public isDead: boolean = false; //是否阵亡
    public hpMax: number = 0; //最大血量
    public cellPos: number = 0; //所属格子坐标
    public target: Fighter = null!; //目标敌人的脚本

    //设置时间缩放
    public set timeScale(value: number) {
        this._timeScale = value;

        //更新时间缩放的同时更新士兵的动画播放速度
        this._fighterModel && this._fighterModel.updateAniSpeed();
    }

    //获取时间缩放
    public get timeScale() {
        return this._timeScale;
    }

    //刚体半径
    public get radius() {
        return 0.3 * this.fighterInfo.scale;
    }

    private _moveStartCostTime: number = 0; //计算出移动到_posFightStartTarget这个位置所需的时间
    private _attackRange: number = 0.8; //攻击范围
    private _hp: number = 0; //当前血量
    private _damage: number = 0; //伤害值
    private _coolTime: number = 0; //攻击冷却时间，如果还在冷却中，不得发起攻击
    private _currentStatus: number = -1; //士兵当前状态
    private _attackAniTime: number = 0; //攻击动画累计播放时间
    private _moveTime: number = 0; //每次移动的时间
    private _moveSpeed: number = 0; //移动速度
    private _isWaitingDamage: boolean = false; //等待伤害计算
    private _tweenDead: any = null!; //士兵阵亡缓动效果
    private _isAttacking: boolean = false; //是否正在攻击
    private _loadGeneration: number = 0; //异步模型加载代次：每次 init() 递增，回收时失效，防止旧回调挂载到复用后的角色
    private _fightStartTargetPos: Vec3 = new Vec3(); //开始游戏后士兵到达的第一个位置
    private _nodeModel: Node = null!; //士兵模型
    private _fighterModel: FighterModel = null!; //士兵模型的脚本
    private _isPlayingChairEffect = false; //是否正在播放被击中的特效
    private _timeScale: number = 1; //时间缩放，用于加快攻击及移动速度, 也可以理解成游戏速度
    private _curPos: Vec3 = new Vec3(); //当前位置
    private _outPos: Vec3 = new Vec3(); //士兵阵亡后退的位置
    private _oriEuler: Vec3 = new Vec3(); //士兵初始欧拉角
    private _nowPos: Vec3 = new Vec3(); //士兵刚体当前位置
    private _targetPos: Vec3 = new Vec3(); //目标位置
    private _forward: Vec3 = new Vec3(); //士兵节点朝向的单位向量
    private _direction: Vec3 = new Vec3(); //士兵朝向目标位移的向量差
    private _startOffset: Vec3 = new Vec3(); //开始位置和目标位置的向量差

    start() {
        //士兵播放待机动画
        this._enterStatus(Constants.FIGHTER_STATUS.IDLE);
    }

    onDisable() {
        if (this._tweenDead) {
            this._tweenDead.stop();
            this._tweenDead = null;
        }
    }

    /**
     * 士兵初始化
     * @param identity 唯一标识
     * @param team 队伍
     * @param fighterInfo 士兵数据
     * @param posWorld 位置
     * @param world 物理世界
     * @param manager 管理所有士兵的脚本
     * @param cellPos 对应的格子
     */
    public init(identity: number, team: number, fighterInfo: any, posWorld: Vec3, cellPos: number) {
        this.rigidBody = this.getComponent(FighterRigidBody) as FighterRigidBody;
        this.rigidBody.initBody(GameMgr.world, 0.3);
        this.rigidBody.setWorldPosition(posWorld);

        //开启刚体数据同步
        this.rigidBody.enableSync = true;

        this.timeScale = 1;
        this.isDead = false;
        this.target = null!;
        this.cellPos = cellPos;
        this.identity = identity;
        this.fighterInfo = fighterInfo;
        this.fightType = fighterInfo.type;
        this.team = team;
        this.ndShadow.active = true;

        this._fightStartTargetPos = null!;
        this._currentStatus = -1;
        this._attackAniTime = 0;
        this._coolTime = 0;
        this._isWaitingDamage = false;
        this._isAttacking = false;
        this._isPlayingChairEffect = false;

        this._enterStatus(Constants.FIGHTER_STATUS.IDLE);

        let rotationY = 270;
        switch (this.team) {
            case 2:
                rotationY = 270;
                break;
            case 3:
                rotationY = 180;
                break;
            case 4:
                rotationY = 0;
                break;
        }

        this._oriEuler.set(0, rotationY, 0);
        this.node.eulerAngles = this._oriEuler;

        //加载士兵对应模型
        //代次保护：本角色在资源返回前可能被回收并复用给下一名角色，
        //回调必须校验加载代次、identity 与节点有效性，避免旧模型挂到新角色
        const loadGeneration = ++this._loadGeneration;
        const curIdentity = identity;
        const modelName = Constants.FIGHTER_MODEL[Number(this.fighterInfo.type)];
        egf.ResMgr.getAsset(ModuleDef.GAME, `game/prefabs/model/man/${modelName}`, (pf: Prefab) => {
            //代次校验：本次初始化已被回收/重新初始化，或节点已失效时，迟到的加载结果直接丢弃
            if (
                loadGeneration !== this._loadGeneration ||
                curIdentity !== this.identity ||
                !isValid(this.node) ||
                !this.ndModelParent
            ) {
                return;
            }

            //兜底：若此前仍有已挂载的旧模型（理论上 recycle 时已回收），先回池，避免同一角色挂两个模型导致泄漏
            if (this._nodeModel) {
                egf.PoolMgr.putNode(this._nodeModel);
                this._nodeModel = null!;
                this._fighterModel = null!;
            }

            this._nodeModel = egf.PoolMgr.getNode(pf, this.ndModelParent);
            this._fighterModel = this._nodeModel.getComponent(FighterModel) as FighterModel;
            this._fighterModel.show(this);
            this._fighterModel.setEffectListener(this._triggerEffect, this);
        });

        let scale = this.fighterInfo.scale;
        this.node.setScale(scale, scale, scale);
        this.rigidBody.updateRadius(0.3 * scale);

        this._hp = this.fighterInfo.hp;
        this.hpMax = this._hp;
        this._damage = this.fighterInfo.attack;
        this._moveSpeed = this.fighterInfo.speed;

        if (
            this.fightType === Constants.FIGHTER_TYPE.CLOSE ||
            this.fightType === Constants.FIGHTER_TYPE.OX ||
            this.fightType === Constants.FIGHTER_TYPE.BAT
        ) {
            //近战的会执行速度30%的浮动
            let percent = 0.2;
            this._moveSpeed = Math.floor(
                this._moveSpeed * (1 + percent) - Math.random() * this._moveSpeed * percent * 2,
            );
        }

        this._attackRange = this.fighterInfo.range / 100;
    }

    /**
     * 重置士兵状态
     */
    public resetFighterState() {
        if (this._tweenDead) {
            this._tweenDead.stop();
            this._tweenDead = null;
        }

        this.recycle();
    }

    /**
     * 士兵进入对应状态
     * @param status
     * @returns
     */
    private _enterStatus(status: number) {
        if (this._currentStatus === status) {
            //不需要重复进入
            return;
        }

        if (this.isDead && status !== Constants.FIGHTER_STATUS.DEAD) {
            return;
        }

        this._currentStatus = status;

        switch (status) {
            case Constants.FIGHTER_STATUS.IDLE:
                this._fighterModel && this._fighterModel.playAni(Constants.ANI_TYPE.IDLE);
                break;
            case Constants.FIGHTER_STATUS.FIND:
                this._findEnemy();
                break;
            case Constants.FIGHTER_STATUS.DEAD:
                this._fighterModel && this._fighterModel.playAni(Constants.ANI_TYPE.DIED, true);
                break;
            case Constants.FIGHTER_STATUS.CHARGE:
                this._fighterModel && this._fighterModel.playAni(Constants.ANI_TYPE.RUN, true);
                break;
        }
    }

    /**
     * 寻找最近的敌人
     * @returns
     */
    private _findEnemy() {
        //现将速度清除掉
        // this.rigidBody.resetPhysical();

        if (GameMgr.isGameOver) {
            return;
        }

        let ndTarget = GameMgr.getNearestEnemy(this);

        //如果找不到敌人
        if (!ndTarget || !ndTarget.isValid) {
            //进入待机状态
            this._enterStatus(Constants.FIGHTER_STATUS.IDLE);

            GameMgr.checkWin(this.team);
            if (!GameMgr.isGameOver) {
                //待机3s在搜寻下？？
                this.scheduleOnce(this._findEnemy, 3);
            }
        } else {
            //如果找到敌人则向敌人移动
            this.target = ndTarget.getComponent(Fighter) as Fighter;
            this._enterStatus(Constants.FIGHTER_STATUS.MOVE);
        }
    }

    /**
     * 部分士兵播放攻击特效
     */
    private _playAttackEffect() {
        let effect = null;
        if (this.fightType === Constants.FIGHTER_TYPE.OX || this.fightType === Constants.FIGHTER_TYPE.BAT) {
            effect = "attckRing01";
        } else if (this.fightType === Constants.FIGHTER_TYPE.CLOSE) {
            effect = "attck01";
        }

        if (effect) {
            egf.ResMgr.getAsset(ModuleDef.GAME, `game/prefabs/effect/${effect}`, (pf: Prefab) => {
                let ndEffect = egf.PoolMgr.getNode(pf, this.node);
                let effect = ndEffect.getComponent(Effect);

                effect.play();
                effect.setEndListener(() => {
                    egf.PoolMgr.putNode(ndEffect);
                });
            });
        }
    }

    /**
     * 士兵进攻
     * @returns
     */
    private _attack() {
        //还在冷却中，不得发起攻击，进入待机状态
        if (this._coolTime > 0) {
            this._enterStatus(Constants.FIGHTER_STATUS.IDLE);
            return;
        }

        this._enterStatus(Constants.FIGHTER_STATUS.ATTACK);

        this._coolTime = this.fighterInfo.attackSpeed / 1000;

        //部分兵种带有攻击特效
        this._playAttackEffect();

        //振动
        PlatformMgr.vibrate(100);

        //音效
        egf.AudioMgr.playOneShot(`${this.fightType}_${egf.Utils.getRandomInt(1, 2)}`);

        this._isWaitingDamage = true;
        this._attackAniTime = 0;

        if (this._fighterModel) {
            this._fighterModel.playAttack();
            this._fighterModel.showHandWeapon();
            this._isAttacking = true;

            this._fighterModel.onceAniFinished(() => {
                this._isAttacking = false;

                //切回待机动画
                this._enterStatus(Constants.FIGHTER_STATUS.IDLE);
            }, this);
        } else {
            //动作未加载完成？
            this._isAttacking = false;
            this._enterStatus(Constants.FIGHTER_STATUS.IDLE);
        }
    }

    /**
     * 士兵收到伤害
     * @param damageValue
     * @param attacker
     */
    public onDamage(damageValue: number, attacker?: number) {
        //同一帧可能被多个伤害源命中（近战 + 范围伤害 + 飞行武器），必须幂等：
        //否则会重复触发 onSomeoneDead → 重复掉落金币、重复播放阵亡缓动
        if (this.isDead) {
            return;
        }

        this._hp -= damageValue;

        if (this._hp <= 0) {
            this._hp = 0;
            this._onDead(attacker);
        }
    }

    /**
     * 士兵阵亡
     *
     * @param {number} killer
     * @memberof Fighter
     */
    public _onDead(killer?: number) {
        //提前置位 + 重入保护：保证同一帧只结算一次死亡
        if (this.isDead) {
            return;
        }
        this.isDead = true;
        //播放死亡效果
        this._enterStatus(Constants.FIGHTER_STATUS.DEAD);

        this.ndShadow.active = false;
        this.rigidBody.destroyBody();

        if (this._tweenDead) {
            this._tweenDead.stop();
            this._tweenDead = null;
        }

        let posPushOrient = this.node.forward;

        let pushScale = 1;
        Vec3.multiplyScalar(this._outPos, posPushOrient, pushScale);

        Vec3.add(this._outPos, this._outPos, this.node.position);

        //士兵阵亡后退一个单位向量，停留0.8秒后原地下沉2个单位，最后回收士兵节点
        //修复：原来把绝对坐标 _deadPos 传给 .by()，导致 x/z 也被额外累加，角色会额外横移
        this._tweenDead = new Tween(this.node)
            .to(0.2, { position: this._outPos })
            .delay(0.8)
            .by(1, { position: new Vec3(0, -2, 0) })
            .union()
            .call(() => {
                this.recycle();
            })
            .start();

        GameMgr.onSomeoneDead(this);
    }

    /**
     * 士兵开始战斗
     */
    public fightStart(attackAddition: number, posFightStart: Vec3) {
        //开启刚体对模型的属性同步，避免刚体与模型分离
        this.rigidBody.enableSync = true;

        //攻击加成
        this._damage = Math.floor(this.fighterInfo.attack * attackAddition);

        this._fightStartTargetPos = posFightStart;

        this._startOffset.set(this._fightStartTargetPos);

        //计算出移动到_posFightStartTarget这个位置所需的时间，时间完成后，直接寻找目标，省的卡住
        this._moveStartCostTime =
            this._startOffset.subtract(this.node.position).length() / (this._moveSpeed / Constants.MOVE_SPEED_BASE); //166.6 = 10000/60帧

        this._enterStatus(Constants.FIGHTER_STATUS.CHARGE);
    }

    /**
     * 士兵attack动画帧动画事件触发的回调函数
     */
    private _triggerEffect() {
        if (!this._isWaitingDamage) {
            return;
        }

        this._isWaitingDamage = false;
        if (this.target && !this.target.isDead) {
            //是否远程兵/是否扔武器
            let isThrowWeapon =
                this.fightType === Constants.FIGHTER_TYPE.ARCHER ||
                this.fightType === Constants.FIGHTER_TYPE.AXE ||
                this.fightType === Constants.FIGHTER_TYPE.BOMBER;
            if (isThrowWeapon) {
                let posTarget = this.target.node.worldPosition;

                //扔武器
                this._fighterModel.throwWeapon((target: Fighter) => {
                    //触发特效
                    if (this.fightType === Constants.FIGHTER_TYPE.ARCHER) {
                        //弓箭手
                        GameMgr.effectGroup.playBombEffect(posTarget);
                    } else if (!target._isPlayingChairEffect) {
                        //如果目标没有正在播放被击中特效，则生成新特效

                        //小丑、枪兵暂用同一个特效
                        target._isPlayingChairEffect = true;
                        GameMgr.effectGroup.playChairEffect(posTarget, () => {
                            target._isPlayingChairEffect = false;
                        });
                    }

                    //单个士兵被击中后，如果范围伤害属性大于0，则该士兵和以该士兵为中心的指定范围内的同队士兵受到攻击，否则只有该士兵受到攻击
                    let range = this.fighterInfo["damageRange"] / 100;
                    if (range > 0) {
                        let arrTargets = GameMgr.getEnemyAroundRange(this.team, target.node.position, range);

                        arrTargets.forEach((enemy) => {
                            enemy.onDamage(this._damage, this.identity);
                        });
                    } else if (target && !target.isDead) {
                        target.onDamage(this._damage, this.identity);
                    }

                    //扔完后展示手中的武器
                    this._fighterModel.showHandWeapon();
                });
            } else {
                //近战攻击
                let range = this.fighterInfo["damageRange"] / 100;
                if (range > 0) {
                    let arrTargets = GameMgr.getEnemyAroundRange(this.team, this.target.node.position, range);

                    arrTargets.forEach((enemy) => {
                        enemy.onDamage(this._damage, this.identity);
                    });
                } else if (this.target && !this.target.isDead) {
                    this.target.onDamage(this._damage, this.identity);
                }
            }
        }
    }

    /**
     * 播放士兵胜利动画
     *
     * @returns
     * @memberof Fighter
     */
    public showWin() {
        if (this.isDead) {
            return;
        }

        this._fighterModel && this._fighterModel.playAni(Constants.ANI_TYPE.WIN);
    }

    /**
     * 回收士兵节点、模型节点，删掉士兵刚体
     *
     * @returns
     * @memberof Fighter
     */
    public recycle() {
        if (!this.node.parent) {
            //已经回收过了
            return;
        }

        this.rigidBody.destroyBody();

        //使当前代次的异步加载全部失效：本节点即将回池复用，旧回调不得再挂载模型/皇冠
        this._loadGeneration++;

        //通知模型组件取消未完成的异步加载（如皇冠）
        if (this._fighterModel) {
            this._fighterModel.reset();
        }

        egf.PoolMgr.putNode(this._nodeModel);
        this._nodeModel = null!;
        this._fighterModel = null!;

        egf.PoolMgr.putNode(this.node);
    }

    update(deltaTime: number) {
        // Your update function goes here.
        if (this.isDead || GameMgr.isGamePause) {
            return;
        }

        //deltaTime 加入时间缩放，用于加快攻击及移动速度
        deltaTime *= this.timeScale;

        if (this.target) {
            if (this.target.isDead) {
                //搜索新敌人
                this.target = null!;

                //理论上应该清空物理引擎自身移动状态，
                // this.rigidBody.resetPhysical();
                this._enterStatus(Constants.FIGHTER_STATUS.FIND);
                return;
            }

            //检查是否在攻击范围，如果没有，则朝向该目标
            this._targetPos.set(this.target.node.position);

            //攻击方与被攻击方的向量差
            let offset = this._targetPos.subtract(this.node.position);

            //攻击方与被攻击方的距离是否小于攻击距离
            if (offset.length() - this.target.radius - this.radius <= this._attackRange) {
                this._direction.set(offset);
                this._direction.normalize().negative();
                this._forward.set(this._direction);
                this.node.forward = this._forward;
                this._moveTime = 0;

                //可以攻击
                if (this._coolTime <= 0) {
                    this._attack();
                } else {
                    this._coolTime -= deltaTime;
                }
            } else if (this._isAttacking) {
                //正在攻击，不要停
                this._attackAniTime += deltaTime;
                if (this._attackAniTime > 2) {
                    this._isAttacking = false;
                }
            } else {
                //接着移动
                this._fighterModel && this._fighterModel.playAni(Constants.ANI_TYPE.RUN, true);

                this._direction.set(offset);
                //随机扰动 ±0.1：原实现 Math.floor(Math.random() * 0.2) - 0.1 因为 floor 恒为 0，
                //实际等于常量 -0.1，随机完全失效（人群会朝同一侧偏斜）
                this._direction.x += (Math.random() - 0.5) * Constants.FIGHTER_DIRECTION_RANDOM;
                this._direction.z += (Math.random() - 0.5) * Constants.FIGHTER_DIRECTION_RANDOM;
                this._direction.normalize();

                this._forward.set(this._direction);
                this._forward.negative();

                //士兵朝向目标敌人
                this.node.forward = this._forward;

                this._direction = this._direction.multiplyScalar(
                    (this._moveSpeed * deltaTime) / Constants.MOVE_SPEED_BASE,
                );

                this._curPos.set(this.node.position);
                this._curPos.add(this._direction);

                //设置刚体位置
                this.rigidBody.setWorldPosition(this._curPos);

                this._moveTime += deltaTime;
                if (this._moveTime > 0.1) {
                    //超过一定时间，考虑换下最近的目标
                    this._findEnemy();
                }
            }
        } else if (this._fightStartTargetPos) {
            // console.log('moving...', this.posFightStartTarget, this.team);

            //战斗开始时朝向这个位置移动
            this._targetPos.set(this._fightStartTargetPos);
            let offset = this._targetPos.subtract(this.node.position);

            this._moveStartCostTime -= deltaTime;

            if (this._moveStartCostTime <= 0) {
                // console.log('move over', posTarget, this.team);
                this._fightStartTargetPos = null!;

                //寻找敌人
                this._enterStatus(Constants.FIGHTER_STATUS.FIND);
            } else {
                //接着移动
                this._fighterModel && this._fighterModel.playAni(Constants.ANI_TYPE.RUN, true);

                this._direction.set(offset);

                //增加值取-0.1～0.1之间
                this._direction.x += (Math.random() - 0.5) * Constants.FIGHTER_DIRECTION_RANDOM;
                this._direction.z += (Math.random() - 0.5) * Constants.FIGHTER_DIRECTION_RANDOM;
                this._direction.normalize();

                this._forward.set(this._direction);
                this._forward.negative();

                //士兵朝向目标敌人
                this.node.forward = this._forward;

                //士兵朝向目标位移的向量差
                this._direction = this._direction.multiplyScalar(
                    (this._moveSpeed * deltaTime) / Constants.MOVE_SPEED_BASE,
                ); //166.6 = 10000/60帧

                this._nowPos.set(this.node.worldPosition);
                this._nowPos.add(this._direction);

                //设置刚体的下一步位置
                this.rigidBody.setWorldPosition(this._nowPos);

                this._moveTime += deltaTime;

                if (this._moveTime > 0.1) {
                    // 检查游戏是否结束
                    if (!GameMgr.isGameOver) {
                        //超过一定时间，检测下附近是否有可攻击目标
                        let ndTarget: any = GameMgr.getNearestEnemy(this) as Node;

                        if (ndTarget) {
                            //目标敌人的刚体半径
                            let targetRadius = ndTarget.getComponent(Fighter)?.radius;

                            //判断是否进入攻击范围，发起攻击
                            if (ndTarget["tmpMinDis"] - targetRadius - this.radius <= this._attackRange) {
                                // console.log('attack', this.posFightStartTarget, this.team, targetNode['tmpMinDis'], this.attackRange);
                                this._fightStartTargetPos = null!;

                                //更新目标敌人
                                this.target = ndTarget.getComponent(Fighter) as Fighter;
                                this._attack();
                            }
                        }
                    }

                    this._moveTime = 0;
                }
            }
        }
    }
}
