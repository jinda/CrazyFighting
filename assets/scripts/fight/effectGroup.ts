import { ResourceUtil } from "./../framework/resourcesUtils";
import { _decorator, Component, Vec3, instantiate, Prefab } from "cc";
import { Effect } from "./effect";
import { PoolManager } from "../framework/poolManager";
const { ccclass } = _decorator;
//管理特效播放脚本
@ccclass("effectGroup")
export class effectGroup extends Component {
    /* class member could be defined like this */
    // dummy = '';

    /* use `property` decorator if your want the member to be serializable */
    // @property
    // serializableDummy = 0;

    start() {
        // Your initialization goes here.
    }

    /**
     * 播放被击中的特效
     * @param posWorld
     * @param endCb
     */
    public playChairEffect(posWorld: Vec3, endCb?: Function) {
        ResourceUtil.getEffectPrefab("hit01", (err: any, pf: Prefab) => {
            if (err) {
                console.error("get effect failed:", err);
                return;
            }
            let ndEffect = PoolManager.instance.getNode(pf, this.node);

            posWorld.y = 0.1;
            ndEffect.setWorldPosition(posWorld);

            let effect = ndEffect.getComponent(Effect);

            effect.play();

            effect.setEndListener(() => {
                PoolManager.instance.putNode(ndEffect);

                endCb && endCb();
            });
        });
    }

    /**
     * 播放大火球落地特效
     * @param posWorld
     * @param scale
     */
    public playBombEffect(posWorld: Vec3, scale: number = 1) {
        ResourceUtil.getEffectPrefab("hitBoom01", (err: any, pf: Prefab) => {
            if (err) {
                console.error("get effect failed:", err);
                return;
            }
            let ndEffect = PoolManager.instance.getNode(pf, this.node);
            ndEffect.setScale(scale, scale, scale);

            ndEffect.setWorldPosition(posWorld);

            let effect = ndEffect.getComponent(Effect);

            effect.play();

            effect.setEndListener(() => {
                PoolManager.instance.putNode(ndEffect);
            });
        });
    }

    /**
     * 播放大火球特效
     * @param posWorld
     * @param callback
     */
    public playFireBallEffect(posWorld: Vec3, callback: Function) {
        ResourceUtil.getEffectPrefab("fireBall01", (err: any, pf: Prefab) => {
            if (err) {
                console.error("get effect failed:", err);
                return;
            }

            let ndEffect = instantiate(pf);
            ndEffect.parent = this.node;
            ndEffect.setWorldPosition(posWorld);

            let effect = ndEffect.getComponent(Effect) as Effect;

            effect.play();

            effect.setEndListener(() => {
                this.playBombEffect(posWorld, 2);
                ndEffect.destroy();
                callback && callback();
            });
        });
    }

    /**
     * 播放胜利特效
     * @param posWorld
     * @param callback
     */
    public playWinEffect(posWorld: Vec3, callback: Function) {
        ResourceUtil.getEffectPrefab("win01", (err: any, pf: Prefab) => {
            if (err) {
                console.error("get effect failed:", err);
                return;
            }

            let ndEffect = instantiate(pf);
            ndEffect.parent = this.node;
            ndEffect.setWorldPosition(posWorld);

            let effect = ndEffect.getComponent(Effect) as Effect;

            effect.play();

            effect.setEndListener(() => {
                ndEffect.destroy();

                callback && callback();
            });
        });
    }

    // update (deltaTime: number) {
    //     // Your update function goes here.
    // }
}
