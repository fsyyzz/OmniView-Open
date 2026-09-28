import * as vscode from 'vscode';
import { basename, dirname, extname } from 'node:path';
import { SUPPORTED_EXTENSIONS } from './types';
import { createLogger } from './utils';
import { OmniViewerEditorProvider } from './editorProvider';
import { getWebviewHtml } from './webviewHtml';

const VIEW_TYPE = 'omniview.editor';

let output: vscode.OutputChannel | undefined;
let log: (message: string, details?: unknown) => void = () => {};

export function activate(context: vscode.ExtensionContext): void {
  output = vscode.window.createOutputChannel('OmniView');
  log = createLogger(output);
  context.subscriptions.push(output);
  log(`Extension activated: ${context.extensionUri?.fsPath ?? 'unknown path'}`);
  const provider = new OmniViewerEditorProvider(context.extensionUri, log);
  context.subscriptions.push(vscode.window.registerCustomEditorProvider(VIEW_TYPE, provider, {
    webviewOptions: { retainContextWhenHidden: true },
    supportsMultipleEditorsPerDocument: true,
  }));
  log(`Custom Editor registered: ${VIEW_TYPE}`);

  // 预览锁定与自动跟随状态
  let isPreviewLocked = false;
  let isSidePreviewActive = false;

  // 切换预览锁定
  context.subscriptions.push(vscode.commands.registerCommand('omniview.togglePreviewLock', () => {
    isPreviewLocked = !isPreviewLocked;
    vscode.window.showInformationMessage(`OmniView 实时预览跟随已${isPreviewLocked ? '锁定 (Pin 模式)' : '解锁 (跟随当前激活文件)'}`);
  }));

  // 监听当前活动文本编辑器切换，支持如同 VS Code 官方 Markdown Preview 的智能自动跟随
  context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(async (editor) => {
    if (!editor || isPreviewLocked || !isSidePreviewActive) return;
    const doc = editor.document;
    if (doc.uri.scheme !== 'file') return;
    const ext = extname(doc.uri.fsPath).toLowerCase();
    if (!SUPPORTED_EXTENSIONS.includes(ext)) return;

    const tabs = vscode.window.tabGroups?.all?.flatMap(g => g.tabs) || [];
    const hasOmniviewBeside = tabs.some(t => {
      const input = t.input as { viewType?: string } | undefined;
      return t.group.viewColumn !== editor.viewColumn && input?.viewType === VIEW_TYPE;
    });

    if (hasOmniviewBeside) {
      try {
        await vscode.commands.executeCommand('vscode.openWith', doc.uri, VIEW_TYPE, {
          viewColumn: vscode.ViewColumn.Beside,
          preserveFocus: true,
        });
        await vscode.window.showTextDocument(editor.document, {
          viewColumn: editor.viewColumn,
          preserveFocus: false,
        });
      } catch (e) {
        log('Auto-follow preview update failed', e);
      }
    }
  }));

  // 在侧边打开预览
  context.subscriptions.push(vscode.commands.registerCommand('omniview.openSidePreview', async (uri?: vscode.Uri | vscode.Uri[]) => {
    isSidePreviewActive = true;
    let target = Array.isArray(uri) ? uri[0] : uri;
    if (!target) {
      const activeTab = vscode.window.tabGroups?.activeTabGroup?.activeTab;
      const tabInput = activeTab?.input;
      if (tabInput && typeof tabInput === 'object' && 'uri' in tabInput) {
        target = (tabInput as { uri: vscode.Uri }).uri;
      } else if (vscode.window.activeTextEditor?.document?.uri) {
        target = vscode.window.activeTextEditor.document.uri;
      }
    }
    if (!target) {
      vscode.window.showWarningMessage('无法获取当前文档路径，请先在编辑器中打开支持的文件。');
      return;
    }
    const targetPath = target.fsPath || target.path || '';
    const ext = extname(targetPath).toLowerCase();
    if (!SUPPORTED_EXTENSIONS.includes(ext)) {
      vscode.window.showWarningMessage(`OmniView 不支持 ${ext || '未知'} 格式的文件。`);
      return;
    }
    try {
      const activeTextEditor = vscode.window.activeTextEditor;
      await vscode.commands.executeCommand('vscode.openWith', target, VIEW_TYPE, {
        viewColumn: vscode.ViewColumn.Beside,
        preserveFocus: true,
      });
      // 保持或恢复左侧文本编辑器的光标焦点，实现即开即打体验
      if (activeTextEditor && activeTextEditor.document.uri.toString() === target.toString()) {
        await vscode.window.showTextDocument(activeTextEditor.document, {
          viewColumn: activeTextEditor.viewColumn,
          preserveFocus: false,
        });
      }
    } catch (error) {
      log('openWith failed', error);
      vscode.window.showErrorMessage(`打开预览失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }));

  // 打开源码编辑
  context.subscriptions.push(vscode.commands.registerCommand('omniview.openSource', async (uri?: vscode.Uri | vscode.Uri[]) => {
    let target = Array.isArray(uri) ? uri[0] : uri;
    if (!target) {
      const activeTab = vscode.window.tabGroups?.activeTabGroup?.activeTab;
      const tabInput = activeTab?.input;
      if (tabInput && typeof tabInput === 'object' && 'uri' in tabInput) {
        target = (tabInput as { uri: vscode.Uri }).uri;
      } else if (vscode.window.activeTextEditor?.document?.uri) {
        target = vscode.window.activeTextEditor.document.uri;
      }
    }
    if (!target) {
      vscode.window.showWarningMessage('无法获取当前文档路径。');
      return;
    }
    try {
      await vscode.window.showTextDocument(target, { viewColumn: vscode.ViewColumn.Beside, preview: false });
    } catch (error) {
      log('showTextDocument failed, trying openWith default', error);
      try {
        await vscode.commands.executeCommand('vscode.openWith', target, 'default', vscode.ViewColumn.Beside);
      } catch {
        vscode.window.showErrorMessage('无法打开该文件的源码编辑器。');
      }
    }
  }));

  // 方案 A: 打开并排协同 (原生文本编辑器 + OmniView 实时渲染预览)
  context.subscriptions.push(vscode.commands.registerCommand('omniview.openSideBySide', async (uri?: vscode.Uri | vscode.Uri[]) => {
    isSidePreviewActive = true;
    let target = Array.isArray(uri) ? uri[0] : uri;
    if (!target) {
      const activeTab = vscode.window.tabGroups?.activeTabGroup?.activeTab;
      const tabInput = activeTab?.input;
      if (tabInput && typeof tabInput === 'object' && 'uri' in tabInput) {
        target = (tabInput as { uri: vscode.Uri }).uri;
      } else if (vscode.window.activeTextEditor?.document?.uri) {
        target = vscode.window.activeTextEditor.document.uri;
      }
    }
    if (!target) {
      vscode.window.showWarningMessage('无法获取当前文档路径。');
      return;
    }
    try {
      // 1. 在当前激活列（或主编辑区）打开原生源码文本编辑器（支持 Copilot, GitLens, LSP 补全）
      const editor = await vscode.window.showTextDocument(target, { viewColumn: vscode.ViewColumn.Active, preview: false });
      // 2. 在侧边列打开 OmniView 实时可视化渲染预览
      await vscode.commands.executeCommand('vscode.openWith', target, VIEW_TYPE, {
        viewColumn: vscode.ViewColumn.Beside,
        preserveFocus: true,
      });
      // 3. 焦点稳定保留在左侧原生文本编辑器中
      if (editor) {
        await vscode.window.showTextDocument(editor.document, { viewColumn: editor.viewColumn, preserveFocus: false });
      }
    } catch (error) {
      log('openSideBySide failed', error);
      vscode.window.showErrorMessage(`打开并排协同失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }));

  // 打开插件配置面板
  context.subscriptions.push(vscode.commands.registerCommand('omniview.openSettings', async () => {
    try {
      await vscode.commands.executeCommand('workbench.action.openSettings', 'omniview');
    } catch (error) {
      log('openSettings failed', error);
    }
  }));

  // 资源管理器顶栏工具条命令 1: 快速新建多维图表/文档模板
  context.subscriptions.push(vscode.commands.registerCommand('omniview.createNewFile', async (selectedUri?: vscode.Uri) => {
    // 1. 确定目标文件夹
    let targetFolderUri: vscode.Uri | undefined;
    if (selectedUri && selectedUri.scheme === 'file') {
      try {
        const stats = await vscode.workspace.fs.stat(selectedUri);
        if (stats.type === vscode.FileType.Directory) {
          targetFolderUri = selectedUri;
        } else {
          targetFolderUri = vscode.Uri.file(dirname(selectedUri.fsPath));
        }
      } catch {
        targetFolderUri = vscode.Uri.file(dirname(selectedUri.fsPath));
      }
    }
    if (!targetFolderUri && vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
      targetFolderUri = vscode.workspace.workspaceFolders[0].uri;
    }
    if (!targetFolderUri) {
      vscode.window.showWarningMessage('请先在 VS Code 中打开一个工作区文件夹，然后再新建 OmniView 图表或文档。');
      return;
    }

    // 2. 预设多维模板清单
    const templateOptions: Array<vscode.QuickPickItem & { ext: string; defaultName: string; content: string }> = [
      {
        label: '$(graph) Mermaid 流程图 / 时序图',
        description: '.mmd',
        detail: '现代化流程图、序列图、状态机与类图',
        ext: '.mmd',
        defaultName: 'diagram.mmd',
        content: `sequenceDiagram
    autonumber
    actor User as 用户
    participant Gateway as API 网关
    participant Service as 核心服务
    participant DB as 数据库

    User->>Gateway: 发起请求 (Request)
    Gateway->>Service: 校验并路由
    Service->>DB: 查询业务数据
    DB-->>Service: 返回数据记录
    Service-->>Gateway: 组装响应模型
    Gateway-->>User: 返回 200 OK 结果
`,
      },
      {
        label: '$(server-process) PlantUML 架构组件图',
        description: '.puml',
        detail: '经典软件架构分层、时序与类拓扑设计',
        ext: '.puml',
        defaultName: 'architecture.puml',
        content: `@startuml
skinparam monochrome false
skinparam shadowing false
skinparam defaultFontName "PingFang SC, Microsoft YaHei, sans-serif"

package "用户交互层 (Presentation)" {
  [Webview Shell] as Shell
  [Driver Manager] as DM
}

package "业务内核层 (Core)" {
  [Markdown Pipeline] as MP
  [DOMPurify Sanitizer] as Sanitizer
  [Export Engine] as Exporter
}

database "持久化层" {
  [Local Storage / VS Code State] as Storage
}

Shell --> DM : 驱动路由
DM --> MP : 分发 AST
MP --> Sanitizer : XSS 深度清洗
Sanitizer --> Exporter : 导出 SVG / Word
DM --> Storage : 配置持久化
@enduml
`,
      },
      {
        label: '$(symbol-color) Excalidraw 手绘白板架构草图',
        description: '.excalidraw',
        detail: '手绘风格自由绘图、架构白板与组件原型',
        ext: '.excalidraw',
        defaultName: 'whiteboard.excalidraw',
        content: JSON.stringify({
          type: "excalidraw",
          version: 2,
          source: "https://omniview.dev",
          elements: [
            {
              type: "rectangle",
              version: 1,
              versionNonce: 1,
              isDeleted: false,
              id: "rect-1",
              fillStyle: "hachure",
              strokeWidth: 1,
              strokeStyle: "solid",
              roughness: 1,
              opacity: 100,
              angle: 0,
              x: 100,
              y: 100,
              strokeColor: "#1e1e1e",
              backgroundColor: "#e0f2fe",
              width: 180,
              height: 90,
              seed: 12345,
              groupIds: [],
              frameId: null,
              roundness: { type: 3 },
              boundElements: [],
              updated: Date.now(),
              link: null,
              locked: false
            },
            {
              type: "text",
              version: 1,
              versionNonce: 2,
              isDeleted: false,
              id: "text-1",
              fillStyle: "hachure",
              strokeWidth: 1,
              strokeStyle: "solid",
              roughness: 1,
              opacity: 100,
              angle: 0,
              x: 135,
              y: 135,
              strokeColor: "#1e1e1e",
              backgroundColor: "transparent",
              width: 110,
              height: 25,
              seed: 54321,
              groupIds: [],
              frameId: null,
              roundness: null,
              boundElements: [],
              updated: Date.now(),
              link: null,
              locked: false,
              fontSize: 18,
              fontFamily: 1,
              text: "OmniView",
              textAlign: "center",
              verticalAlign: "middle",
              containerId: "rect-1",
              originalText: "OmniView"
            }
          ],
          appState: {
            viewBackgroundColor: "#ffffff",
            currentItemFontFamily: 1
          },
          files: {}
        }, null, 2),
      },
      {
        label: '$(type-hierarchy) Markmap 交互式思维导图',
        description: '.markmap',
        detail: '层级结构思维发散、知识大纲与架构拆解',
        ext: '.markmap',
        defaultName: 'mindmap.markmap',
        content: `# OmniView 全景思维导图
## 1. 文档出版套件
- Markdown (含 KaTeX 公式与表格)
- Typst (现代排版引擎)
- Jupyter Notebook (.ipynb)
- EPUB 电子书阅读器
## 2. 图表与白板
- Mermaid 流程/时序/状态机
- PlantUML 架构设计
- Graphviz 复杂有向图
- Excalidraw 手绘白板
## 3. 结构化数据全景
- JSON / YAML / TOML / XML
- 树状投影与 JSONPath 提取
- 依赖拓扑图与同构表格下钻
- 企业密钥自动脱敏
## 4. Office 离线秒开
- Word (.docx) 高保真
- PowerPoint (.pptx) 矢量放映
- Excel (.xlsx) 多标签与列画像
`,
      },
      {
        label: '$(markdown) OmniView 增强型 Markdown 文档',
        description: '.md',
        detail: '支持内嵌 Mermaid、PlantUML、公式与表格的高性能文档',
        ext: '.md',
        defaultName: 'document.md',
        content: `# 技术设计方案 (Technical Design)

> 基于 OmniView 纯前端离线渲染引擎

## 1. 架构流向

\`\`\`mermaid
flowchart LR
    Client[客户端请求] --> Gateway[API 网关]
    Gateway --> Service[核心微服务]
    Service --> Cache[(Redis 缓存)]
    Service --> DB[(MySQL 数据库)]
\`\`\`

## 2. 核心公式

根据系统吞吐率定义：

$$QPS = \\frac{N_{total}}{\\Delta t_{seconds}}$$

## 3. 关键特性清单

- [x] 100% 纯端侧离线运行
- [x] Markdown 复制到 Word 格式不乱
- [ ] 自动化流水线集成
`,
      },
      {
        label: '$(book) Typst 现代学术/出版排版',
        description: '.typ',
        detail: '极速编译、工业级 A4 页面设置与矢量公式',
        ext: '.typ',
        defaultName: 'paper.typ',
        content: `#set page(
  paper: "a4",
  margin: (x: 2.5cm, y: 2.5cm),
  header: align(right)[_OmniView System Specification_],
  numbering: "1",
)
#set text(
  font: ("Linux Libertine", "PingFang SC"),
  size: 11pt,
)

= 系统架构规范与设计概览

== 1. 引言
本文档采用 Typst 现代排版规范编撰，在 OmniView 内置纯端侧 AST 编译器中即时渲染。

== 2. 核心数学模型
$ E = m c^2 $

$ int_0^infinity e^(-x^2) dif x = sqrt(pi) / 2 $
`,
      },
      {
        label: '$(symbol-structure) Graphviz DOT 状态机与网络拓扑',
        description: '.dot',
        detail: 'WASM Worker 异步计算的复杂有向图与布局',
        ext: '.dot',
        defaultName: 'workflow.dot',
        content: `digraph Workflow {
  rankdir=LR;
  node [shape=box, style="rounded,filled", fillcolor="#e0f2fe", color="#0284c7", fontname="sans-serif"];
  edge [color="#64748b", fontname="sans-serif", fontsize=10];

  Start [shape=circle, fillcolor="#bbf7d0", color="#16a34a", label="Start"];
  Parsing [label="1. AST 解析"];
  Sanitizing [label="2. DOMPurify 清洗"];
  Rendering [label="3. 60 FPS 渲染"];
  End [shape=doublecircle, fillcolor="#fecdd3", color="#e11d48", label="Done"];

  Start -> Parsing;
  Parsing -> Sanitizing [label="Token 流"];
  Sanitizing -> Rendering [label="安全 DOM"];
  Rendering -> End;
}
`,
      },
      {
        label: '$(table) CSV 离线数据分析表格',
        description: '.csv',
        detail: '具备列特征画像、数值排序与迷你图分析的表格',
        ext: '.csv',
        defaultName: 'dataset.csv',
        content: `id,service_name,cluster,latency_ms,qps,status
1,auth-service,us-east,12.4,8500,healthy
2,order-api,us-east,28.6,12400,healthy
3,payment-gateway,eu-west,45.2,3200,warning
4,user-profile,ap-northeast,18.1,6700,healthy
5,search-engine,us-west,8.9,19800,healthy
`,
      },
    ];

    const picked = await vscode.window.showQuickPick(templateOptions, {
      placeHolder: '请选择要创建的 OmniView 多维图表或文档模板...',
      matchOnDescription: true,
      matchOnDetail: true,
    });
    if (!picked) return;

    // 3. 输入文件名
    const fileNameInput = await vscode.window.showInputBox({
      prompt: `请输入新建文件名 (${picked.ext})`,
      value: picked.defaultName,
      validateInput: (val) => {
        if (!val || !val.trim()) return '文件名不能为空';
        if (/[/\\?%*:|"<>]/g.test(val)) return '文件名包含非法字符';
        return null;
      },
    });
    if (!fileNameInput) return;

    let finalName = fileNameInput.trim();
    if (!finalName.toLowerCase().endsWith(picked.ext.toLowerCase())) {
      finalName += picked.ext;
    }

    const fileUri = vscode.Uri.joinPath(targetFolderUri, finalName);
    try {
      try {
        await vscode.workspace.fs.stat(fileUri);
        const overwrite = await vscode.window.showWarningMessage(
          `文件 ${finalName} 已存在，是否覆盖？`,
          { modal: true },
          '覆盖',
          '取消'
        );
        if (overwrite !== '覆盖') return;
      } catch {
        // 文件不存在，正常创建
      }

      await vscode.workspace.fs.writeFile(fileUri, Buffer.from(picked.content, 'utf8'));
      // 自动以并排协同形式打开：左侧原生编辑源码，右侧 OmniView 实时可视化渲染
      await vscode.commands.executeCommand('omniview.openSideBySide', fileUri);
      vscode.window.showInformationMessage(`已成功创建 ${finalName} 并开启 OmniView 实时协同！`);
    } catch (err) {
      log('createNewFile failed', err);
      vscode.window.showErrorMessage(`创建文件失败: ${err instanceof Error ? err.message : String(err)}`);
    }
  }));

  // 资源管理器顶栏工具条命令 2: 打开多维可视化全景工作台
  let activeWorkbenchPanel: vscode.WebviewPanel | undefined;
  context.subscriptions.push(vscode.commands.registerCommand('omniview.openWorkbench', async () => {
    if (activeWorkbenchPanel) {
      activeWorkbenchPanel.reveal(vscode.ViewColumn.Active);
      return;
    }

    activeWorkbenchPanel = vscode.window.createWebviewPanel(
      'omniview.workbench',
      'OmniView 工作台',
      vscode.ViewColumn.Active,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(context.extensionUri, 'dist'),
          vscode.Uri.joinPath(context.extensionUri, 'dist', 'webview'),
          ...(vscode.workspace.workspaceFolders?.map(f => f.uri) || []),
        ],
      }
    );

    const initialPayload = {
      id: 'omniview:workbench',
      name: 'OmniView 工作台',
      path: '',
      extension: 'md',
      content: '',
      size: 0,
      lastModified: Date.now(),
      isStandaloneWorkbench: true,
    };

    activeWorkbenchPanel.webview.html = getWebviewHtml(
      activeWorkbenchPanel.webview,
      context.extensionUri,
      initialPayload,
      log
    );

    activeWorkbenchPanel.onDidDispose(() => {
      activeWorkbenchPanel = undefined;
    });
  }));

  // 资产全景树视图提供者与刷新命令
  const assetTreeProvider = new OmniViewAssetTreeDataProvider();
  context.subscriptions.push(vscode.window.registerTreeDataProvider('omniview.assetExplorer', assetTreeProvider));
  context.subscriptions.push(vscode.commands.registerCommand('omniview.refreshAssets', () => {
    assetTreeProvider.refresh();
    vscode.window.showInformationMessage('OmniView: 已刷新工作区多维资产全景树。');
  }));

  // 注册 Hover 悬浮预览提供者 (支持 Markdown, Typst, Mermaid, PlantUML, DOT, JS/TS 等)
  const hoverProvider = new OmniViewHoverProvider();
  const supportedLanguages = [
    'markdown', 'typst', 'mermaid', 'plantuml', 'dot', 'json', 'yaml', 'toml',
    'javascript', 'typescript', 'javascriptreact', 'typescriptreact', 'html', 'python'
  ];
  for (const lang of supportedLanguages) {
    context.subscriptions.push(vscode.languages.registerHoverProvider({ language: lang }, hoverProvider));
  }

  // 注册 CodeLens 一键动作提供者
  const codeLensProvider = new OmniViewCodeLensProvider();
  for (const lang of ['markdown', 'typst', 'mermaid', 'plantuml', 'dot']) {
    context.subscriptions.push(vscode.languages.registerCodeLensProvider({ language: lang }, codeLensProvider));
  }

  // 注册原生大纲符号提供者 (DocumentSymbolProvider)
  const docSymbolProvider = new OmniViewDocumentSymbolProvider();
  for (const lang of ['markdown', 'typst', 'mermaid', 'plantuml', 'dot']) {
    context.subscriptions.push(vscode.languages.registerDocumentSymbolProvider({ language: lang }, docSymbolProvider));
  }

  // 注册状态栏指示器与快捷控制菜单
  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.command = 'omniview.showQuickMenu';
  statusBarItem.text = '$(eye) OmniView';
  statusBarItem.tooltip = 'OmniView: 多维渲染与实时协同中心 (点击打开快捷面板)';
  context.subscriptions.push(statusBarItem);

  const updateStatusBarVisibility = (editor?: vscode.TextEditor) => {
    if (!editor) {
      statusBarItem.hide();
      return;
    }
    const ext = extname(editor.document.uri.fsPath).toLowerCase();
    if (SUPPORTED_EXTENSIONS.includes(ext) || editor.document.uri.scheme === 'file') {
      statusBarItem.show();
    } else {
      statusBarItem.hide();
    }
  };

  updateStatusBarVisibility(vscode.window.activeTextEditor);
  context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(updateStatusBarVisibility));

  // 快捷控制菜单 QuickPick
  context.subscriptions.push(vscode.commands.registerCommand('omniview.showQuickMenu', async () => {
    const quickItems: vscode.QuickPickItem[] = [
      {
        label: '$(split-horizontal) 打开并排协同 (Side-by-Side)',
        description: 'Ctrl+Alt+V',
        detail: '左侧原生编辑器享受 LSP/Copilot，右侧 OmniView 毫秒级双向渲染',
      },
      {
        label: '$(eye) 在侧边打开实时预览 (Side Preview)',
        description: 'Ctrl+Shift+V',
        detail: '独立侧边栏可视化视口，平滑双向滚动与节点双击反向溯源',
      },
      {
        label: '$(sparkle) 新建多维图表/文档模板...',
        detail: '快速创建 Mermaid、PlantUML、Typst、Excalidraw、DOT 与 CSV 模板',
      },
      {
        label: '$(preview) 打开多维可视化全景工作台',
        detail: '无需物理文件，直接进入纯端侧多格式渲染与排版工作台',
      },
      {
        label: '$(refresh) 刷新工作区资产全景树',
        detail: '重新扫描工作区中的图表、白板、文档与表格资产',
      },
      {
        label: '$(lock) 切换预览跟随与锁定状态',
        detail: `当前状态: ${isPreviewLocked ? '🔒 已锁定 (Pin 模式)' : '⚡ 自动跟随当前激活文件'}`,
      },
      {
        label: '$(settings-gear) 打开 OmniView 插件设置',
        detail: '调整主题、排版密度、缩放比例、A4 分页与 PlantUML 服务地址',
      },
      {
        label: '$(output) 查看 OmniView 运行日志',
        detail: '打开 OmniView 扩展输出通道诊断详细信息',
      },
    ];

    const selected = await vscode.window.showQuickPick(quickItems, {
      placeHolder: 'OmniView 多维渲染与实时协同控制中心...',
      matchOnDetail: true,
      matchOnDescription: true,
    });

    if (!selected) return;

    if (selected.label.includes('打开并排协同')) {
      await vscode.commands.executeCommand('omniview.openSideBySide');
    } else if (selected.label.includes('在侧边打开实时预览')) {
      await vscode.commands.executeCommand('omniview.openSidePreview');
    } else if (selected.label.includes('新建多维图表/文档模板')) {
      await vscode.commands.executeCommand('omniview.createNewFile');
    } else if (selected.label.includes('打开多维可视化全景工作台')) {
      await vscode.commands.executeCommand('omniview.openWorkbench');
    } else if (selected.label.includes('刷新工作区资产全景树')) {
      await vscode.commands.executeCommand('omniview.refreshAssets');
    } else if (selected.label.includes('切换预览跟随与锁定状态')) {
      await vscode.commands.executeCommand('omniview.togglePreviewLock');
    } else if (selected.label.includes('打开 OmniView 插件设置')) {
      await vscode.commands.executeCommand('omniview.openSettings');
    } else if (selected.label.includes('查看 OmniView 运行日志')) {
      await vscode.commands.executeCommand('omniview.showLogs');
    }
  }));

  context.subscriptions.push(vscode.commands.registerCommand('omniview.showLogs', () => output?.show(true)));
}

export interface AssetItem {
  type: 'category' | 'file';
  label: string;
  categoryKey?: 'arch' | 'whiteboard' | 'document' | 'data' | 'knowledge';
  resourceUri?: vscode.Uri;
  description?: string;
  tooltip?: string;
  iconPath?: vscode.ThemeIcon;
}

export class OmniViewAssetTreeDataProvider implements vscode.TreeDataProvider<AssetItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<AssetItem | undefined | null | void> = new vscode.EventEmitter<AssetItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<AssetItem | undefined | null | void> = this._onDidChangeTreeData.event;

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: AssetItem): vscode.TreeItem {
    if (element.type === 'category') {
      const item = new vscode.TreeItem(element.label, vscode.TreeItemCollapsibleState.Expanded);
      item.iconPath = element.iconPath;
      item.contextValue = 'assetCategory';
      return item;
    }
    const item = new vscode.TreeItem(element.label, vscode.TreeItemCollapsibleState.None);
    item.resourceUri = element.resourceUri;
    item.description = element.description;
    item.tooltip = element.tooltip;
    item.iconPath = element.iconPath || vscode.ThemeIcon.File;
    item.contextValue = 'assetFile';
    item.command = {
      command: 'omniview.openSidePreview',
      title: 'OmniView: 在侧边打开预览',
      arguments: [element.resourceUri],
    };
    return item;
  }

  async getChildren(element?: AssetItem): Promise<AssetItem[]> {
    if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
      return [];
    }

    if (!element) {
      return [
        { type: 'category', label: '📊 架构与流程设计 (Architecture & Flow)', categoryKey: 'arch', iconPath: new vscode.ThemeIcon('symbol-structure') },
        { type: 'category', label: '🎨 矢量设计与白板 (Whiteboard & Vector)', categoryKey: 'whiteboard', iconPath: new vscode.ThemeIcon('symbol-color') },
        { type: 'category', label: '📑 学术出版与富文档 (Docs & Publishing)', categoryKey: 'document', iconPath: new vscode.ThemeIcon('book') },
        { type: 'category', label: '📈 电子表格与结构数据 (Sheets & Data)', categoryKey: 'data', iconPath: new vscode.ThemeIcon('table') },
        { type: 'category', label: '🧠 知识库与思维导图 (Mindmaps & Knowledge)', categoryKey: 'knowledge', iconPath: new vscode.ThemeIcon('type-hierarchy') },
      ];
    }

    if (element.type === 'category' && element.categoryKey) {
      const extsByCategory: Record<string, string[]> = {
        arch: ['.mmd', '.mermaid', '.puml', '.plantuml', '.iuml', '.dot', '.gv', '.dst', '.egn', '.domainstory'],
        whiteboard: ['.excalidraw', '.svg'],
        document: ['.md', '.markdown', '.typ', '.typst', '.docx', '.pptx', '.pdf', '.epub', '.ipynb', '.html', '.htm'],
        data: ['.xlsx', '.xls', '.xlsm', '.xltx', '.csv', '.tsv', '.json', '.yaml', '.yml', '.xml', '.toml'],
        knowledge: ['.okf', '.markmap', '.mm', '.mindmap', '.km'],
      };

      const targetExts = extsByCategory[element.categoryKey] || [];
      const files: vscode.Uri[] = [];

      for (const folder of vscode.workspace.workspaceFolders) {
        try {
          const pattern = new vscode.RelativePattern(folder, `**/*{${targetExts.join(',')}}`);
          const found = await vscode.workspace.findFiles(pattern, '**/node_modules/**', 100);
          files.push(...found);
        } catch {
          // fallback
        }
      }

      const validFiles = files.filter(uri => {
        const ext = extname(uri.fsPath).toLowerCase();
        return targetExts.includes(ext);
      });

      return validFiles.map(uri => {
        const name = basename(uri.fsPath);
        const folder = vscode.workspace.asRelativePath(dirname(uri.fsPath));
        return {
          type: 'file',
          label: name,
          resourceUri: uri,
          description: folder === '.' ? '' : folder,
          tooltip: uri.fsPath,
        };
      });
    }

    return [];
  }
}

export class OmniViewHoverProvider implements vscode.HoverProvider {
  provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    _token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.Hover> {
    const lineText = document.lineAt(position.line).text;

    // 1. 检查是否在图表代码块定义行或内部
    if (/```(?:mermaid|puml|plantuml|dot|graphviz|typst|markmap)/i.test(lineText)) {
      const match = lineText.match(/```(mermaid|puml|plantuml|dot|graphviz|typst|markmap)/i);
      const diagramType = (match ? match[1] : '图表').toUpperCase();
      const md = new vscode.MarkdownString();
      md.isTrusted = true;
      md.appendMarkdown(`### ⚡ OmniView ${diagramType} 可视化组件\n\n`);
      md.appendMarkdown(`支持纯本地 WASM 离线 60 FPS 渲染、交互缩放与一键导出。\n\n`);
      md.appendMarkdown(`[▶ 在侧边打开实时预览](command:omniview.openSidePreview) | [✨ 开启双屏协同](command:omniview.openSideBySide) | [📊 打开全景工作台](command:omniview.openWorkbench)`);
      return new vscode.Hover(md);
    }

    // 2. 检查 LaTeX / KaTeX 公式块
    if (/\$\$|\$[^\$]+\$/.test(lineText)) {
      const md = new vscode.MarkdownString();
      md.isTrusted = true;
      md.appendMarkdown(`### 📐 OmniView KaTeX 数学公式\n\n`);
      md.appendMarkdown(`高保真矢量数学符号渲染、支持 A4 打印与 Word 剪贴板富文本复制。\n\n`);
      md.appendMarkdown(`[▶ 查看实时渲染效果](command:omniview.openSidePreview) | [✨ 双屏协同](command:omniview.openSideBySide)`);
      return new vscode.Hover(md);
    }

    // 3. 检查嵌入媒体与 Obsidian Wiki 链接
    if (/!\[\[([^\]]+)\]\]|!\[[^\]]*\]\(([^)]+)\)/.test(lineText)) {
      const md = new vscode.MarkdownString();
      md.isTrusted = true;
      md.appendMarkdown(`### 🖼️ OmniView 媒体/图表嵌入引用\n\n`);
      md.appendMarkdown(`支持跨格式资产热解析与相对路径本地穿透。\n\n`);
      md.appendMarkdown(`[▶ 开启实时渲染联动](command:omniview.openSidePreview)`);
      return new vscode.Hover(md);
    }

    return null;
  }
}

export class OmniViewCodeLensProvider implements vscode.CodeLensProvider {
  provideCodeLenses(
    document: vscode.TextDocument,
    _token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.CodeLens[]> {
    const codeLenses: vscode.CodeLens[] = [];
    const text = document.getText();
    const lines = text.split(/\r?\n/);

    const topRange = new vscode.Range(0, 0, 0, 0);
    codeLenses.push(
      new vscode.CodeLens(topRange, {
        title: '▶ OmniView 实时分屏协同',
        command: 'omniview.openSideBySide',
        arguments: [document.uri],
      }),
      new vscode.CodeLens(topRange, {
        title: '👁️ 侧边预览',
        command: 'omniview.openSidePreview',
        arguments: [document.uri],
      })
    );

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/^```(mermaid|puml|plantuml|dot|graphviz|typst|markmap)/i.test(line.trim()) || /^@startuml/i.test(line.trim()) || /^digraph/i.test(line.trim())) {
        const range = new vscode.Range(i, 0, i, line.length);
        codeLenses.push(
          new vscode.CodeLens(range, {
            title: '⚡ OmniView 图表实时渲染',
            command: 'omniview.openSidePreview',
            arguments: [document.uri],
          })
        );
      }
    }

    return codeLenses;
  }
}

export class OmniViewDocumentSymbolProvider implements vscode.DocumentSymbolProvider {
  provideDocumentSymbols(
    document: vscode.TextDocument,
    _token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.DocumentSymbol[]> {
    const symbols: vscode.DocumentSymbol[] = [];
    const lineCount = document.lineCount;

    for (let i = 0; i < lineCount; i++) {
      const line = document.lineAt(i);
      const text = line.text.trim();

      const mdHeadingMatch = text.match(/^(#{1,6})\s+(.+)$/);
      if (mdHeadingMatch) {
        const level = mdHeadingMatch[1].length;
        const title = mdHeadingMatch[2];
        const kind = level === 1 ? vscode.SymbolKind.Namespace : level === 2 ? vscode.SymbolKind.Class : vscode.SymbolKind.Field;
        symbols.push(new vscode.DocumentSymbol(title, `H${level}`, kind, line.range, line.range));
        continue;
      }

      const typstHeadingMatch = text.match(/^(=+)\s+(.+)$/);
      if (typstHeadingMatch) {
        const level = typstHeadingMatch[1].length;
        const title = typstHeadingMatch[2];
        symbols.push(new vscode.DocumentSymbol(title, `Heading ${level}`, vscode.SymbolKind.Namespace, line.range, line.range));
        continue;
      }

      const pumlMatch = text.match(/^(?:package|class|interface|component|state|rectangle)\s+["']?([^"'{]+)["']?/i);
      if (pumlMatch) {
        symbols.push(new vscode.DocumentSymbol(pumlMatch[1].trim(), 'UML Element', vscode.SymbolKind.Struct, line.range, line.range));
        continue;
      }

      const dotMatch = text.match(/^(?:digraph|graph|subgraph)\s+([a-zA-Z0-9_]+)/i);
      if (dotMatch) {
        symbols.push(new vscode.DocumentSymbol(dotMatch[1], 'Graph', vscode.SymbolKind.Module, line.range, line.range));
        continue;
      }

      const mmdMatch = text.match(/^(?:flowchart|sequenceDiagram|classDiagram|stateDiagram|erDiagram|gantt)/i);
      if (mmdMatch) {
        symbols.push(new vscode.DocumentSymbol(mmdMatch[0], 'Diagram Type', vscode.SymbolKind.Module, line.range, line.range));
        continue;
      }
    }

    return symbols;
  }
}

export function deactivate(): void {}
