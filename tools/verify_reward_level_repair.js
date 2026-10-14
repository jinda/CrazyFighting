const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { stripTypeScriptTypes } = require("node:module");

const projectRoot = path.resolve(__dirname, "..");
let assertionCount = 0;

function equal(actual, expected, message) {
    assert.equal(actual, expected, message);
    assertionCount++;
}

function deepEqual(actual, expected, message) {
    assert.deepEqual(actual, expected, message);
    assertionCount++;
}

function check(value, message) {
    assert.ok(value, message);
    assertionCount++;
}

function loadTypeScript(relativePath, prelude, exportsList, contextValues = {}, removeDecorators = false) {
    const filename = path.join(projectRoot, relativePath);
    let source = fs.readFileSync(filename, "utf8");
    source = source.replace(/^import[\s\S]*?;\n/gm, "");
    source = source.replace(/\bexport\s+default\s+class\s+/g, "class ");
    source = source.replace(/\bexport\s+(?=(?:class|const|enum|interface|type)\b)/g, "");
    if (removeDecorators) {
        source = source.replace(/^\s*@[^\n]+\n/gm, "");
    }
    source = `${prelude}\n${source}\nglobalThis.__testedExports = { ${exportsList.join(", ")} };\n`;
    const javascript = stripTypeScriptTypes(source, { mode: "transform", sourceMap: false });
    const context = vm.createContext({
        console,
        Map,
        Set,
        Promise,
        Math,
        Date,
        JSON,
        Number,
        String,
        Array,
        Object,
        ...contextValues,
    });
    vm.runInContext(javascript, context, { filename });
    return context.__testedExports;
}

function createStorage() {
    const values = new Map();
    return {
        values,
        getItem(key) {
            return values.has(key) ? values.get(key) : null;
        },
        setItem(key, value) {
            values.set(key, value);
        },
    };
}

function createCrypto() {
    return {
        enc: { Utf8: {} },
        AES: {
            encrypt(text) {
                return { toString: () => `enc:${Buffer.from(text, "utf8").toString("base64")}` };
            },
            decrypt(value) {
                return {
                    toString: () =>
                        typeof value === "string" && value.startsWith("enc:")
                            ? Buffer.from(value.slice(4), "base64").toString("utf8")
                            : "",
                };
            },
        },
    };
}

function encodeSave(value) {
    return `enc:${Buffer.from(JSON.stringify(value), "utf8").toString("base64")}`;
}

function testSignProgressAndLevelMigration() {
    let now = new Date(2026, 0, 1, 12).getTime();
    const RealDate = Date;
    class FakeDate extends RealDate {
        constructor(...args) {
            super(...(args.length > 0 ? args : [now]));
        }

        static now() {
            return now;
        }
    }

    const storage = createStorage();
    const dataMgr = { coin: 0, level: 0 };
    const logs = { warn: [], error: [] };
    const { LocalDataMgr } = loadTypeScript(
        "assets/scripts/LocalDataMgr.ts",
        `
const clamp = __deps.clamp;
const sys = __deps.sys;
const CryptoTS = __deps.CryptoTS;
const ClientApi = __deps.ClientApi;
const Constants = __deps.Constants;
const DataMgr = __deps.DataMgr;
`,
        ["LocalDataMgr"],
        {
            __deps: {
                clamp: (value, minimum, maximum) => Math.min(Math.max(value, minimum), maximum),
                sys: { localStorage: storage },
                CryptoTS: createCrypto(),
                ClientApi: { inst: { token: "", getData() {}, saveData() {} } },
                Constants: {
                    BASE_FIGHTER: 101,
                    MAX_LEVEL: 1000,
                    UNLOCK_CELL_SEQ: [1, 2, 3],
                    goldRate: { maxLv: 10, step: 0.1 },
                },
                DataMgr: dataMgr,
            },
            Date: FakeDate,
            Buffer,
            setTimeout,
            clearTimeout,
            egf: {
                Logger: {
                    log() {},
                    warn: (...args) => logs.warn.push(args),
                    error: (...args) => logs.error.push(args),
                },
                AudioMgr: { musicVolume: 1, soundVolume: 1 },
            },
        },
    );

    LocalDataMgr.saveGameInfoData = () => {};
    for (let day = 1; day <= 8; day++) {
        equal(LocalDataMgr.doSign(), ((day - 1) % 7) + 1, `第 ${day} 次签到应领取对应循环档位`);
        equal(LocalDataMgr.doSign(), 0, `第 ${day} 天重复签到必须被拒绝`);
        equal(LocalDataMgr.getSignedRewardDayToday(), ((day - 1) % 7) + 1, `第 ${day} 天领取后应保留当天展示档位`);
        now += 24 * 60 * 60 * 1000;
    }

    LocalDataMgr.saveGameInfoData = () => {
        throw new Error("loadData must not save while applying an existing save");
    };
    storage.setItem(
        "CrazyFightGameInfoConfig",
        encodeSave({ coin: 100, level: 1007, unlock: [101], formation: { 1: 101 } }),
    );
    LocalDataMgr.loadData();
    equal(LocalDataMgr.GameInfo.level, 999, "超上限旧存档应归一化到内部第 999 索引");
    equal(dataMgr.level, 999, "归一化关卡应同步到 DataMgr");
    storage.setItem(
        "CrazyFightGameInfoConfig",
        encodeSave({ coin: 100, level: -8, unlock: [101], formation: { 1: 101 } }),
    );
    LocalDataMgr.loadData();
    equal(LocalDataMgr.GameInfo.level, 0, "负数旧存档应归一化到内部第 0 索引");
    check(logs.warn.length >= 2, "关卡归一化应记录警告");
}

function testSignUiRewardsAndStates() {
    const addedCoins = [];
    const flyCoins = [];
    const itemStates = [];
    let signedToday = false;
    let rewardDay = 1;
    let signedRewardDay = 0;
    let randomRange = null;
    const buttonSprite = () => ({ grayscale: false });
    const layout = {
        btnBack: {},
        btnGet: { getComponent: buttonSprite },
        btnDoubleGet: { getComponent: buttonSprite },
        showInfo(awards) {
            this.awards = [...awards];
        },
        updateItemState(day, status) {
            itemStates[day - 1] = status;
        },
    };
    class UIController {
        constructor() {
            this.layout = layout;
        }
        onButtonEvent() {}
        close() {}
    }
    const localDataMgr = {
        getCoinRate: () => 0,
        getSignProgress: () => rewardDay,
        getSignedRewardDayToday: () => signedRewardDay,
        isSignToday: () => signedToday,
        doSign() {
            if (signedToday) {
                return 0;
            }
            signedToday = true;
            signedRewardDay = rewardDay;
            return rewardDay;
        },
    };
    const platformMgr = {
        reportEvent() {},
        showRewardedVideo(_placement, callback) {
            callback(true);
        },
    };
    const { UI_Sign } = loadTypeScript(
        "assets/module_game/ui_sign/UI_Sign.ts",
        `
const Layout_Sign = __deps.Layout_Sign;
const ModuleDef = __deps.ModuleDef;
const Sprite = __deps.Sprite;
const sys = __deps.sys;
const Constants = __deps.Constants;
const DataMgr = __deps.DataMgr;
const UI_CommonTips = __deps.UI_CommonTips;
const LocalDataMgr = __deps.LocalDataMgr;
const PlatformMgr = __deps.PlatformMgr;
`,
        ["UI_Sign"],
        {
            __deps: {
                Layout_Sign: class {},
                ModuleDef: { GAME: "game" },
                Sprite: class {},
                sys: { getNetworkType: () => 1, NetworkType: { NONE: 0 } },
                Constants: { LEDGER_SCENE: { SIGN: "sign", SIGN_AD_DOUBLE: "sign_ad" } },
                DataMgr: { addCoin: (coin, scene) => addedCoins.push({ coin, scene }) },
                UI_CommonTips: class {},
                LocalDataMgr: localDataMgr,
                PlatformMgr: platformMgr,
            },
            egf: {
                UIController,
                UILayers: { POPUP2: 2 },
                AudioMgr: { playOneShot() {} },
                UI_Toast: { show() {} },
                UIAlert: { show() {} },
                UIMgr: { showUI() {} },
                EventMgr: { emit: (_event, data) => flyCoins.push(data.coin) },
                i18nMgr: { getText: (text) => text },
                Logger: { log() {}, warn() {} },
                Utils: {
                    getRandomInt(minimum, maximum) {
                        randomRange = [minimum, maximum];
                        return Math.floor((minimum + maximum) / 2);
                    },
                },
            },
        },
        true,
    );

    const controller = new UI_Sign();
    controller.onCreated();
    for (let day = 1; day <= 6; day++) {
        equal(controller.getReward(day), day * 100, `第 ${day} 档必须使用固定奖励`);
    }
    equal(controller.getReward(7), 850, "第 7 档必须使用随机区间");
    deepEqual(randomRange, [700, 1000], "第 7 档随机区间必须与界面一致");

    rewardDay = 1;
    signedToday = false;
    signedRewardDay = 0;
    controller.clickGet();
    deepEqual(addedCoins[0], { coin: 100, scene: "sign" }, "普通签到应发放本档奖励一次");
    controller.clickGet();
    equal(addedCoins.length, 1, "当天重复点击普通领取不得增加金币");

    rewardDay = 7;
    signedToday = false;
    signedRewardDay = 0;
    controller.clickDoubleGet();
    deepEqual(addedCoins[1], { coin: 1700, scene: "sign_ad" }, "广告签到应按同一第 7 档奖励翻倍");
    equal(flyCoins.at(-1), 1700, "广告签到金币动画应使用翻倍后的金额");

    signedToday = true;
    signedRewardDay = 7;
    itemStates.length = 0;
    controller.updateSignState();
    deepEqual(itemStates, [1, 1, 1, 1, 1, 1, 1], "第 7 天领取后当天应保持整轮已领取状态");
    signedToday = false;
    signedRewardDay = 0;
    rewardDay = 1;
    itemStates.length = 0;
    controller.updateSignState();
    deepEqual(itemStates, [2, 0, 0, 0, 0, 0, 0], "次日应开启新轮第 1 档且不提前标记领取");
}

function testSettlementReward() {
    const events = [];
    const additions = [];
    const reports = [];
    const displays = [];
    let level = 1000;
    const layout = {
        btnBack: {},
        btnNext: {},
        btnRetry: {},
        btnShare: {},
        nodeUnlock: { active: false },
        nodeWin: { position: null },
        showInfo(...args) {
            displays.push(args);
        },
        showUnlockHero() {},
    };
    class UIController {
        constructor() {
            this.layout = layout;
        }
        onButtonEvent() {}
        close() {}
    }
    const dataMgr = {
        get level() {
            return level;
        },
        addCoin: (coin, scene) => additions.push({ coin, scene }),
        reportLevelComplete: (value) => reports.push(value),
        nextLevel: () => {
            level++;
        },
        waitingBuy: -1,
    };
    const { UI_Settlement } = loadTypeScript(
        "assets/module_game/ui_settlement/UI_Settlement.ts",
        `
const v3 = __deps.v3;
const Constants = __deps.Constants;
const DataMgr = __deps.DataMgr;
const LocalDataMgr = __deps.LocalDataMgr;
const GameCfg = __deps.GameCfg;
const UI_Menu = __deps.UI_Menu;
const Layout_Settlement = __deps.Layout_Settlement;
const PlatformMgr = __deps.PlatformMgr;
`,
        ["UI_Settlement"],
        {
            __deps: {
                v3: (...values) => values,
                Constants: {
                    LeaderboardMode: "level",
                    EVENT_NAME: { FIGHT_RESET: "reset" },
                    LEDGER_SCENE: { LEVEL_WIN: "win", LEVEL_LOSE: "lose" },
                },
                DataMgr: dataMgr,
                LocalDataMgr: {
                    getCoinRate: () => 0.5,
                    GameInfo: { unlock: [] },
                    saveGameInfoData() {},
                },
                GameCfg: {
                    queryByID(table) {
                        return table === "level" ? { gold: 90, unlock: null } : null;
                    },
                },
                UI_Menu: class {},
                Layout_Settlement: class {},
                PlatformMgr: { setUserCloudStorage() {}, share() {} },
            },
            egf: {
                UIController,
                UILayers: { POPUP: 1 },
                EventMgr: { emit: (event, data) => events.push({ event, data }) },
                AudioMgr: { playOneShot() {} },
                UIMgr: { showUI() {} },
                i18nMgr: { getText: (text) => text },
            },
        },
    );

    const winController = new UI_Settlement();
    winController.onCreated({ coin: 10, bWin: true });
    deepEqual(displays[0], [true, 1000, 100, 50], "胜利结算应展示结算关卡、基础金币与一次加成");
    deepEqual(additions[0], { coin: 150, scene: "win" }, "胜利结算到账应包含一次金币加成");
    equal(events[0].data.coin, 150, "胜利金币动画应包含一次金币加成");
    equal(reports[0], 1000, "第 1000 关应按通关前显示关卡上报");

    level = 42;
    const loseController = new UI_Settlement();
    loseController.onCreated({ coin: 40, bWin: false });
    deepEqual(displays[1], [false, 42, 40, 20], "失败结算也应展示一次金币加成");
    deepEqual(additions[1], { coin: 60, scene: "lose" }, "失败结算到账应包含一次金币加成");
    equal(events[1].data.coin, 60, "失败金币动画应包含一次金币加成");
}

function testLevelBoundsAndMissingConfig() {
    class SecureValue {
        constructor(value) {
            this.value = value;
        }
        get() {
            return this.value;
        }
        set(value) {
            this.value = value;
        }
    }
    const localDataMgr = {
        GameInfo: { level: 0, coin: 0 },
        saveGameInfoData() {},
        clearPendingLedgerOps() {},
        flushCloudSaves() {},
        addPendingLevel() {},
        removePendingLevelsUpTo() {},
        pendingLevels: [],
    };
    const dataLogs = [];
    const { DataMgr } = loadTypeScript(
        "assets/scripts/DataMgr.ts",
        `
const Game = __deps.Game;
const game = __deps.game;
const EApiErrcode = __deps.EApiErrcode;
const EResourceType = __deps.EResourceType;
const ClientApi = __deps.ClientApi;
const Constants = __deps.Constants;
const LocalDataMgr = __deps.LocalDataMgr;
const EPlatform = __deps.EPlatform;
const PlatformMgr = __deps.PlatformMgr;
`,
        ["DataMgr"],
        {
            __deps: {
                Game: { EVENT_SHOW: "show", EVENT_HIDE: "hide" },
                game: { on() {}, off() {} },
                EApiErrcode: {},
                EResourceType: { Coin: 1 },
                ClientApi: {
                    createReqId: () => "id",
                    inst: {
                        token: "",
                        reportError() {},
                        foreground() {},
                        background() {},
                    },
                },
                Constants: { MAX_LEVEL: 1000, LEDGER_SCENE: { UNKNOWN: "unknown" } },
                LocalDataMgr: localDataMgr,
                EPlatform: { Android: 1 },
                PlatformMgr: { platform: 1 },
            },
            window: {},
            setTimeout,
            clearTimeout,
            setInterval,
            clearInterval,
            egf: {
                SecureValue,
                Logger: { log() {}, warn: (...args) => dataLogs.push(args), error() {} },
                EventMgr: { emit() {} },
                AudioMgr: { resume() {}, pause() {} },
            },
        },
    );

    DataMgr.level = 998;
    equal(DataMgr.level, 999, "内部第 998 索引应显示为第 999 关");
    DataMgr.nextLevel();
    equal(DataMgr.level, 1000, "第 999 关通关后应进入第 1000 关");
    DataMgr.nextLevel();
    equal(DataMgr.level, 1000, "第 1000 关通关后应继续停留第 1000 关");
    equal(localDataMgr.GameInfo.level, 999, "第 1000 关重玩应持久化内部第 999 索引");
    DataMgr.level = 1004;
    equal(DataMgr.level, 1000, "运行时超上限关卡应归一化到第 1000 关");
    DataMgr.level = -4;
    equal(DataMgr.level, 1, "运行时负数关卡应归一化到第 1 关");
    check(dataLogs.length >= 2, "运行时关卡归一化应记录警告");

    const gameLogs = [];
    const gameDataMgr = { level: 999 };
    const gameCfg = {
        queryByID(_table, id) {
            if (id === "999") {
                return { formation: "101#0_202#2" };
            }
            if (id === "1000") {
                return { formation: "303#1" };
            }
            return null;
        },
        getTableArr: () => null,
        queryOneByCondition: () => null,
    };
    class Vec3 {
        clone() {
            return new Vec3();
        }
    }
    const { GameMgr } = loadTypeScript(
        "assets/module_game/game/scripts/GameMgr.ts",
        `
const Camera = __deps.Camera;
const Vec3 = __deps.Vec3;
const Node = __deps.Node;
const geometry = __deps.geometry;
const screen = __deps.screen;
const PhysicsSystem = __deps.PhysicsSystem;
const Constants = __deps.Constants;
const GameCfg = __deps.GameCfg;
const DataMgr = __deps.DataMgr;
const LocalDataMgr = __deps.LocalDataMgr;
const Fighter = __deps.Fighter;
const EffectGroup = __deps.EffectGroup;
`,
        ["GameMgr"],
        {
            __deps: {
                Camera: class {},
                Vec3,
                Node: class {},
                geometry: {},
                screen: {},
                PhysicsSystem: {},
                Constants: { CELL_FIGHTER_SPACING: 1 },
                GameCfg: gameCfg,
                DataMgr: gameDataMgr,
                LocalDataMgr: { GameInfo: { formation: {} } },
                Fighter: class {},
                EffectGroup: class {},
            },
            egf: { Logger: { log() {}, error: (...args) => gameLogs.push(args) } },
        },
    );

    deepEqual({ ...GameMgr.getCurLevelEnemy() }, { 0: 101, 2: 202 }, "第 999 关应读取其配置阵型");
    gameDataMgr.level = 1000;
    deepEqual({ ...GameMgr.getCurLevelEnemy() }, { 1: 303 }, "第 1000 关应读取其配置阵型");
    gameDataMgr.level = 1001;
    equal(GameMgr.getCurLevelEnemy(), null, "缺失关卡配置时应安全返回失败");
    equal(GameMgr.getCurLevelEnemyFight(), 0, "缺失关卡配置时战力查询应安全返回 0");
    equal(GameMgr.getNextUnlock(), null, "缺失关卡表时下一解锁查询应安全返回失败");
    check(gameLogs.length >= 3, "缺失关卡配置应记录错误");

    let mapLoadCount = 0;
    class Component {}
    class LogicVec3 {}
    const fighterGameMgr = {
        dictFighter: { stale: true },
        reset() {},
        getCurLevelEnemy: () => null,
    };
    const { FighterLogic } = loadTypeScript(
        "assets/module_game/game/scripts/FighterLogic.ts",
        `
const _decorator = __deps._decorator;
const Component = __deps.Component;
const Node = __deps.Node;
const Prefab = __deps.Prefab;
const Vec3 = __deps.Vec3;
const Vec2 = __deps.Vec2;
const geometry = __deps.geometry;
const PhysicsSystem = __deps.PhysicsSystem;
const BoxCollider = __deps.BoxCollider;
const find = __deps.find;
const view = __deps.view;
const instantiate = __deps.instantiate;
const Follow = __deps.Follow;
const EffectGroup = __deps.EffectGroup;
const Constants = __deps.Constants;
const DataMgr = __deps.DataMgr;
const Fighter = __deps.Fighter;
const FormationCell = __deps.FormationCell;
const LocalDataMgr = __deps.LocalDataMgr;
const GameMgr = __deps.GameMgr;
const GameCfg = __deps.GameCfg;
const UI_Menu = __deps.UI_Menu;
const UI_Fighter = __deps.UI_Fighter;
const BackResPkg = __deps.BackResPkg;
const ModuleDef = __deps.ModuleDef;
`,
        ["FighterLogic"],
        {
            __deps: {
                _decorator: { ccclass: () => {}, property: () => {} },
                Component,
                Node: class {},
                Prefab: class {},
                Vec3: LogicVec3,
                Vec2: LogicVec3,
                geometry: { Ray: class {} },
                PhysicsSystem: {},
                BoxCollider: class {},
                find: () => null,
                view: {},
                instantiate: () => null,
                Follow: class {},
                EffectGroup: class {},
                Constants: { EVENT_NAME: {}, COLLIDER_GROUP: { PLANE: 1 } },
                DataMgr: { level: 1001, isDebugMode: false },
                Fighter: class {},
                FormationCell: class {},
                LocalDataMgr: { GameInfo: { formation: { 1: 101 } } },
                GameMgr: fighterGameMgr,
                GameCfg: {},
                UI_Menu: class {},
                UI_Fighter: class {},
                BackResPkg: {},
                ModuleDef: { GAME: "game" },
            },
            egf: {
                Logger: { log() {}, error() {} },
                EventMgr: { on() {}, off() {} },
                ResMgr: { getAsset: () => mapLoadCount++ },
                Utils: { getRandomInt: () => 1 },
            },
        },
        true,
    );
    const logic = new FighterLogic();
    logic.cameraFollow = { initCamera() {} };
    logic.nodeFighters = { destroyAllChildren() {} };
    logic.nodeMap = { removeAllChildren() {} };
    logic._fightReset();
    equal(mapLoadCount, 0, "缺失关卡配置时应在地图加载前停止战斗初始化");
    equal(Object.keys(fighterGameMgr.dictFighter).length, 0, "缺失关卡配置时应清理旧士兵字典");
}

testSignProgressAndLevelMigration();
testSignUiRewardsAndStates();
testSettlementReward();
testLevelBoundsAndMissingConfig();

console.log(`reward/level regression checks: ${assertionCount} passed`);
