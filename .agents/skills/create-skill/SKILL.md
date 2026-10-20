---
name: create-skill
description: >-
  Use this skill when the user asks to create, scaffold, design, or install a new skill
  for Antigravity or Codex. Guides the creation of production-ready skills with proper
  frontmatter, progressive disclosure, directory structure, helper scripts, and validation checklists.
---

# 创建技能指南 (Create Skill Runbook)

本技能指导开发者与 AI Agent 如何规范、高质量地设计、创建与安装 Antigravity / Codex 体系下的 **Skill（专项技能）**。

---

## 一、技能（Skill）定位与边界

在 Antigravity 体系中，合理区分自定义类型至关重要：

| 类型 | 形式与位置 | 机制 | 适用场景 |
| --- | --- | --- | --- |
| **Rule（规则）** | `GEMINI.md` / `AGENTS.md` / `rules/*.md` | 全局注入或条件匹配 | 硬性规范、代码风格、安全红线、架构防腐 |
| **Skill（技能）** | `skills/<name>/SKILL.md` | **按需渐进式披露 (Progressive Disclosure)** | 多步 SOP、工作流 Runbook、工具链实操、专项领域专家指导 |
| **Plugin（插件）** | `plugins/<name>/plugin.json` | 打包聚合 | 将相关 Skills、Rules、MCP 整体打包复用 |

> [!TIP] 渐进式披露原则 (Progressive Disclosure)
> 只有 `SKILL.md` 的 `name` 和 `description` 会常驻在系统提示词大纲中（耗费极低 Token）。
> 只有当用户的意图命中了 `description` 中的描述时，Agent 才会按需使用 `view_file` 读取 `SKILL.md` 正文；深入步骤则继续按需读取 `references/` 中的材料。

---

## 二、标准技能目录结构 (Standard Directory Scaffold)

创建技能时，必须遵守标准目录层级规范：

```text
skills/<skill-name>/
├── SKILL.md            # 必选：主指令与工作流定义（必须含 YAML Frontmatter）
├── scripts/            # 可选：自动化辅助脚本（如 Node.js / Python / Shell 自动化脚本）
├── references/         # 可选：沉重或详细的参考资料（API 字典、领域手册、备忘清单）
├── examples/           # 可选：标准参考实现、正反例对比样本
└── resources/          # 可选：模板文件、静态配置原型、脚手架原型
```

---

## 三、快速脚手架命令 (Scaffold Utility)

本技能内置了快速脚手架脚本，可一键自动化生成新技能的完整骨架：

```bash
# 在当前工作区创建技能
node ~/.gemini/config/skills/create-skill/scripts/scaffold.mjs <skill-name> --desc "<触发描述>"

# 或指定全局安装
node ~/.gemini/config/skills/create-skill/scripts/scaffold.mjs <skill-name> --global --desc "<触发描述>"
```

---

## 四、核心文件编写规范 (`SKILL.md`)

### 1. YAML Frontmatter（最关键字段）
`SKILL.md` 必须以合法的 YAML Frontmatter 开头，仅包含 `name` 与 `description`：

```yaml
---
name: my-specialized-workflow
description: >-
  Use this skill when the user asks to perform X, debug Y, or optimize Z.
  Clear instructions on what the skill achieves and exact trigger keywords.
---
```

- **`name` 规范**：全小写短横线命名（kebab-case），禁止空格或大写，如 `docker-deployment`、`react-performance-audit`。
- **`description` 规范**：
  - **采用第三人称**（如 `Use this skill when...`）；
  - **明确声明触发场景**（用户提问哪些关键词或意图时激活）；
  - **简明扼要**（控制在 2~4 句话，不要在描述中写长篇步骤）。

### 2. 正文结构推荐模版
- **技能定位与价值**：用 1~2 句话说明为什么需要该技能。
- **前置准备与环境检查**：依赖工具、环境变量或前置状态。
- **阶段化操作步骤 (Step-by-Step SOP)**：
  - 步骤清晰标号（1, 2, 3...）；
  - 复杂命令行建议封装在 `scripts/` 中并通过 Markdown 链接引用；
  - 详细的 API 列表沉淀在 `references/` 并按需引导 Agent 查看。
- **验收与自愈校验清单 (Verification & Diagnostics)**：
  - 每一步执行后的成功标志（如终端回显、状态码、文件生成）；
  - 典型故障与自愈指引。

---

## 五、安装与生效路径 (Installation Paths)

根据作用域选择技能安装位置：

1. **项目私有技能 (Workspace Project Scope)**：
   - 路径：`[工作区根目录]/.agents/skills/<skill-name>/`
   - 场景：与特定工程/仓库深度绑定的 SOP，可纳入 Git 协同版本管理。
2. **全局用户技能 (Global Machine Scope)**：
   - 路径：`~/.gemini/config/skills/<skill-name>/`
   - 场景：跨项目通用的个人开发习惯、通用诊断排查、工具脚手架（对当前机器所有工程生效）。

---

## 六、质量自检清单 (Quality Checklist)

在交付新建的技能前，必须逐项核对：

- [ ] **命名唯一性**：`name` 为 kebab-case 格式，无冲突；
- [ ] **触发精准度**：`description` 语义明确，无模糊泛化词汇，能准确引导 Agent 命中；
- [ ] **渐进式分流**：`SKILL.md` 正文控制在精简范围内，大部头文档已拆分进 `references/`；
- [ ] **无死链**：内部引用的 `[script](./scripts/xxx.sh)` 或 `[ref](./references/xxx.md)` 路径全部真实存在；
- [ ] **环境隔离**：脚本不依赖未声明的全局硬编码绝对路径。
