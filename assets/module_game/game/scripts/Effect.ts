import { _decorator, Component, AnimationComponent, ParticleSystemComponent, Enum } from "cc";
const { ccclass, property } = _decorator;
//特效、动画播放脚本: 该脚本挂在节点上

//美术特效类型
const EFFECT_TYPE = Enum({
    ANIMATION: 0, //动画
    PARTICLE: 1, //粒子特效
    SPINE: 2, //骨骼动画
});

@ccclass("Effect")
export class Effect extends Component {
    @property({ type: EFFECT_TYPE })
    public effectType = EFFECT_TYPE.ANIMATION; //特效类型

    @property({ type: AnimationComponent })
    public ani: AnimationComponent = null!; //动画组件

    @property({
        displayName: "持续时间",
        tooltip: "到达指定时间后会自动移除该特效",
    })
    public keepTime: number = -1;

    @property({ displayName: "自动销毁", tooltip: "是否自动销毁" })
    public autoDestroy = true;

    @property({
        displayName: "是否自动播放",
        tooltip: "是否在允许游戏后自动播放",
    })
    public playOnStart = true;

    private _endListenerCb: Function = null!; //特效播放完后的回调函数
    private _arrParticle: ParticleSystemComponent[] | null = null; //粒子组件缓存（节点回池后子树不变，避免每次 getComponentsInChildren 分配）
    private _arrAni: AnimationComponent[] | null = null; //动画组件缓存

    start() {
        if (this.playOnStart) {
            this.play();
        }
        // if (this.ani) {
        //     this.keepTime = this.ani.clips[0]?.duration || -1;
        // }
    }

    /**
     * 手动控制播放，默认是自动播放，不需要手动控制
     *
     */
    public play() {
        //节点来自对象池时，必须清掉上一次生命周期残留的定时器：
        //否则旧定时器会在新一次播放过程中触发 effectOver，把正在使用的节点回收进池
        //（注意：这里不能清 _endListenerCb，win01/hitBoom01 的 playOnStart 为 true，
        //  start() 会在调用方 setEndListener 之后再调一次 play()，清掉会丢回调）
        this.unscheduleAllCallbacks();

        if (!this._arrParticle) {
            this._arrParticle = this.node.getComponentsInChildren(ParticleSystemComponent);
        }
        this._arrParticle.forEach((particle: ParticleSystemComponent) => {
            particle.clear();
            particle.stop();
            particle.play();
        });

        if (!this._arrAni) {
            this._arrAni = this.node.getComponentsInChildren(AnimationComponent);
        }
        this._arrAni.forEach((ani: AnimationComponent) => {
            ani.play();
        });

        if (this.keepTime > 0) {
            //表示要持续一个时间后删除该特效
            this.scheduleOnce(() => {
                this.effectOver();
            }, this.keepTime);
        }
    }

    /**
     * 特效播放完后调用
     */
    public effectOver() {
        if (this.autoDestroy) {
            this.node.destroy();
        }

        //取出后置空：保证“播放结束回调”最多只触发一次，
        //否则同一个节点会被重复 putNode（对象池里出现同一个节点的多份引用）
        let endCb = this._endListenerCb;
        this._endListenerCb = null!;
        endCb && endCb();
    }

    /**
     * 设置特效播放完后的回调函数
     */
    public setEndListener(cb: Function) {
        this._endListenerCb = cb;
    }
}
