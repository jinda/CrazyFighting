import {
  _decorator,
  Component,
  AnimationComponent,
  ParticleSystemComponent,
  Enum,
} from "cc";
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

  start() {
    if (this.playOnStart) {
      this.play();
    }
  }

  /**
   * 手动控制播放，默认是自动播放，不需要手动控制
   *
   */
  public play() {
    let arrParticle = this.node.getComponentsInChildren(
      ParticleSystemComponent,
    );
    arrParticle.forEach((particle: ParticleSystemComponent) => {
      particle.clear();
      particle.stop();
      particle.play();
    });

    let arrAni = this.node.getComponentsInChildren(AnimationComponent);
    arrAni.forEach((ani) => {
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

    this._endListenerCb && this._endListenerCb();
  }

  /**
   * 设置特效播放完后的回调函数
   */
  public setEndListener(cb: Function) {
    this._endListenerCb = cb;
  }
}
