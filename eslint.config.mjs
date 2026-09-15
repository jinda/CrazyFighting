// ESLint 9 flat config
// 分工：Prettier 只负责"格式"（缩进/引号/换行等），ESLint 只负责"代码质量与规范"
// 运行：npm run lint / npm run lint:fix（需先 npm i -D 安装 devDependencies）
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";

export default tseslint.config(
    {
        // Cocos 生成目录 / 第三方库不参与检查
        ignores: [
            "library/**",
            "temp/**",
            "build/**",
            "profiles/**",
            "native/**",
            "node_modules/**",
            "extensions/**",
            "assets/scripts/libs/**",
        ],
    },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    prettier,
    {
        files: ["assets/**/*.ts"],
        languageOptions: {
            // TS 已做未定义标识符检查，这里关闭 ESLint 的重复检查（否则 window/setTimeout 等会误报）
            globals: {},
        },
        rules: {
            // ---------- 基础质量 ----------
            eqeqeq: ["error", "always"],
            "no-var": "error",
            "prefer-const": "error",
            curly: ["error", "multi-line"],
            "no-debugger": "error",
            "no-duplicate-imports": "error",
            "no-unneeded-ternary": "error",
            "no-console": ["warn", { allow: ["error", "warn"] }],
            // hasOwnProperty 直调：先降级为 warn，后续统一改为 Object.hasOwn
            "no-prototype-builtins": "warn",
            // TS 负责未定义检查
            "no-undef": "off",
            // 允许空的 catch（storageManager 用它吞掉坏存档的解析异常）
            "no-empty": ["error", { allowEmptyCatch: true }],
            // base64/正则工具代码里存在无害转义，先 warn
            "no-useless-escape": "warn",

            // ---------- TypeScript ----------
            // 存量约 296 处 any，先 warn，后续按模块收敛（见审核报告）
            "@typescript-eslint/no-explicit-any": "warn",
            // 对应报告中的 52 处 `: Function`，用具体函数签名替代
            "@typescript-eslint/no-unsafe-function-type": "error",
            "@typescript-eslint/no-unused-vars": [
                "error",
                { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
            ],
            "@typescript-eslint/consistent-type-imports": ["warn", { prefer: "type-imports" }],
            // Cocos 生命周期空实现（start(){} / update(){}）属于模板写法，关闭该规则
            "@typescript-eslint/no-empty-function": "off",
            // 31 处 @ts-ignore：待类型补齐后改为 @ts-expect-error（改造完成再打开）
            // "@typescript-eslint/prefer-ts-expect-error": "error",
        },
    },
    {
        // 第三方移植代码（lodash 子集 / csv 解析器）单独降级，避免一次性阻塞
        files: ["assets/scripts/framework/lodash.ts", "assets/scripts/framework/csvManager.ts"],
        rules: {
            "@typescript-eslint/no-explicit-any": "off",
            "@typescript-eslint/no-unsafe-function-type": "off",
            "no-prototype-builtins": "off",
            "no-var": "warn",
        },
    },
);