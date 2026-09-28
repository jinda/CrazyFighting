#!/bin/bash
# AGENTS.md + DESIGN.md 自动生成器（精简版 v4）
# 读取 package.json + tsconfig + prettierrc，自动识别技术栈，生成 AI 规范文件
# 产出：AGENTS.md（~130 行）+ AGENTS.local.md + DESIGN.md（~35 行）
# 策略：AGENTS.md / DESIGN.md 默认覆盖，AGENTS.local.md 存在则跳过

PROJECT_DIR=$(pwd)
PKG="$PROJECT_DIR/package.json"

if [ ! -f "$PKG" ]; then
  echo "❌ 未找到 package.json，请在项目根目录执行"
  exit 1
fi

# ── 读取项目名 ──
PROJECT_NAME=$(cat "$PKG" | grep '"name"' | head -1 | sed 's/.*: *"\(.*\)".*/\1/' | sed 's/@.*\///')
echo "📦 项目: $PROJECT_NAME"

# ── 技术栈检测（含 Monorepo 兜底）──
DEPS=$(cat "$PKG" | tr -d '\n')
FRAMEWORK="Unknown"
UI_LIB="无"
CSS_SCHEME="CSS"
CSS_IMPORT=""
PKG_MGR="npm"
LANG="JavaScript"
IS_MONOREPO="false"

# Monorepo 检测：如果根 package.json 检测不到框架，扫描子包
detect_from_deps() {
  local D="$1"
  echo "$D" | grep -q '"react"' && FRAMEWORK="React" || true
  echo "$D" | grep -q '"vue"' && FRAMEWORK="Vue" || true
  echo "$D" | grep -q '"next"' && FRAMEWORK="Next.js" || true
  echo "$D" | grep -q '"nuxt"' && FRAMEWORK="Nuxt" || true
  echo "$D" | grep -q '"@angular/core"' && FRAMEWORK="Angular" || true
  echo "$D" | grep -q '"svelte"' && FRAMEWORK="Svelte" || true
  echo "$D" | grep -q '"@ali/ppx"\|"umi"\|"@umijs"' && FRAMEWORK="$FRAMEWORK + Umi" || true
  echo "$D" | grep -q '"antd"\|"@ant-design"' && UI_LIB="Ant Design" || true
  echo "$D" | grep -q '"element-plus"' && UI_LIB="Element Plus" || true
  echo "$D" | grep -q '"element-ui"' && UI_LIB="Element UI" || true
  echo "$D" | grep -q '"@arco-design"' && UI_LIB="Arco Design" || true
  echo "$D" | grep -q '"@douyinfe/semi-ui"' && UI_LIB="Semi Design" || true
  echo "$D" | grep -q '"vant"' && UI_LIB="Vant" || true
  echo "$D" | grep -q '"@mui/material"\|"@material-ui"' && UI_LIB="Material UI" || true
  echo "$D" | grep -q '"less"' && CSS_SCHEME="Less + CSS Modules" && CSS_IMPORT="import styles from './index.less'" || true
  echo "$D" | grep -q '"sass"\|"node-sass"' && CSS_SCHEME="Sass/SCSS" && CSS_IMPORT="import styles from './index.module.scss'" || true
  echo "$D" | grep -q '"tailwindcss"' && CSS_SCHEME="Tailwind CSS" && CSS_IMPORT="" || true
  (echo "$D" | grep -q '"styled-components"' || echo "$D" | grep -q '"@emotion/') && CSS_SCHEME="CSS-in-JS" && CSS_IMPORT="" || true
}

# 先从根 package.json 检测
detect_from_deps "$DEPS"

# 如果框架仍为 Unknown，尝试 Monorepo 子包扫描
if [ "$FRAMEWORK" = "Unknown" ] || [ "$FRAMEWORK" = "Unknown + Umi" ]; then
  # 检测是否为 Monorepo
  if [ -f "$PROJECT_DIR/lerna.json" ] || [ -f "$PROJECT_DIR/pnpm-workspace.yaml" ] || echo "$DEPS" | grep -q '"workspaces"'; then
    IS_MONOREPO="true"
    echo "📦 检测到 Monorepo 结构，扫描子包..."
    for SUB_PKG in "$PROJECT_DIR"/packages/*/package.json "$PROJECT_DIR"/apps/*/package.json; do
      [ -f "$SUB_PKG" ] || continue
      SUB_DEPS=$(cat "$SUB_PKG" | tr -d '\n')
      detect_from_deps "$SUB_DEPS"
      [ "$FRAMEWORK" != "Unknown" ] && [ "$FRAMEWORK" != "Unknown + Umi" ] && break
    done
  fi
fi

# 版本号
FRAMEWORK_VERSION=$(cat "$PKG" | grep -E '"react"|"vue"|"@angular/core"' | head -1 | grep -oE '[0-9]+' | head -1 2>/dev/null)
[ -n "$FRAMEWORK_VERSION" ] && [ "$FRAMEWORK" != "Unknown" ] && FRAMEWORK="$FRAMEWORK $FRAMEWORK_VERSION"

# 包管理器
[ -f "$PROJECT_DIR/yarn.lock" ] || [ -f "$PROJECT_DIR/.yarnrc" ] || [ -f "$PROJECT_DIR/.yarnrc.yml" ] && PKG_MGR="yarn"
[ -f "$PROJECT_DIR/pnpm-lock.yaml" ] && PKG_MGR="pnpm"
[ -f "$PROJECT_DIR/bun.lockb" ] && PKG_MGR="bun"

# TypeScript
(echo "$DEPS" | grep -q '"typescript"' || [ -f "$PROJECT_DIR/tsconfig.json" ]) && LANG="TypeScript" || true

# UI 库主色（用于 DESIGN.md）
PRIMARY_COLOR="#1677ff"
BORDER_RADIUS="6"
case "$UI_LIB" in
  "Ant Design") PRIMARY_COLOR="#1677ff"; BORDER_RADIUS="6" ;;
  "Element Plus"|"Element UI") PRIMARY_COLOR="#409EFF"; BORDER_RADIUS="4" ;;
  "Arco Design") PRIMARY_COLOR="#165DFF"; BORDER_RADIUS="4" ;;
  "Semi Design") PRIMARY_COLOR="#0077FA"; BORDER_RADIUS="6" ;;
  "Vant") PRIMARY_COLOR="#1989fa"; BORDER_RADIUS="4" ;;
  "Material UI") PRIMARY_COLOR="#1976d2"; BORDER_RADIUS="4" ;;
esac

echo "🔍 检测结果: $FRAMEWORK | $UI_LIB | $CSS_SCHEME | $PKG_MGR | $LANG"
[ "$IS_MONOREPO" = "true" ] && echo "   📦 Monorepo: 是"

# ── 读取 scripts（构建命令）──
CMD_DEV=$(cat "$PKG" | grep -oE '"(dev|serve|start)"\s*:\s*"[^"]*"' | head -1 | sed 's/.*: *"\(.*\)"/\1/' 2>/dev/null)
CMD_BUILD=$(cat "$PKG" | grep -oE '"build"\s*:\s*"[^"]*"' | head -1 | sed 's/.*: *"\(.*\)"/\1/' 2>/dev/null)
CMD_LINT=$(cat "$PKG" | grep -oE '"lint"\s*:\s*"[^"]*"' | head -1 | sed 's/.*: *"\(.*\)"/\1/' 2>/dev/null)
CMD_DEV_KEY=$(cat "$PKG" | grep -oE '"(dev|serve|start)"' | head -1 | tr -d '"' 2>/dev/null || echo "dev")
[ -z "$CMD_DEV_KEY" ] && CMD_DEV_KEY="dev"

# ── 读取路径别名（tsconfig.json）──
ALIAS_LINES=""
if [ -f "$PROJECT_DIR/tsconfig.json" ]; then
  ALIAS_AT=$(cat "$PROJECT_DIR/tsconfig.json" | grep -oE '"@/\*"' 2>/dev/null)
  [ -n "$ALIAS_AT" ] && ALIAS_LINES="- \`@/*\` → \`src/*\`"
  ALIAS_ATAT=$(cat "$PROJECT_DIR/tsconfig.json" | grep -oE '"@@/\*"' 2>/dev/null)
  [ -n "$ALIAS_ATAT" ] && ALIAS_LINES="$ALIAS_LINES\n- \`@@/*\` → \`src/.umi/*\`"
fi

# ── 读取 Prettier 配置 ──
PRETTIER_SUMMARY=""
for PFILE in .prettierrc .prettierrc.json .prettierrc.js .prettierrc.yml; do
  if [ -f "$PROJECT_DIR/$PFILE" ]; then
    HAS_SINGLE=$(cat "$PROJECT_DIR/$PFILE" | grep -i "singleQuote.*true\|single_quote" 2>/dev/null)
    HAS_SEMI=$(cat "$PROJECT_DIR/$PFILE" | grep -i '"semi".*false' 2>/dev/null)
    HAS_TRAILING=$(cat "$PROJECT_DIR/$PFILE" | grep -i "trailingComma\|trailing" 2>/dev/null)
    PRETTIER_SUMMARY=""
    [ -n "$HAS_SINGLE" ] && PRETTIER_SUMMARY="单引号"
    [ -n "$HAS_SEMI" ] && PRETTIER_SUMMARY="$PRETTIER_SUMMARY、无分号"
    [ -n "$HAS_TRAILING" ] && PRETTIER_SUMMARY="$PRETTIER_SUMMARY、尾随逗号"
    [ -n "$PRETTIER_SUMMARY" ] && PRETTIER_SUMMARY="Prettier：$PRETTIER_SUMMARY"
    break
  fi
done

# ── 目录结构扫描 ──
SRC_DIR="src"
[ -d "$PROJECT_DIR/app" ] && SRC_DIR="app"
DIR_STRUCTURE="$SRC_DIR/\n"
[ -d "$PROJECT_DIR/$SRC_DIR/components" ] && DIR_STRUCTURE="${DIR_STRUCTURE}├── components/     # 通用组件\n"
[ -d "$PROJECT_DIR/$SRC_DIR/pages" ] || [ -d "$PROJECT_DIR/$SRC_DIR/views" ] && DIR_STRUCTURE="${DIR_STRUCTURE}├── pages/          # 页面组件\n"
[ -d "$PROJECT_DIR/$SRC_DIR/hooks" ] && DIR_STRUCTURE="${DIR_STRUCTURE}├── hooks/          # 自定义 Hooks\n"
[ -d "$PROJECT_DIR/$SRC_DIR/services" ] || [ -d "$PROJECT_DIR/$SRC_DIR/api" ] && DIR_STRUCTURE="${DIR_STRUCTURE}├── services/       # API 请求封装\n"
[ -d "$PROJECT_DIR/$SRC_DIR/models" ] && DIR_STRUCTURE="${DIR_STRUCTURE}├── models/         # 状态模型\n"
[ -d "$PROJECT_DIR/$SRC_DIR/stores" ] || [ -d "$PROJECT_DIR/$SRC_DIR/store" ] && DIR_STRUCTURE="${DIR_STRUCTURE}├── stores/         # 状态仓库\n"
[ -d "$PROJECT_DIR/$SRC_DIR/utils" ] && DIR_STRUCTURE="${DIR_STRUCTURE}├── utils/          # 工具函数\n"
[ -d "$PROJECT_DIR/$SRC_DIR/constants" ] && DIR_STRUCTURE="${DIR_STRUCTURE}├── constants/      # 常量定义\n"
[ -d "$PROJECT_DIR/$SRC_DIR/typings" ] || [ -d "$PROJECT_DIR/$SRC_DIR/types" ] && DIR_STRUCTURE="${DIR_STRUCTURE}└── typings/        # 类型定义\n"

# ── 自动生成目录判断 ──
AUTO_GEN_DIRS=""
[ -d "$PROJECT_DIR/$SRC_DIR/.umi" ] && AUTO_GEN_DIRS="- \`Never\` edit files under \`${SRC_DIR}/.umi/\` or \`${SRC_DIR}/.umi-production/\` — 框架自动生成"
[ -d "$PROJECT_DIR/.next" ] && AUTO_GEN_DIRS="- \`Never\` edit files under \`.next/\` — 框架自动生成"
[ -d "$PROJECT_DIR/.nuxt" ] && AUTO_GEN_DIRS="- \`Never\` edit files under \`.nuxt/\` — 框架自动生成"
[ -d "$PROJECT_DIR/.angular" ] && AUTO_GEN_DIRS="- \`Never\` edit files under \`.angular/\` — 框架缓存目录"

# ── 组件风格（React vs Vue vs 通用）──
if echo "$FRAMEWORK" | grep -q "React\|Next"; then
  COMP_STYLE="**组件（React）**
- 命名：PascalCase，文件名 \`index.tsx\`
- 使用 \`interface\` 定义 Props 类型，组件使用 \`React.FC<Props>\` 或函数声明
- 导出：\`export default Component\`"
elif echo "$FRAMEWORK" | grep -q "Vue\|Nuxt"; then
  COMP_STYLE="**组件（Vue）**
- 命名：PascalCase，单文件组件 \`.vue\`
- 使用 \`defineProps<T>()\` 定义 Props 类型
- 使用 Composition API + \`<script setup>\`"
elif echo "$FRAMEWORK" | grep -q "Angular"; then
  COMP_STYLE="**组件（Angular）**
- 命名：kebab-case，每个组件包含 \`.component.ts\` + \`.component.html\` + \`.component.scss\`
- 使用 \`@Input()\` / \`@Output()\` 定义组件接口
- 使用 standalone components（推荐）"
else
  COMP_STYLE="**组件**
- 命名：PascalCase
- 使用明确的类型定义
- 导出：\`export default Component\`"
fi

# ── 生成 AGENTS.md（默认覆盖）──
[ -f "$PROJECT_DIR/AGENTS.md" ] && echo "   ♻️  AGENTS.md 已存在，更新覆盖"
cat > "$PROJECT_DIR/AGENTS.md" << EOF
# AGENTS.md

- 本项目为 ${FRAMEWORK} + ${LANG} 前端应用
- 包管理器：\`${PKG_MGR}\`
- 样式方案：${CSS_SCHEME}
- UI 组件库：${UI_LIB}
$([ -n "$PRETTIER_SUMMARY" ] && echo "- ${PRETTIER_SUMMARY}")

## Project Structure

\`\`\`
$(echo -e "$DIR_STRUCTURE")\`\`\`

${AUTO_GEN_DIRS}
- \`Never\` edit \`dist/\` or \`build/\` — 构建产物目录

## Build & Dev Commands

\`\`\`bash
# 开发
${PKG_MGR} ${CMD_DEV_KEY}$([ -n "$CMD_DEV" ] && echo "           # ${CMD_DEV}")

# 构建
${PKG_MGR} build$([ -n "$CMD_BUILD" ] && echo "          # ${CMD_BUILD}")
$([ -n "$CMD_LINT" ] && echo "
# 代码格式化
${PKG_MGR} lint           # ${CMD_LINT}")
\`\`\`

- 测试框架暂未配置，如需添加测试请先与用户确认方案
$([ -n "$ALIAS_LINES" ] && echo "
## Path Aliases

$(echo -e "$ALIAS_LINES")")

## Coding Style & Naming

${COMP_STYLE}
$([ -n "$CSS_IMPORT" ] && echo "
**样式**
\`\`\`tsx
${CSS_IMPORT}
\`\`\`")

**命名规范**
- 组件目录：PascalCase（如 \`CopyButton/\`）
- Hook 函数：\`useXxx\`（如 \`useAuth\`）
- 常量：\`UPPER_SNAKE_CASE\`（如 \`MAX_RETRY_COUNT\`）
- CSS 类名：kebab-case（如 \`copy-button\`）
- 工具函数 / 变量：camelCase（如 \`formatDate\`）
- 类型 / 接口：PascalCase（如 \`IUserInfo\` 或 \`UserInfo\`）

**导入顺序**
\`\`\`ts
// 1. 框架核心（React / Vue）
// 2. UI 组件库（antd / element-plus）
// 3. 第三方工具（lodash / dayjs）
// 4. 路径别名（@/ 开头）
// 5. 相对路径导入
// 6. 样式文件（放最后）
\`\`\`

## Commit & Git Convention

**Commit Message**
- 遵循 Conventional Commits 规范
- 格式：\`type(scope): description\`
- 类型：feat / fix / docs / style / refactor / test / chore

**提交前**
- lint-staged 会自动运行格式化和 lint 检查
- \`Never\` 使用 \`git stash\` — 会影响其他 Agent 的工作区
- \`Never\` 切换分支 — 只在当前分支工作
- 只 commit 自己修改的文件

## Component & API Conventions

**组件开发**
- 新建组件在 \`${SRC_DIR}/components/\` 下创建 PascalCase 目录
- 目录结构：入口文件 + 样式文件（如 \`index.tsx\` + \`index.less\`）
- 复杂组件可添加 \`types.ts\` 集中定义类型

**API 开发**
- 新增 API 在 \`${SRC_DIR}/services/\` 对应业务模块下添加
- 类型定义放在 \`${SRC_DIR}/typings/\` 或服务模块同级 \`typings.d.ts\`

## Never Rules

- \`Never\` 使用 \`any\` 类型 — 必须定义明确的类型
- \`Never\` 使用内联样式（\`style={{ }}\`），除非需要动态计算
$(echo "$CSS_SCHEME" | grep -q "Less\|Sass" && echo "- \`Never\` 使用硬编码颜色值 — 使用主题变量")
- \`Never\` 在组件中直接调用 fetch/axios — 使用 \`${SRC_DIR}/services/\` 封装
- \`Never\` 在列表渲染中省略 \`key\` 属性
- \`Never\` 修改 \`node_modules/\` 或构建产物目录
- \`Never\` 在渲染路径中执行耗时操作（如 \`new Date()\`、大循环）
- \`Never\` 提交 lock 文件 — 除非明确要求安装新依赖
- \`Never\` 在代码中硬编码敏感信息（密钥、token、AK/SK）
- \`Never\` 修改框架自动生成的目录
- \`Never\` 在 \`useEffect\` / \`watch\` 中遗漏依赖项或清理函数
- \`Never\` 在全局作用域中抛出未捕获的异步错误
- \`Never\` 使用 \`git stash\` 或切换分支 — 多 Agent 并发安全
- \`Never\` 跳过 TypeScript 类型检查（\`@ts-ignore\` / \`@ts-nocheck\`）
- \`Never\` 在 \`catch\` 块中吞掉错误不做任何处理

## Multi-Agent Safety

- 禁止 \`git stash\`、禁止切换分支
- 只 commit 自己修改的文件
- 修改全局配置文件前先与用户确认
- 安装 / 删除依赖前先与用户确认

## Quick Commands（AI 指令）

以下指令可直接对 AI 说，AI 会按照本文件的规范执行：

| 指令 | 说明 |
|------|------|
| \`分析项目规范\` | 扫描源码，学习项目的隐性编码习惯，产出规范总结 |
| \`CR 代码\` | 自动 Review 暂存区代码，检查 Never 规则，生成 Conventional Commits 格式的 commit 信息 |
| \`生成变量名\` | 根据上下文 + 社区约定推荐命名（变量 / 函数 / 组件 / CSS 类名） |

## Error Handling

- 异步操作必须有 try-catch 或 .catch() 兜底
- 用户可见的错误需要友好提示，不暴露技术细节
- API 错误统一在 \`${SRC_DIR}/services/\` 的请求封装中处理
- 组件级错误使用 ErrorBoundary 捕获（React）或 onErrorCaptured（Vue）
EOF
echo "   ✅ AGENTS.md 已生成"

# ── 生成 AGENTS.local.md（个人偏好，存在则跳过）──
if [ -f "$PROJECT_DIR/AGENTS.local.md" ]; then
  echo "   ~ AGENTS.local.md 已存在，跳过（个人偏好不覆盖）"
else
cat > "$PROJECT_DIR/AGENTS.local.md" << 'LOCALEOF'
# AGENTS.local.md — 个人偏好配置

> 此文件仅供 AI 只读参考，不入仓库（已加入 .gitignore）。
> AI 不可修改此文件，仅人工编辑。

## 个人偏好

- 代码注释语言：中文
- 变量命名倾向：语义化长命名 > 简短缩写
- Commit message 语言：中文描述
- 响应风格：简洁直接
LOCALEOF
  echo "   ✅ AGENTS.local.md 已生成"

  # 添加到 .gitignore
  if [ -f "$PROJECT_DIR/.gitignore" ]; then
    if ! grep -q "AGENTS.local.md" "$PROJECT_DIR/.gitignore"; then
      echo "" >> "$PROJECT_DIR/.gitignore"
      echo "# AI 个人偏好（不入仓库）" >> "$PROJECT_DIR/.gitignore"
      echo "AGENTS.local.md" >> "$PROJECT_DIR/.gitignore"
      echo "   📝 已添加到 .gitignore"
    fi
  fi
fi

# ── 生成 DESIGN.md（默认覆盖）──
[ -f "$PROJECT_DIR/DESIGN.md" ] && echo "   ♻️  DESIGN.md 已存在，更新覆盖"
cat > "$PROJECT_DIR/DESIGN.md" << EOF
# DESIGN.md — 视觉设计规范

> AI 生成 UI 代码时参考此文件，确保视觉一致性。

## Design Tokens

| Token | 值 | 说明 |
|-------|-----|------|
| 主色 | \`${PRIMARY_COLOR}\` | 按钮、链接、高亮 |
| 成功色 | \`#52c41a\` | 成功状态、完成提示 |
| 警告色 | \`#faad14\` | 警告状态、注意提示 |
| 错误色 | \`#ff4d4f\` | 错误状态、删除操作 |
| 圆角 | \`${BORDER_RADIUS}px\` | 卡片、按钮、输入框 |
| 间距基数 | \`8px\` | 所有间距为 8 的倍数（8/16/24/32） |
| 字体 | 系统默认 | -apple-system, BlinkMacSystemFont, 'Segoe UI' |
| 正文字号 | \`14px\` | 行高 \`22px\`（1.57 倍） |
| 标题字号 | \`20px / 16px / 14px\` | h1 / h2 / h3 |

## 设计原则

- 遵循 ${UI_LIB} 默认主题，不硬编码颜色和间距
- 使用组件库内置的 Design Token / CSS 变量
- 间距使用 8px 网格系统（\`8 / 16 / 24 / 32 / 48\`）
- 响应式断点：移动端 \`< 768px\` / 平板 \`768-1024px\` / 桌面 \`> 1024px\`
- 动画时长：微交互 \`150ms\`，过渡 \`300ms\`，复杂动画 \`500ms\`
- 阴影层级：卡片 \`0 1px 2px rgba(0,0,0,0.06)\`，弹窗 \`0 4px 12px rgba(0,0,0,0.08)\`
- 文字颜色：主文本 \`rgba(0,0,0,0.88)\`，辅助文本 \`rgba(0,0,0,0.65)\`，禁用文本 \`rgba(0,0,0,0.25)\`

## 图标 & 插图

- 图标尺寸：\`16px\`（行内）/ \`24px\`（操作栏）/ \`48px\`（空状态）
- 使用 ${UI_LIB} 内置图标库，不引入额外图标包（除非确认）
- 空状态插图使用组件库默认，不自定义 SVG
EOF
echo "   ✅ DESIGN.md 已生成"

echo ""
echo "🎉 完成！已生成 AGENTS.md + AGENTS.local.md + DESIGN.md"
echo "   AI 编程助手现在能读懂你的项目规范了。"