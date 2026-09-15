import { _decorator } from "cc";
import Constants from "./constants";
import { localConfig } from "./localConfig";
import { StorageManager } from "./storageManager";
const { ccclass, property } = _decorator;
//管理玩家数据脚本
@ccclass("PlayerData")
export class PlayerData {
    /* class member could be defined like this */
    // dummy = '';

    /* use `property` decorator if your want the member to be serializable */
    // @property
    // serializableDummy = 0;

    public serverTime: number = 0;      //服务端时间
    public localTime: number = 0;       //本地时间
    public userId: string = '';         //玩家ID
    public playerInfo: any = null!;     //玩家数据
    public isNewBee: boolean = false;    //是否是新手，默认非新手
    public dataVersion: string = '';     //数据版本
    public settings: any = {};           //杂项数据
    public formation: any = {};          //编队{pos: fighterId}
    public isLoadFinished: boolean = false;  //是否游戏载入完成
    public waitingUnlock: number = -1;   //标记是否展示解锁界面，为-1则不展示
    public waitingBuy: number = -1;      //标记刚解锁的可购买的士兵，为-1则
    public isLastFightWin: boolean = true; //最近一次战斗是否胜利，默认是
    
    //获取实例
    public static get instance () {
        if (this._instance) {
            return this._instance;
        }

        this._instance = new PlayerData();
        return this._instance;
    }

    private static _instance: PlayerData;       

    //获取金币
    public get gold () {
        return this.playerInfo.gold;
    }

    //读取游戏缓存
    public loadGlobalCache() {
        let userId = StorageManager.instance.getUserId();
        if (userId) {
            this.userId = userId;
        }
    }

    /**
     * 读取缓存数据
     *
     * @memberof PlayerData
     */
    public loadFromCache() {
        //读取玩家基础数据
        //@ts-ignore
        this.playerInfo = this.loadDataByKey(Constants.LOCAL_CACHE.PLAYER);

        //设置相关
        this.settings = this.loadDataByKey(Constants.LOCAL_CACHE.SETTINGS);

        this.formation = this.loadDataByKey(Constants.LOCAL_CACHE.FORMATION);
    }

    /**
     * 根据KEY值获得数据
     *
     * @param {string} keyName
     * @returns
     * @memberof PlayerData
     */
    public loadDataByKey (keyName: string) {
        let ret = {};
        let str = StorageManager.instance.getConfigData(keyName);
        if (str) {
            try {
                ret = JSON.parse(str);
            } catch (e) {
                ret = {};
            }
        } 
        
        return ret;
    }

    /**
     * 创建玩家数据
     * @param loginData 
     */
    public createPlayerInfo(loginData?:any) {
        this.playerInfo = {
            gold: 100,                          //金币数量
            level: 1,                           //默认初始关卡
            createDate: new Date(),             //记录创建时间
            buyTimes: 0,                        //购买次数
            buyCellTimes: 0,                    //购买格子的次数
            unlock: [Constants.BASE_FIGHTER],   //已解锁士兵
            onlineReward: 0,                    //在线奖励的数值
            finishGuides: [],                   //完成的引导步骤
            hasUsedFireBall: false              //是否使用过火球技能
        };
        
        this.isNewBee = true; //区分新老玩家
        
        if (loginData) {
            for (let key in loginData) {
                this.playerInfo[key] = loginData[key];
            }
        }

        //初始化阵型
        this.createDefaultFormation();

        this.saveAll();
    }

    /**
     * 设置默认阵型
     */
    public createDefaultFormation () {
        //默认阵型
        this.formation = {
            1: 101,
            2: 101,
            3: 101
        }
    }

    /**
     * 更新用户信息
     * 例如钻石，金币，道具
     * @param {String} key
     * @param {Number} value
     */
    public updatePlayerInfo(key:string, value: any) {
        let isChanged = false;
        if (this.playerInfo.hasOwnProperty(key)) {
            if (typeof value === 'number') {
                isChanged = true;
                this.playerInfo[key] += value;
                if (this.playerInfo[key] < 0) {
                    this.playerInfo[key] = 0;
                }
                //return;
            } else if (typeof value === 'boolean' || typeof value === 'string') {
                isChanged = true;
                this.playerInfo[key] = value;
            }
        }
        if (isChanged) {
            //有修改就保存到localcache
            this.savePlayerInfoToLocalCache();
        }
    }

    /**
     * 保存玩家数据
     */
    public  savePlayerInfoToLocalCache() {
        StorageManager.instance.setConfigData(Constants.LOCAL_CACHE.PLAYER, JSON.stringify(this.playerInfo));
    }

    /**
     * 保存阵型数据
     */
    public saveFormationToLocalCache() {
        StorageManager.instance.setConfigData(Constants.LOCAL_CACHE.FORMATION, JSON.stringify(this.formation));
    }

    /**
     * 当数据同步完毕，即被覆盖的情况下，需要将数据写入到本地缓存，以免数据丢失
     */
    public saveAll() {
        StorageManager.instance.setConfigDataWithoutSave(Constants.LOCAL_CACHE.PLAYER, JSON.stringify(this.playerInfo));
        StorageManager.instance.setConfigDataWithoutSave(Constants.LOCAL_CACHE.SETTINGS, JSON.stringify(this.settings));
        StorageManager.instance.setConfigDataWithoutSave(Constants.LOCAL_CACHE.FORMATION, JSON.stringify(this.formation));
        StorageManager.instance.setConfigData(Constants.LOCAL_CACHE.DATA_VERSION, this.dataVersion);
    }

    /**
     * 获取已完成的引导步骤
     * @returns 
     */
    public getFinishGuide () {
        if (this.playerInfo.hasOwnProperty('finishGuides')) {
            return this.playerInfo.finishGuides;
        }

        return [];
    }

    /**
     * 完成指定步骤的引导
     * @param guideStep 
     */
    public finishGuide (guideStep: any) {
        if (!this.playerInfo.finishGuides) {
            //@ts-ignore
            this.playerInfo.finishGuides = [];
        }

        if (this.playerInfo.finishGuides.indexOf(guideStep) === -1) {
            this.playerInfo.finishGuides.push(guideStep);
            this.savePlayerInfoToLocalCache();
        }
    }

    /**
     * 同步服务器时间
     */
    public syncServerTime (serverTime: number) {
        this.serverTime = serverTime;
        this.localTime = Date.now();
    }

    /**
     * 获取当前时间
     */
    public getCurrentTime () {
        let diffTime = Date.now() - this.localTime;

        return this.serverTime + diffTime;
    }

    /**
     * 清除数据
     */
    public clear () {
        this.playerInfo = null!;
        this.settings = {};
        this.formation = {};
        this.saveAll();
    }

    /**
     * 生成随机账户
     * @returns
     */
    public generateRandomAccount () {
        this.userId = `${Date.now()}${0 | (Math.random() * 1000, 10)}`;
        StorageManager.instance.setUserId(this.userId);
    }

    /**
     * 获得当前阵型战力
     */
    public getFormationFight () {
        return this._getFormationFight(this.formation);
    }
    
    /**
     * 获得当前阵型战力
     * @param formation 
     * @returns 
     */
    private _getFormationFight (formation: any) {
        let num = 0;
        for (let pos in formation) {
            let fighterId = formation[pos];

            if (fighterId > 0) {
                let fighter = localConfig.instance.queryByID('fighter', fighterId);
                num += fighter['num'] * fighter['fight'];
            }   
        }

        return num;
    }

    /**
     * 获得当前敌方战力
     */
    public getCurLevelEnemyFight () {
        return this._getFormationFight(this.getCurLevelEnemy());
    }

    /**
     * 获取当前等级的敌人阵型
     * @returns 
     */
    public getCurLevelEnemy () {
        let levelInfo = localConfig.instance.queryByID('level', this.playerInfo.level.toString());

        let arrEnemyInfo = levelInfo['formation'].split('_');

        let dictFormation: any = {};
        arrEnemyInfo.forEach((enemy: any) => {
            let enemyInfo = enemy.split('#');
            let fighterId = enemyInfo[0];
            let pos = enemyInfo[1];

            dictFormation[pos] = fighterId;
        });

        return dictFormation;
    }

    /**
     * 通过关卡
     */
    public passLevel () {
        //先判定当前是否有解锁的士兵
        let levelInfo = localConfig.instance.queryByID('level', this.playerInfo.level.toString());
        let unlock = levelInfo['unlock'];
        if (unlock) {
            //有待解锁的士兵
            if (this.playerInfo.unlock.indexOf(unlock) === -1) {
                this.playerInfo.unlock.push(unlock);

                this.savePlayerInfoToLocalCache();

                this.waitingUnlock = unlock;
                this.waitingBuy = unlock;
            }
        }

        this.playerInfo.level++;

        if (this.playerInfo.level > Constants.MAX_LEVEL) {
            this.playerInfo.level = Constants.MAX_LEVEL;
        }

        this.savePlayerInfoToLocalCache();
    }

    /**
     * 获得已购买次数
    */
    private _getBuyTimes () {
        let times = 0;
        if (this.playerInfo.buyTimes) {
            times = this.playerInfo.buyTimes;
        }

        return times;
    }

    /**
     * 增加购买次数
     */
    public addBuyTimes () {
        if (this.playerInfo.buyTimes) {
            this.playerInfo.buyTimes++;
        } else {
            this.playerInfo.buyTimes = 1;
        }

        this.savePlayerInfoToLocalCache();
    }

    /**
     * 获得购买士兵的价格
     */
    public getBuyFighterPrice () {
        let times = this._getBuyTimes();
        let factor = 1.07;
        let sep = 13;

        if (times < sep) {
            return 30 + 10 * times;
        } else {
            return 30 + 10 * sep + Math.round(30 * Math.pow(factor, times - sep));
        }
    }

    /**
     * 获得购买格子的价格
     */
    public getBuyCellPrice () {
        return Math.floor(100 * Math.pow(1.2, this.getBuyCellTimes()));
    }

    /**
     * 获得已购买格子次数
     */
    public getBuyCellTimes () {
        let times = 0;
        if (this.playerInfo.buyCellTimes) {
            times = this.playerInfo.buyCellTimes;
        }

        return times;
    }

    /**
     * 增加购买次数
     */
    public  addBuyCellTimes () {
        if (this.playerInfo.buyCellTimes) {
            this.playerInfo.buyCellTimes++;
        } else {
            this.playerInfo.buyCellTimes = 1;
        }

        this.savePlayerInfoToLocalCache();
    }

    /**
     * 获得阵型上空闲格子的位置
     */
    public getEmptyPos (): number {
        for (let pos in this.formation) {
            if (this.formation[pos] === 0) {
                return Number(pos);
            }
        }

        return -1;
    }

    /**
     * 获得已经解锁的士兵
     */
    public getUnlockFighters (): [number] {
        if (this.playerInfo.unlock) {
            return this.playerInfo.unlock;
        }

        return [Constants.BASE_FIGHTER];
    }

    /**
     * 随机获得可购买的士兵
     */
    public getRandomBuyFighter (): number {
        if (this.waitingBuy > 0) { //对于首次解锁，下次优先安排购买
            let ret = this.waitingBuy;
            this.waitingBuy = -1;
            return ret;
        }

        let unlock = this.getUnlockFighters();

        return unlock[Math.floor(Math.random() * unlock.length)]
    }

    /**
     * 添加士兵到阵型里面
     * @param pos 在第几个格子
     * @param fighterId 士兵编号/种类
     * @returns 
     */
    public addFighter (pos: number, fighterId: number) {
        if (this.formation[pos] !== 0) {
            return false;
        }

        this.formation[pos] = Number(fighterId); //强制转换成阵型，避免因为异常数据转成字符串了

        this.saveFormationToLocalCache();
    }

    /**
     * 根据格子获得对应位置上的士兵
     * @param pos 
     */
    public getFighterIdByCellPos (pos: number) {
        return this.formation[pos];
    }

    /**
     * 生成新的格子数据并添加到队列里面去
     * @returns 
     */
    public addCell () {
        let len = Object.keys(this.formation).length;
        //从数组里面取对应的位置
        let nextPos = Constants.UNLOCK_CELL_SEQ[len];
        //如果超过24个，则位置的值网上累加
        if (len >= Constants.UNLOCK_CELL_SEQ.length) {
            nextPos = len;
        }

        //刚生成的格子上默认没有士兵
        this.formation[nextPos] = 0;
        this.saveFormationToLocalCache();
        return nextPos;
    }

    /**
     * 格子上的士兵数据互换
     * @param cellA 
     * @param cellB 
     */
    public swapCell (cellA: number, cellB: number) {
        let tmp = this.formation[cellA];
        this.formation[cellA] = this.formation[cellB];
        this.formation[cellB] = tmp;
        this.saveFormationToLocalCache();
    }

    /**
     * 获得下一等级的士兵id
     * @param fighterId 
     */
    public getFighterNextId (fighterId: number): number {
        let fighterInfo = localConfig.instance.queryByID('fighter', fighterId.toString());
        
        let next = localConfig.instance.queryOneByCondition('fighter', {level: fighterInfo.level+1, type: fighterInfo.type});
        if (next) {
            return Number(next.ID);
        }
        
        return -1;
    }

    /**
     * 合并格子
     * @param cellOld 
     * @param cellTarget 
     * @param nextId 
     */
    public combineCell (cellOld: number, cellTarget: number, nextId: number) {
        this.formation[cellOld] = 0;
        this.formation[cellTarget] = nextId;

        this.saveFormationToLocalCache();
    }

    /**
     * 更新在线奖励的奖励值
     * @param times 
     */
    public updateOnlineReward (times = 1000) {
        if (!this.playerInfo.onlineReward) {
            this.playerInfo.onlineReward = 0;
        }

        this.playerInfo.onlineReward += Constants.ONLINE.PROFIT_PER_SECOND * PlayerData.instance.getBuyFighterPrice() * times / 1000;
        this.playerInfo.onlineReward = Number(this.playerInfo.onlineReward.toFixed(2));

        this.savePlayerInfoToLocalCache();
    }

    /**
     * 获取在线奖励的值
     * @returns 
     */
    public getOnlineReward (): number {
        if (!this.playerInfo.onlineReward) {
            this.playerInfo.onlineReward = 0;
        }

        return Math.floor(this.playerInfo.onlineReward);
    }

    /**
     * 更新领取后的在线奖励的奖励值
     * @param money 
     */
    public reduceOnlineReward (money: number) {
        if (!this.playerInfo.onlineReward) {
            this.playerInfo.onlineReward = 0;
        }

        this.playerInfo.onlineReward -= money;
        this.playerInfo.onlineReward = Number(this.playerInfo.onlineReward.toFixed(2));

        this.savePlayerInfoToLocalCache();
    }

    /**
     * 标记已经使用过大火球技能
     */
    public markUseFireBall () {
        this.playerInfo.hasUsedFireBall = true;
        this.savePlayerInfoToLocalCache();
    }
}
