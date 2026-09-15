import { _decorator } from 'cc';
//宏定义脚本
const {ccclass, property} = _decorator;
@ccclass
export default class Constants {
    
    /**
     * 场景元素的分组
     * @enum PANEL_GROUP
     */
    static PANEL_GROUP = {
        /**
         * ui 分组，静止
         * @property UI_ROOT
         * @type {Number}
         * @value 0
         * @static
        */
        UI_ROOT: 0, // ui 分组，静止
        /**
         * 游戏分组，运动
         * @property GAME_ROOT
         * @type {Number}
         * @value 1
         * @static
        */
        GAME_ROOT: 1, // 游戏分组，运动
    }

    /**
     * 层级
     * @enum PANEL_HIERARCHY
     * @type {Object}
     */
    static PANEL_HIERARCHY = {
        /**
         * 基础层级
         * @property BASE
         * @type {Number}
         * @value 1
         * @static
        */
        BASE: 1, // 基础层级
        /**
         * 跑马灯层级，在弹窗之下，底层之上
         * @property MARQUEE
         * @type {Number}
         * @value 5000
         * @static
        */
        MARQUEE: 5000, // 跑马灯层级，在弹窗之下，底层之上
        /**
         * 二级界面层级，用于常见的界面等
         * @property MODAL
         * @type {Number}
         * @value 10000
         * @static
        */
        MODAL: 10000, // 二级界面层级，用于常见的界面等
        /**
         * 三级界面层级，用于二级界面的弹出层等
         * @property POPUP
         * @type {Number}
         * @value 15000
         * @static
        */
        POPUP: 15000, // 三级界面层级，用于二级界面的弹出层等
        /**
         * 提示层级，用于浮动提示框、确认提示框等
         * @property TIPS
         * @type {Number}
         * @value 20000
         * @static
        */
        TIPS: 20000, // 提示层级，用于浮动提示框、确认提示框等
    }


    static FIGHTER_TYPE = {
        CLOSE: 1,           //近战
        OX: 2,              //牛角兵
        BAT: 3,             //球棒兵
        AXE: 4,             //斧头兵
        ARCHER: 5,          //弓箭手
        BOMBER: 6           //投弹手
    }

    //1奥特曼/2牛角/3短剑/4标枪/5投石车/6小丑
    public static FIGHTER_MODEL = {
        1: "axe",
        2: "altman",
        3: "soldier",
        4: "javelin",
        5: "catapult",
        6: "clown"
    }

    //本地缓存
    static LOCAL_CACHE = {
        PLAYER: 'player',               //玩家基础数据缓存，如金币砖石等信息，暂时由客户端存储，后续改由服务端管理
        SETTINGS: 'settings',           //设置相关，所有杂项都丢里面进去
        DATA_VERSION: 'dataVersion',    //数据版本
        ACCOUNT: 'account',                 //玩家账号
        FORMATION: 'formation',                 //玩家账号
        // TMP_DATA: 'tmpData',             //临时数据，不会存储到云盘
    }

    //游戏名称
    static GAME_NAME: 'gangWar';
    
    //先设置最多50关
    static MAX_LEVEL = 50;

    //基础兵，默认解锁
    static BASE_FIGHTER = 101; 

    //共50个格子的解锁顺序
    static UNLOCK_CELL_SEQ = [
        1, 2, 3, //前期为已解锁
        7, 6, 8, 
        12, 11, 13, 
        17, 16, 18, 15, 19, 
        10, 14, 
        5, 9, 
        0, 4, 
        22, 21, 23, 20, 24, 
        27, 26, 28, 25, 29,
        32, 31, 33, 30, 34,
        37, 36, 38, 35, 39,
        42, 41, 43, 40, 44,
        47, 46, 48, 45, 49
    ];

    //碰撞分数
    static COLLIDER_GROUP = {
        PLANE: 1        //地面分组
    };

    //格子上每个人的间距
    static CELL_FIGHTER_SPACING = 0.3; 

    //玩家队伍
    static PLAYER_TEAM = 1; 

    //敌人所在队伍
    static ENEMY_TEAM = 2; 

    //在线奖励相关
    public static ONLINE = {
        MAX_TIME: 1800,            //30分钟
        // MAX_TIME: 60,            //4个小时
        PROFIT_PER_SECOND: 0.01,       //每秒收益 当前买兵价格的1%
        TIME_PER_CIRCLE: 10         //转一圈所需时间
    }

    //火球伤害范围
    static FIRE_BALL_DISTANCE = 2.5; 

    //50%的生命最大值
    static FIRE_BALL_DAMAGE_PERCENT = 0.5;

    //火球的冷却时间
    static FIRE_BALL_COOL_TIME = 10; 

    //比例：像素 转成 米 的比例，对于物理引擎来说，他是按米来算的，这里取0.1
    static PTM_RATIO = 0.1;

    //引导步奏
    public static GUIDE_STEP = {
        START: 100,//开始
        BUY: 200,//购买
        COMBINE_ONE: 300,//合成一个
        COMBINE_TWO: 400,//合成两个
        BUY_CELL: 500,//购买土地
        LAST_GUIDE: 700,//最后引导
    }

    //新手引导类型
    public static GUIDE_TYPE = { 
        SPACE: 0, //空，不做任何操作，用来判定触发
        GUIDE_ANI: 1, //引导动画
        TRIGGER_EVENT: 2, //触发事件
        WAIT_EVENT: 3, //等待事件触发
        GUIDE: 4, //界面性引导
        DELAY: 5,   //延迟
    }

    //音效常量
    public static AUDIO_SOUND = {
        BACKGROUND: 'background',       //背景音乐
        BUY_CELL: 'buyCell',            //购买格子
        BUY_FIGHTER: 'buyFighter',      //购买人物
        COMBINE: 'combine',             //合并成功
        FIGHT_START: 'fightStart',      //开场号角
        WIN: 'win',                     //战斗胜利
        FAIL: 'fail',                   //战斗失败
        FIRE_BALL: 'fireBall',          //陨石
        RAMPAGE: 'rampage',             //暴走
    }

    //派发的事件名称
    public static EVENT_NAME = {
        BUY_CELL: "buyCell",//购买格子
        BUY_FIGHTER: "buyFighter",//购买士兵

        COMBINE_SUCCEED: "combineSucceed",//合成成功

        DROP_COIN: "dropCoin",//展示金币提示

        FIGHT_START: "fightStart",//战斗开始
        FIGHT_RESET: "fightReset",//战斗重置

        GAME_INIT: "gameInit",//游戏初始化
        GAME_OVER: "gameOver",//游戏结束

        HOME_UI_TOUCH: "homeUITouch",//接收主界面的触摸位置
        HIDE_ALL_SIMILAR: "hideAllSimilar",//隐藏所有的格子上“可合成的”特效提示

        UPDATE_GOLD: "updateGold",//更新金币
        UPDATE_LEVEL: "updateLevel",//更新等级
        USE_FIRE_BALL: "useFireBall",//使用火球技能
        UPDATE_FORMATION: "updateFormation",//更新队列
        UPDATE_ONLINE_REWARD: "updateOnlineReward",//更新离线奖励

        REC_ONLINE_REWARD: "recOnlineReward",//更新界面玩家士兵战力、购买士兵价格、购买土地按钮状态

        SHOW_SPRINT: "showSprint",//格子上展示冲刺暴走特效
        SHOW_LEVEL_TIPS: "showLevelTips",//展示士兵等级提示
    }

    //动画类型
    public static ANI_TYPE = {
        IDLE: 'idle',
        RUN: 'run',
        ATTACK: 'attack',
        WIN: 'win',
        DIED: 'died'
    }

    //玩家状态
    public static FIGHTER_STATUS = {
        IDLE: 0,        //待机
        CHARGE: 1,      //冲锋，先向前冲锋一小段路
        FIND: 2,        //搜索目标
        MOVE: 3,        //向敌人靠近
        ATTACK: 4,      //攻击
        WIN: 5,         //胜利
        DEAD: 6         //死亡
    }

    public static LEVEL_TIPS_TYPE = {
        NONE: 0,//不需要出现任何标识
        UPGRADE: 1,//升级
        EXCHANGE: 2,//交换
    }
}
