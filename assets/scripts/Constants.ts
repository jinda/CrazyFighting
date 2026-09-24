export class Constants {
    static FIGHTER_TYPE = {
        CLOSE: 1, //近战
        OX: 2, //牛角兵
        BAT: 3, //球棒兵
        AXE: 4, //斧头兵
        ARCHER: 5, //弓箭手
        BOMBER: 6, //投弹手
    };

    //先设置最多50关
    static MAX_LEVEL = 1000;

    //士兵移动速度换算基数：166.6 = 10000/60帧
    //原实现中追击分支按“每帧位移”、冲锋分支按“每秒位移”，帧率不同速度就不同，这里统一为按秒计算
    static MOVE_SPEED_BASE = 166.6;

    //士兵朝向随机扰动幅度（实际扰动为 ±幅度/2）
    static FIGHTER_DIRECTION_RANDOM = 0.2;

    //物理世界固定步长（秒）与单帧最多步进次数：避免每帧固定 Step 导致高刷新率设备物理推进加速
    static PHYSICS_STEP = 1 / 30;
    static PHYSICS_MAX_STEPS = 3;

    //基础兵，默认解锁
    static BASE_FIGHTER = 101;

    //共50个格子的解锁顺序
    static UNLOCK_CELL_SEQ = [
        1,
        2,
        3, //前期为已解锁
        7,
        6,
        8,
        12,
        11,
        13,
        17,
        16,
        18,
        15,
        19,
        10,
        14,
        5,
        9,
        0,
        4,
        22,
        21,
        23,
        20,
        24,
        27,
        26,
        28,
        25,
        29,
        32,
        31,
        33,
        30,
        34,
        37,
        36,
        38,
        35,
        39,
        42,
        41,
        43,
        40,
        44,
        47,
        46,
        48,
        45,
        49,
    ];

    //碰撞分数
    static COLLIDER_GROUP = {
        PLANE: 1, //地面分组
    };

    //格子上每个人的间距
    static CELL_FIGHTER_SPACING = 0.3;

    //玩家队伍
    static PLAYER_TEAM = 1;

    //敌人所在队伍
    static ENEMY_TEAM = 2;

    //火球伤害范围
    static FIRE_BALL_DISTANCE = 2.5;

    //50%的生命最大值
    static FIRE_BALL_DAMAGE_PERCENT = 0.5;

    //比例：像素 转成 米 的比例，对于物理引擎来说，他是按米来算的，这里取0.1
    static PTM_RATIO = 0.1;

    //引导步奏
    public static GUIDE_STEP = {
        START: 100, //开始
        BUY: 200, //购买
        COMBINE_ONE: 300, //合成一个
        COMBINE_TWO: 400, //合成两个
        BUY_CELL: 500, //购买土地
        LAST_GUIDE: 700, //最后引导
    };

    //新手引导类型
    public static GUIDE_TYPE = {
        SPACE: 0, //空，不做任何操作，用来判定触发
        GUIDE_ANI: 1, //引导动画
        TRIGGER_EVENT: 2, //触发事件
        WAIT_EVENT: 3, //等待事件触发
        GUIDE: 4, //界面性引导
        DELAY: 5, //延迟
    };

    //音效常量
    public static AUDIO_SOUND = {
        BACKGROUND: "background", //背景音乐
        BUY_CELL: "buyCell", //购买格子
        BUY_FIGHTER: "buyFighter", //购买人物
        COMBINE: "combine", //合并成功
        FIGHT_START: "fightStart", //开场号角
        WIN: "win", //战斗胜利
        FAIL: "fail", //战斗失败
        FIRE_BALL: "fireBall", //陨石
        RAMPAGE: "rampage", //暴走
    };

    //派发的事件名称
    public static EVENT_NAME = {
        BUY_CELL: "buyCell", //购买格子
        BUY_FIGHTER: "buyFighter", //购买士兵

        COMBINE_SUCCEED: "combineSucceed", //合成成功

        DROP_COIN: "dropCoin", //展示金币提示

        FIGHT_START: "fightStart", //战斗开始
        FIGHT_RESET: "fightReset", //战斗重置

        GAME_INIT: "gameInit", //游戏初始化
        GAME_OVER: "gameOver", //游戏结束
        GAME_PAUSE: "gamePause", //暂停游戏（设置界面、奖励界面、激励视频等外部模块广播，由游戏模块统一冻结战斗逻辑）
        GAME_RESUME: "gameResume", //恢复游戏（与 GAME_PAUSE 成对派发，支持叠加暂停）

        HOME_UI_TOUCH: "homeUITouch", //接收主界面的触摸位置
        HIDE_ALL_SIMILAR: "hideAllSimilar", //隐藏所有的格子上“可合成的”特效提示

        UPDATE_GOLD: "updateGold", //更新金币
        UPDATE_LEVEL: "updateLevel", //更新等级
        USE_FIRE_BALL: "useFireBall", //使用火球技能
        UPDATE_FORMATION: "updateFormation", //更新队列
        UPDATE_ONLINE_REWARD: "updateOnlineReward", //更新离线奖励

        REC_ONLINE_REWARD: "recOnlineReward", //更新界面玩家士兵战力、购买士兵价格、购买土地按钮状态

        SHOW_SPRINT: "showSprint", //格子上展示冲刺暴走特效
        SHOW_LEVEL_TIPS: "showLevelTips", //展示士兵等级提示
    };

    //动画类型
    public static ANI_TYPE = {
        IDLE: 0,
        WALK: 1,
        RUN: 2,
        ATTACK: 3,
        BEHIT: 4,
        DIED: 5,
        WIN: 6,
        SKILL: 7,
    };

    //玩家状态
    public static FIGHTER_STATUS = {
        IDLE: 0, //待机
        CHARGE: 1, //冲锋，先向前冲锋一小段路
        FIND: 2, //搜索目标
        MOVE: 3, //向敌人靠近
        ATTACK: 4, //攻击
        WIN: 5, //胜利
        DEAD: 6, //死亡
    };

    public static LEVEL_TIPS_TYPE = {
        NONE: 0, //不需要出现任何标识
        UPGRADE: 1, //升级
        EXCHANGE: 2, //交换
    };

    /**
     * 排行榜玩法标识（对应服务器后台配置的 mode）
     */
    public static LeaderboardMode = "crazyfight_level";

    // 技能CD时间
    public static SkillCD = 10;
    // 观看视频可领取金币数量
    public static awardCoin = 100;
    // 金币加成配置
    public static goldRate = { default: 1, step: 0.1, maxLv: 50 };
}
