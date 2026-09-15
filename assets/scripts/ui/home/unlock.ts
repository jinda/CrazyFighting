import { localConfig } from './../../framework/localConfig';
import { _decorator, Component, SpriteComponent, LabelComponent, SpriteFrame } from "cc";
import { ResourceUtil } from "../../framework/resourcesUtils";
import { UIManager } from "../../framework/uiManager";
const { ccclass, property } = _decorator;
//解锁士兵脚本
@ccclass("unlock")
export class unlock extends Component {
    /* class member could be defined like this */
    // dummy = '';

    /* use `property` decorator if your want the member to be serializable */
    // @property
    // serializableDummy = 0;

    // @property(Node)
    // nodeHalo: Node = null;

    @property(SpriteComponent)
    public spCard: SpriteComponent = null!;//士兵卡片图标组件

    @property(LabelComponent)
    public lbName: LabelComponent = null!;//士兵名字

    private _callback: Function = null!;//回调函数

    start () {
        // Your initialization goes here.
    }

    onDisable () {

    }

    /**
     * 展示
     * @param fighterId 士兵编号
     * @param callback 回调函数
     */
    public show (fighterId: number, callback: Function) {
        this._callback = callback;

        let fighter = localConfig.instance.queryByID('fighter', fighterId.toString());

        //TODO 设置图片
        ResourceUtil.getCard(fighter['type'], (err: any, sf: SpriteFrame)=>{
            if (this.spCard.node.isValid) {
                this.spCard.spriteFrame = sf;
            }
        });

        this.lbName.string = fighter['name'];
    }

    /**
     * 点击确定按钮
     */
    public onBtnOKClick () {
        UIManager.instance.hideDialog('home/unlock');
        this._callback && this._callback();
    }

    // update (deltaTime: number) {
    //     // Your update function goes here.
    // }
}
