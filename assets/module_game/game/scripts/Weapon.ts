import {
    _decorator,
    Component,
    Node,
    Vec3,
    Prefab,
    ParticleSystemComponent,
    MeshRenderer,
    CCBoolean,
    Material,
    isValid,
} from "cc";
import { Fighter } from "./Fighter";
import { Constants } from "db://assets/scripts/Constants";
import { GameMgr } from "./GameMgr";

const { ccclass, property } = _decorator;
//武器脚本
@ccclass("Weapon")
export class Weapon extends Component {
    @property(Prefab)
    public pfTrail: Prefab = null!; //拖尾

    @property([MeshRenderer])
    public msrs: MeshRenderer[] = []; //武器模型
    @property([Material])
    public aryMaterial: Material[] = []; //材质皮肤数组

    @property(CCBoolean)
    public isAutoRotate: boolean = true; //武器是否朝向下一个目标位置

    @property(CCBoolean)
    public isLine: boolean = false; //是否是直线

    private totalTime: number = -1; //飞行时间
    private currentTime: number = 0; //当前飞行时间
    private maxHeight: number = 0; //表示此次飞行最大高度
    private posOffset: Vec3 = new Vec3(); //起点和终点的向量差
    private posStart: Vec3 = new Vec3(); //起点
    private endCb: ((target: Fighter, hitPosition: Vec3) => void) | null = null; //到达目标位置后的回调函数
    private attacker: Fighter | null = null;
    private attackTarget: Fighter | null = null; //攻击的敌人（的脚本）
    private attackerGeneration: number = 0;
    private targetGeneration: number = 0;
    private battleGeneration: number = 0;
    private ndTrail: Node | null = null; //拖尾节点
    private rotateCoolTime: number = 0; //旋转角度的冷却时间
    private isBattlePaused: boolean = false;
    private _targetPos: Vec3 = new Vec3(); //当前目标位置
    private _nextTargetPos: Vec3 = new Vec3(); //下次目标位置
    private _lookDirection: Vec3 = new Vec3();

    show(team: number, color: number) {
        // Your initialization goes here.
        let idxMaterial = 0;
        if (team === Constants.PLAYER_TEAM) {
            idxMaterial = color;
        } else {
            idxMaterial = 0;
        }
        this.msrs.forEach((msr) => {
            msr.material = this.aryMaterial[idxMaterial];
        });

        this.reset();
    }

    /**
     * 重置武器数据
     */
    public reset() {
        GameMgr.unregisterBattleLifecycle(this);
        this.endCb = null;
        this.attacker = null;
        this.attackTarget = null;
        this.totalTime = -1;
        this.currentTime = 0;
        this.posStart.set(Vec3.ZERO);
        this.posOffset.set(Vec3.ZERO);
        this.maxHeight = 0;
        this.rotateCoolTime = 0;
        this.isBattlePaused = false;
        if (this.ndTrail) {
            egf.PoolMgr.putNode(this.ndTrail);
            this.ndTrail = null;
        }
        this.node.setScale(1, 1, 1);
    }

    /**
     * 向敌人投掷武器
     * @param posEnd 目标敌人位置
     * @param speed 投掷速度
     * @param attackTarget 攻击的敌人(的脚本)
     * @param endCb
     */
    public throwMissile(
        posEnd: Vec3,
        speed: number,
        attacker: Fighter,
        attackTarget: Fighter,
        endCb: (target: Fighter, hitPosition: Vec3) => void,
    ) {
        this.reset();

        //如果是飞行物，先缩小至0.3单位问题
        this.node.setScale(0.5, 0.5, 0.5);

        //计算出飞行路径
        this.posStart.set(this.node.worldPosition);
        this.posOffset.set(posEnd).subtract(this.node.worldPosition);
        const distance = this.posOffset.length();
        this.totalTime = distance === 0 ? 0 : distance / Math.max(speed, Number.EPSILON);
        this.currentTime = 0;
        this.maxHeight = this.totalTime * 5;
        this.endCb = endCb;
        this.attacker = attacker;
        this.attackTarget = attackTarget;
        this.attackerGeneration = attacker.lifecycleGeneration;
        this.targetGeneration = attackTarget.lifecycleGeneration;
        this.battleGeneration = GameMgr.battleGeneration;
        GameMgr.registerBattleLifecycle(this);

        //如果武器有拖尾特效则展示出来
        if (this.pfTrail) {
            if (this.ndTrail) {
                egf.PoolMgr.putNode(this.ndTrail);
                this.ndTrail = null;
            }

            this.ndTrail = egf.PoolMgr.getNode(this.pfTrail, this.node);
            const particle = this.ndTrail.getComponent(ParticleSystemComponent);
            particle?.clear();
            particle?.stop();
            particle?.play();
            if (this.isBattlePaused) {
                particle?.pause();
            }
        }
    }

    /**
     * 飞行结束时触发
     */
    private _onFlyOver() {
        if (this.totalTime < 0) {
            return;
        }

        this.totalTime = -1;
        const callback = this.endCb;
        const attacker = this.attacker;
        const target = this.attackTarget;
        const attackerGeneration = this.attackerGeneration;
        const targetGeneration = this.targetGeneration;
        const battleGeneration = this.battleGeneration;
        this.endCb = null;
        this.attacker = null;
        this.attackTarget = null;

        if (
            callback &&
            attacker &&
            target &&
            !GameMgr.isGamePause &&
            attacker.isLifecycleActive(attackerGeneration, battleGeneration) &&
            target.isLifecycleActive(targetGeneration, battleGeneration)
        ) {
            callback(target, target.node.worldPosition.clone());
        }

        this._recycle();
    }

    private _recycle() {
        GameMgr.unregisterBattleLifecycle(this);

        if (this.ndTrail) {
            egf.PoolMgr.putNode(this.ndTrail);
            this.ndTrail = null;
        }

        if (isValid(this.node) && this.node.parent) {
            egf.PoolMgr.putNode(this.node);
        }
    }

    public setBattlePaused(paused: boolean) {
        this.isBattlePaused = paused;
        const particle = this.ndTrail?.getComponent(ParticleSystemComponent);
        if (!particle) {
            return;
        }
        if (paused) {
            particle.pause();
        } else if (particle.isPaused) {
            particle.play();
        }
    }

    public cancelBattle() {
        this.totalTime = -1;
        this.endCb = null;
        this.attacker = null;
        this.attackTarget = null;
        this._recycle();
    }

    protected onDisable() {
        GameMgr.unregisterBattleLifecycle(this);
    }

    update(deltaTime: number) {
        // Your update function goes here.
        if (this.totalTime < 0 || this.isBattlePaused || GameMgr.isGamePause) {
            return;
        }

        if (this.totalTime === 0) {
            this._onFlyOver();
            return;
        }

        if (this.currentTime < this.totalTime) {
            this.currentTime += deltaTime;

            if (this.currentTime > this.totalTime) {
                this.currentTime = this.totalTime;
            }

            //百分比
            const currentPercent = this.currentTime / this.totalTime;

            //目标高度
            const height = this.maxHeight * Math.cos(currentPercent * Math.PI - Math.PI / 2);

            //设置目标位置
            this._targetPos.set(
                this.posStart.x + this.posOffset.x * currentPercent,
                this.posStart.y + height,
                this.posStart.z + this.posOffset.z * currentPercent,
            );

            //设置武器位置
            this.node.setWorldPosition(this._targetPos);

            if (this.isAutoRotate) {
                this.rotateCoolTime -= deltaTime;
                if (this.rotateCoolTime < 0) {
                    this.rotateCoolTime = 0.1;

                    const lookAheadPercent = (this.currentTime + 0.1) / this.totalTime;
                    if (lookAheadPercent < 1) {
                        //下一个目标位置的高度
                        const lookAheadHeight = this.maxHeight * Math.cos(lookAheadPercent * Math.PI - Math.PI / 2);

                        //下一个目标位置
                        this._nextTargetPos.set(
                            this.posStart.x + this.posOffset.x * lookAheadPercent,
                            this.posStart.y + lookAheadHeight,
                            this.posStart.z + this.posOffset.z * lookAheadPercent,
                        );

                        //武器朝向下一个目标位置, 形成曲线飞行的感觉
                        Vec3.subtract(this._lookDirection, this._nextTargetPos, this._targetPos);
                        this.node.forward = this._lookDirection.normalize().negative();
                    }
                }
            }

            if (currentPercent >= 1) {
                //表示达到目标
                this._onFlyOver();
            }
        }
    }
}
