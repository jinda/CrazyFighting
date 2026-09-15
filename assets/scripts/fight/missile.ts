import { _decorator, Component, Node, Vec3, Prefab, ParticleSystemComponent, Material, ModelComponent, CCBoolean } from "cc";
import { PoolManager } from "../framework/poolManager";
import { Fighter } from "./fighter";
const { ccclass, property } = _decorator;
//飞行武器脚本
@ccclass("Missile")
export class Missile extends Component {
    @property(Prefab)
    public pfTrail: Prefab = null!; //拖尾

    @property(ModelComponent)
    public model: ModelComponent = null!;//武器模型（暂无用到）

    @property(CCBoolean)
    public isAutoRotate: boolean = false;//武器是否朝向下一个目标位置

    private totalTime: number = -1;//飞行时间
    private currentTime: number = 0;//当前飞行时间
    private maxHeight: number = 0;//表示此次飞行最大高度
    private posOffset: Vec3 = new Vec3();//起点和终点的向量差
    private posStart: Vec3 = new Vec3();//起点
    private endCb: Function = null!;//到达目标位置后的回调函数
    private attackTarget: Fighter = null!;//攻击的敌人（的脚本）
    private ndTrail: Node = null!;//拖尾节点
    private rotateCoolTime: number = 0;//旋转角度的冷却时间
    private _targetPos: Vec3 = new Vec3();//当前目标位置
    private _nextTargetPos: Vec3 = new Vec3();//下次目标位置

    onLoad() {

    }

    start() {
        // Your initialization goes here.
    }

    /**
     * 重置武器数据
     */
    public reset() {
        this.endCb = null!;
        this.totalTime = 0;
        this.currentTime = 0;
        this.posStart = null!;
        this.posOffset = null!;
        this.maxHeight = 0;
        this.node.setScale(1, 1, 1);

        if (this.ndTrail) {
            PoolManager.instance.putNode(this.ndTrail);
            this.ndTrail = null!;
        }
    }

    /**
     * 向敌人投掷武器
     * @param posEnd 目标敌人位置
     * @param speed 投掷速度
     * @param attackTarget 攻击的敌人(的脚本)
     * @param endCb 
     */
    public throwMissile(posEnd: Vec3, speed: number, attackTarget: Fighter, endCb: Function) {

        //如果是飞行物，先缩小至0.3单位问题
        this.node.setScale(0.5, 0.5, 0.5);
        this.rotateCoolTime = 0;

        //计算出飞行路径
        this.posStart.set(this.node.worldPosition);
        this.posOffset.set(posEnd).subtract(this.node.worldPosition);
        this.totalTime = this.posOffset.length() / speed;
        this.currentTime = 0;
        this.maxHeight = this.totalTime * 5;
        this.endCb = endCb;
        this.attackTarget = attackTarget;

        //如果武器有拖尾特效则展示出来
        if (this.pfTrail) {
            if (this.ndTrail) {
                PoolManager.instance.putNode(this.ndTrail);
                this.ndTrail = null!;
            }

            this.ndTrail = PoolManager.instance.getNode(this.pfTrail, this.node);
            let particle = this.ndTrail.getComponent(ParticleSystemComponent);
            particle?.clear();
            particle?.stop();
            particle?.play();
        }
    }

    /**
     * 飞行结束时触发
     */
    private _onFlyOver() {
        this.endCb && this.endCb(this.attackTarget);
        this.endCb = null!;
        this.attackTarget = null!;

        if (this.ndTrail) {
            PoolManager.instance.putNode(this.ndTrail);
            this.ndTrail = null!;
        }

        PoolManager.instance.putNode(this.node);
    }

    update(deltaTime: number) {
        // Your update function goes here.
        if (this.totalTime <= 0) {
            return;
        }

        if (this.currentTime < this.totalTime) {
            this.currentTime += deltaTime;

            if (this.currentTime > this.totalTime) {
                this.currentTime = this.totalTime;
            }

            //百分比
            let percent = Number((this.currentTime / this.totalTime).toFixed(2));

            //目标高度
            let height = this.maxHeight * Math.cos(percent * Math.PI - Math.PI / 2);

            //设置目标位置
            this._targetPos.set(this.posStart.x + this.posOffset.x * percent, this.posStart.y + height, this.posStart.z + this.posOffset.z * percent);

            //设置武器位置
            this.node.setWorldPosition(this._targetPos);

            if (this.isAutoRotate) {
                this.rotateCoolTime -= deltaTime;
                if (this.rotateCoolTime < 0) {
                    this.rotateCoolTime = 0.1;

                    percent = Number(((this.currentTime + 0.1) / this.totalTime).toFixed(2));
                    if (percent < 1) {

                        //下一个目标位置的高度 
                        height = this.maxHeight * Math.cos(percent * Math.PI - Math.PI / 2);

                        //下一个目标位置
                        this._nextTargetPos.set(this.posStart.x + this.posOffset.x * percent, this.posStart.y + height, this.posStart.z + this.posOffset.z * percent)

                        //武器朝向下一个目标位置, 形成曲线飞行的感觉
                        this.node.forward = this._nextTargetPos.subtract(this._targetPos).normalize().negative();
                    }
                }
            }

            if (percent >= 1) {
                //表示达到目标
                this._onFlyOver();
            }
        }
    }
}
