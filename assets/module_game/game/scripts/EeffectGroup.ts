import { _decorator, Component, Vec3, instantiate, Prefab, Node } from "cc";
import { ModuleDef } from "db://assets/scripts/ModuleDef";
import { Effect } from "./Effect";
import { PlatformMgr } from "db://assets/scripts/SDK/PlatformMgr";
const { ccclass } = _decorator;
//管理特效播放脚本
@ccclass("EffectGroup")
export class EffectGroup extends Component {
    /**
     * 播放特定节点的特效
     * @param posWorld
     * @param endCb
     */
    public playEffect(effect: string, parent: Node, pos: Vec3, endCb?: Function, loadCb?: (node: Node) => void) {
        // egf.Logger.log("playEffect:", effect);
        egf.ResMgr.getAsset(ModuleDef.GAME, `game/prefabs/effect/${effect}`, (pf: Prefab) => {
            const ndEffect = egf.PoolMgr.getNode(pf, parent);

            ndEffect.position = pos;

            const effect = ndEffect.getComponent(Effect);
            effect?.play();
            effect?.setEndListener(() => {
                egf.PoolMgr.putNode(ndEffect);

                endCb && endCb();
            });
            loadCb && loadCb(ndEffect);
        });
    }

    /**
     * 播放被击中的特效
     * @param posWorld
     * @param endCb
     */
    public playChairEffect(effect: string, posWorld: Vec3, endCb?: Function) {
        // egf.Logger.log("playChairEffect:", effect);
        egf.ResMgr.getAsset(ModuleDef.GAME, `game/prefabs/effect/${effect}`, (pf: Prefab) => {
            const ndEffect = egf.PoolMgr.getNode(pf, this.node);

            posWorld.y = 0.1;
            ndEffect.setWorldPosition(posWorld);

            const effect = ndEffect.getComponent(Effect);
            effect?.play();
            effect?.setEndListener(() => {
                egf.PoolMgr.putNode(ndEffect);

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
        //振动
        PlatformMgr.vibrate(100);
        egf.ResMgr.getAsset(ModuleDef.GAME, "game/prefabs/effect/hitBoom01", (pf: Prefab) => {
            const ndEffect = egf.PoolMgr.getNode(pf, this.node);
            ndEffect.setScale(scale, scale, scale);

            ndEffect.setWorldPosition(posWorld);

            const effect = ndEffect.getComponent(Effect);
            effect?.play();
            effect?.setEndListener(() => {
                egf.PoolMgr.putNode(ndEffect);
            });
        });
    }

    /**
     * 播放大火球特效
     * @param posWorld
     * @param callback
     */
    public playFireBallEffect(posWorld: Vec3, callback: Function) {
        egf.ResMgr.getAsset(ModuleDef.GAME, "game/prefabs/effect/fireBall01", (pf: Prefab) => {
            const ndEffect = instantiate(pf);
            ndEffect.parent = this.node;
            ndEffect.setWorldPosition(posWorld);

            const effect = ndEffect.getComponent(Effect);
            effect?.play();
            effect?.setEndListener(() => {
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
        egf.ResMgr.getAsset(ModuleDef.GAME, "game/prefabs/effect/win01", (pf: Prefab) => {
            const ndEffect = instantiate(pf);
            ndEffect.parent = this.node;
            ndEffect.setWorldPosition(posWorld);

            const effect = ndEffect.getComponent(Effect);
            effect?.play();
            effect?.setEndListener(() => {
                ndEffect.destroy();

                callback && callback();
            });
        });
    }
}
