import {
    _decorator,
    Component,
    Node,
    Material,
    SkeletalAnimation,
    Prefab,
    AnimationComponent,
    SkinnedMeshRenderer,
    MeshRenderer,
    CCBoolean,
    type Vec3,
} from "cc";
import type { Fighter } from "./Fighter";
import { Constants } from "db://assets/scripts/Constants";
import { Weapon } from "./Weapon";
import { GameMgr } from "./GameMgr";

const { ccclass, property } = _decorator;

@ccclass("FighterModel")
export class FighterModel extends Component {
    @property([SkinnedMeshRenderer])
    public models: SkinnedMeshRenderer[] = []; //蒙皮网格渲染器组件
    @property([MeshRenderer])
    public msrs: MeshRenderer[] = []; //蒙皮网格渲染器组件

    @property([Material])
    public aryMaterial: Material[] = []; //材质皮肤数组

    @property(Node)
    public nodeWeapon: Node = null!; //右手节点
    @property(Node)
    public nodeShield: Node = null!; //左手节点

    @property(Node)
    public ndHead: Node = null!; //头部节点

    @property(SkeletalAnimation)
    public ani: SkeletalAnimation = null!; //骨骼动画组件

    @property(Prefab)
    public pfThrowWeapon: Prefab = null!; //可以丢弃的武器预制体
    @property(CCBoolean)
    public bThrowWeapon: boolean = false; //可以丢弃的武器本体

    private _cb: (() => void) | null = null; //攻击后的回调函数
    private _target: Fighter | null = null; //士兵对应的fighter脚本
    private _animationFinishedCallback: (() => void) | null = null;
    private _animationFinishedTarget: object | null = null;
    private _currentAni: string = ""; //当前动画名称
    private _crownGeneration: number = 0; //皇冠异步加载代次：每次 show()/reset() 递增，防止模型复用后旧皇冠挂到新角色
    private _isBattlePaused: boolean = false;

    start() {
        // Your initialization goes here.
    }

    /**
     * 模型回池前重置：使未完成的异步加载（如皇冠）失效，
     * 防止模型在对象池中等待复用期间被旧回调写入状态
     */
    public reset() {
        this._crownGeneration++;
        this._clearAnimationFinishedListener();
        this._cb = null;
        this._target = null;
        this._currentAni = "";
        this._isBattlePaused = false;
        this.ani.stop();
        if (this.bThrowWeapon && this.nodeWeapon) {
            this.nodeWeapon.active = true;
        }
    }

    /**
     * 展示士兵模型
     * @param fighter
     */
    public show(team: number, color: number, crown?: number) {
        this._crownGeneration++; //新一轮展示，使上一次未完成的皇冠加载失效

        let idxMaterial = 0;
        if (team === Constants.PLAYER_TEAM) {
            idxMaterial = color;
        } else {
            //皮肤二
            idxMaterial = 0;
        }
        this.models.forEach((model) => {
            model.material = this.aryMaterial[idxMaterial];
        });
        this.msrs.forEach((msr) => {
            msr.material = this.aryMaterial[idxMaterial];
        });

        this.ndHead.active = !!crown;

        this.updateAniSpeed();

        this.playAniByIdx(Constants.ANI_TYPE.IDLE);
    }

    /**
     * 设置特效播放完后执行的回调函数
     * @param cb 回调函数
     * @param target 目标
     */
    public setEffectListener(cb: () => void, target: Fighter) {
        this._cb = cb;
        this._target = target;
    }

    /**
     * attack动画帧事件
     */
    public triggerEffect() {
        if (this._isBattlePaused || !this._cb || !this._target) {
            return;
        }
        this._cb.apply(this._target);
    }

    /**
     * 监听士兵当前是否播放完动画（attack）
     *
     * @param {Function} callback
     * @param {Object} targe
     * @memberof FighterModel
     */
    public onceAniFinished(callback: () => void, target: object) {
        this._clearAnimationFinishedListener();
        this._animationFinishedCallback = () => {
            this._animationFinishedCallback = null;
            this._animationFinishedTarget = null;
            callback();
        };
        this._animationFinishedTarget = target;
        this.ani.once(AnimationComponent.EventType.FINISHED, this._animationFinishedCallback, target);
    }

    private _clearAnimationFinishedListener() {
        if (this._animationFinishedCallback && this._animationFinishedTarget) {
            this.ani.off(
                AnimationComponent.EventType.FINISHED,
                this._animationFinishedCallback,
                this._animationFinishedTarget,
            );
        }
        this._animationFinishedCallback = null;
        this._animationFinishedTarget = null;
    }

    public setBattlePaused(paused: boolean) {
        if (this._isBattlePaused === paused) {
            return;
        }
        this._isBattlePaused = paused;
        if (paused) {
            this.ani.pause();
        } else {
            this.ani.resume();
        }
    }

    /**
     * 攻击动画
     */
    public playAttack() {
        this.playAniByIdx(Constants.ANI_TYPE.ATTACK, false);
    }

    /**
     * 播放士兵动画
     * @param aniName 动画名称
     * @param isSkipWhenCurrentPlay 是否结束当前正在播放的相同的动画
     * @returns
     */
    public playAni(aniName: string, isSkipWhenCurrentPlay: boolean = false) {
        if (isSkipWhenCurrentPlay && this._currentAni === aniName) {
            return;
        }

        this._currentAni = aniName;
        this.ani.play(aniName);
    }
    /**
     * 播放士兵动画
     * @param idx 动画下标
     * @param isSkipWhenCurrentPlay 是否结束当前正在播放的相同的动画
     * @returns
     */
    public playAniByIdx(idx: number, isSkipWhenCurrentPlay: boolean = false) {
        const aniName = this.ani.clips[idx]?.name;
        if ((isSkipWhenCurrentPlay && this._currentAni === aniName) || !aniName) {
            return;
        }

        this._currentAni = aniName;

        this.ani.play(aniName);
    }

    /**
     * 展示手中的武器，远程兵在扔武器的时候会先隐藏手中的武器，扔完后再展示手中的武器
     */
    public showHandWeapon() {
        if (this.bThrowWeapon && this.nodeWeapon && !this.nodeWeapon.active) {
            this.nodeWeapon.active = true;
        }
    }

    /**
     * 在士兵手上生成武器，并向敌人扔该武器
     * @param callback
     */
    public throwWeapon(
        parent: Node,
        attacker: Fighter,
        target: Fighter,
        callback: (target: Fighter, hitPosition: Vec3) => void,
    ) {
        if (!this.pfThrowWeapon) {
            egf.Logger.error("throwWeapon error no prefab!");
            return;
        }
        const ndThrow = egf.PoolMgr.getNode(this.pfThrowWeapon, parent!);
        ndThrow.setWorldPosition(this.nodeWeapon.worldPosition);
        ndThrow.setWorldRotation(this.nodeWeapon.worldRotation);
        const posTarget = target.node.worldPosition.clone();
        const weapon = ndThrow.getComponent(Weapon);

        if (!weapon) {
            egf.Logger.error("throwWeapon error no Weapon component!");
            egf.PoolMgr.putNode(ndThrow);
            return;
        }

        //隐藏手中的武器
        if (this.bThrowWeapon) {
            this.nodeWeapon.active = false;
        }
        weapon.throwMissile(posTarget, 10 * GameMgr.timeScale, attacker, target, callback);
    }

    /**
     * 更新士兵动画速度
     */
    public updateAniSpeed() {
        const aryClips = this.ani.clips;
        aryClips.forEach((clip: any) => {
            clip.speed = GameMgr.timeScale;
        });
    }
}
