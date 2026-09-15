import { _decorator, Component, Node, SpriteComponent, SpriteFrame, Vec2, view } from "cc";
import { localConfig } from "../../framework/localConfig";
import { PlayerData } from "../../framework/playerData";
import Constants from '../../framework/constants';
const { ccclass, property } = _decorator;
//士兵等级提示脚本：在界面移动士兵时，士兵头上会展示
@ccclass("levelTips")
export class levelTips extends Component {
    /* class member could be defined like this */
    // dummy = '';

    /* use `property` decorator if your want the member to be serializable */
    // @property
    // serializableDummy = 0;

    @property([Node])
    public aryStar: Node[] = [];//星星节点数组

    @property(Node)
    public ndFlag: Node = null!;//图标节点

    @property(SpriteComponent)
    public spFlag: SpriteComponent = null!;//图标sprite

    @property(SpriteFrame)
    public sfUpgrade: SpriteFrame = null!;//升级图标

    @property(SpriteFrame)
    public sfExchange: SpriteFrame = null!;//交换图标

    private _fighterId: number = null!;//士兵编号
    private _type: number = null!;//提示类型
    private _newPos: Vec2 = new Vec2();//该节点的位置

    start () {
        // Your initialization goes here.
    }

    onDisable () {
        this._fighterId = null!;
        this._type = null!;
    }

    /**
     * 展示
     * @param pos 触摸位置
     * @param fighterId 士兵编号
     * @param type 提示类型
     * @returns 
     */
    public show (pos: Vec2, fighterId: number, type: number) {
        this._newPos.set(pos.x / view.getScaleX(), pos.y / view.getScaleY() + 120);

        //type 为 0 表示不需要出现任何标志  1为升级  2为交换位置
        this.node.setWorldPosition(this._newPos.x, this._newPos.y, 0);
        // console.log('2: ', pos.x - Math.floor(this.node.parent.width/2), pos.y - Math.floor(this.node.parent.height/2), 0);
        // console.log('3: ', this.node.position);
        if (typeof(fighterId) === 'undefined' || typeof(type) === 'undefined') {
            return;
        }

        if (this._fighterId === fighterId && this._type === type) {
            return;
        }

        this._fighterId = fighterId;
        this._type = type;

        let fighterInfo = localConfig.instance.queryByID('fighter', fighterId.toString());
        let level = fighterInfo['level'];

        //如果能升级的话会多一颗新星图标，否则展示交换图标
        if (type === Constants.LEVEL_TIPS_TYPE.UPGRADE) {
            let nextId = PlayerData.instance.getFighterNextId(fighterId);
            if (nextId > 0) {
                level += 1;
            } else {
                type = Constants.LEVEL_TIPS_TYPE.EXCHANGE;
            }
        }

        this.ndFlag.active = false;

        if (type === Constants.LEVEL_TIPS_TYPE.UPGRADE) {
            //展示升级图标
            this.ndFlag.active = true;
            this.spFlag.spriteFrame = this.sfUpgrade;
        } else if (type === Constants.LEVEL_TIPS_TYPE.EXCHANGE) {
            //展示交换图标
            this.ndFlag.active = true;
            this.spFlag.spriteFrame = this.sfExchange;
        }

        //根据level值展示对应星星数量
        let star = level % 5;
        star = star !== 0 ? star : 5;
        for (let idx = 0; idx < star; idx++) {
            this.aryStar[idx].active = true;
        }

        //隐藏剩余的星星
        for (let idx = star; idx < this.aryStar.length; idx++) {
            this.aryStar[idx].active = false;
        }
    }

    // update (deltaTime: number) {
    //     // Your update function goes here.
    // }
}
