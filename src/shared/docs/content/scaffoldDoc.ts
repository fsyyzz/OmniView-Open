import { SoftwareDoc } from '../../types';

export const SCAFFOLD_DOC: SoftwareDoc = {
  id: 'scaffold',
  title: '3. VS Code 插件源码脚手架 (Extension Scaffold)',
  category: 'Scaffold',
  summary: '提供可直接打包构建为真实 VS Code .vsix 插件的工程级代码模板与双目标编译流水线规范。',
  tags: ['源码脚手架', 'package.json', 'extension.ts', 'Mermaid构建流水线', '双目标编译'],
  content: `# VS Code 扩展工程脚手架 (OmniView Production Scaffold)

本部分提供了可以直接用于构建官方 VS Code 扩展插件的工程级源码架构与编译构建流水线规范。

---

## 一、双目标构建与发布流水线架构

\`\`\`mermaid
flowchart LR
    subgraph Dev ["1. 源码编写开发"]
        TS["TypeScript 宿主源码<br/>(src/extension/extension.ts)"]
        WebviewTS["Webview React 客户端<br/>(src/main.tsx)"]
    end

    subgraph Build ["2. 双目标构建 (Vite + Esbuild)"]
        Esbuild["Esbuild 极速宿主编译<br/>• Node.js CommonJS (dist/extension.cjs)"]
        Vite["Vite 6 现代化 Webview 打包<br/>• React 19 + Rollup 资产 (dist/assets/*)"]
        Assets["静态资源安全映射与 CSP Nonce 校验"]
    end

    subgraph Package ["3. VSIX 打包与分发"]
        VSCE["npx @vscode/vsce package --no-dependencies"]
        VSIX["📦 omniview-1.2.4.vsix<br/>(内容与完整性自动检验)"]
        Marketplace["VS Code 插件市场在线发布"]
        LocalInstall["code --install-extension 本地离线安装"]
    end

    Dev --> Esbuild
    Dev --> Vite
    Esbuild --> Assets
    Vite --> Assets
    Assets --> VSCE
    VSCE --> VSIX
    VSIX --> Marketplace
    VSIX --> LocalInstall
\`\`\`

---

## 二、核心配置文件清单

### 1. \`package.json\` (核心贡献点规范)

\`\`\`json
{
  "name": "omniview",
  "displayName": "OmniView",
  "description": "OmniView 多格式文件渲染与预览插件",
  "version": "1.2.4",
  "publisher": "zhouzan",
  "license": "MIT",
  "engines": {
    "vscode": "^1.85.0",
    "node": ">=18.0.0"
  },
  "main": "./dist/extension.cjs",
  "activationEvents": [
    "onCustomEditor:omniview.editor",
    "onCommand:omniview.openSidePreview",
    "onCommand:omniview.openSideBySide",
    "onCommand:omniview.openSource",
    "onCommand:omniview.createNewFile",
    "onCommand:omniview.openWorkbench"
  ],
  "contributes": {
    "customEditors": [
      {
        "viewType": "omniview.editor",
        "displayName": "OmniView 文件渲染器",
        "selector": [
          { "filenamePattern": "*.md" },
          { "filenamePattern": "*.puml" },
          { "filenamePattern": "*.mmd" },
          { "filenamePattern": "*.dot" },
          { "filenamePattern": "*.svg" },
          { "filenamePattern": "*.pdf" },
          { "filenamePattern": "*.csv" },
          { "filenamePattern": "*.json" },
          { "filenamePattern": "*.yaml" },
          { "filenamePattern": "*.toml" },
          { "filenamePattern": "*.xml" },
          { "filenamePattern": "*.ipynb" },
          { "filenamePattern": "*.typ" },
          { "filenamePattern": "*.excalidraw" },
          { "filenamePattern": "*.egn" },
          { "filenamePattern": "*.docx" },
          { "filenamePattern": "*.pptx" },
          { "filenamePattern": "*.xlsx" },
          { "filenamePattern": "Dockerfile*" }
        ],
        "priority": "option"
      }
    ]
  }
}
\`\`\`

---

## 三、宿主生命周期调度实现 (\`src/extension/extension.ts\`)

\`\`\`typescript
import * as vscode from 'vscode';
import { OmniViewEditorProvider } from './OmniViewEditorProvider';

export function activate(context: vscode.ExtensionContext) {
  console.log('[OmniView] Extension activating...');

  // 1. 注册 CustomEditorProvider
  const provider = new OmniViewEditorProvider(context);
  const registration = vscode.window.registerCustomEditorProvider(
    'omniview.editor',
    provider,
    {
      webviewOptions: {
        retainContextWhenHidden: true, // 切换标签页时保留 Webview 状态，防止重新加载
      },
      supportsMultipleEditorsPerDocument: true,
    }
  );
  context.subscriptions.push(registration);

  // 2. 注册并排协同命令 (原生源码编辑 + 实时渲染预览)
  const sideBySideCommand = vscode.commands.registerCommand(
    'omniview.openSideBySide',
    async (uri?: vscode.Uri) => {
      const targetUri = uri || vscode.window.activeTextEditor?.document.uri;
      if (!targetUri) return;
      await vscode.commands.executeCommand('vscode.openWith', targetUri, 'default', vscode.ViewColumn.One);
      await vscode.commands.executeCommand('vscode.openWith', targetUri, 'omniview.editor', vscode.ViewColumn.Beside);
    }
  );
  context.subscriptions.push(sideBySideCommand);
}

export function deactivate() {
  console.log('[OmniView] Extension deactivated.');
}
\`\`\`

---

## 四、本地极速打包与调试指南

\`\`\`bash
# 1. 安装工程依赖
npm install

# 2. 编译打包生成独立 .vsix 安装文件
npm run package:vsix

# 3. 在 VS Code 中本地一键加载体验
code --install-extension omniview-1.2.4.vsix
\`\`\`
`,
};
