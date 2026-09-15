import { _decorator, Component, Prefab, Vec3, LabelComponent, Tween } from "cc";
import { GameLogic } from "../../framework/gameLogic";
import { PoolManager } from "../../framework/poolManager";
const { ccclass, property } = _decorator;
//金币提示管理脚本
@ccclass("coinTipsManager")
export class coinTipsManager extends Component {
    @property(Prefab)
    public pfCoinTips: Prefab = null!;//金币提示预制体

    private _uiPos: Vec3 = new Vec3();//金币提示节点的坐标
    private _scale1: Vec3 = new Vec3(1.2, 1.2, 1.2);//缩放大小
    private _scale2: Vec3 = new Vec3(1, 1, 1);//缩放大小
    private _pos1: Vec3 = new Vec3(0, 100, 0);//向量差

    start () {
        // Your initialization goes here.
    }

    /**
     * 展示金币提示
     *
     * @param {number} coin
     * @param {Vec3} posWorld
     * @memberof coinTipsManager
     */
    public dropCoin (coin: number, posWorld: Vec3) {
        let ndTips = PoolManager.instance.getNode(this.pfCoinTips, this.node);

        GameLogic.mainCamera.convertToUINode(posWorld, this.node, this._uiPos);
        ndTips.setPosition(this._uiPos);

        let nodeNum = ndTips.getChildByName('num');
        if (nodeNum) {
            nodeNum.getComponent(LabelComponent).string = coin.toString();
        }

        //播放动画
        ndTips.setScale(0, 0, 0)
        ndTips['tweenMove'] = new Tween(ndTips)
            .to(0.3, {scale: this._scale1})
            .to(0.1, {scale: this._scale2})
            .by(0.6, {position: this._pos1})
            .union()
            .call(()=>{
                ndTips['tweenMove'] = null;
                PoolManager.instance.putNode(ndTips);
            })
            .start();
    }

    /**
     * 如果界面切换需要对tips回收该节点
     */
    public recycle () {
        let arrChild: any[] = [];
        this.node.children.forEach((child)=>{
            arrChild.push(child);
        });

        arrChild.forEach((child)=>{
            if (child['tweenMove']) {
                child['tweenMove'].stop();
                child['tweenMove'] = null;
            }

            PoolManager.instance.putNode(child);
        })
    }

    // update (deltaTime: number) {
    //     // Your update function goes here.
    // }
}
