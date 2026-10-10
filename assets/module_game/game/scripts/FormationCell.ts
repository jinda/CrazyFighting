import { _decorator, Component, Node, Vec3, Prefab, v3, ParticleSystemComponent } from "cc";
import { Constants } from "db://assets/scripts/Constants";
import { GameCfg } from "./GameConfig";
import { GameMgr } from "./GameMgr";
import { Fighter } from "./Fighter";

const { ccclass, property } = _decorator;
//格子/土地节点脚本
@ccclass("FormationCell")
export class FormationCell extends Component {
    @property(Prefab)
    public pfFighter: Prefab = null!; //士兵预制体

    @property(Node)
    public ndCell: Node = null!; //格子节点

    @property(Node)
    public ndSelect: Node = null!; //格子被选中节点

    public pos: number = 0; //格子索引
    public fighterId: number = 0; //士兵编号/种类
    public aryIdentity: number[] = []; //当前格子上的士兵唯一标识的数组

    //设置是否展示“选择提示”特效
    public set select(isSelect) {
        this._select = isSelect;
        this.ndSelect.active = isSelect;
    }

    //获取是否选择
    public get select() {
        return this._select;
    }

    private _ndSimilar: Node = null!; //“提示可以与其他士兵合成”的特效
    private _team: number = 0; //队伍
    private _isShowSimilar: boolean = false; //是否有与格子上士兵相同的士兵/格子上的士兵是否可以合成
    private _select: boolean = false; //是否被选中
    private _cellPos1: Vec3 = new Vec3(); //临时变量，格子位置
    private _cellPos2: Vec3 = new Vec3(); //临时变量，格子位置

    start() {
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
    public init(pos: number, team: number, fighterId: number) {
        this.pos = pos;
        this._team = team;
        this.fighterId = Number(fighterId);

        this.showSimilar(false);

        this.ndCell.active = team === Constants.PLAYER_TEAM;

        //设置格子坐标
        let x = 10 * (team === 1 ? -1 : 1) + Math.floor(pos / 5) * (team === 1 ? -1.5 : 1.5);
        let y = (pos % 5) * 1.5 - 2 * 1.5;
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
    public recycle() {
        this.fighterId = 0;
        this.aryIdentity = [];

        egf.PoolMgr.putNode(this.node);
    }

    /**
     * 更新格子上的士兵
     *
     * @param {number} fighterId
     * @returns 是否完成替换；创建失败时保留原士兵
     * @memberof FormationCell
     */
    public updateFighter(fighterId: number): boolean {
        const newIdentities: number[] = [];
        const newNodes: Node[] = [];

        //先完成新士兵创建，再替换旧士兵，避免创建异常导致格子和阵型数据不一致。
        if (fighterId > 0) {
            try {
                const fighterInfo = GameCfg.queryByID("fighter", fighterId.toString());
                if (!fighterInfo || !this.node.parent) {
                    egf.Logger.error("FormationCell updateFighter: missing config or parent", this.pos, fighterId);
                    return false;
                }

                this._cellPos1.set(this.node.worldPosition);
                const arrPos = GameMgr.getFighterPosByNum(this._cellPos1, fighterInfo.num);
                for (const fighterPos of arrPos) {
                    const ndFighter = egf.PoolMgr.getNode(this.pfFighter, this.node.parent);
                    //init 可能抛错，必须在注册前记录节点，才能回收未注册的半成品。
                    newNodes.push(ndFighter);
                    const identity = GameMgr.addFighter(ndFighter, this._team, fighterPos, fighterInfo, this.pos);
                    newIdentities.push(identity);
                }
            } catch (error) {
                //updateFighter 同时用于敌方初始化，按所属队伍清理本次创建的登记。
                for (const identity of newIdentities) {
                    GameMgr.removeFighter(identity, this._team);
                }
                for (const node of newNodes) {
                    const fighter = node.getComponent(Fighter);
                    if (fighter) {
                        fighter.recycle();
                    } else {
                        egf.PoolMgr.putNode(node);
                    }
                }
                egf.Logger.error("FormationCell updateFighter failed", this.pos, fighterId, error);
                return false;
            }
        }

        for (const identity of this.aryIdentity) {
            GameMgr.removeFighter(identity, this._team);
        }
        this.aryIdentity = newIdentities;
        this.fighterId = fighterId;
        return true;
    }

    /**
     * 检察触摸点是否落在格子内
     * @param pos
     * @returns
     */
    public checkIsHit(pos: Vec3) {
        this._cellPos2.set(this.node.worldPosition);

        let halfWidth = 0.75; //1.5 的一半
        let halfHeight = 0.75;

        return (
            this._cellPos2.x - halfWidth <= pos.x &&
            this._cellPos2.x + halfWidth >= pos.x &&
            this._cellPos2.z - halfHeight <= pos.z &&
            this._cellPos2.z + halfHeight >= pos.z
        );
    }

    /**
     * 展示或者关闭合成提示特效
     *
     * @param {boolean} isShow
     * @memberof FormationCell
     */
    public showSimilar(isShow: boolean) {
        this._isShowSimilar = isShow;
        // egf.Logger.log("showSimilar:", this._isShowSimilar, this._ndSimilar);
        if (this._isShowSimilar && !this._ndSimilar) {
            GameMgr.effectGroup.playEffect("upLoop01", this.node, v3(0, 0.1, 0), undefined, (effectNode: Node) => {
                this._ndSimilar = effectNode;
            });
        } else if (this._ndSimilar) {
            let particle = this._ndSimilar.getComponentInChildren(ParticleSystemComponent);
            particle?.clear();
            particle?.stop();
            egf.PoolMgr.putNode(this._ndSimilar);
            this._ndSimilar = null!;
        }
    }

    /**
     * 展示合并成功特效
     */
    public showCombineSucceed() {
        GameMgr.effectGroup.playEffect("upClick", this.node, v3(0, 0.1, 0));
    }

    /**
     * 格子上展示冲刺暴走特效
     */
    public showSprint() {
        GameMgr.effectGroup.playEffect("goBallistic01", this.node, v3(0, 0.1, 0));
    }
}
