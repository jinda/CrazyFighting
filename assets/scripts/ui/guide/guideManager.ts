import { _decorator, find, Node } from "cc";
import Constants from "../../framework/constants";
import { PlayerData } from "../../framework/playerData";
import { UIManager } from "../../framework/uiManager";
import { FighterManager } from "../../fight/fighterManager";
import { ClientEvent } from "../../framework/clientEvent";
const { ccclass, property } = _decorator;
//引导管理脚本
@ccclass("GuideManager")
export class GuideManager {
    private _isStart: boolean = false;//是否开始引导
    private _currentWaitEvent: string = '';//当前正在等待触发的事件
    private _isGuiding: boolean = false;//是否正在引导
    private _isPlaying: boolean = false;//是否正在播放引导
    private _currentSubGuideInfo: any = null!;//当前在执行的子引导步骤
    private _finishGuideObj: any = {};//大引导步骤状态的字典
    private _aryGuideSteps: any = [];//大引导步骤数组：里面每个元素都是大步骤, 大步骤只是统称，不执行任何操作，具体操作执行是由每个大步骤里面的guideLs数组里面小步骤的组成
    private _currentSubGuideIndex: number = 0;//子引导步骤对应的索引
    private _currentBigGuideInfo: any = null!;//当前正在执行的大引导步骤
    private _callBackFunc: Function = null!;//事件触发回调函数
    private static _instance: GuideManager;

    //获取canvas节点
    private get ndCanvas () {
        return find("Canvas") as Node; 
    }

    public static get instance () {
        if (this._instance) {
            return this._instance;
        }

        this._instance = new GuideManager();
        this._instance._init();
        return this._instance;
    }

    /**
     * 初始化
     */
    private _init () {
        this._currentWaitEvent = '';
        this._isGuiding = false;
        this._isPlaying = false;
        this._currentSubGuideInfo = null;
        this._finishGuideObj = {};
    }

    /**
     * 开始引导
     */
    public startGuide () {
        this._isStart = true;
        this._loadGuideStep();
        this._loadFinishGuide();
        this._enterBigGuide();
    }

    /**
     * 加载引导步骤
     */
    private _loadGuideStep () {
        let idx = 0;
        
        //this._aryGuideSteps数组里面每个元素都是大步骤, 大步骤只是统称，不执行任何操作，具体操作执行是由每个大步骤里面的guideLs数组里面小步骤
        this._aryGuideSteps = [
            {
                "id": idx = Constants.GUIDE_STEP.START,
                "guideVersion": 1,
                "title": "开始引导",
                "guideLs": [
                    //为保留引导步奏就，先走直接跳过
                    {
                        "title": "延时-为避免没有引导",
                        "type": Constants.GUIDE_TYPE.DELAY,
                        "param": [100]
                    },
                ]
            },
            {
                "id": idx = Constants.GUIDE_STEP.BUY,
                "guideVersion": 1,
                "title": "引导-购买",
                "guideLs": [
                    {
                        "title": "延时-为避免没有引导",
                        "type": Constants.GUIDE_TYPE.DELAY,
                        "param": [50]
                    },
                ]
            },
            {
                "id": idx = Constants.GUIDE_STEP.COMBINE_ONE,
                "guideVersion": 1,
                "title": "引导-合成-1",
                "guideLs": [
                    {
                        "title": "等待进入主场景",
                        "type": Constants.GUIDE_TYPE.WAIT_EVENT,
                        "param": ["onHomeShow"]
                    },
                    {
                        "title": "延时-为避免没有引导",
                        "type": Constants.GUIDE_TYPE.DELAY,
                        "param": [100]
                    },
                    {
                        "title": "引导合成",
                        "type": Constants.GUIDE_TYPE.GUIDE,
                        "offsetWidth": 40,
                        "offsetHeight": 40,
                        "getPosFun": {
                            "posFun": this.execFun,
                            "posOwner": this,
                            "posParam": ["getCombineContent"],
                            "posRecvEventNodePath": "Canvas/homeUI",
                        },
                        "combineGuide": true,
                        "finishConditionEvent": "combineSucceed",   //引导完成事件
                        "resetConditionEvent": "swapSucceed"        //引导重置事件
                    }
                ]
            },
            {
                "id": idx = Constants.GUIDE_STEP.COMBINE_TWO,
                "guideVersion": 1,
                "title": "引导-合成-2",
                "guideLs": [
                   {
                        "title": "通知显示指向开始游戏的手指",
                        "type": Constants.GUIDE_TYPE.TRIGGER_EVENT,
                        "param": ["showStartGameHandForGuide"]
                    }
                ]
            },
            {
                "id": idx = Constants.GUIDE_STEP.BUY_CELL,
                "guideVersion": 1,
                "title": "引导-购买格子",
                "guideLs": [
                    {
                        "title": "等待没有格子的时候",
                        "type": Constants.GUIDE_TYPE.WAIT_EVENT,
                        "param": ["noEnoughPos"]
                    },
                    {
                        "title": "通知显示购买格子按钮",
                        "type": Constants.GUIDE_TYPE.TRIGGER_EVENT,
                        "param": ["showBuyCellForGuide"]
                    },
                    {
                        "title": "延时-为避免没有引导",
                        "type": Constants.GUIDE_TYPE.DELAY,
                        "param": [100]
                    },
                    {
                        "title": "引导购买格子",
                        "type": Constants.GUIDE_TYPE.GUIDE,
                        "offsetWidth": 40,
                        "offsetHeight": 40,
                        "getNodeFun": {
                            "nodeFun": this.execFun,
                            "nodeOwner": this,
                            "nodeParam": ["getBuyCellButton"]
                        }
                    }
                ]
            }
        ];
    }

    /**
     * 加载已完成和未完成的引导步骤数据
     */
    private _loadFinishGuide () {
        let arrGuides = PlayerData.instance.getFinishGuide();

        //已完成
        if (arrGuides.length > 0) {
            arrGuides.forEach((guideId: any)=> {
                this._finishGuideObj[guideId] = true;
            }, this);
        }

        //未完成
        for (let idx = 0; idx < this._aryGuideSteps.length; idx++) {
            let guideId = this._aryGuideSteps[idx].id;
            let guideStep = this._aryGuideSteps[idx];
            guideStep.isFinish = this._finishGuideObj.hasOwnProperty(guideId) && this._finishGuideObj[guideId];
        }
    }

    /**
     * 进入大引导步骤
     * @returns 
     */
    private _enterBigGuide () {
        if (!this._isStart) {
            return;
        }

        //如果当前没在引导查找新的引导
        if (!this._isGuiding) {
            this._findNewBigGuide();
        } else {
            this._checkGuide();
        }

        if (this._currentSubGuideInfo !== null) {
            return true;
        }

        return false;
    }

    /**
     * 查找新的大引导步骤
     * @returns 
     */
    private _findNewBigGuide () {
        for (let idx = 0; idx < this._aryGuideSteps.length; idx++) {
            let guideStep = this._aryGuideSteps[idx];
            //找到第一个还没完成引导步骤并执行，然后return掉
            if (!guideStep.isFinish) {

                //避免进入没有满足条件的子引导，或者说先满足条件才能进入子引导
                if (!this._isConditionFinish(guideStep.guideLs[0])) {
                    return false;
                }

                this._playSubGuide(idx);
                return true;
            }
        }

        return false;
    }

    /**
     * 检查是否正在引导
     */
    private _checkGuide () {
        if (this._isGuiding) { 

            //如果满足执行子引导条件，则执行子引导步骤
            if (this._isConditionFinish(this._currentSubGuideInfo)) {
                if (!this._isPlaying) {
                    this._continueSubGuide();
                }
            } else if (this._isPlaying) {//如果面板改变了，并且当前正处于新手引导状态的话，先暂停
                this.pauseSubGuide();
            }

            return true;
        }

        return false;
    }

    /**
     * 检查大引导步骤中是否有此步骤
     * @param guideId 
     * @returns 
     */
    public hasFinishGuide (guideId: any) {
        return !!this._finishGuideObj[guideId];
    }

    /**
     * 检查是否满足/完成进入子引导的条件/函数
     */
    private _isConditionFinish (subGuide: any) {
        if (subGuide.hasOwnProperty("condition")) {
            return subGuide.condition.apply(subGuide.conditionOwner,
                subGuide.conditionParam);
        }

        return true;
    }

    /**
     * 是否跳过大步骤
     */
    private _isNeedSkipBigGuide () {
        if (this._currentBigGuideInfo && this._currentBigGuideInfo.hasOwnProperty("skipGuide")) {
            let fun = this._currentBigGuideInfo.skipGuide.fun;
            return fun.apply(this._currentBigGuideInfo.skipGuide.owner, this._currentBigGuideInfo.skipGuide.param);
        }

        return false;
    }

    /**
     * 暂停小引导步骤
     */
    public pauseSubGuide () {
        this._isPlaying = false;

        //如果当前在执行界面性引导则隐藏界面
        if (this._currentSubGuideInfo.type === Constants.GUIDE_TYPE.GUIDE) {
            this._hideGuidePanel();
        }

        //判断是否暂停后跳过大步骤引导
        if (this._currentSubGuideInfo.isSkipAfterPause) {
            this.finishBigGuide();
        }
    }

    /**
     * 继续执行子引导步骤
     */
    private _continueSubGuide () {
        this._isPlaying = true;
        this._doPlaySubGuide(this._currentSubGuideInfo);
    }

    /**
     * 是否跳过小步骤
     */
    private _isNeedPassSubGuide () {
        if (this._currentSubGuideInfo && this._currentSubGuideInfo.hasOwnProperty("passCondition")) {
            let fun = this._currentSubGuideInfo.passCondition;
            return fun.apply(this._currentSubGuideInfo.passConditionOwner, this._currentSubGuideInfo.passConditionParam);
        }

        return false;
    }

    /**
     * 执行子引导步骤
     * @param idx 
     * @returns 
     */
    private _playSubGuide (idx: number) {
        this._currentSubGuideIndex = 0;
        this._currentBigGuideInfo = this._aryGuideSteps[idx];

        console.log('### start guide: ', this._currentBigGuideInfo.id);

        //子引导步骤内容
        this._currentSubGuideInfo = this._currentBigGuideInfo.guideLs[this._currentSubGuideIndex];

        //判断是否跳过大步骤
        if (this._isNeedSkipBigGuide()) {
            this.finishBigGuide(true);
            return;
        }

        this._doPlaySubGuide(this._currentBigGuideInfo.guideLs[this._currentSubGuideIndex]);
    }

    /**
     * 完成大引导步骤，比如事件点击完成
     * */
    public finishBigGuide (isSkipBigGuide: boolean = false) {
        if (this._currentSubGuideInfo) {
            //如果是界面性引导则关闭界面
            switch (this._currentSubGuideInfo.type) {
                case Constants.GUIDE_TYPE.GUIDE:
                    this._hideGuidePanel();
                    break;
            }

            //如果大步骤执行完后有afterFun回调函数则执行
            if (this._currentSubGuideInfo.hasOwnProperty("afterFun")) {
                let fun = this._currentSubGuideInfo.afterFun;
                fun.apply(this._currentSubGuideInfo.afterOwner, this._currentSubGuideInfo.afterParam);
            }

            //如果大步骤都搞定了，或者小步骤都执行完了，或者跳过大步骤，则标记完成该大步骤并更新下缓存数据
            if (this._currentSubGuideInfo.hasOwnProperty("guideOver") || this._currentSubGuideIndex >= this._currentBigGuideInfo.guideLs.length - 1 || isSkipBigGuide) {
                if (!this._currentBigGuideInfo.isFinish) {
                    this._currentBigGuideInfo.isFinish = true;
                    let guideId = this._currentBigGuideInfo.id;
                    this._finishGuideObj[guideId] = true;
                    PlayerData.instance.finishGuide(guideId);
                }
            }

            //如果小步骤都执行完了，或者跳过大步骤，则初始化一些属性并查找下一个大步骤
            if (this._currentSubGuideIndex >= this._currentBigGuideInfo.guideLs.length - 1 || isSkipBigGuide) {
                this._isGuiding = false;
                this._isPlaying = false;
                this._currentBigGuideInfo = null;
                this._currentSubGuideIndex = null!;
                this._currentSubGuideInfo = null;
                this._findNewBigGuide();
            } else {//否则执行下一个子引导步骤
                this._currentSubGuideIndex++;
                this._currentSubGuideInfo = this._currentBigGuideInfo.guideLs[this._currentSubGuideIndex];
                this._doPlaySubGuide(this._currentSubGuideInfo);
            }
        }
    }

    /**
     * 执行子引导步骤
     */
    private _doPlaySubGuide (subGuideInfo: any) {
        this._currentSubGuideInfo = subGuideInfo;
        this._isGuiding = true;

        //如果跳过小引导步骤，则结束当前的大引导步骤
        if (this._isNeedPassSubGuide()) {
            this.finishBigGuide();
            return true;
        }

        if (!this._isConditionFinish(this._currentSubGuideInfo)) {
            this._isPlaying = false;
            return;
        }

        //如果有beforeFun回调函数则执行
        if (subGuideInfo.hasOwnProperty("beforeFun")) {
            let fun = subGuideInfo.beforeFun;
            fun.apply(subGuideInfo.beforeOwner, subGuideInfo.beforeParam);
        }

        this._isPlaying = false;

        switch (subGuideInfo.type) {
            case Constants.GUIDE_TYPE.TRIGGER_EVENT://触发事件
                this._isPlaying = true;
                ClientEvent.dispatchEvent(subGuideInfo.param[0], subGuideInfo.param[1]);

                //暂时为直接完成，后续考虑由事件回调回来
                this.finishBigGuide();
                break;
            case Constants.GUIDE_TYPE.SPACE://空，不做任何操作，用来判定触发
                this.finishBigGuide();
                break;
            case Constants.GUIDE_TYPE.GUIDE://界面性引导
                this._isPlaying = true;
                this._showGuidePanel(subGuideInfo);
                break;
            case Constants.GUIDE_TYPE.WAIT_EVENT://等待事件触发
                this._isPlaying = true;

                //如果已有事件触发回调函数，则注销该函数
                if (this._callBackFunc) {
                    ClientEvent.off(this._currentWaitEvent, this._callBackFunc, this);
                    this._callBackFunc = null!;
                    this._currentWaitEvent = '';
                }

                this._callBackFunc = () => {

                    //注销事件，参数依次是事件名称、回调函数、this对象
                    ClientEvent.off(subGuideInfo.param[0], this._callBackFunc, this);

                    //如果不是自己当前正在等待的事件，则直接退出，不要继续处理
                    if (!this._currentSubGuideInfo || this._currentSubGuideInfo.type !== Constants.GUIDE_TYPE.WAIT_EVENT || this._currentSubGuideInfo.param[0] !== subGuideInfo.param[0]) {
                        return;
                    }

                    this._callBackFunc = null!;
                    this._currentWaitEvent = '';
                    this.finishBigGuide();
                };

                this._currentWaitEvent = subGuideInfo.param[0];
                ClientEvent.on(subGuideInfo.param[0], this._callBackFunc, this);
                break;
            case Constants.GUIDE_TYPE.DELAY://延迟
                setTimeout(()=>{
                    this.finishBigGuide();
                }, subGuideInfo.param[0]);
                break;
        }
    }

    /**
     * 展示引导界面
     * @param subGuide 
     */
    private _showGuidePanel (subGuideInfo: any) {
        UIManager.instance.showDialog('guide/guide', [subGuideInfo]);
    }

    /**
     * 关闭引导界面
     */
    private _hideGuidePanel () {
        UIManager.instance.hideDialog('guide/guide');
    }

    /**
     * 执行函数
     * @param funStr 函数名称
     * @param param 参数
     * @returns 
     */
    public execFun (funStr: string, param?: any) {
        switch (funStr) {
            case 'getStartButton':
                return find('homeUI/start/btnStart', this.ndCanvas);
            case 'getBuyButton':
                return find('homeUI/menu/buy', this.ndCanvas);
            case 'isFightStart':
                return !UIManager.instance.isDialogVisible('home/homeUI');
            case 'getCombineContent':
                let nodeFighters = find('game/fighters');
                let fighterManager = nodeFighters?.getComponent(FighterManager) as FighterManager;
                return fighterManager.getCombineContentForGuide();
            case 'getBuyCellButton':
                return find('homeUI/menu/buyCell', this.ndCanvas);
        }
    }

    /**
     * 是否在播放购买引导
     * @returns 
     */
    public isPlayingBuyGuide () {
        return this._isPlaying && this._currentBigGuideInfo.id === Constants.GUIDE_STEP.BUY;
    }
}
