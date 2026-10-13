import { _decorator, Component, Vec3, instantiate, Prefab, Node, isValid } from "cc";
import { ModuleDef } from "db://assets/scripts/ModuleDef";
import { Effect } from "./Effect";
import { PlatformMgr } from "db://assets/scripts/SDK/PlatformMgr";
import { GameMgr } from "./GameMgr";
const { ccclass } = _decorator;
//管理特效播放脚本
@ccclass("EffectGroup")
export class EffectGroup extends Component {
    /**
     * 播放特定节点的特效
     * @param posWorld
     * @param endCb
     */
    public playEffect(
        effect: string,
        parent: Node,
        pos: Vec3,
        endCb?: () => void,
        loadCb?: (node: Node) => void,
        ownerValid?: () => boolean,
    ) {
        // egf.Logger.log("playEffect:", effect);
        const battleGeneration = GameMgr.battleGeneration;
        egf.ResMgr.getAsset(ModuleDef.GAME, `game/prefabs/effect/${effect}`, (pf: Prefab) => {
            if (!this._isRequestValid(battleGeneration, parent, ownerValid)) {
                return;
            }
            const ndEffect = egf.PoolMgr.getNode(pf, parent);

            ndEffect.position = pos;

            const effectComponent = ndEffect.getComponent(Effect);
            if (!effectComponent) {
                egf.Logger.warn("[EffectGroup] 特效节点缺少 Effect 组件:", effect);
                egf.PoolMgr.putNode(ndEffect);
                return;
            }
            effectComponent.setEndListener(() => {
                if (isValid(ndEffect)) {
                    egf.PoolMgr.putNode(ndEffect);
                }

                if (this._isRequestValid(battleGeneration, parent, ownerValid)) {
                    endCb?.();
                }
            });
            effectComponent.play();
            loadCb?.(ndEffect);
        });
    }

    /**
     * 播放被击中的特效
     * @param posWorld
     * @param endCb
     */
    public playChairEffect(effect: string, posWorld: Vec3, endCb?: () => void) {
        // egf.Logger.log("playChairEffect:", effect);
        const battleGeneration = GameMgr.battleGeneration;
        const actualPosition = posWorld.clone();
        actualPosition.y = 0.1;
        egf.ResMgr.getAsset(ModuleDef.GAME, `game/prefabs/effect/${effect}`, (pf: Prefab) => {
            if (!this._isRequestValid(battleGeneration, this.node)) {
                return;
            }
            const ndEffect = egf.PoolMgr.getNode(pf, this.node);

            ndEffect.setWorldPosition(actualPosition);

            const effectComponent = ndEffect.getComponent(Effect);
            if (!effectComponent) {
                egf.Logger.warn("[EffectGroup] 受击特效节点缺少 Effect 组件:", effect);
                egf.PoolMgr.putNode(ndEffect);
                return;
            }
            effectComponent.setEndListener(() => {
                if (isValid(ndEffect)) {
                    egf.PoolMgr.putNode(ndEffect);
                }

                if (this._isRequestValid(battleGeneration, this.node)) {
                    endCb?.();
                }
            });
            effectComponent.play();
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
        const battleGeneration = GameMgr.battleGeneration;
        const actualPosition = posWorld.clone();
        egf.ResMgr.getAsset(ModuleDef.GAME, "game/prefabs/effect/hitBoom01", (pf: Prefab) => {
            if (!this._isRequestValid(battleGeneration, this.node)) {
                return;
            }
            const ndEffect = egf.PoolMgr.getNode(pf, this.node);
            ndEffect.setScale(scale, scale, scale);

            ndEffect.setWorldPosition(actualPosition);

            const effectComponent = ndEffect.getComponent(Effect);
            if (!effectComponent) {
                egf.Logger.warn("[EffectGroup] 爆炸特效节点缺少 Effect 组件");
                egf.PoolMgr.putNode(ndEffect);
                return;
            }
            effectComponent.setEndListener(() => {
                if (isValid(ndEffect)) {
                    egf.PoolMgr.putNode(ndEffect);
                }
            });
            effectComponent.play();
        });
    }

    /**
     * 播放大火球特效
     * @param posWorld
     * @param callback
     */
    public playFireBallEffect(posWorld: Vec3, callback: () => void) {
        const battleGeneration = GameMgr.battleGeneration;
        const actualPosition = posWorld.clone();
        egf.ResMgr.getAsset(ModuleDef.GAME, "game/prefabs/effect/fireBall01", (pf: Prefab) => {
            if (!this._isRequestValid(battleGeneration, this.node)) {
                return;
            }
            const ndEffect = instantiate(pf);
            ndEffect.parent = this.node;
            ndEffect.setWorldPosition(actualPosition);

            const effectComponent = ndEffect.getComponent(Effect);
            if (!effectComponent) {
                egf.Logger.warn("[EffectGroup] 火球特效节点缺少 Effect 组件");
                ndEffect.destroy();
                return;
            }
            effectComponent.setEndListener(() => {
                const isCurrentBattle = this._isRequestValid(battleGeneration, this.node);
                if (isCurrentBattle) {
                    this.playBombEffect(actualPosition, 2);
                }
                if (isValid(ndEffect)) {
                    ndEffect.destroy();
                }
                if (isCurrentBattle) {
                    callback();
                }
            });
            effectComponent.play();
        });
    }

    /**
     * 播放胜利特效
     * @param posWorld
     * @param callback
     */
    public playWinEffect(posWorld: Vec3, callback: () => void) {
        const battleGeneration = GameMgr.battleGeneration;
        const actualPosition = posWorld.clone();
        egf.ResMgr.getAsset(ModuleDef.GAME, "game/prefabs/effect/win01", (pf: Prefab) => {
            if (!this._isRequestValid(battleGeneration, this.node)) {
                return;
            }
            const ndEffect = instantiate(pf);
            ndEffect.parent = this.node;
            ndEffect.setWorldPosition(actualPosition);

            const effectComponent = ndEffect.getComponent(Effect);
            if (!effectComponent) {
                egf.Logger.warn("[EffectGroup] 胜利特效节点缺少 Effect 组件");
                ndEffect.destroy();
                return;
            }
            effectComponent.setEndListener(() => {
                if (isValid(ndEffect)) {
                    ndEffect.destroy();
                }

                if (this._isRequestValid(battleGeneration, this.node)) {
                    callback();
                }
            });
            effectComponent.play();
        });
    }

    private _isRequestValid(battleGeneration: number, parent: Node, ownerValid?: () => boolean) {
        return (
            battleGeneration === GameMgr.battleGeneration &&
            isValid(this.node) &&
            isValid(parent) &&
            (ownerValid ? ownerValid() : true)
        );
    }
}
