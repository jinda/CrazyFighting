const assert = require("node:assert/strict");
const { Component, Node, createGameManager, loadTypeScript } = require("./verify_battle_lifecycle_repair");

const { GameMgr } = createGameManager();
let scheduledCallback = null;

const { Layout_Fighter } = loadTypeScript(
    "assets/module_game/ui_fighter/Layout_Fighter.ts",
    `
const _decorator = { ccclass: () => (value) => value, property: () => () => {} };
const Component = __deps.Component;
const Node = __deps.Node;
const Button = class {};
const Label = class {};
const Animation = class {};
const Sprite = class {};
const UITransform = class {};
const v3 = (...values) => values;
const Constants = { SkillCD: 5 };
const DataMgr = { level: 1 };
const GameMgr = __deps.GameMgr;
`,
    ["Layout_Fighter"],
    {
        __deps: { Component, Node, GameMgr },
        egf: { i18nMgr: { getText: () => "" } },
    },
    true,
);

const layout = new Layout_Fighter();
layout.btnSkill = { interactable: true };
layout.labelSkillCD = { string: "" };
layout.spriteSkillGray = { node: { active: false }, fillRange: 0 };
layout.skillTipsAnim = { node: { active: false }, stop() {} };
layout.nodeHand = { active: false };
layout.labelCoin = { string: "" };
layout.schedule = (callback) => {
    scheduledCallback = callback;
};
layout.unschedule = (callback) => {
    if (scheduledCallback === callback) {
        scheduledCallback = null;
    }
};

layout.showSkillStatus(true);
assert.equal(layout._skillCD, 4, "技能使用后应按原规则立即进入冷却");
assert.equal(typeof scheduledCallback, "function", "技能冷却应注册稳定的调度回调");

GameMgr.pauseGame();
GameMgr.pauseGame();
const pausedCooldown = layout._skillCD;
scheduledCallback();
assert.equal(layout._skillCD, pausedCooldown, "嵌套暂停期间技能冷却不得下降");

layout.updateCoin(7);
assert.equal(layout.labelCoin.string, "7", "暂停不得冻结战斗 UI 交互逻辑");

GameMgr.resumeGame();
scheduledCallback();
assert.equal(layout._skillCD, pausedCooldown, "释放一个暂停来源后技能冷却仍应冻结");

GameMgr.resumeGame();
scheduledCallback();
assert.equal(layout._skillCD, pausedCooldown - 1, "释放全部暂停来源后技能冷却应继续原进度");

layout.onDisable();
assert.equal(scheduledCallback, null, "组件停用时应清理技能冷却调度");

console.log("战斗技能暂停回归检查通过：7 项断言");
