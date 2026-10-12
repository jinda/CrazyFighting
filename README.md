# CrazyFighting

使用 **Cocos Creator 3.8.8** 和 **TypeScript** 开发的竖屏 3D 游戏。玩家通过购买、合并士兵和调整阵型挑战关卡，并获得金币用于后续成长。

项目使用自有 `egf` 框架管理 UI、资源、事件、网络、音频、ECS 和状态机；资源按 Cocos Asset Bundle 组织。

## 项目概况

| 项目 | 说明 |
| --- | --- |
| 引擎 | Cocos Creator 3.8.8 |
| 语言 | TypeScript，开发依赖版本为 5.8.3 |
| 画面 | 竖屏 3D，设计分辨率 720 × 1280 |
| 渲染管线 | Cocos legacy render pipeline |
| 启动场景 | `assets/start/start.scene` |
| 游戏场景 | `assets/module_game/scene/fight.scene` |
| 开发工具 | npm、ESLint 9、Prettier 3 |
| 本地存档 | `sys.localStorage`，使用 `crypto-ts` 的 AES 加密 |

主要功能包括：

- 士兵购买、合并、解锁与阵型调整。
- 关卡战斗、技能、掉落金币及胜负结算。
- 金币加成、士兵和土地升级。
- 签到、在线奖励、每日奖励及激励广告奖励。
- 排行榜、音效、设置和多语言资源。

## 快速开始

### 准备环境

- 安装 Cocos Creator **3.8.8**。
- 准备 Node.js 和 npm，用于安装依赖及运行校验工具。仓库未指定 Node.js 版本。
- 获取完整工程，保留资源对应的 `.meta` 文件。

在项目根目录安装依赖：

```bash
npm install --package-lock=false
```

该命令不生成或更新 `package-lock.json`。依赖变更需遵循项目协作约定。

### 打开与预览

1. 使用 Cocos Creator 3.8.8 打开项目根目录，等待资源导入完成。
2. 检查 [环境配置](assets/scripts/config/config.ts) 中的服务地址和游戏标识。
3. 在编辑器中打开 `assets/start/start.scene`。
4. 使用编辑器预览按钮运行启动场景，资源加载完成后会进入 `fight` 场景。

从启动场景运行可以完成框架初始化、资源预加载、本地数据加载、登录和广告配置获取。直接运行战斗场景时，应确认这些初始化已经完成。

### 构建

通过 Cocos Creator 的构建发布面板选择目标平台，并将 `start` 设置为启动场景。项目包含微信小游戏构建模板；微信小游戏、抖音小游戏和 Android 的平台逻辑由各自 SDK 适配类处理。

npm 脚本用于代码检查和格式化，预览与平台构建通过 Cocos Creator 完成。仓库未配置 `npm run dev`、`npm run build` 或自动化测试脚本。

## 目录结构

```text
CrazyFighting/
├── assets/
│   ├── start/                  # 启动场景、加载界面和初始化逻辑
│   ├── scripts/                # 全局数据、API、配置、平台 SDK 和模块定义
│   ├── core_code/              # egf 框架
│   ├── module_game/            # 核心玩法与游戏 UI Bundle
│   │   ├── datas/              # 士兵、关卡、技能 CSV 配置
│   │   ├── game/               # 战斗逻辑、角色和玩法资源
│   │   └── scene/              # fight 场景及场景组件
│   ├── module_extra/           # HUD、设置、奖励和通用弹窗 Bundle
│   ├── module_i18n/            # 多语言文字及图片 Bundle
│   ├── module_sounds/          # 音频 Bundle
│   └── res/                    # 模型、材质、动画、字体、特效等公共资源
├── tools/                      # 角色 Prefab 生成与校验脚本
├── settings/                   # Cocos Creator 项目设置
├── build-templates/            # 平台构建模板
├── preview-template/           # 编辑器预览模板
├── extensions/cocos-service/   # Cocos 编辑器扩展
├── client-api.md               # 客户端接口协议
├── AGENTS.md                   # 开发与协作约定
└── package.json                # 工程信息、依赖与检查脚本
```

## 主要代码入口

| 模块 | 入口与职责 |
| --- | --- |
| 启动流程 | [Start.ts](assets/start/Start.ts)：初始化框架、SDK、资源、本地数据及登录流程 |
| 玩法场景 | [FightScene.ts](assets/module_game/scene/FightScene.ts)：显示 HUD 并管理场景背景音乐 |
| 玩法交互 | [FighterLogic.ts](assets/module_game/game/scripts/FighterLogic.ts)：加载玩法配置、初始化阵型与主界面，处理布阵和合并 |
| 战斗管理 | [GameMgr.ts](assets/module_game/game/scripts/GameMgr.ts)：阵型、士兵、战斗状态和暂停管理 |
| 玩法配置 | [GameConfig.ts](assets/module_game/game/scripts/GameConfig.ts)：加载和查询 `fighter`、`level`、`skill` 表 |
| 运行时数据 | [DataMgr.ts](assets/scripts/DataMgr.ts)：金币、关卡、服务器同步及通关进度上报 |
| 本地存档 | [LocalDataMgr.ts](assets/scripts/LocalDataMgr.ts)：阵型、成长、签到、设置及存档读写 |
| 客户端接口 | [ClientApi.ts](assets/scripts/ClientApi.ts) 与 [apiInterface.ts](assets/scripts/apiInterface.ts)：请求封装及接口类型 |
| 平台适配 | [PlatformMgr.ts](assets/scripts/SDK/PlatformMgr.ts)：选择 SDK 实现并统一调用平台能力 |
| 基础框架 | [egf.ts](assets/core_code/egf.ts)：框架能力入口 |

UI 通常分为两层：`Layout_Xxx` Cocos 组件保存编辑器注入的节点引用，`UI_Xxx` 控制器负责交互和业务逻辑。跨 Bundle 的 UI、场景和模块声明分别维护在 `UIDef.ts`、`SceneDef.ts` 和 `ModuleDef.ts` 中。

## 配置与平台

### 服务配置

配置入口为 [config.ts](assets/scripts/config/config.ts)，通过 [GetEnvConfig](assets/scripts/config/EnvConfig.ts) 读取。

| 字段 | 用途 |
| --- | --- |
| `url` | HTTP 服务地址；`ClientApi` 在请求时拼接 `/client/...` 接口路径 |
| `game_code` | 游戏标识，作为 `X-Game-Code` 请求头发送 |
| `version` | 游戏版本，用于运行时上报 |
| `platform` | 配置中的平台字段；实际 SDK 选择由 `PlatformMgr` 根据运行环境判断 |

接口协议、参数和错误码见 [客户端 API 文档](client-api.md)。登录成功后，客户端通过 `Authorization: Bearer ...` 请求头携带认证信息。

### 平台适配

| 环境 | 当前客户端处理方式 |
| --- | --- |
| 浏览器 / H5 | 使用默认 `SDKBase`，通过设备标识进行游客登录 |
| 微信小游戏 | 使用 `IWeChat`，通过微信登录 code 调用 OAuth 登录 |
| 抖音小游戏 | 使用 `ITT`；当前启动代码走游客登录分支 |
| Android | 使用 `IAndroid`；当前 `ClientApi` 跳过 HTTP 请求，金币使用本地余额 |

平台发布前应在对应开发工具或真机中验证登录、广告及前后台切换。平台适配代码集中在 `assets/scripts/SDK/`。

## 数据与金币同步

本地存档由 `LocalDataMgr` 管理，运行时金币通过 `DataMgr` 统一修改：

- **在线**：界面立即显示金币变化，账本操作串行发送；成功后使用服务器返回余额校准，并保留尚未确认操作的显示效果。
- **离线**：使用本地余额，金币加减保存到本地，不记录离线金币补报。
- **恢复联网**：查询服务器资源账本，直接用服务器余额覆盖本地金币。离线期间的变化不会合并到服务器。
- **自动恢复**：前台期间每 15 秒尝试同步或恢复登录，返回前台时立即尝试；后台暂停重试。
- **存档兼容**：旧版金币补报队列会被清理，云存档中的金币不能覆盖当前余额。通关进度仍按原有机制补报。

例如，服务器余额为 100，离线游玩后本地余额为 150，恢复联网同步成功后余额为 100。

## 开发与校验

在项目根目录执行：

```bash
# TypeScript 类型检查
npm run typecheck

# ESLint 检查
npm run lint

# Prettier 格式检查
npm run format:check

# 角色 Prefab 结构与引用校验
node tools/verify_role_prefabs.js
```

需要自动修复时，可运行 `npm run lint:fix` 或 `npm run format`；这些命令会改写 `assets/**/*.ts`，运行后应检查差异，避免产生无关修改。

`typecheck` 依赖编辑器生成的 `temp/tsconfig.cocos.json` 及 Cocos 类型声明。首次检查前应先用对应版本的编辑器打开工程。当前没有配置测试框架，玩法验证通过编辑器预览及目标平台运行完成。

### 角色资源工具

[build_role_prefabs.js](tools/build_role_prefabs.js) 会批量重写角色 `.prefab` 和 `.meta`，并依赖本机 `library/` 导入缓存。仅在明确需要重新生成角色资源时运行，完成后必须执行校验脚本、检查差异，并在编辑器中确认模型、动画和节点引用。

## 常见问题

| 问题 | 排查方式 |
| --- | --- |
| 缺少 `temp/tsconfig.cocos.json`，或无法解析 `cc` | 使用 Cocos Creator 3.8.8 打开工程，确认资源导入和 TypeScript 环境生成完成；不要直接改写生成文件 |
| 找不到 `tsc`、`eslint` 或 `prettier` | 确认依赖已安装；跨操作系统复制的 `node_modules` 可能导致命令入口不可用，应在实际开发环境重新安装依赖 |
| 直接预览战斗场景时初始化不完整 | 从 `assets/start/start.scene` 启动 |
| 登录或服务器请求失败 | 检查服务地址、网络连接、`game_code` 和登录状态；金币同步失败时继续使用本地余额 |
| 联网后金币减少 | 按当前同步规则，服务器余额会覆盖离线余额，离线收益不会补报 |
| Prefab、动画或材质引用丢失 | 检查资源与 `.meta` 是否完整，以及关联资源是否已导入；使用编辑器检查序列化引用 |

## 开发约定

- 代码格式采用 4 空格、双引号、分号、120 列行宽和 LF 换行。
- UI、资源、事件、网络与日志沿用 `egf` 封装；跨平台能力通过 `PlatformMgr` 调用。
- 新增或调整资源时同时处理对应 `.meta`，保留已有 UUID 和序列化字段兼容性。
- `library/`、`temp/`、`local/`、`build/`、`profiles/`、`native/` 和 `node_modules/` 为生成目录。
- 遵循 Conventional Commits；仅提交当前任务涉及的文件，依赖和锁文件变更需明确确认。

完整约定见 [AGENTS.md](AGENTS.md)，视觉设计参考见 [DESIGN.md](DESIGN.md)。
