import { ResourceUtil } from './../framework/resourcesUtils';
import { _decorator, Component, Node, Vec3, AnimationComponent, ParticleSystemComponent, Prefab } from "cc";
import { FighterManager } from "./fighterManager";
import Constants from "../framework/constants";
import { GameLogic } from "../framework/gameLogic";
import { Effect } from "./effect";
import { PoolManager } from "../framework/poolManager";
import { localConfig } from '../framework/localConfig';
const { ccclass, property } = _decorator;
//格子/土地节点脚本
@ccclass("FormationCell")
export class FormationCell extends Component {
    @property(Node)
    public ndCell: Node = null!;//格子节点

    @property(Node)
    public ndSelect: Node = null!;//格子被选中节点

    public pos: number = 0;//格子索引
    public fighterId: number = 0;//士兵编号/种类
    public aryIdentity: any = [];//当前格子上的士兵唯一标识的数组

    //设置是否展示“选择提示”特效
    public set select (isSelect) {
        this._select = isSelect;
        this.ndSelect.active = isSelect;
    }

    //获取是否选择
    public get select () {
        return this._select;
    }

    private _ndSimilar: Node = null!;//“提示可以与其他士兵合成”的特效
    private _team: number = 0;//队伍
    private _manager: FighterManager = null!;//“管理所有士兵”的脚本
    private _isShowSimilar: boolean = false;//是否有与格子上士兵相同的士兵/格子上的士兵是否可以合成
    private _select: boolean = false;//是否被选中
    private _similarPos: Vec3 = new Vec3(0, 0.1, 0);//“合并提示特效”位置
    private _sprintPos: Vec3 = new Vec3(0, 0.1, 0);//“冲刺暴走特效”位置
    private _combinePos: Vec3 = new Vec3(0, 0.1, 0);//“合并成功特效”位置
    private _cellPos1: Vec3 = new Vec3();//临时变量，格子位置
    private _cellPos2: Vec3 = new Vec3();//临时变量，格子位置

    start () {
        // Your initialization goes here.
    }

    /**
     * 格子初始化
     * @param pos 
     * @param team 
     * @param fighterId 
     * @param manager 
     * @returns 
     */
    public init (pos: number, team: number, fighterId: number, manager: FighterManager) {
        this.pos = pos;
        this._team = team;
        this.fighterId = Number(fighterId);
        this._manager = manager;

        this.showSimilar(false);

        this.ndCell.active = team === Constants.PLAYER_TEAM;

        //设置格子坐标
        let x = 10*(team === 1?-1:1) + Math.floor(pos / 5) * (team === 1? -1.5: 1.5);
        let y = (pos % 5)*1.5 - 2*1.5;
        this.node.setWorldPosition(x, 0, y);

        if (!fighterId) {
            //空位
            return;
        }

        this.updateFighter(fighterId);
    }
    
    /**
     * 回收格子节点
     */
    public recycle () {
        this.fighterId = 0;
        this.aryIdentity = [];

        PoolManager.instance.putNode(this.node);
    }
    
    /**
     * 更新格子上的士兵
     *
     * @param {number} fighterId
     * @returns
     * @memberof FormationCell
     */
    public updateFighter (fighterId: number) {
        //移除原来格子关联的士兵ID
        if (this.aryIdentity.length > 0) {
            this.aryIdentity.forEach((identity: any)=>{
                this._manager.removeFighter(identity);
            });

            this.aryIdentity = [];
        }

        this.fighterId = fighterId;

        if (this.fighterId <= 0) {
            //如果是0，则置空，无需再操作
            return;
        }

        let fighterInfo = localConfig.instance.queryByID('fighter', fighterId.toString());
        let num = fighterInfo['num'];

        this._cellPos1.set(this.node.worldPosition);

        let arrPos = GameLogic.getFighterPosByNum(this._cellPos1, num);
        arrPos.forEach((fighterPos)=>{
            let identity = this._manager.addFighter(this._team, fighterPos, fighterInfo, this.pos);
            this.aryIdentity.push(identity);
        });
    }

    /**
     * 检察触摸点是否落在格子内
     * @param pos 
     * @returns 
     */
    public checkIsHit (pos: Vec3) {
        this._cellPos2.set(this.node.worldPosition);

        let halfWidth = 0.75; //1.5 的一半
        let halfHeight = 0.75;

        return (this._cellPos2.x - halfWidth <= pos.x &&
            this._cellPos2.x + halfWidth >= pos.x &&
            this._cellPos2.z - halfHeight <= pos.z &&
            this._cellPos2.z + halfHeight >= pos.z);
    }

    /**
     * 展示或者关闭合成提示特效
     *
     * @param {boolean} isShow 
     * @memberof FormationCell
     */
    public showSimilar (isShow: boolean) {
        this._isShowSimilar = isShow;
        
        if (this._isShowSimilar) {
            if (!this._ndSimilar) {
                ResourceUtil.getEffectPrefab('upLoop01', (err: any, pf: Prefab)=>{
                    if (!this.node.activeInHierarchy) {
                        return;
                    }

                    if (this._isShowSimilar && !this._ndSimilar) {
                        this._ndSimilar = PoolManager.instance.getNode(pf, this.node);
                        this._similarPos.set(0, 0.1, 0);
                        this._ndSimilar.position = this._similarPos;
                        let particle = this._ndSimilar.getComponentInChildren(ParticleSystemComponent);
                        particle?.play();
                    }
                });
            }
            
        } else if (this._ndSimilar) {
            let particle = this._ndSimilar.getComponentInChildren(ParticleSystemComponent);
            particle?.clear();
            particle?.stop();
            PoolManager.instance.putNode(this._ndSimilar);
            this._ndSimilar = null!;
        }
    }

    /**
     * 展示合并成功特效
     */
    public showCombineSucceed () {
        ResourceUtil.getEffectPrefab(`upClick`, (err: any, pf: Prefab)=>{
            if (!this.node.activeInHierarchy) {
                return;
            }

            let nodeCombine = PoolManager.instance.getNode(pf, this.node);
            this._combinePos.set(0, 0.1, 0);
            nodeCombine.position = this._combinePos;

            let particle = nodeCombine.getComponentInChildren(ParticleSystemComponent);
            particle.clear();
            particle.play();

            let ani = nodeCombine.getComponent(AnimationComponent);
            ani.play();
            ani.once('finished', ()=>{
                PoolManager.instance.putNode(nodeCombine);
            });
        });
    }

    /**
     * 格子上展示冲刺暴走特效
     */
    public showSprint () {
        ResourceUtil.getEffectPrefab(`goBallistic01`, (err: any, pf: Prefab)=>{
            if (err) {
                return;
            }

            if (!this.node.activeInHierarchy) {
                return;
            }

            let nodeSprint = PoolManager.instance.getNode(pf, this.node);
            this._sprintPos.set(0, 0.1, 0);
            nodeSprint.position = this._sprintPos;

            let effect = nodeSprint.getComponent(Effect);
            effect.play();
            effect.setEndListener(()=>{
                PoolManager.instance.putNode(nodeSprint);
            });
        });
    }

    // update (deltaTime: number) {
    //     // Your update function goes here.
    // }
}
