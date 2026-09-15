import { PoolManager } from './../../framework/poolManager';
import { ClientEvent } from './../../framework/clientEvent';
import { _decorator, Component, Node, SpriteFrame, SpriteComponent, Tween, Vec3, LabelComponent, ButtonComponent, EventTouch, Vec2, instantiate, view, UITransformComponent, Color, Prefab, tween } from "cc";
import { UIManager } from "../../framework/uiManager";
import { PlayerData } from "../../framework/playerData";
import { GameLogic } from "../../framework/gameLogic";
import Constants from "../../framework/constants";
import { levelTips } from "./levelTips";
import { AudioManager } from "../../framework/audioManager";
import { GuideManager } from "../guide/guideManager";
import { ResourceUtil } from '../../framework/resourcesUtils';
import { localConfig } from '../../framework/localConfig';
const { ccclass, property } = _decorator;
//主界面脚本
@ccclass("homeUI")
export class homeUI extends Component {
    /* class member could be defined like this */
    // dummy = '';

    /* use `property` decorator if your want the member to be serializable */
    // @property
    // serializableDummy = 0;

    @property(Node)
    public ndIndicator: Node = null!;//圆盘的指针节点

    @property(Node)
    public ndFight: Node = null!;//开始游戏节点和圆盘节点的父节点

    @property(SpriteFrame)
    public sfCrazy: SpriteFrame = null!;//暴走提示图标

    @property(SpriteFrame)
    public sfGood: SpriteFrame = null!;//真棒图标图标

    @property(SpriteFrame)
    public sfNormal: SpriteFrame = null!;//普通提示图标

    @property(Node)
    public ndTips: Node = null!;//提示节点

    @property(LabelComponent)
    public lbGold: LabelComponent = null!;//金币文本组件

    @property(LabelComponent)
    public lbSelf: LabelComponent = null!;//我方战力文本组件

    @property(LabelComponent)
    public lbEnemy: LabelComponent = null!;//敌方人战力文本组件

    @property(LabelComponent)
    public lbLevel: LabelComponent = null!;//等级文本组件

    @property(ButtonComponent)
    public btnBuy: ButtonComponent = null!;//增加兵力按钮组件

    @property(Node)
    public ndBuyByMoney: Node = null!;//增加兵力按钮节点

    @property(Node)
    public ndBuyCellByMoney: Node = null!;//增加土地节点

    @property(Node)
    public ndBuy: Node = null!;//增加兵力节点

    @property(LabelComponent)
    public lbPrice: LabelComponent = null!;//增加兵力价格本文组件

    @property(Node)
    public ndBuyCellUpgrade: Node = null!;//增加土地图标

    @property(ButtonComponent)
    public btnBuyCell: ButtonComponent = null!;//增加土地按钮组件

    @property(Node)
    public ndBuyCell: Node = null!;//增加土地节点

    @property(Node)
    public ndOnline: Node = null!;//在线奖励节点

    @property(LabelComponent)
    public lbPriceCell: LabelComponent = null!;//增加土地价格文本组件

    @property(Node)
    public ndBlock: Node = null!;//防止点击穿透节点

    @property(Node)
    public ndHand: Node = null!;//手指提示节点

    @property(Node)
    public ndBtnStart: Node = null!;//开始游戏按钮节点

    @property(Node)
    public ndUnlock: Node = null!;//解锁士兵提示节点

    @property(LabelComponent)
    public lbUnlockLevel: LabelComponent = null!;//解锁等级文本组件

    @property(LabelComponent)
    public lbUnlockName: LabelComponent = null!;//解锁士兵文本组件

    @property(Node)
    public ndFightTipsParent: Node = null!;//战力提示父节点

    //设置增加兵力按钮是否可点击
    public set buyBtnEnable (value: boolean) {
        this.btnBuy.interactable = value;
        let arrSprite = this.ndBuy.getComponentsInChildren(SpriteComponent);
        arrSprite.forEach((sprite)=>{
            sprite.grayscale = !value;
        });
    }

    //设置增加土地按钮是否可点击
    public set buyCellBtnEnable (value: boolean) {
        this.btnBuyCell.interactable = value;
        let arrSprite = this.ndBuyCell.getComponentsInChildren(SpriteComponent);
        arrSprite.forEach((sprite)=>{
            sprite.grayscale = !value;
        })
    }

    private _rotateSpeed: number = 170;//指针旋转速队
    private _isRotating: boolean = true;//指针是否在旋转中
    private _oriIndicatorEuler: Vec3 = new Vec3();//初始指针角度
    private _curIndicatorEuler: Vec3 = new Vec3();//当前指针角度
    private _ndLevelTips: Node = null!;//士兵等级提示节点
    private _tweenBtnStart: any = null!;//缓动对象
    private _tweenTips: any = null!;//缓动对象
    private _tweenHand: any = null!;//缓动对象
    private _btnStartScale1: Vec3 = new Vec3(1.3, 1.3, 1.3);//按钮缩放1
    private _btnStartScale2: Vec3 = new Vec3(1, 1, 1);//按钮缩放2
    private _tipPos: Vec3 = new Vec3(0, 60, 0);//攻击力加成对应图标位置
    private _handPos1: Vec3 = new Vec3();//手势位置1
    private _handPos2: Vec3 = new Vec3();//手势位置2
    private _handWorPos: Vec3 = new Vec3();//设置手势节点的目标世界坐标位置
    private _fightTipScale: Vec3 = new Vec3(0, 50, 0);//战斗提示节点的缩放大小
    private _fightTipPos: Vec3 = new Vec3(0.5, 0.5, 0);//战斗提示节点的位置
    private _outPutPos: Vec3 = new Vec3();//手势节点在
    private _isShowLevelTips: boolean = false;//是否展示士兵等级提示节点

    onLoad () {
    }

    start () {

        //循环播放背景音乐
        AudioManager.instance.playMusic(Constants.AUDIO_SOUND.BACKGROUND, true);
    }

    onEnable () {
        ClientEvent.on(Constants.EVENT_NAME.UPDATE_GOLD, this._updateGold, this);
        ClientEvent.on(Constants.EVENT_NAME.UPDATE_FORMATION, this._updateFormation, this);
        ClientEvent.on(Constants.EVENT_NAME.UPDATE_LEVEL, this._updateLevel, this);
        ClientEvent.on(Constants.EVENT_NAME.SHOW_LEVEL_TIPS, this._showLevelTips, this);
        ClientEvent.on(Constants.EVENT_NAME.REC_ONLINE_REWARD, this._updateFormation, this);
        ClientEvent.on(Constants.EVENT_NAME.BUY_FIGHTER, this._buyFighter, this);

        this.node.on(Node.EventType.TOUCH_START, this._onTouchEvent, this);
        this.node.on(Node.EventType.TOUCH_MOVE, this._onTouchEvent, this);
        this.node.on(Node.EventType.TOUCH_END, this._onTouchEvent, this);
        this.node.on(Node.EventType.TOUCH_CANCEL, this._onTouchEvent, this);
    }

    onDisable () {
        ClientEvent.off(Constants.EVENT_NAME.UPDATE_GOLD, this._updateGold, this);
        ClientEvent.off(Constants.EVENT_NAME.UPDATE_FORMATION, this._updateFormation, this);
        ClientEvent.off(Constants.EVENT_NAME.UPDATE_LEVEL, this._updateLevel, this);
        ClientEvent.off(Constants.EVENT_NAME.SHOW_LEVEL_TIPS, this._showLevelTips, this);
        ClientEvent.off(Constants.EVENT_NAME.REC_ONLINE_REWARD, this._updateFormation, this);
        ClientEvent.off(Constants.EVENT_NAME.BUY_FIGHTER, this._buyFighter, this);

        this.node.off(Node.EventType.TOUCH_START, this._onTouchEvent, this);
        this.node.off(Node.EventType.TOUCH_MOVE, this._onTouchEvent, this);
        this.node.off(Node.EventType.TOUCH_END, this._onTouchEvent, this);
        this.node.off(Node.EventType.TOUCH_CANCEL, this._onTouchEvent, this);
    }

    /**
     * 暂停开始按钮动画
     */
    private _stopBtnStartAni () {
        if (this._tweenBtnStart) {
            this._tweenBtnStart.stop();
            this._tweenBtnStart = null;
        }
    }

    /**
     * 展示
     */
    public show () {
        this._stopBtnStartAni();

        if (PlayerData.instance.playerInfo.level >= 3) {
            this._tweenBtnStart = new Tween(this.ndBtnStart)
                .to(0.3, {scale: this._btnStartScale1})
                .to(0.3, {scale: this._btnStartScale2})
                .union()
                .repeatForever()
                .start();
        }

        this._isRotating = true;
        this.ndTips.active = false;
        this.ndBlock.active = false;

        this._updateGold();
        this._updateLevel();
        this._updateFormation();

        if (PlayerData.instance.waitingUnlock !== -1) {
            UIManager.instance.showDialog('home/unlock', [PlayerData.instance.waitingUnlock, ()=>{
            }]);
            PlayerData.instance.waitingUnlock = -1;
        }

        if (PlayerData.instance.playerInfo.level < 3) {
            this._resetIndicatorForGuide();
        }

        if (!PlayerData.instance.isLastFightWin) {
            this._showFailGuide();
        }

        this.ndOnline.active = PlayerData.instance.playerInfo.level >= 4;

        if (PlayerData.instance.playerInfo.level >= 4 || GuideManager.instance.hasFinishGuide(Constants.GUIDE_STEP.BUY_CELL)) {
            this.ndBuyCell.active = true;
        } else {
            this.ndBuyCell.active = false;
        }

        let objNextUnlock = this.getNextUnlock();

        if (!objNextUnlock) {
            this.ndUnlock.active = false;
        } else {
            let unlock = objNextUnlock.unlock;

            let fighter = localConfig.instance.queryByID('fighter', unlock.toString());
            if (fighter) {
                this.lbUnlockLevel.string = `第${objNextUnlock.level}关解锁`;
                this.lbUnlockName.string = fighter.name;

                this.ndUnlock.active = true;
            }
        }
    }

    /**
     * 展示手势提示
     */
    private _showFailGuide () {
        //检查格子是否足够
        if (this.btnBuy.interactable) {
            //表示购买按钮可用，将手一动到上面
            this._handWorPos.set(this.ndBuy.worldPosition);
            this._showHand(this._handWorPos);
        } else if (this.btnBuyCell.interactable) {
            this._handWorPos.set(this.ndBuyCell.worldPosition);
            this._showHand(this._handWorPos);
        } else {
            this._handWorPos.set(this.ndOnline.worldPosition);
            this._showHand(this._handWorPos);
        }
    }

    /**
     * 更新金币
     */
    private _updateGold () {
        //更新金币
        this.lbGold.string = PlayerData.instance.playerInfo.gold.toString();
    }

    /**
     * 更新增加兵力按钮状态
     */
    public updateBuyBtn () {
        let price = PlayerData.instance.getBuyFighterPrice();

        this.lbPrice.string = price.toString();
        this.ndBuyByMoney.active = true;

        let hasEmptyPos = PlayerData.instance.getEmptyPos() !== -1;

        if (price <= PlayerData.instance.gold && hasEmptyPos) {
            //可购买
            this.buyBtnEnable = true;
        } else if (!hasEmptyPos) {
            //格子不足
            this.lbPrice.string = '格子不足';
            this.buyBtnEnable = false;
        } else {
            //不可购买
            this.buyBtnEnable = false;
        }
    }

    /**
     * 更新增加土地按钮状态
     */
    public updateBuyCellBtn () {
        let price = PlayerData.instance.getBuyCellPrice();

        this.lbPriceCell.string = price.toString();
        this.ndBuyCellUpgrade.active = false;
        this.ndBuyCellByMoney.active = true;

        if (price <= PlayerData.instance.gold) {
            //可购买
            this.buyCellBtnEnable = true;
            if (PlayerData.instance.getEmptyPos() === -1) {
                //没有空位置了，显示箭头
                this.ndBuyCellUpgrade.active = true;
            }
        } else {
            this.buyCellBtnEnable = false;

            if (PlayerData.instance.getEmptyPos() === -1) {
                //没有空位置了，显示箭头
                this.ndBuyCellUpgrade.active = true;
            }
        }
    }

    /*
     * 更新界面玩家士兵战力、购买士兵价格、购买土地按钮状态
     */
    private _updateFormation () {
        this.lbSelf.string = PlayerData.instance.getFormationFight().toString();

        //并且更新价格
        this.updateBuyBtn();

        //更新格子按钮，可能会触发显示箭头
        this.updateBuyCellBtn();
    }

    /**
     * 更新等级、敌人人员数量
     */
    private _updateLevel () {
        this.lbLevel.string = `第 ${PlayerData.instance.playerInfo.level} 关`;
        this.lbEnemy.string = PlayerData.instance.getCurLevelEnemyFight().toString();
    }

    /**
     * 展示开始游戏前的文字提示、并计算出攻击加成
     */
    private _showStart (angle: Vec3) {
        let power = 1;
        let sf = this.sfNormal;

        //根据指针角度提升攻击力
        if (Math.abs(angle.z) <= 5) {
            //暴走
            power = 1.5;  //攻击力提升1.5倍
            sf = this.sfCrazy;

            ClientEvent.dispatchEvent(Constants.EVENT_NAME.SHOW_SPRINT);
            AudioManager.instance.playSound(Constants.AUDIO_SOUND.RAMPAGE);
        } else if (Math.abs(angle.z) <= 35) {
            //真棒
            power = 1.2;    //攻击力提升1.2倍
            sf = this.sfGood;
        } else {
            //普通
            power = 1;      //攻击力提升1倍
            sf = this.sfNormal;
        }

        let spComTips = this.ndTips.getComponent(SpriteComponent) as SpriteComponent;
        spComTips.spriteFrame = sf;

        this.ndTips.setPosition(0, -40, 0);

        if (this._tweenTips) {
            this._tweenTips.stop();
            this._tweenTips = null;
        }

        //展示攻击力对应图标
        this.ndTips.active = true;
        this._tweenTips = new Tween(this.ndTips).to(1, {position: this._tipPos}).call(()=>{
            this._tweenTips = null;

            //隐藏主界面
            UIManager.instance.hideDialog('home/homeUI');
            //开始游戏
            ClientEvent.dispatchEvent(Constants.EVENT_NAME.FIGHT_START, power);
        }).start();

        AudioManager.instance.playSound(Constants.AUDIO_SOUND.FIGHT_START); 
    }

    /**
     * 点击开始游戏按钮
     * @returns 
     */
    public onBtnFightClick () {
        if (this.ndTips.active) {
            //避免重复点击
            return;
        }

        this._stopBtnStartAni();

        ClientEvent.dispatchEvent(Constants.EVENT_NAME.HIDE_ALL_SIMILAR);

        let angle = this.ndIndicator.eulerAngles;
        this._isRotating = false;
        this.ndBlock.active = true;
        this._showStart(angle);
        this.hideHand();
    }

    /**
     * 展示购买士兵界面
     *
     * @param {number} pos
     * @memberof homeUI
     */
    private _showBuy (pos: number) {
        //显示购买界面
        let fighterId = PlayerData.instance.getRandomBuyFighter();
        UIManager.instance.showDialog('home/buyFighter', [fighterId, pos, ()=>{
        }]);
    }

    /**
     * 点击增加兵力购买按钮
     * @returns 
     */
    public onBtnBuyClick () {
        let pos = PlayerData.instance.getEmptyPos();
        if (pos === -1) {
            //没有空位，不可购买
            return;
        }

        let price = PlayerData.instance.getBuyFighterPrice();
        if (price <= PlayerData.instance.gold) {
            //先扣钱
            GameLogic.addGold(-price);
            this._showBuy(pos);
        }        

        this.hideHand();
    }

    /**
     * 增加格子
     */
    private _addCell () {
        //增加购买次数
        PlayerData.instance.addBuyCellTimes();
        //添加格子
        let cellPos = PlayerData.instance.addCell();
        //通知刷新界面
        ClientEvent.dispatchEvent(Constants.EVENT_NAME.BUY_CELL, cellPos);
        //播放购买格子音效
        AudioManager.instance.playSound(Constants.AUDIO_SOUND.BUY_CELL);
        //并且更新价格
        this.updateBuyCellBtn();
        //并且更新购买按钮
        this.updateBuyBtn();
    }

    /**
     * 点击购买格子按钮
     */
    public onBtnBuyCellClick () {
        //根据指定规则进行格子解锁
        let price = PlayerData.instance.getBuyCellPrice();
        if (price <= PlayerData.instance.gold) {
            //金币购买
            //先扣钱
            GameLogic.addGold(-price);
            this._addCell();
        }

        this.hideHand();        
    }

    /**
     * 监听触摸点并派发出去
     * @param event 
     */
    private _onTouchEvent (event: EventTouch) {
        ClientEvent.dispatchEvent(Constants.EVENT_NAME.HOME_UI_TOUCH, event.type, event.getLocation());
    }

    /**
     * 展示士兵等级提示节点
     * @param isShow 
     * @param pos 当前触摸点
     * @param fighterId 士兵编号
     * @param type 提示类型
     */
    private _showLevelTips (isShow: boolean, pos: Vec2, fighterId: number, type: number) {
        this._isShowLevelTips = isShow;

        if (isShow) {
            if (!this._ndLevelTips) {
                ResourceUtil.getUIPrefabRes('home/levelTips', (err: any, pf: Prefab)=>{
                    //还需要展示
                    if (this._isShowLevelTips) {
                        if (!this._ndLevelTips) {
                            this._ndLevelTips = PoolManager.instance.getNode(pf, this.node);
                        }
    
                        this._ndLevelTips.active = true;
                        this._ndLevelTips.getComponent(levelTips)?.show(pos, fighterId, type);
                    }
                })
            } else {
                this._ndLevelTips.active = true;
                this._ndLevelTips.getComponent(levelTips)?.show(pos, fighterId, type);
            }
        } else if (this._ndLevelTips) {
            this._ndLevelTips.active = false;
        }
    }

    /**
     * 重置指针角度
     */
    private _resetIndicatorForGuide () {
        this._oriIndicatorEuler.set(0, 0, 0);
        this.ndIndicator.eulerAngles = this._oriIndicatorEuler;
        this._isRotating = false;
    }

    /**
     * 在底部指定按钮上展示手势引导
     * @param posWorld 
     */
    private _showHand (posWorld: Vec3) {
        if (this._tweenHand) {
            this._tweenHand.stop();
            this._tweenHand = null;
        }

        this.ndHand.active = true;
        this.ndHand.parent?.getComponent(UITransformComponent)?.convertToNodeSpaceAR(posWorld, this._outPutPos);
        this.ndHand.setPosition(this._outPutPos);
        this._handPos1.set(this._outPutPos.x + 20, this._outPutPos.y - 20, 0);
        this._handPos2.set(this._outPutPos.x, this._outPutPos.y, 0);

        this._tweenHand = new Tween(this.ndHand)
            .to(0.5, {position: this._handPos1})
            .to(0.5, {position: this._handPos2})
            .union()
            .repeatForever()
            .start();
    }

    /**
     * 隐藏手势引导
     */
    public hideHand () {
        if (this._tweenHand) {
            this._tweenHand.stop();
            this._tweenHand = null;
        }

        this.ndHand.active = false;
    }

    /**
     * 如果下一关有待解锁的兵种，则返回该下一关卡的等级和待解锁的兵种编号
     * @returns 
     */
    public getNextUnlock () {
        let level = PlayerData.instance.playerInfo.level;
        let arrLevel = localConfig.instance.getTableArr('level');
        for (let idx = level - 1; idx < arrLevel.length; idx++) {
            if (arrLevel[idx].unlock) {
                return {level: idx+1, unlock: arrLevel[idx].unlock};
            }
        }

        return null;
    }

    /**
     * 成功购买士兵后回到主界面，后弹出一个战力增加提示
     * @param pos 
     * @param fighterId 
     */
    private _buyFighter (pos: number, fighterId: number) {
        let fighter = localConfig.instance.queryByID('fighter', fighterId.toString());
        ResourceUtil.getUIPrefabRes('home/fightTips', (err: any, pf: Prefab)=>{
            if (!err) {
                let ndFightTip = PoolManager.instance.getNode(pf, this.ndFightTipsParent);
                ndFightTip.setPosition(0, 0, 0);
                ndFightTip.setScale(1, 1, 1);
                let lbTitle = ndFightTip.getChildByName('title').getComponent(LabelComponent);
                lbTitle.color = Color.WHITE;
                let lbValue = ndFightTip.getChildByName('value').getComponent(LabelComponent);
                lbValue.color = Color.GREEN;
                lbValue.string = `+${fighter.fight}`;
                
                this._fightTipPos.set(0, 50, 0);
                this._fightTipScale.set(0.5, 0.5, 0);
                 
                tween(ndFightTip)
                .by(0.5, {position: this._fightTipPos})
                .delay(0.3)
                .to(0.2, {scale: this._fightTipScale})
                .union()
                .call(()=>{
                    PoolManager.instance.putNode(ndFightTip);
                }).start();
            }
        })
    }

    update (deltaTime: number) {
        //更新指针角度
        if (this._isRotating) {
            this._curIndicatorEuler.set(this .ndIndicator.eulerAngles);
            this._curIndicatorEuler.z = this._curIndicatorEuler.z % 360;
            this._curIndicatorEuler.z += this._rotateSpeed * deltaTime;
            this._curIndicatorEuler.z = Math.round(this._curIndicatorEuler.z);
            if ((this._curIndicatorEuler.z <= -70 || this._curIndicatorEuler.z >= 290) && this._rotateSpeed < 0) {
                this._rotateSpeed = -this._rotateSpeed;
                this._curIndicatorEuler.z = -70;

            } else if ((this._curIndicatorEuler.z >= 70 || this._curIndicatorEuler.z <= -290) && this._rotateSpeed > 0) {
                this._rotateSpeed = -this._rotateSpeed;
                this._curIndicatorEuler.z = 70;
            }

            this.ndIndicator.eulerAngles = this._curIndicatorEuler;
        }
    }
}
