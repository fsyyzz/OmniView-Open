# 贡献指南 (Contributing)

感谢你对 OmniView 的兴趣。本指南说明如何在本地开发、提交改动，以及发起 Pull Request。

## 环境要求

- **Node.js** `>= 24`（与 `package.json` → `engines.node` 一致）
- **npm**（仓库当前以 npm 为默认包管理器）
- 可选：**VS Code** `>= 1.85`，用于安装与验证 VSIX

## 快速开始

```bash
git clone https://github.com/fsyyzz/OmniView.git
cd OmniView
npm install

# Webview 本地调试（默认 http://localhost:3000）
npm run dev
```

### 常用命令

| 命令 | 作用 |
| --- | --- |
| `npm run dev` | 启动 Vite 开发服务器 |
| `npm run lint` | TypeScript 类型检查 (`tsc --noEmit`) |
| `npm test` | 运行自动化单元测试套件 |
| `npm run verify` | 全量校验（结构 / 文档一致性 / 类型 / 测试 / 插件构建） |
| `npm run build:plugin` | 构建 Webview + Extension |
| `npm run package:vsix` | 打包 `omniview-<version>.vsix` |

提交前请至少保证：

```bash
npm run verify
```

## 仓库结构（贡献者视角）

```text
src/
  extension/     # VS Code Extension Host（Custom Editor、消息桥）
  app/           # Webview 应用入口
  features/      # viewers / workbench / docs 等特性模块
  shared/        # 类型、工具库、持久化、示例数据
docs/            # 架构与文档索引
examples/        # 多格式示例文件
scripts/         # 测试与校验脚本
```

更完整的架构说明见 [`docs/architecture.md`](./docs/architecture.md)。

## 改动约定

1. **小步、可验证**：优先改动与议题直接相关的文件；避免无关格式化大扫荡。
2. **分层单向依赖**：`app → features → shared`；不要让 `shared` 反向依赖 UI 层。
3. **安全底线**：凡渲染 HTML / SVG / 图表产物，必须经过现有 DOMPurify / 清洗链路；新增渲染面需补充安全相关测试或说明。
4. **文档同步**：若变更驱动路由、持久化键、架构分层或公开能力，请同步更新 `README.md`、`docs/` 与（如适用）`CHANGELOG.md`。
5. **中文 Conventional Commits**（示例）：
   - `feat(markdown): 窄屏下隐藏视图模式文字标签`
   - `fix(toolbar): 收紧右侧工具按钮间距`
   - `docs: 补充开源贡献与安全披露文档`

## Pull Request 流程

1. 从最新 `main`（或维护分支）拉出特性分支。
2. 完成本地 `npm run verify`。
3. 在 PR 描述中写清：
   - **动机 / 问题**
   - **改动要点**
   - **如何验证**（命令或手工步骤）
4. 若涉及 UI，附上前后对比截图更佳。
5. 保持 PR 聚焦；大范围重构请先开 Issue 讨论。

## 新增或扩展 Viewer 驱动

1. 在 `src/features/viewers/` 增加/修改驱动组件与路由。
2. 更新 Extension 侧扩展名选择器（`package.json` → `contributes.customEditors`）与宿主逻辑（如有）。
3. 在 `examples/` 增加可打开的样例文件。
4. 补充或更新 `scripts/test-*.mjs` 中的路由 / 解析断言。
5. 同步 README 功能矩阵与 `docs/architecture.md` 驱动清单（如适用）。

## 行为准则与安全

- 请保持友善、建设性的讨论氛围。
- **请勿**在公开 Issue / PR 中披露可利用的安全漏洞细节；请遵循 [`SECURITY.md`](./SECURITY.md)。

## 需要帮助？

- 文档索引：[`docs/README.md`](./docs/README.md)
- 功能与安装：[`README.md`](./README.md) / [`README.en.md`](./README.en.md)
- 问题反馈：[GitHub Issues](https://github.com/fsyyzz/OmniView/issues)
