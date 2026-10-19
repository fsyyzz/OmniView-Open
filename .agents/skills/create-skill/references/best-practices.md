# Antigravity 技能设计最佳实践 (Skill Design Best Practices)

本文档总结了在 Antigravity 体系下编写高表现力、高成功率 Skill 的核心工程原则。

---

## 一、Prompt 工程与触发优化 (Trigger Optimization)

### 1. Description 是最关键的元数据
Agent 在未激活技能时，仅能在系统上下文看到：
```text
Available skills:
- <name> (<path>/SKILL.md): <description>
```
如果 `description` 描述不清，Agent 就**永远不会**主动调用 `view_file` 读取 `SKILL.md`。

#### 正面范例 (Good):
```yaml
description: >-
  Use this skill when the user asks to run integration tests, configure Jest/Vitest,
  or debug test flakiness in the billing service. Provides standard test runbooks,
  mock factories, and coverage check commands.
```

#### 负面范例 (Bad):
```yaml
# 过于简略，模型无法判断何时使用
description: Tests for billing.

# 第一人称或命令式，不符合路由模式
description: I will help you write tests.
```

---

## 二、渐进式信息分流 (Progressive Disclosure)

- **主文件瘦身**：`SKILL.md` 的行数建议控制在 **100 ~ 250 行**以内，专注引导工作流与核心决策树；
- **重型知识下沉**：
  - API 手册、字段定义 -> 放入 `references/api-reference.md`
  - 架构说明、原理推演 -> 放入 `references/architecture.md`
  - 常见错误速查表 -> 放入 `references/error-codes.md`
- **按需加载提示**：在 `SKILL.md` 中写明：
  `若涉及 X 模块的高阶参数调优，请使用 view_file 查看 [高阶参数指南](./references/advanced-tuning.md)`。

---

## 三、可执行脚本设计原则 (Script Helpers)

- 优先采用通用运行环境（如 Node.js `.mjs` 或标准 POSIX Shell）；
- 脚本内尽量避免写死用户主目录的绝对路径，优先使用相对路径或动态推断根目录（如 `git rev-parse --show-toplevel` 或 `process.cwd()`）；
- 提供明确的 CLI 帮助信息与退出码（0 为成功，非 0 为异常退出）。
