# AGENTS.md

- 本项目为 Unknown + TypeScript 前端应用
- 包管理器：`npm`
- 样式方案：CSS
- UI 组件库：无
- Prettier：、尾随逗号

## Project Structure

```
src/```


- `Never` edit `dist/` or `build/` — 构建产物目录

## Build & Dev Commands

```bash
# 开发
npm dev

# 构建
npm build

# 代码格式化
npm lint           # eslint \
```

- 测试框架暂未配置，如需添加测试请先与用户确认方案


## Coding Style & Naming

**组件**
- 命名：PascalCase
- 使用明确的类型定义
- 导出：`export default Component`


**命名规范**
- 组件目录：PascalCase（如 `CopyButton/`）
- Hook 函数：`useXxx`（如 `useAuth`）
- 常量：`UPPER_SNAKE_CASE`（如 `MAX_RETRY_COUNT`）
- CSS 类名：kebab-case（如 `copy-button`）
- 工具函数 / 变量：camelCase（如 `formatDate`）
- 类型 / 接口：PascalCase（如 `IUserInfo` 或 `UserInfo`）

**导入顺序**
```ts
// 1. 框架核心（React / Vue）
// 2. UI 组件库（antd / element-plus）
// 3. 第三方工具（lodash / dayjs）
// 4. 路径别名（@/ 开头）
// 5. 相对路径导入
// 6. 样式文件（放最后）
```

## Commit & Git Convention

**Commit Message**
- 遵循 Conventional Commits 规范
- 格式：`type(scope): description`
- 类型：feat / fix / docs / style / refactor / test / chore

**提交前**
- lint-staged 会自动运行格式化和 lint 检查
- `Never` 使用 `git stash` — 会影响其他 Agent 的工作区
- `Never` 切换分支 — 只在当前分支工作
- 只 commit 自己修改的文件

## Component & API Conventions

**组件开发**
- 新建组件在 `src/components/` 下创建 PascalCase 目录
- 目录结构：入口文件 + 样式文件（如 `index.tsx` + `index.less`）
- 复杂组件可添加 `types.ts` 集中定义类型

**API 开发**
- 新增 API 在 `src/services/` 对应业务模块下添加
- 类型定义放在 `src/typings/` 或服务模块同级 `typings.d.ts`

## Never Rules

- `Never` 使用 `any` 类型 — 必须定义明确的类型
- `Never` 使用内联样式（`style={{ }}`），除非需要动态计算

- `Never` 在组件中直接调用 fetch/axios — 使用 `src/services/` 封装
- `Never` 在列表渲染中省略 `key` 属性
- `Never` 修改 `node_modules/` 或构建产物目录
- `Never` 在渲染路径中执行耗时操作（如 `new Date()`、大循环）
- `Never` 提交 lock 文件 — 除非明确要求安装新依赖
- `Never` 在代码中硬编码敏感信息（密钥、token、AK/SK）
- `Never` 修改框架自动生成的目录
- `Never` 在 `useEffect` / `watch` 中遗漏依赖项或清理函数
- `Never` 在全局作用域中抛出未捕获的异步错误
- `Never` 使用 `git stash` 或切换分支 — 多 Agent 并发安全
- `Never` 跳过 TypeScript 类型检查（`@ts-ignore` / `@ts-nocheck`）
- `Never` 在 `catch` 块中吞掉错误不做任何处理

## Multi-Agent Safety

- 禁止 `git stash`、禁止切换分支
- 只 commit 自己修改的文件
- 修改全局配置文件前先与用户确认
- 安装 / 删除依赖前先与用户确认

## Quick Commands（AI 指令）

以下指令可直接对 AI 说，AI 会按照本文件的规范执行：

| 指令 | 说明 |
|------|------|
| `分析项目规范` | 扫描源码，学习项目的隐性编码习惯，产出规范总结 |
| `CR 代码` | 自动 Review 暂存区代码，检查 Never 规则，生成 Conventional Commits 格式的 commit 信息 |
| `生成变量名` | 根据上下文 + 社区约定推荐命名（变量 / 函数 / 组件 / CSS 类名） |

## Error Handling

- 异步操作必须有 try-catch 或 .catch() 兜底
- 用户可见的错误需要友好提示，不暴露技术细节
- API 错误统一在 `src/services/` 的请求封装中处理
- 组件级错误使用 ErrorBoundary 捕获（React）或 onErrorCaptured（Vue）
