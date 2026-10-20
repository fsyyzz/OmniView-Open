#!/usr/bin/env node
/**
 * Antigravity Skill 脚手架生成器 (Skill Scaffold Generator)
 *
 * 用法:
 *   node scaffold.mjs <skill-name> [--desc "触发描述"] [--global] [--dir <custom-dir>]
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

function printHelp() {
  console.log(`
🛠️  Antigravity Skill 脚手架工具

用法:
  node scaffold.mjs <skill-name> [选项]

选项:
  --desc, -d <描述>     技能触发描述 (推荐以 "Use this skill when..." 开头)
  --global, -g         安装到全局目录 (~/.gemini/config/skills/)，默认为当前工作区 (.agents/skills/)
  --dir <路径>         自定义输出目录
  --help, -h           显示帮助信息

示例:
  node scaffold.mjs react-perf --desc "Use this skill when auditing React rendering performance."
  node scaffold.mjs docker-deploy --global --desc "Use this skill when creating multi-stage Dockerfiles."
`);
}

function parseArgs() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes('-h') || args.includes('--help')) {
    printHelp();
    process.exit(0);
  }

  let name = '';
  let desc = '';
  let isGlobal = false;
  let customDir = '';

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--desc' || arg === '-d') {
      desc = args[++i] || '';
    } else if (arg === '--global' || arg === '-g') {
      isGlobal = true;
    } else if (arg === '--dir') {
      customDir = args[++i] || '';
    } else if (!arg.startsWith('-') && !name) {
      name = arg.trim();
    }
  }

  return { name, desc, isGlobal, customDir };
}

function main() {
  const { name, desc, isGlobal, customDir } = parseArgs();

  if (!name) {
    console.error('❌ 错误: 必须指定技能名称 (例如: react-perf)');
    process.exit(1);
  }

  // 校验 name 格式为 kebab-case
  const validNameRegex = /^[a-z0-9]+(-[a-z0-9]+)*$/;
  if (!validNameRegex.test(name)) {
    console.warn(`⚠️  警告: 技能名称建议采用全小写连字符形式 (kebab-case)，当前输入为: "${name}"`);
  }

  const finalDesc = desc.trim() || `Use this skill when the user asks to perform tasks related to ${name}.`;

  // 决定基础目录
  let targetBaseDir = '';
  if (customDir) {
    targetBaseDir = path.resolve(process.cwd(), customDir);
  } else if (isGlobal) {
    targetBaseDir = path.resolve(os.homedir(), '.gemini/config/skills');
  } else {
    targetBaseDir = path.resolve(process.cwd(), '.agents/skills');
  }

  const skillDir = path.join(targetBaseDir, name);

  if (fs.existsSync(skillDir)) {
    console.error(`❌ 错误: 目标技能目录已存在: ${skillDir}`);
    process.exit(1);
  }

  console.log(`📦 正在初始化技能: ${name}`);
  console.log(`📂 输出路径: ${skillDir}`);

  // 创建目录
  fs.mkdirSync(path.join(skillDir, 'scripts'), { recursive: true });
  fs.mkdirSync(path.join(skillDir, 'references'), { recursive: true });
  fs.mkdirSync(path.join(skillDir, 'examples'), { recursive: true });
  fs.mkdirSync(path.join(skillDir, 'resources'), { recursive: true });

  // 生成 SKILL.md
  const skillMdContent = `---
name: ${name}
description: >-
  ${finalDesc}
---

# ${name.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ')} 技能指南

> **技能定位**: 简要说明本技能解决的核心问题与适用场景。

---

## 一、前置准备与环境校验

在执行本技能前，验证以下工具与依赖状态：

- [ ] 核心环境与命令行工具可用
- [ ] 工作区上下文就绪

---

## 二、标准执行流程 (Step-by-Step SOP)

### 步骤 1: 现状诊断与需求分析
- 详细说明 Agent 第一步应该做什么，建议优先运行哪些命令或检查哪些文件。

### 步骤 2: 方案执行与编码推进
- 核心操作指导。
- 更多详细参考规范参见 [技术参考手册](./references/spec.md)。

### 步骤 3: 自动化验证与质量门禁
- 运行针对性测试验证变更是否达标。

---

## 三、常见故障自愈 (Troubleshooting)

| 异常现象 | 可能原因 | 自愈解决方式 |
| --- | --- | --- |
| 典型报错 A | 配置缺失或路径错误 | 运行检查脚本并补齐配置 |
| 典型报错 B | 端口冲突或权限不足 | 检查当前进程与权限状态 |
`;

  fs.writeFileSync(path.join(skillDir, 'SKILL.md'), skillMdContent, 'utf-8');

  // 生成示例参考文档 references/spec.md
  const refSpecContent = `# ${name} 详细技术规范与参考手册

本文件用于沉淀沉重的 API 字典、长篇配置参数或架构备忘。
由于采用**渐进式披露 (Progressive Disclosure)**，Agent 仅在主流程需要深入查阅时才会读取本文件。

---

## 详细参数清单

| 参数字段 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| \`sampleKey\` | string | \`"default"\` | 示例配置参数说明 |
`;

  fs.writeFileSync(path.join(skillDir, 'references/spec.md'), refSpecContent, 'utf-8');

  // 生成 README / 提示
  console.log(`✅ 技能脚手架生成成功！`);
  console.log(`
📄 核心文件:
   - ${path.join(skillDir, 'SKILL.md')}
   - ${path.join(skillDir, 'references/spec.md')}
📁 子目录:
   - ${path.join(skillDir, 'scripts/')}
   - ${path.join(skillDir, 'examples/')}
   - ${path.join(skillDir, 'resources/')}

👉 下一步建议:
   1. 编辑 SKILL.md 完善核心操作 SOP
   2. 如有自动化脚本，放入 scripts/ 目录
   3. 在 Antigravity 中通过对话测试意图激活情况
`);
}

main();
