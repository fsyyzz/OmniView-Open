## 变更概述 / Pull Request Overview

<!-- 请简明扼要地描述本次 PR 的主要改动内容与目的 -->

## 关联 Issue / Related Issue

<!-- 例如：Fixes #123 或 Resolves #456 -->
- Issue: 

## 变更类型 / Change Type

- [ ] 🐞 Bug 修复 (Bug Fix)
- [ ] 🚀 新功能或新格式驱动支持 (New Feature / Viewer Driver)
- [ ] ⚡ 性能优化与资源回收 (Performance & Memory)
- [ ] 🎨 界面体验与多主题适配 (UI & Theme Adaptation)
- [ ] 📚 文档完善或架构同步 (Documentation & Architecture)
- [ ] 🛠️ 工程基建与门禁维护 (DevOps & Tooling)

## 自测与物理门禁验证 / Verification Checklist

在提交 PR 前，请确保已在本地通过以下工程质量门禁：

- [ ] `npm run lint` - TypeScript 类型检查无报错 (`tsc --noEmit`)
- [ ] `npm run check:structure` - 源码分层拓扑与无孤儿文件门禁通过
- [ ] `npm run check:doc-code-consistency` - 文档事实与代码一致性通过
- [ ] `npm test` - 全量自动化测试套件通过（未引入单测退化）
- [ ] `npm run build:plugin` - VS Code Webview 与 Extension 产物编译成功
