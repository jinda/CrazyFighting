# AGENTS.md

## 项目概览

- 本项目是使用 **Cocos Creator 3.8.8** 开发的竖屏 3D 游戏，主要语言为 TypeScript。
- 项目设计分辨率为 `720 × 1280`，使用 Cocos legacy render pipeline。
- `npm` 只用于 TypeScript、ESLint、Prettier 等开发工具；预览与构建通过 Cocos Creator 编辑器完成。
- 运行时代码主要位于 `assets/`，不是传统的 `src/` Web 前端项目。
- 项目使用自有 `egf` 框架封装 UI、资源、事件、网络、音频、ECS/FSM 等能力。
- `module_game`、`module_extra`、`module_i18n`、`module_sounds` 是 Cocos Asset Bundle。

## 项目结构

```text
assets/
├── start/                  # 启动场景逻辑与首屏加载
├── scripts/                # 全局配置、数据、API、平台 SDK、模块/场景/UI 定义
├── core_code/              # egf 基础框架：UI、资源、网络、ECS、FSM、通用工具
├── module_game/            # 核心玩法、战斗场景与游戏 UI Bundle
├── module_extra/           # 通用弹窗、设置、HUD、奖励等 UI Bundle
├── module_i18n/            # 多语言资源 Bundle
├── module_sounds/          # 音频资源 Bundle
└── res/                    # 模型、材质、动画、字体、特效等公共资源
tools/                      # 角色 Prefab 生成与校验脚本
settings/                   # Cocos Creator 项目设置
build-templates/            # 平台构建模板（当前含 wechatgame）
preview-template/           # Cocos 预览模板
extensions/cocos-service/   # Cocos 编辑器扩展；非业务代码
```

## 开发与校验命令

```bash
# TypeScript 类型检查；依赖 Cocos Creator 生成的 temp/tsconfig.cocos.json
npm run typecheck

# ESLint（仅检查 assets/**/*.ts）
npm run lint
npm run lint:fix

# Prettier（仅处理 assets/**/*.ts）
npm run format:check
npm run format

# 校验角色 Prefab 的结构与引用
node tools/verify_role_prefabs.js
```

- 项目没有 `npm dev`、`npm build` 或自动化测试脚本；不要虚构或调用这些命令。
- 预览、场景运行和平台构建使用 Cocos Creator 3.8.8。
- 暂未配置测试框架；如需引入测试框架或新增依赖，先与用户确认。
- `tools/build_role_prefabs.js` 会批量重写角色 `.prefab`/`.meta`，并依赖本机 `library/` 导入缓存；仅在任务明确要求重新生成角色 Prefab 时运行，随后必须执行 `node tools/verify_role_prefabs.js` 并检查 diff。

## TypeScript 与格式规范

- 遵循 `.prettierrc`：4 空格、双引号、分号、行宽 120、尾随逗号、LF 换行。
- 遵循 `eslint.config.mjs`；新增代码不得引入新的 ESLint error。
- 使用明确类型；新代码避免 `any`、`Function`、非必要的非空断言以及类型逃逸。
- 不使用 `@ts-ignore` / `@ts-nocheck`。存量代码中的 `any` 和 `@ts-ignore` 属于待清理技术债，不应照搬。
- 类与组件使用 PascalCase，函数和变量使用 camelCase，常量使用 UPPER_SNAKE_CASE；沿用既有 Cocos 序列化字段名时以兼容 Prefab/Scene 为先。
- 优先使用 `const`；仅在确实需要重新赋值时使用 `let`，禁止 `var`。
- 使用严格相等 `===` / `!==`，新增分支使用花括号并保证所有需要返回值的路径都有返回值。
- 日志使用 `egf.Logger`；避免新增 `console.log`，错误和警告分别使用 `egf.Logger.error` / `egf.Logger.warn`。
- 导入优先按“Cocos `cc` 模块 → `db://assets/...` 项目绝对路径 → 相对路径”组织；同一文件内保持分组稳定，不为排序制造无关 diff。

## Cocos 组件与资源约定

- Cocos 组件使用 `_decorator`、`@ccclass("ClassName")` 和 `@property(...)`；类名、`ccclass` 名及 Prefab/Scene 已序列化引用必须保持兼容。
- 编辑器注入的 `@property` 字段沿用明确的 Cocos 类型；仅此类字段可按现有模式初始化为 `null!`。
- 生命周期逻辑放在合适的 `onLoad`、`start`、`onEnable`、`onDisable`、`onDestroy` 中，避免在模块顶层执行依赖场景状态的逻辑。
- 注册 `egf.EventMgr`、`Node.EventType`、定时器或调度器时，必须在对应销毁/停用路径中解除监听、清理定时器或停止调度。
- 节点、Tween、异步加载回调执行前要考虑对象是否仍有效；资源加载失败必须记录错误并安全退出。
- 不直接绕过既有封装：UI 使用 `egf.UIMgr` / `egf.UIController`，资源使用 `egf.ResMgr`，事件使用 `egf.EventMgr`，网络请求集中在 `assets/scripts/ClientApi.ts` 或 `core_code/network/`。
- UI 通常由 `Layout_Xxx` Cocos 组件保存序列化节点引用，由 `UI_Xxx`（继承 `egf.UIController`）负责交互、事件订阅和业务逻辑；跨 Bundle 的 UI 声明放在 `assets/scripts/UIDef.ts` 并保持 `@egf_class(ModuleDef.XXX)` 一致。
- 新增 Asset Bundle 时同步维护 `assets/scripts/ModuleDef.ts` 及相应目录 `.meta` 配置；新增场景/UI 定义时检查 `SceneDef.ts`、`UIDef.ts` 和资源路径。
- 平台差异通过 `assets/scripts/SDK/PlatformMgr.ts` 及对应平台实现处理，不在业务组件中散落平台 API 判断。

## 资源与生成目录安全

- 禁止修改或提交 Cocos/工具生成目录：`library/`、`temp/`、`local/`、`build/`、`profiles/`、`native/`、`node_modules/`。
- 不直接修改 `dist/`（若出现）或其他构建输出。
- `.meta` 文件包含 Cocos UUID 和资源导入信息。新增、移动、重命名或删除资源时优先通过 Cocos Creator 编辑器操作，并将资源与对应 `.meta` 一起处理。
- 不随意改写 `.scene`、`.prefab`、`.anim`、`.mtl` 等序列化资源；修改后必须检查引用、UUID 和编辑器中的实际表现。
- `assets/scripts/libs/`、`extensions/cocos-service/` 视为第三方/扩展代码，除非任务明确指向，否则不要修改或统一格式化。
- `settings/`、`build-templates/`、`preview-template/` 的改动会影响全项目或平台构建，修改前先确认任务确实需要。
- 不硬编码密钥、Token、AK/SK 或生产环境凭据；环境地址和游戏标识统一通过 `assets/scripts/config/` 管理。

## 数据、网络与错误处理

- 全局运行时数据沿用 `DataMgr`，本地持久化沿用 `LocalDataMgr`；不要在 UI 中另建重复状态源。
- API 数据结构放在 `assets/scripts/apiInterface.ts` 或相邻的明确类型文件中。
- 新增客户端接口统一封装在 `ClientApi`，复用 `egf.HttpMgr` 的 Header、鉴权与错误处理，不在组件中直接使用 `fetch`/`XMLHttpRequest`。
- 异步操作和回调必须处理失败路径；用户可见错误使用本地化后的友好提示，技术细节写入日志。
- `catch` 块不得静默吞错；若确需容忍坏数据，至少保留注释并提供安全默认值或日志。
- 修改存档结构、加密字段、登录流程或支付/广告逻辑时，必须考虑旧数据兼容和不同平台行为。

## Git 与协作约定

- 遵循 Conventional Commits：`feat`、`fix`、`docs`、`style`、`refactor`、`test`、`chore`。
- 禁止使用 `git stash`，禁止切换分支；多 Agent 共用工作区时不得覆盖他人的未提交修改。
- 只修改并提交当前任务涉及的文件；未经明确要求不要提交。
- 不提交 lock 文件，除非用户明确要求安装/升级依赖并接受对应变更。
- 修改全局配置、安装/删除依赖或引入测试框架前，先征得用户确认。

## 交付前检查

- TypeScript 改动至少运行 `npm run typecheck` 和 `npm run lint`。
- 格式相关改动运行 `npm run format:check`；不要对资源文件或第三方目录做批量格式化。
- Prefab/Scene/资源改动除静态检查外，还应在 Cocos Creator 3.8.8 中打开相关场景或 Prefab 验证序列化引用和运行效果。
- 角色 Prefab 改动额外运行 `node tools/verify_role_prefabs.js`。
- 若无法执行 Cocos 编辑器内验证，在交付说明中明确列出未验证项。
