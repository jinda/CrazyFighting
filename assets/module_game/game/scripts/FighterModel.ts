import {
    _decorator,
    Component,
    Node,
    Material,
    SkeletalAnimation,
    Prefab,
    AnimationComponent,
    isValid,
    SkinnedMeshRenderer,
} from "cc";
import { Fighter } from "./Fighter";
import { Constants } from "db://assets/scripts/Constants";
import { Missile } from "./Missile";
import { ModuleDef } from "db://assets/scripts/ModuleDef";

const { ccclass, property } = _decorator;

@ccclass("FighterModel")
export class FighterModel extends Component {
    @property(SkinnedMeshRenderer)
    public model: SkinnedMeshRenderer = null!; //蒙皮网格渲染器组件

    @property([Material])
    public aryMaterial: Material[] = []; //材质皮肤数组

    @property(Node)
    public nodeWeapon: Node = null!; //右手节点

    @property(Node)
    public ndHead: Node = null!; //头部节点

    @property(SkeletalAnimation)
    public ani: SkeletalAnimation = null!; //骨骼动画组件

    @property(Prefab)
    public pfWeapon: Prefab = null!; //武器预制体

    private _cb: Function = null!; //攻击后的回调函数
    private _target: any = null!; //士兵对应的fighter脚本
    private _ndWeapon: Node = null!; //武器节点
    private _ndCrown: Node = null!; //皇冠节点
    private _currentAni: string = ""; //当前动画名称
    private _fighter: Fighter = null!; //该士兵绑定的fighter脚本
    private _crownGeneration: number = 0; //皇冠异步加载代次：每次 show()/reset() 递增，防止模型复用后旧皇冠挂到新角色

    start() {
        // Your initialization goes here.
    }

    /**
     * 模型回池前重置：使未完成的异步加载（如皇冠）失效，
     * 防止模型在对象池中等待复用期间被旧回调写入状态
     */
    public reset() {
        this._crownGeneration++;
    }

    /**
     * 展示士兵模型
     * @param fighter
     */
    public show(fighter: Fighter) {
        this._fighter = fighter;
        this._crownGeneration++; //新一轮展示，使上一次未完成的皇冠加载失效

        let idxMaterial = 0;
        if (fighter.team === Constants.PLAYER_TEAM) {
            if (fighter.fighterInfo.color === 1) {
                //皮肤三
                idxMaterial = 2;
            } else {
                //皮肤一
                idxMaterial = 1;
            }
        } else {
            //皮肤二
            idxMaterial = 0;
        }

        this.model.material = this.aryMaterial[idxMaterial];

        if (this._ndWeapon) {
            egf.PoolMgr.putNode(this._ndWeapon);
            this._ndWeapon = null!;
        }

        if (this._ndCrown) {
            egf.PoolMgr.putNode(this._ndCrown);
            this._ndCrown = null!;
        }

        //生成武器在右手
        if (this.pfWeapon) {
            this._ndWeapon = egf.PoolMgr.getNode(this.pfWeapon, this.nodeWeapon);

            // egf.Logger.log("pfWeapon:", this.pfWeapon.data);
            this._ndWeapon.position = this.nodeWeapon.position;
            this._ndWeapon.eulerAngles = this.nodeWeapon.eulerAngles;
            this._ndWeapon.active = true;

            let missile = this._ndWeapon.getComponent(Missile);
            if (missile) {
                missile.reset();
            }
        }

        //在头上生成皇冠
        if (fighter.fighterInfo.crown) {
            let path = "crown/crownWhite";

            if (this._fighter.fighterInfo.crown === 2) {
                path = "crown/crownGold";
            }

            //代次保护：模型被复用/重置后，迟到的加载结果直接丢弃，避免旧皇冠挂到新角色
            const crownGeneration = ++this._crownGeneration;
            egf.ResMgr.getAsset(ModuleDef.GAME, `game/prefabs/model/${path}`, (pf: Prefab) => {
                if (
                    crownGeneration !== this._crownGeneration ||
                    !isValid(this.node) ||
                    !isValid(this.ndHead) ||
                    !this._fighter ||
                    this._fighter.fighterInfo.crown !== fighter.fighterInfo.crown
                ) {
                    return;
                }

                this._ndCrown = egf.PoolMgr.getNode(pf, this.ndHead);
            });
        }

        this.updateAniSpeed();

        this.ani.play(Constants.ANI_TYPE.IDLE);
    }

    /**
     * 设置特效播放完后执行的回调函数
     * @param cb 回调函数
     * @param target 目标
     */
    public setEffectListener(cb: Function, target: any) {
        this._cb = cb;
        this._target = target;
    }

    /**
     * attack动画帧事件
     */
    public triggerEffect() {
        this._cb && this._cb.apply(this._target);
    }

    /**
     * 监听士兵当前是否播放完动画（attack）
     *
     * @param {Function} callback
     * @param {Object} targe
     * @memberof FighterModel
     */
    public onceAniFinished(callback: Function, target: Object) {
        this.ani.once(
            AnimationComponent.EventType.FINISHED,
            () => {
                callback();
            },
            target,
        );
    }

    /**
     * 攻击动画
     */
    public playAttack() {
        this.playAni(Constants.ANI_TYPE.ATTACK);
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
     * 展示手中的武器，远程兵在扔武器的时候会先隐藏手中的武器，扔完后再展示手中的武器
     */
    public showHandWeapon() {
        if (this._ndWeapon && !this._ndWeapon.active) {
            this._ndWeapon.active = true;
        }
    }

    /**
     * 在士兵手上生成武器，并向敌人扔该武器
     * @param callback
     */
    public throwWeapon(callback: Function) {
        let ndThrow = egf.PoolMgr.getNode(this.pfWeapon, this._fighter.node.parent!);
        ndThrow.setWorldPosition(this._ndWeapon.worldPosition);
        ndThrow.setWorldRotation(this._ndWeapon.worldRotation);
        let posTarget = this._fighter.target.node.worldPosition;
        let scriptMissile = ndThrow.getComponent(Missile) as Missile;
        scriptMissile.throwMissile(posTarget, 10 * this._fighter.timeScale, this._fighter.target, callback);

        //隐藏手中的武器
        this._ndWeapon.active = false;
    }

    /**
     * 更新士兵动画速度
     */
    public updateAniSpeed() {
        let aryClips = this.ani.clips;
        aryClips.forEach((clip: any) => {
            clip.speed = this._fighter.timeScale;
        });
    }
}
