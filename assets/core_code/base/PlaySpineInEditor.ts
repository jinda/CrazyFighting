/*******************************************************************************
 * 创建: 2024年09月15日
 * 作者: 水煮肉片饭
 * 版本: CocosCreator3.x
 * 描述: 编辑器预览Spine动画
 *******************************************************************************/
import * as cc from "cc";
import { EDITOR } from "cc/env";
EDITOR &&
    cc.game.once(cc.Game.EVENT_ENGINE_INITED, function () {
        cc.js.mixin(cc.js.getClassByName("sp.Skeleton").prototype, {
            updateAnimation(dt: number) {
                this.markForUpdateRenderData();
                if (this.paused) return;
                dt *= this._timeScale * 1.0;
                if (!this.isAnimationCached()) {
                    this._instance.updateAnimation(dt);
                    return;
                }
                if (!this._isAniComplete) {
                    this._updateCache(dt);
                    return;
                }
                if (this._animationQueue.length === 0 && !this._headAniInfo) {
                    const frameCache = this._animCache;
                    if (frameCache && frameCache.isInvalid()) {
                        frameCache.updateToFrame(0);
                        const frames = frameCache.frames;
                        this._curFrame = frames[frames.length - 1];
                    }
                } else {
                    this._headAniInfo ??= this._animationQueue.shift();
                    this._accTime += dt;
                    if (this._accTime > this._headAniInfo?.delay) {
                        const aniInfo = this._headAniInfo;
                        this._headAniInfo = null;
                        this.setAnimation(0, aniInfo?.animationName, aniInfo?.loop);
                    }
                }
            },
        });
    });
