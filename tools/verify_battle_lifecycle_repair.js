const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { performance } = require("node:perf_hooks");
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
        source = source.replace(/^\s*@property\(\{[\s\S]*?^\s*\}\)\n/gm, "");
        source = source.replace(/^\s*@(ccclass|property)\([^\n]*\)\n/gm, "");
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

class Vec3 {
    constructor(x = 0, y = 0, z = 0) {
        this.x = x;
        this.y = y;
        this.z = z;
    }

    set(x, y, z) {
        if (typeof x === "object") {
            this.x = x.x;
            this.y = x.y;
            this.z = x.z;
        } else {
            this.x = x;
            this.y = y;
            this.z = z;
        }
        return this;
    }

    clone() {
        return new Vec3(this.x, this.y, this.z);
    }

    add(value) {
        this.x += value.x;
        this.y += value.y;
        this.z += value.z;
        return this;
    }

    subtract(value) {
        this.x -= value.x;
        this.y -= value.y;
        this.z -= value.z;
        return this;
    }

    multiplyScalar(value) {
        this.x *= value;
        this.y *= value;
        this.z *= value;
        return this;
    }

    lengthSqr() {
        return this.x * this.x + this.y * this.y + this.z * this.z;
    }

    length() {
        return Math.sqrt(this.lengthSqr());
    }

    normalize() {
        const length = this.length();
        if (length > 0) {
            this.multiplyScalar(1 / length);
        }
        return this;
    }

    negative() {
        return this.multiplyScalar(-1);
    }

    static subtract(out, left, right) {
        return out.set(left.x - right.x, left.y - right.y, left.z - right.z);
    }

    static multiplyScalar(out, value, scale) {
        return out.set(value.x * scale, value.y * scale, value.z * scale);
    }

    static add(out, left, right) {
        return out.set(left.x + right.x, left.y + right.y, left.z + right.z);
    }
}
Vec3.ZERO = new Vec3();

class Node {
    constructor(x = 0, z = 0) {
        this.position = new Vec3(x, 0, z);
        this.parent = {};
        this.forward = new Vec3(0, 0, 1);
        this.activeInHierarchy = true;
        this.isValid = true;
        this.components = new Map();
        this.children = [];
    }

    get worldPosition() {
        return this.position;
    }

    set worldPosition(value) {
        this.position.set(value);
    }

    setWorldPosition(value) {
        this.position.set(value);
    }

    setWorldRotation() {}

    setPosition(x, y, z) {
        this.position.set(x, y, z);
    }

    setScale() {}

    getComponent(type) {
        return this.components.get(type) ?? null;
    }

    getComponentsInChildren(type) {
        return this.components.get(type) ?? [];
    }

    removeAllChildren() {
        this.children.length = 0;
    }

    destroyAllChildren() {
        this.children.length = 0;
    }

    destroy() {
        this.isValid = false;
        this.parent = null;
    }
}

class Component {
    constructor() {
        this.node = new Node();
    }

    unscheduleAllCallbacks() {}
}

class Tween {
    constructor() {
        this.paused = false;
    }

    to() {
        return this;
    }

    delay() {
        return this;
    }

    by() {
        return this;
    }

    union() {
        return this;
    }

    call() {
        return this;
    }

    start() {
        return this;
    }

    stop() {}

    pause() {
        this.paused = true;
    }

    resume() {
        this.paused = false;
    }
}

function createGameManager() {
    class Camera {}
    class FighterToken {}
    class EffectGroupToken {}
    const { GameMgr } = loadTypeScript(
        "assets/module_game/game/scripts/GameMgr.ts",
        `
const Camera = __deps.Camera;
const Vec3 = __deps.Vec3;
const Node = __deps.Node;
const geometry = { Ray: class {} };
const screen = { windowSize: { width: 720, height: 1280 } };
const PhysicsSystem = { instance: {} };
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
                Camera,
                Vec3,
                Node,
                Constants: { PLAYER_TEAM: 1, ENEMY_TEAM: 2, COLLIDER_GROUP: { PLANE: 1 } },
                GameCfg: { queryByID() {}, queryOneByCondition() {}, getTableArr: () => [] },
                DataMgr: { level: 1 },
                LocalDataMgr: { GameInfo: { formation: {} } },
                Fighter: FighterToken,
                EffectGroup: EffectGroupToken,
            },
            egf: { Logger: { log() {}, warn() {}, error() {} }, EventMgr: { emit() {} }, PoolMgr: {} },
        },
    );
    GameMgr.dictFighter = {};
    return { GameMgr, FighterToken };
}

function testNestedPause(GameMgr) {
    const transitions = [];
    const participant = { setBattlePaused: (paused) => transitions.push(paused) };
    GameMgr.registerBattleLifecycle(participant);
    GameMgr.pauseGame();
    GameMgr.pauseGame();
    deepEqual(transitions, [true], "首次暂停应冻结一次，嵌套暂停不得重复切换");
    GameMgr.resumeGame();
    deepEqual(transitions, [true], "释放一个暂停来源时仍应保持冻结");
    GameMgr.resumeGame();
    deepEqual(transitions, [true, false], "最后一个暂停来源释放后才恢复");
    GameMgr.unregisterBattleLifecycle(participant);
}

function createTarget(GameMgr, x, generation = 1) {
    return {
        lifecycleGeneration: generation,
        isDead: false,
        node: new Node(x, 0),
        damage: 0,
        isLifecycleActive(expectedGeneration, expectedBattle) {
            return (
                !this.isDead &&
                this.lifecycleGeneration === expectedGeneration &&
                GameMgr.battleGeneration === expectedBattle &&
                this.node.parent !== null
            );
        },
        onDamage(value) {
            this.damage += value;
        },
    };
}

function testWeapon(GameMgr) {
    class ParticleSystemComponent {}
    class MeshRenderer {}
    class FighterToken {}
    const pooled = [];
    const { Weapon } = loadTypeScript(
        "assets/module_game/game/scripts/Weapon.ts",
        `
const _decorator = { ccclass: () => (value) => value, property: () => () => {} };
const Component = __deps.Component;
const Node = __deps.Node;
const Vec3 = __deps.Vec3;
const Prefab = class {};
const ParticleSystemComponent = __deps.ParticleSystemComponent;
const MeshRenderer = __deps.MeshRenderer;
const CCBoolean = Boolean;
const Material = class {};
const isValid = (node) => !!node && node.isValid !== false;
const Fighter = __deps.Fighter;
const Constants = { PLAYER_TEAM: 1 };
const GameMgr = __deps.GameMgr;
`,
        ["Weapon"],
        {
            __deps: { Component, Node, Vec3, ParticleSystemComponent, MeshRenderer, Fighter: FighterToken, GameMgr },
            egf: {
                PoolMgr: {
                    putNode(node) {
                        pooled.push(node);
                        node.parent = null;
                    },
                    getNode() {
                        return new Node();
                    },
                },
            },
        },
        true,
    );

    const newWeapon = () => {
        const weapon = new Weapon();
        weapon.node = new Node();
        weapon.pfTrail = null;
        weapon.isAutoRotate = true;
        return weapon;
    };

    GameMgr.reset();
    const attacker = createTarget(GameMgr, 0);
    const target = createTarget(GameMgr, 10);
    const hits = [];
    const weapon = newWeapon();
    weapon.throwMissile(target.node.worldPosition.clone(), 10, attacker, target, (_target, position) =>
        hits.push(position),
    );
    weapon.update(0.95);
    equal(hits.length, 0, "预测朝向超过终点时不得提前结算命中");
    weapon.update(0.05);
    equal(hits.length, 1, "投射物实际到达时应结算一次");
    weapon.update(1);
    equal(hits.length, 1, "已回收投射物不得重复结算");
    equal(hits[0].x, 10, "命中回调应携带实际目标位置");

    const pausedWeapon = newWeapon();
    const pausedHits = [];
    target.node.parent = {};
    pausedWeapon.throwMissile(target.node.worldPosition.clone(), 10, attacker, target, () => pausedHits.push(true));
    GameMgr.pauseGame();
    pausedWeapon.update(2);
    equal(pausedHits.length, 0, "暂停期间投射物不得前进或命中");
    GameMgr.resumeGame();
    pausedWeapon.update(1);
    equal(pausedHits.length, 1, "恢复后投射物应从原进度继续");

    const zeroWeapon = newWeapon();
    const zeroTarget = createTarget(GameMgr, 0);
    const zeroHits = [];
    zeroWeapon.throwMissile(zeroTarget.node.worldPosition.clone(), 10, attacker, zeroTarget, () => zeroHits.push(true));
    zeroWeapon.update(0);
    equal(zeroHits.length, 1, "零距离投射物应完成并回收");

    const staleWeapon = newWeapon();
    const staleTarget = createTarget(GameMgr, 5);
    const staleHits = [];
    staleWeapon.throwMissile(staleTarget.node.worldPosition.clone(), 5, attacker, staleTarget, () =>
        staleHits.push(true),
    );
    staleTarget.lifecycleGeneration++;
    staleWeapon.update(1);
    equal(staleHits.length, 0, "目标复用后旧投射物不得命中");
    check(pooled.length >= 4, "完成或失效的投射物应回收到对象池");
}

function testFighterAndModel(GameMgr) {
    class FighterModelToken {}
    class Prefab {}
    const constants = {
        FIGHTER_STATUS: { IDLE: 0, FIND: 1, DEAD: 2, CHARGE: 3, ATTACK: 4, MOVE: 5 },
        ANI_TYPE: { IDLE: 0, DIED: 1, RUN: 2, WALK: 3, ATTACK: 4, WIN: 5 },
        FIGHTER_TYPE: { CLOSE: 1 },
        MOVE_SPEED_BASE: 1,
        AOE_MAX_TARGETS: 5,
        AOE_PRIMARY_FULL: true,
        AOE_MIN_RATIO: 0.2,
        AOE_FALLOFF: 0.2,
        FIGHTER_DIRECTION_RANDOM: 0.2,
        PLAYER_TEAM: 1,
    };
    const hitPositions = [];
    GameMgr.effectGroup = {
        playEffect() {},
        playChairEffect: (_effect, position) => hitPositions.push(position.clone()),
    };
    const { Fighter } = loadTypeScript(
        "assets/module_game/game/scripts/Fighter.ts",
        `
const _decorator = { ccclass: () => (value) => value, property: () => () => {} };
const Component = __deps.Component;
const Node = __deps.Node;
const Vec3 = __deps.Vec3;
const Tween = __deps.Tween;
const Prefab = __deps.Prefab;
const isValid = (node) => !!node && node.isValid !== false;
const Constants = __deps.Constants;
const FighterModel = __deps.FighterModel;
const ModuleDef = { GAME: "game" };
const GameMgr = __deps.GameMgr;
const GameCfg = { queryByID: () => ({}) };
`,
        ["Fighter"],
        {
            __deps: {
                Component,
                Node,
                Vec3,
                Tween,
                Prefab,
                Constants: constants,
                FighterModel: FighterModelToken,
                GameMgr,
            },
            egf: {
                Logger: { log() {}, error() {} },
                AudioMgr: { playOneShot() {} },
                ResMgr: { getAsset() {} },
                PoolMgr: { putNode() {}, getNode: () => new Node() },
            },
        },
        true,
    );

    const fighter = new Fighter();
    fighter.node = new Node();
    fighter.isDead = false;
    fighter.fighterInfo = { damageRange: 0, scale: 1 };
    fighter._hp = 100;
    fighter._damage = 7;
    fighter._skillInfo = { hit: "hit" };
    fighter._lifecycleGeneration = 3;
    fighter._battleGeneration = GameMgr.battleGeneration;
    GameMgr.pauseGame();
    fighter.onDamage(20);
    equal(fighter._hp, 100, "暂停期间伤害入口不得扣血");
    GameMgr.resumeGame();
    fighter.onDamage(20);
    equal(fighter._hp, 80, "恢复后伤害入口应正常生效");

    const actualTarget = createTarget(GameMgr, 2, 4);
    const laterTarget = createTarget(GameMgr, 99, 5);
    fighter.target = laterTarget;
    fighter.hitEffect(actualTarget, new Vec3(7, 8, 9), 3, 4, GameMgr.battleGeneration);
    equal(hitPositions.at(-1).x, 7, "命中特效必须使用回调传入的位置而不是攻击者当前 target");
    equal(actualTarget.damage, 7, "有效命中应只伤害回调捕获的目标");

    class AnimationComponent {
        static EventType = { FINISHED: "finished" };

        constructor() {
            this.clips = [];
            this.offCalls = 0;
            this.stopCalls = 0;
        }

        once(_event, callback, target) {
            this.callback = callback;
            this.target = target;
        }

        off() {
            this.offCalls++;
        }

        stop() {
            this.stopCalls++;
        }

        pause() {}

        resume() {}

        play() {}
    }
    class SkeletalAnimation extends AnimationComponent {}
    const { FighterModel } = loadTypeScript(
        "assets/module_game/game/scripts/FighterModel.ts",
        `
const _decorator = { ccclass: () => (value) => value, property: () => () => {} };
const Component = __deps.Component;
const Node = __deps.Node;
const Material = class {};
const SkeletalAnimation = __deps.SkeletalAnimation;
const Prefab = class {};
const AnimationComponent = __deps.AnimationComponent;
const SkinnedMeshRenderer = class {};
const MeshRenderer = class {};
const CCBoolean = Boolean;
const Vec3 = __deps.Vec3;
const Fighter = class {};
const Constants = { PLAYER_TEAM: 1, ANI_TYPE: { IDLE: 0, ATTACK: 1 } };
const Weapon = class {};
const GameMgr = __deps.GameMgr;
`,
        ["FighterModel"],
        {
            __deps: { Component, Node, SkeletalAnimation, AnimationComponent, Vec3, GameMgr },
            egf: { Logger: { error() {} }, PoolMgr: {} },
        },
        true,
    );
    const model = new FighterModel();
    model.ani = new SkeletalAnimation();
    model.nodeWeapon = { active: false };
    model.bThrowWeapon = true;
    let triggered = 0;
    model.setEffectListener(() => triggered++, fighter);
    model.onceAniFinished(() => {}, fighter);
    model.reset();
    model.triggerEffect();
    equal(triggered, 0, "模型回池后不得残留攻击帧回调");
    equal(model.ani.offCalls, 1, "模型回池应取消动画完成监听");
    equal(model.ani.stopCalls, 1, "模型回池应停止旧动画播放状态");
    equal(model.nodeWeapon.active, true, "模型回池应恢复手持武器显示状态");
}

function testEffectPause(GameMgr) {
    class AnimationComponent {
        constructor() {
            this.pauseCount = 0;
            this.resumeCount = 0;
        }
        play() {}
        pause() {
            this.pauseCount++;
        }
        resume() {
            this.resumeCount++;
        }
    }
    class ParticleSystemComponent {
        constructor() {
            this.isPaused = false;
        }
        clear() {}
        stop() {}
        play() {
            this.isPaused = false;
        }
        pause() {
            this.isPaused = true;
        }
    }
    const { Effect } = loadTypeScript(
        "assets/module_game/game/scripts/Effect.ts",
        `
const _decorator = { ccclass: () => (value) => value, property: () => () => {} };
const Component = __deps.Component;
const AnimationComponent = __deps.AnimationComponent;
const ParticleSystemComponent = __deps.ParticleSystemComponent;
const Enum = (value) => value;
const GameMgr = __deps.GameMgr;
`,
        ["Effect"],
        { __deps: { Component, AnimationComponent, ParticleSystemComponent, GameMgr } },
        true,
    );
    const effect = new Effect();
    const animation = new AnimationComponent();
    const particle = new ParticleSystemComponent();
    effect.node.components.set(AnimationComponent, [animation]);
    effect.node.components.set(ParticleSystemComponent, [particle]);
    effect.keepTime = 1;
    effect.autoDestroy = false;
    let completed = 0;
    effect.setEndListener(() => completed++);
    effect.play();
    GameMgr.pauseGame();
    effect.update(2);
    equal(completed, 0, "暂停期间特效计时不得完成");
    check(particle.isPaused && animation.pauseCount === 1, "暂停应冻结粒子与动画");
    GameMgr.resumeGame();
    effect.update(1);
    equal(completed, 1, "恢复后特效应从剩余进度完成");
    check(!particle.isPaused && animation.resumeCount === 1, "恢复应继续粒子与动画");
}

function testLateEffectLoad(GameMgr) {
    const deferred = [];
    let pooledNodes = 0;
    class EffectToken {}
    const { EffectGroup } = loadTypeScript(
        "assets/module_game/game/scripts/EeffectGroup.ts",
        `
const _decorator = { ccclass: () => (value) => value };
const Component = __deps.Component;
const Vec3 = __deps.Vec3;
const instantiate = () => new __deps.Node();
const Prefab = class {};
const Node = __deps.Node;
const isValid = (node) => !!node && node.isValid !== false;
const ModuleDef = { GAME: "game" };
const Effect = __deps.Effect;
const PlatformMgr = { vibrate() {} };
const GameMgr = __deps.GameMgr;
`,
        ["EffectGroup"],
        {
            __deps: { Component, Vec3, Node, Effect: EffectToken, GameMgr },
            egf: {
                Logger: { warn() {} },
                ResMgr: { getAsset: (_bundle, _path, callback) => deferred.push(callback) },
                PoolMgr: { getNode: () => (++pooledNodes, new Node()), putNode() {} },
            },
        },
        true,
    );
    const group = new EffectGroup();
    group.node = new Node();
    const parent = new Node();
    group.playEffect("late", parent, new Vec3());
    GameMgr.reset();
    deferred.shift()({});
    equal(pooledNodes, 0, "上一局迟到的特效资源不得挂入新局");

    group.playEffect("invalid-parent", parent, new Vec3());
    parent.isValid = false;
    deferred.shift()({});
    equal(pooledNodes, 0, "父节点失效后迟到特效不得实例化");
}

function createClock() {
    let sequence = 0;
    const timers = new Map();
    return {
        setTimeout(callback) {
            const id = ++sequence;
            timers.set(id, callback);
            return id;
        },
        clearTimeout(id) {
            timers.delete(id);
        },
        runAll() {
            const callbacks = [...timers.values()];
            timers.clear();
            callbacks.forEach((callback) => callback());
        },
    };
}

function testUiSettlementTimer(GameMgr) {
    const clock = createClock();
    const shown = [];
    class UIController {
        constructor() {
            this.node = new Node();
            this.layout = {};
        }
        close() {}
    }
    const { UI_Fighter } = loadTypeScript(
        "assets/module_game/ui_fighter/UI_Fighter.ts",
        `
const isValid = (node) => !!node && node.isValid !== false;
const Vec3 = __deps.Vec3;
const Constants = { AUDIO_SOUND: { WIN: "win", FAIL: "fail" }, EVENT_NAME: { DROP_COIN: "coin", GAME_OVER: "over" } };
const DataMgr = { level: 1 };
const Layout_Fighter = class {};
const GameMgr = __deps.GameMgr;
const GameCfg = { queryByID: () => ({ coefficient: 1 }) };
const UI_Settlement = class {};
const PlatformMgr = { reportEvent() {} };
`,
        ["UI_Fighter"],
        {
            __deps: { Vec3, GameMgr },
            setTimeout: clock.setTimeout,
            clearTimeout: clock.clearTimeout,
            egf: {
                UIController,
                UILayers: { GAME: 1 },
                EventMgr: { on() {}, off() {} },
                Logger: { log() {} },
                AudioMgr: { playOneShot() {} },
                UIMgr: { showUI: (...args) => shown.push(args) },
            },
        },
    );
    const disposed = new UI_Fighter();
    disposed.onGameOver(true);
    disposed.onDispose();
    clock.runAll();
    equal(shown.length, 0, "战斗 UI 销毁后旧结算延时不得打开结算界面");

    const active = new UI_Fighter();
    active.onGameOver(false);
    clock.runAll();
    equal(shown.length, 1, "仍有效的战斗 UI 应正常打开结算界面");
}

function testFighterLogic(GameMgr, FighterToken) {
    const deferredAssets = [];
    const instantiateCalls = [];
    const referenceSource = fs
        .readFileSync(path.join(projectRoot, "tools/battle_separation_reference.js"), "utf8")
        .replace(/module\.exports = \{ legacySeparate, legacySeparateDictionary \};\s*$/, "");
    const { FighterLogic, legacySeparate, legacySeparateDictionary } = loadTypeScript(
        "assets/module_game/game/scripts/FighterLogic.ts",
        `
${referenceSource}
const _decorator = { ccclass: () => (value) => value, property: () => () => {} };
const Component = __deps.Component;
const Node = __deps.Node;
const Prefab = class {};
const Vec3 = __deps.Vec3;
const Vec2 = __deps.Vec3;
const geometry = { Ray: class {} };
const PhysicsSystem = { instance: {} };
const BoxCollider = class {};
const find = () => null;
const view = {};
const instantiate = (prefab) => __deps.instantiate(prefab);
const isValid = (node) => !!node && node.isValid !== false;
const Follow = class {};
const EffectGroup = class {};
const Constants = __deps.Constants;
const DataMgr = { level: 2, isDebugMode: false };
const Fighter = __deps.Fighter;
const FormationCell = class {};
const LocalDataMgr = { GameInfo: { formation: {} } };
const GameMgr = __deps.GameMgr;
const GameCfg = { loadConfig() {} };
const UI_Menu = class {};
const UI_Fighter = class {};
const BackResPkg = {};
const ModuleDef = { GAME: "game" };
`,
        ["FighterLogic", "legacySeparate", "legacySeparateDictionary"],
        {
            __deps: {
                Component,
                Node,
                Vec3,
                Fighter: FighterToken,
                GameMgr,
                instantiate(prefab) {
                    instantiateCalls.push(prefab);
                    return new Node();
                },
                Constants: {
                    EVENT_NAME: {},
                    COLLIDER_GROUP: { PLANE: 1 },
                    PLAYER_TEAM: 1,
                    FIGHTER_TYPE: { CLOSE: 1 },
                    FIRE_BALL_DISTANCE: 1,
                    FIRE_BALL_DAMAGE_PERCENT: 0.5,
                },
            },
            egf: {
                EventMgr: { on() {}, off() {}, emit() {} },
                Logger: { log() {}, error() {} },
                ResMgr: {
                    getAsset: (_bundle, _path, callback) => deferredAssets.push(callback),
                    preloadResPackage() {},
                },
                Utils: { getRandomInt: () => 1 },
                UIMgr: { showUI() {} },
                PoolMgr: {},
            },
        },
        true,
    );

    const logic = new FighterLogic();
    logic.cameraFollow = { initCamera() {} };
    logic.nodeFighters = new Node();
    logic.nodeMap = new Node();
    logic._aryCell = [];
    logic.initFighters = () => true;
    logic._checkSimilar = () => {};
    logic._fightReset();
    logic._fightReset();
    deferredAssets[0]({ old: true });
    equal(instantiateCalls.length, 0, "旧战斗地图资源迟到后不得实例化");
    deferredAssets[1]({ current: true });
    equal(instantiateCalls.length, 1, "当前战斗地图资源应正常实例化");

    const initial = [
        [0, 0],
        [0, 0],
        [0.3, 0],
        [1.1, 0.1],
        [-0.2, 0.2],
        [3, 3],
    ];
    const createNodes = () =>
        initial.map(([x, z]) => {
            const node = new Node(x, z);
            node.radius = 0.3;
            node.components.set(FighterToken, { isDead: false, radius: node.radius });
            return node;
        });
    const actualNodes = createNodes();
    const expectedNodes = createNodes();
    GameMgr.dictFighter = { 1: {}, 2: {} };
    actualNodes.forEach((node, index) => {
        GameMgr.dictFighter[index % 2 === 0 ? 1 : 2][index] = node;
    });
    legacySeparate([
        expectedNodes[0],
        expectedNodes[2],
        expectedNodes[4],
        expectedNodes[1],
        expectedNodes[3],
        expectedNodes[5],
    ]);
    logic._separateFighters();
    deepEqual(
        actualNodes.map((node) => [node.position.x, node.position.z]),
        expectedNodes.map((node) => [node.position.x, node.position.z]),
        "缓存版分离应保持原遍历顺序与两轮松弛结果",
    );

    const firstRecord = logic._separationItems[0];
    const firstBuckets = [...logic._separationBuckets.values()];
    actualNodes.forEach((node, index) => node.setPosition(initial[index][0], 0, initial[index][1]));
    logic._separateFighters();
    const secondBuckets = [...logic._separationBuckets.values()];
    equal(logic._separationItems[0], firstRecord, "分离记录对象应跨帧复用");
    check(
        firstBuckets.some((bucket) => secondBuckets.includes(bucket)),
        "网格桶应跨帧复用",
    );

    const benchmarkInitial = Array.from({ length: 160 }, (_, index) => [
        (index % 16) * 0.4,
        Math.floor(index / 16) * 0.4,
    ]);
    const benchmarkNodes = benchmarkInitial.map(([x, z]) => {
        const node = new Node(x, z);
        node.radius = 0.3;
        node.components.set(FighterToken, { isDead: false, radius: node.radius });
        return node;
    });
    GameMgr.dictFighter = { 1: {}, 2: {} };
    benchmarkNodes.forEach((node, index) => {
        GameMgr.dictFighter[index % 2 === 0 ? 1 : 2][index] = node;
    });
    logic._separateFighters();
    const cachedRecordCount = logic._separationItems.length;
    const cachedBucketCount = logic._separationBuckets.size;
    const rounds = 100;
    for (let round = 0; round < 20; round++) {
        benchmarkNodes.forEach((node, index) =>
            node.setPosition(benchmarkInitial[index][0], 0, benchmarkInitial[index][1]),
        );
        logic._separateFighters();
    }
    let start = performance.now();
    for (let round = 0; round < rounds; round++) {
        benchmarkNodes.forEach((node, index) =>
            node.setPosition(benchmarkInitial[index][0], 0, benchmarkInitial[index][1]),
        );
        logic._separateFighters();
    }
    const cachedMilliseconds = performance.now() - start;
    const recordsAfterBenchmark = logic._separationItems.length;

    const legacyNodes = benchmarkInitial.map(([x, z]) => {
        const node = new Node(x, z);
        node.radius = 0.3;
        node.components.set(FighterToken, { isDead: false, radius: node.radius });
        return node;
    });
    const legacyDictionary = { 1: {}, 2: {} };
    legacyNodes.forEach((node, index) => {
        legacyDictionary[index % 2 === 0 ? 1 : 2][index] = node;
    });
    for (let round = 0; round < 20; round++) {
        legacyNodes.forEach((node, index) =>
            node.setPosition(benchmarkInitial[index][0], 0, benchmarkInitial[index][1]),
        );
        legacySeparateDictionary(legacyDictionary, FighterToken);
    }
    start = performance.now();
    for (let round = 0; round < rounds; round++) {
        legacyNodes.forEach((node, index) =>
            node.setPosition(benchmarkInitial[index][0], 0, benchmarkInitial[index][1]),
        );
        legacySeparateDictionary(legacyDictionary, FighterToken);
    }
    const legacyMilliseconds = performance.now() - start;
    equal(recordsAfterBenchmark, cachedRecordCount, "预热后同兵力分离不得继续分配记录对象");
    console.log(
        `分离对比: fighters=160 rounds=${rounds} cached=${cachedMilliseconds.toFixed(2)}ms ` +
            `legacy=${legacyMilliseconds.toFixed(2)}ms cachedRecords=${cachedRecordCount} ` +
            `cachedBuckets=${cachedBucketCount} newCachedRecords=0`,
    );

    logic.onDestroy();
    equal(logic._separationItems.length, 0, "场景销毁应释放分离记录缓存");
    equal(logic._separationBuckets.size, 0, "场景销毁应释放网格缓存");
    equal(logic._separationBucketPool.length, 0, "场景销毁应释放桶池缓存");
}

function main() {
    const { GameMgr, FighterToken } = createGameManager();
    testNestedPause(GameMgr);
    testWeapon(GameMgr);
    testFighterAndModel(GameMgr);
    testEffectPause(GameMgr);
    testLateEffectLoad(GameMgr);
    testUiSettlementTimer(GameMgr);
    testFighterLogic(GameMgr, FighterToken);
    console.log(`战斗生命周期回归检查通过：${assertionCount} 项断言`);
}

main();
