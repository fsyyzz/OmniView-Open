import * as vscode from 'vscode';
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, extname, join as joinPath, resolve as resolvePath } from 'node:path';

const VIEW_TYPE = 'omniview.editor';
const SUPPORTED_EXTENSIONS = [
  '.md', '.markdown', '.okf', '.puml', '.plantuml', '.iuml', '.mmd', '.mermaid',
  '.dot', '.gv', '.svg', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.ico', '.avif', '.tiff',
  '.pdf', '.epub', '.docx', '.pptx', '.xlsx', '.xls', '.xlsm', '.xltx',
  '.csv', '.tsv', '.json', '.yaml', '.yml', '.xml', '.ts', '.tsx', '.js', '.jsx', '.txt',
  '.markmap', '.mm', '.mindmap', '.km', '.typ', '.typst', '.excalidraw', '.ipynb', '.dst', '.egn', '.domainstory',
  '.html', '.htm'
];

const BINARY_EXTENSIONS = [
  '.pdf', '.epub', '.docx', '.pptx', '.xlsx', '.xls', '.xlsm', '.xltx',
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.ico', '.avif', '.tiff'
];

function getMimeType(extension: string): string {
  const mimeMap: Record<string, string> = {
    '.pdf': 'application/pdf',
    '.epub': 'application/epub+zip',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.xls': 'application/vnd.ms-excel',
    '.xlsm': 'application/vnd.ms-excel.sheet.macroEnabled.12',
    '.xltx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.template',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.bmp': 'image/bmp',
    '.ico': 'image/x-icon',
    '.avif': 'image/avif',
    '.tiff': 'image/tiff',
  };
  return mimeMap[extension] || 'application/octet-stream';
}

let output: vscode.OutputChannel;

function log(message: string, details?: unknown): void {
  const suffix = details === undefined ? '' : ` ${details instanceof Error ? details.stack : JSON.stringify(details)}`;
  output?.appendLine(`[${new Date().toISOString()}] ${message}${suffix}`);
  console.log(`[OmniView] ${message}${suffix}`);
}

/** 读取并归一化 VS Code 宿主工作区中的 omniview 配置 */
function getHostConfiguration(): Record<string, unknown> {
  const config = vscode.workspace.getConfiguration('omniview');
  return {
    theme: config.get<string>('preview.theme', 'system'),
    density: config.get<string>('preview.density', 'compact'),
    fontSize: config.get<number>('preview.fontSize', 15),
    contentWidth: config.get<string>('preview.contentWidth', 'standard'),
    zoom: config.get<number>('preview.zoomLevel', 1.0),
    viewMode: config.get<string>('preview.defaultViewMode', 'preview'),
    splitRatio: config.get<number>('preview.splitRatio', 50),
    splitRightMode: config.get<string>('preview.splitRightMode', 'preview'),
    enableLazyBlockUnmount: config.get<boolean>('preview.lazyUnmount', true),
    scrollSync: config.get<boolean>('editor.scrollSync', true),
    wordWrap: config.get<boolean>('editor.wordWrap', true),
    showLineNumbers: config.get<boolean>('editor.showLineNumbers', true),
    enableDoubleClickEdit: config.get<boolean>('editor.doubleClickEdit', false),
    outlineOpen: config.get<boolean>('outline.open', true),
    outlinePosition: config.get<string>('outline.position', 'right'),
    outlineDisplayMode: config.get<string>('outline.displayMode', 'tree'),
    plantUmlServerUrl: config.get<string>('plantuml.serverUrl', 'https://www.plantuml.com/plantuml'),
    enableOkfRendering: config.get<boolean>('knowledge.enableOkfRendering', true),
    locale: config.get<string>('general.locale', 'zh-CN'),
  };
}

/** Webview 无法调用 window.print；Host 侧落盘临时 HTML 并用系统浏览器打开 */
function sanitizePrintFileName(fileName: string): string {
  const leaf = (fileName || 'omniview-print').split(/[/\\]/).pop() || 'omniview-print';
  const cleaned = leaf
    .replace(/[^\w.\u4e00-\u9fff-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^\.+/, '')
    .replace(/\.+$/, '');
  return (cleaned || 'omniview-print').slice(0, 120);
}

async function openPrintableHtmlInBrowser(fileName: string, html: string): Promise<void> {
  if (!html || typeof html !== 'string') {
    throw new Error('Empty printable HTML payload');
  }
  const safeName = sanitizePrintFileName(fileName).replace(/\.html?$/i, '');
  const tmpPath = joinPath(tmpdir(), `omniview-print-${safeName}-${Date.now()}.html`);
  await writeFile(tmpPath, html, 'utf8');
  const opened = await vscode.env.openExternal(vscode.Uri.file(tmpPath));
  if (!opened) {
    throw new Error(`Failed to open printable file: ${tmpPath}`);
  }
  log(`Printable HTML opened in system browser: ${tmpPath} (${html.length} chars)`);
}

async function loadReferencedMediaFiles(
  markdownPath: string,
  markdown: string,
  webview?: vscode.Webview
): Promise<Array<Record<string, unknown>>> {
  const references: string[] = [];

  // 1. 匹配 Obsidian Wiki 嵌入语法: ![[path/to/file.ext]] 或 ![[path/to/file.ext|alias]]
  for (const match of markdown.matchAll(/!\[\[([^\]]+?)\]\]/g)) {
    const rawInner = match[1].trim();
    const target = rawInner.split('|')[0].trim().split('#')[0].trim();
    if (target) references.push(target);
  }

  // 2. 匹配 Standard Markdown 图片/媒体嵌入: ![alt](path/to/file.ext)
  for (const match of markdown.matchAll(/!\[[^\]]*\]\(([^)]+)\)/gi)) {
    const rawTarget = match[1].trim().split(/[?#]/)[0].trim();
    if (rawTarget && !/^[a-z]+:/i.test(rawTarget) && !rawTarget.startsWith('data:')) {
      references.push(rawTarget);
    }
  }

  // 3. 匹配 HTML <img> 标签: <img ... src="path/to/file.ext" ...>
  for (const match of markdown.matchAll(/<img\s+[^>]*?src=["']([^"']+)["'][^>]*>/gi)) {
    const rawTarget = match[1].trim().split(/[?#]/)[0].trim();
    if (rawTarget && !/^[a-z]+:/i.test(rawTarget) && !rawTarget.startsWith('data:')) {
      references.push(rawTarget);
    }
  }

  const uniqueSources = [...new Set(references)];
  const assets: Array<Record<string, unknown>> = [];

  for (const source of uniqueSources) {
    let assetPath = resolvePath(dirname(markdownPath), decodeURIComponent(source));
    let ext = extname(assetPath).toLowerCase().replace(/^\./, '');

    // 容错: 若相对路径无后缀但对应同名工程文件
    if (!ext && !existsSync(assetPath)) {
      for (const candidateExt of ['md', 'dst', 'egn', 'excalidraw', 'puml', 'mmd', 'svg', 'dot', 'markmap', 'png', 'jpg', 'jpeg', 'webp', 'gif', 'html', 'htm']) {
        if (existsSync(`${assetPath}.${candidateExt}`)) {
          assetPath = `${assetPath}.${candidateExt}`;
          ext = candidateExt;
          break;
        }
      }
    }

    try {
      if (existsSync(assetPath)) {
        const stats = await readFile(assetPath);
        const isBinaryImg = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'ico', 'avif', 'tiff'].includes(ext);
        const mime = getMimeType(`.${ext}`);
        const base64Data = isBinaryImg ? stats.toString('base64') : '';
        const dataUri = isBinaryImg ? `data:${mime};base64,${base64Data}` : undefined;
        const webviewUri = webview ? webview.asWebviewUri(vscode.Uri.file(assetPath)).toString() : undefined;
        const textContent = isBinaryImg ? base64Data : stats.toString('utf8');

        assets.push({
          id: assetPath,
          name: basename(assetPath),
          path: assetPath,
          extension: ext,
          content: textContent,
          binaryUrl: webviewUri || dataUri,
          size: stats.byteLength,
          lastModified: Date.now(),
        });
        log(`Referenced media/diagram asset loaded: ${assetPath} (${stats.byteLength} bytes, ext: ${ext}, hasBinaryUrl: ${Boolean(webviewUri || dataUri)})`);
      }
    } catch (error) {
      log(`Referenced asset unavailable: ${assetPath}`, error);
    }
  }
  return assets;
}

class OmniViewerDocument implements vscode.CustomDocument {
  constructor(public readonly uri: vscode.Uri) {}
  dispose(): void {}
}

function getWebviewHtml(webview: vscode.Webview, extensionUri: vscode.Uri, initialData?: Record<string, unknown>): string {
  let htmlPath = vscode.Uri.joinPath(extensionUri, 'dist', 'index.html');
  let assetsBase = vscode.Uri.joinPath(extensionUri, 'dist', 'assets');
  if (!existsSync(htmlPath.fsPath)) {
    htmlPath = vscode.Uri.joinPath(extensionUri, 'dist', 'webview', 'index.html');
    assetsBase = vscode.Uri.joinPath(extensionUri, 'dist', 'webview', 'assets');
  }
  log(`Loading Webview HTML: ${htmlPath.fsPath}`);
  if (!existsSync(htmlPath.fsPath)) {
    throw new Error(
      `Webview HTML not found: ${htmlPath.fsPath}. ` +
        'VSIX 可能未打入 dist/index.html 与 dist/assets（检查 .vscodeignore 与 npm run build:plugin）。'
    );
  }
  const html = readFileSync(htmlPath.fsPath, 'utf8');
  const safeJson = initialData ? JSON.stringify(initialData).replace(/</g, '\\u003c') : '';
  const initialDataScript = safeJson ? `<script id="omniview-initial-data" type="application/json">${safeJson}</script>` : '';
  return html
    .replace(/(src|href)="(\.\/)?assets\//g, (_match: string, attribute: string) => `${attribute}="${webview.asWebviewUri(assetsBase)}/`)
    .replace('<head>', `<head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} https: http://localhost:* http://127.0.0.1:* data: vscode-resource: vscode-webview-resource: blob:; style-src ${webview.cspSource} 'unsafe-inline'; script-src ${webview.cspSource} 'unsafe-inline' 'unsafe-eval'; worker-src ${webview.cspSource} blob: data:; connect-src https: http://localhost:* http://127.0.0.1:* data: blob:;">`)
    .replace('</body>', `${initialDataScript}<script>window.__OMNIVIEW_VSCODE__ = true;</script></body>`);
}

class OmniViewerEditorProvider implements vscode.CustomReadonlyEditorProvider<OmniViewerDocument> {
  constructor(private readonly extensionUri: vscode.Uri) {}

  async openCustomDocument(
    uri: vscode.Uri,
    _openContext?: vscode.CustomDocumentOpenContext,
    _token?: vscode.CancellationToken
  ): Promise<OmniViewerDocument> {
    if (!uri) {
      throw new Error('OmniView: Document URI is undefined or null.');
    }
    return new OmniViewerDocument(uri);
  }

  async resolveCustomEditor(document: OmniViewerDocument, webviewPanel: vscode.WebviewPanel): Promise<void> {
    // 禁止静默 return：未设置 webview.html 时 Cursor/VS Code 会落到
    // “Assertion Failed: Argument is undefined or null” 的宿主断言。
    if (!document?.uri) {
      throw new Error('OmniView: resolveCustomEditor received undefined document.uri');
    }
    if (!webviewPanel?.webview) {
      throw new Error('OmniView: resolveCustomEditor received undefined webviewPanel');
    }
    if (!this.extensionUri) {
      throw new Error('OmniView: extensionUri is undefined; cannot load webview assets');
    }

    log(`Resolving Custom Editor: ${document.uri.fsPath || document.uri.toString()}`);
    const webview = webviewPanel.webview;
    const documentDir = document.uri.scheme === 'file' && document.uri.fsPath ? dirname(document.uri.fsPath) : '';
    const workspaceRoots = vscode.workspace.workspaceFolders?.map(f => f.uri).filter(Boolean) || [];

    const localRoots: vscode.Uri[] = [];
    if (this.extensionUri) {
      try {
        localRoots.push(
          vscode.Uri.joinPath(this.extensionUri, 'dist'),
          vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview')
        );
      } catch {
        // ignore
      }
    }
    if (documentDir && documentDir !== '.') {
      try {
        localRoots.push(vscode.Uri.file(documentDir));
      } catch (e) {
        log('Failed to add documentDir to localResourceRoots', e);
      }
    }
    localRoots.push(...workspaceRoots);

    // 授权访问插件静态资源、文档所在目录及工作区根目录
    webview.options = {
      enableScripts: true,
      localResourceRoots: localRoots,
    };

    const filePath = document.uri.fsPath || document.uri.path || '';
    const extension = extname(filePath).toLowerCase();
    const isBinary = BINARY_EXTENSIONS.includes(extension);
    const disposables: vscode.Disposable[] = [];
    let isSyncingFromWebview = false;
    let syncFromWebviewTimeout: NodeJS.Timeout | undefined;
    let isWritingFromWebview = false;
    let writeFromWebviewTimeout: NodeJS.Timeout | undefined;
    let writeDebounceTimer: NodeJS.Timeout | undefined;

    const loadDocData = async () => {
      let buffer: Buffer;
      if (document.uri.scheme === 'file' && document.uri.fsPath) {
        buffer = await readFile(document.uri.fsPath);
      } else {
        const raw = await vscode.workspace.fs.readFile(document.uri);
        buffer = Buffer.from(raw);
      }
      const mime = getMimeType(extension);
      const binaryUrl = isBinary ? `data:${mime};base64,${buffer.toString('base64')}` : undefined;
      const content = isBinary ? (binaryUrl || '') : buffer.toString('utf8');
      const referencedFiles = (extension === '.md' || extension === '.markdown') && document.uri.fsPath
        ? await loadReferencedMediaFiles(document.uri.fsPath, content, webview)
        : [];
      return { buffer, content, binaryUrl, referencedFiles };
    };

    let docData: { buffer: Buffer; content: string; binaryUrl?: string; referencedFiles: Array<Record<string, unknown>> };
    try {
      docData = await loadDocData();
      log(`Document loaded: ${filePath} (${docData.buffer.byteLength} bytes, ${extension})`);
    } catch (loadErr) {
      log(`Document load failed: ${filePath}`, loadErr);
      docData = {
        buffer: Buffer.from(''),
        content: `Error loading document: ${loadErr instanceof Error ? loadErr.message : String(loadErr)}`,
        referencedFiles: [],
      };
    }

    const postDocument = async (isUpdate = false): Promise<void> => {
      await webview.postMessage({
        type: isUpdate ? 'document-update' : 'document',
        file: {
          id: document.uri.toString(),
          name: basename(document.uri.fsPath),
          path: document.uri.fsPath,
          extension: extension.replace(/^\./, ''),
          content: docData.content,
          size: docData.buffer.byteLength,
          lastModified: Date.now(),
          binaryUrl: docData.binaryUrl,
          relatedFiles: docData.referencedFiles,
        },
      });
      log(`Document posted to Webview (isUpdate: ${isUpdate})`);
    };

    /** Webview 分屏/工作室内容写回磁盘；若文本编辑器已打开则走 WorkspaceEdit 以保持脏标记与撤销栈 */
    const persistWebviewContent = async (content: string, reason: string): Promise<void> => {
      if (typeof content !== 'string') {
        throw new Error('Invalid webview content payload');
      }
      if (isBinary) {
        log(`Skip text persist for binary file (${reason})`);
        return;
      }

      isWritingFromWebview = true;
      clearTimeout(writeFromWebviewTimeout);
      try {
        const bytes = Buffer.from(content, 'utf8');
        const openDoc = vscode.workspace.textDocuments.find(
          (doc) => doc.uri.fsPath === document.uri.fsPath && !doc.isClosed
        );

        if (openDoc) {
          const edit = new vscode.WorkspaceEdit();
          const fullRange = new vscode.Range(
            openDoc.positionAt(0),
            openDoc.positionAt(openDoc.getText().length)
          );
          edit.replace(openDoc.uri, fullRange, content);
          const applied = await vscode.workspace.applyEdit(edit);
          if (!applied) {
            throw new Error('WorkspaceEdit was rejected');
          }
          await openDoc.save();
        } else if (document.uri.scheme === 'file') {
          await writeFile(document.uri.fsPath, bytes);
        } else {
          await vscode.workspace.fs.writeFile(document.uri, bytes);
        }

        const referencedFiles =
          (extension === '.md' || extension === '.markdown') && document.uri.fsPath
            ? await loadReferencedMediaFiles(document.uri.fsPath, content, webview)
            : [];
        docData = {
          buffer: bytes,
          content,
          binaryUrl: undefined,
          referencedFiles,
        };
        log(`Persisted webview content (${reason}): ${document.uri.fsPath} (${bytes.byteLength} bytes)`);
        await webview.postMessage({
          type: 'content-saved',
          path: document.uri.fsPath,
          ok: true,
        });
      } catch (error) {
        log(`Failed to persist webview content (${reason})`, error);
        await webview.postMessage({
          type: 'content-saved',
          path: document.uri.fsPath,
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        });
        void vscode.window.showErrorMessage(
          `保存失败: ${error instanceof Error ? error.message : String(error)}`
        );
      } finally {
        // 吸收 onDidChange / FileWatcher / onDidSave 回声，避免写回后立刻被旧内容覆盖
        writeFromWebviewTimeout = setTimeout(() => {
          isWritingFromWebview = false;
        }, 600);
      }
    };

    // 监听 Webview 消息
    const messageListener = webview.onDidReceiveMessage(async (message) => {
      log(`Webview message received: ${message?.type ?? 'unknown'}`);
      if (message?.type === 'webview-error') {
        log('Webview runtime error', message);
        return;
      }
      if (message?.type === 'document-change' || message?.type === 'save-content') {
        const content = typeof message.content === 'string' ? message.content : '';
        if (message.type === 'save-content') {
          clearTimeout(writeDebounceTimer);
          await persistWebviewContent(content, 'save-content');
          return;
        }
        clearTimeout(writeDebounceTimer);
        writeDebounceTimer = setTimeout(() => {
          void persistWebviewContent(content, 'document-change');
        }, 400);
        return;
      }
      if (message?.type === 'open-source') {
        log(`Opening source editor: ${document.uri.fsPath} (line: ${message?.line})`);
        const targetLine = typeof message?.line === 'number' ? Math.max(0, message.line - 1) : undefined;
        const targetCol = typeof message?.column === 'number' ? Math.max(0, message.column - 1) : 0;
        const options: vscode.TextDocumentShowOptions = {
          viewColumn: vscode.ViewColumn.Beside,
          preview: false,
        };
        if (targetLine !== undefined) {
          const pos = new vscode.Position(targetLine, targetCol);
          options.selection = new vscode.Range(pos, pos);
        }
        await vscode.window.showTextDocument(document.uri, options);
        return;
      }
      if (message?.type === 'reveal-source-line') {
        const line = typeof message?.line === 'number' ? Math.max(1, message.line) : 1;
        const lineIdx = line - 1;
        const revealType = message?.revealType || 'scroll'; // 'scroll' | 'select'

        isSyncingFromWebview = true;
        clearTimeout(syncFromWebviewTimeout);
        syncFromWebviewTimeout = setTimeout(() => {
          isSyncingFromWebview = false;
        }, 350);

        // 查找当前是否已分屏打开此文件的文本编辑器
        const visibleEditor = vscode.window.visibleTextEditors.find(
          (editor) => editor.document.uri.fsPath === document.uri.fsPath
        );

        if (visibleEditor) {
          const pos = new vscode.Position(lineIdx, 0);
          const range = new vscode.Range(pos, pos);
          if (revealType === 'select') {
            visibleEditor.selection = new vscode.Selection(pos, pos);
          }
          visibleEditor.revealRange(
            range,
            revealType === 'select'
              ? vscode.TextEditorRevealType.InCenter
              : vscode.TextEditorRevealType.AtTop
          );
        } else if (revealType === 'select') {
          // 用户显式双击反向定位，若未分屏则在侧边打开源码并定位光标
          const pos = new vscode.Position(lineIdx, 0);
          await vscode.window.showTextDocument(document.uri, {
            viewColumn: vscode.ViewColumn.Beside,
            selection: new vscode.Range(pos, pos),
            preview: false,
          });
        }
        return;
      }
      if (message?.type === 'print-document') {
        try {
          await openPrintableHtmlInBrowser(
            typeof message.fileName === 'string' ? message.fileName : document.uri.fsPath,
            typeof message.html === 'string' ? message.html : ''
          );
          void vscode.window.showInformationMessage('已在系统浏览器打开打印预览，可直接打印或另存为 PDF。');
        } catch (error) {
          log('Failed to open printable document', error);
          void vscode.window.showErrorMessage(
            `打印失败: ${error instanceof Error ? error.message : String(error)}`
          );
        }
        return;
      }
      if (message?.type === 'open-vscode-settings') {
        try {
          await vscode.commands.executeCommand('workbench.action.openSettings', 'omniview');
        } catch (error) {
          log('Failed to open VS Code settings from webview message', error);
        }
        return;
      }
      if (message?.type === 'save-configuration' && message?.settings && typeof message.settings === 'object') {
        // Webview 设置弹窗修改后，向 VS Code 工作区持久化写回配置
        try {
          const config = vscode.workspace.getConfiguration('omniview');
          const s = message.settings as Record<string, unknown>;
          if (s.theme !== undefined) await config.update('preview.theme', s.theme, vscode.ConfigurationTarget.Global);
          if (s.density !== undefined) await config.update('preview.density', s.density, vscode.ConfigurationTarget.Global);
          if (typeof s.fontSize === 'number') await config.update('preview.fontSize', s.fontSize, vscode.ConfigurationTarget.Global);
          if (s.contentWidth !== undefined) await config.update('preview.contentWidth', s.contentWidth, vscode.ConfigurationTarget.Global);
          if (typeof s.zoom === 'number') await config.update('preview.zoomLevel', s.zoom, vscode.ConfigurationTarget.Global);
          if (s.viewMode !== undefined) await config.update('preview.defaultViewMode', s.viewMode, vscode.ConfigurationTarget.Global);
          if (typeof s.splitRatio === 'number') await config.update('preview.splitRatio', s.splitRatio, vscode.ConfigurationTarget.Global);
          if (s.splitRightMode !== undefined) await config.update('preview.splitRightMode', s.splitRightMode, vscode.ConfigurationTarget.Global);
          if (s.enableLazyBlockUnmount !== undefined) await config.update('preview.lazyUnmount', s.enableLazyBlockUnmount, vscode.ConfigurationTarget.Global);
          if (s.scrollSync !== undefined) await config.update('editor.scrollSync', s.scrollSync, vscode.ConfigurationTarget.Global);
          if (s.wordWrap !== undefined) await config.update('editor.wordWrap', s.wordWrap, vscode.ConfigurationTarget.Global);
          if (s.showLineNumbers !== undefined) await config.update('editor.showLineNumbers', s.showLineNumbers, vscode.ConfigurationTarget.Global);
          if (s.enableDoubleClickEdit !== undefined) await config.update('editor.doubleClickEdit', s.enableDoubleClickEdit, vscode.ConfigurationTarget.Global);
          if (s.outlineOpen !== undefined) await config.update('outline.open', s.outlineOpen, vscode.ConfigurationTarget.Global);
          if (s.outlinePosition !== undefined) await config.update('outline.position', s.outlinePosition, vscode.ConfigurationTarget.Global);
          if (s.outlineDisplayMode !== undefined) await config.update('outline.displayMode', s.outlineDisplayMode, vscode.ConfigurationTarget.Global);
          if (typeof s.plantUmlServerUrl === 'string') await config.update('plantuml.serverUrl', s.plantUmlServerUrl, vscode.ConfigurationTarget.Global);
          if (s.enableOkfRendering !== undefined) await config.update('knowledge.enableOkfRendering', s.enableOkfRendering, vscode.ConfigurationTarget.Global);
          if (s.locale !== undefined) await config.update('general.locale', s.locale, vscode.ConfigurationTarget.Global);
          log('Saved configuration back to VS Code global settings');
        } catch (err) {
          log('Failed to save configuration to VS Code workspace', err);
        }
        return;
      }
      if (message?.type !== 'ready') return;
      try {
        await postDocument(false);
        // 初始握手时将当前 VS Code 宿主配置一并推给 Webview
        await webview.postMessage({
          type: 'host-configuration',
          settings: getHostConfiguration(),
        });
      } catch (error) {
        log('Failed to post document to Webview', error);
      }
    });
    disposables.push(messageListener);

    // 1. 实时编辑监听 (onDidChangeTextDocument): 边打字边实时热刷新 Webview
    let editDebounceTimer: NodeJS.Timeout | undefined;
    const changeListener = vscode.workspace.onDidChangeTextDocument((event) => {
      if (isWritingFromWebview) return;
      if (event.document.uri.fsPath === document.uri.fsPath && !isBinary) {
        clearTimeout(editDebounceTimer);
        editDebounceTimer = setTimeout(async () => {
          if (isWritingFromWebview) return;
          try {
            const content = event.document.getText();
            const referencedFiles = extension === '.md' || extension === '.markdown'
              ? await loadReferencedMediaFiles(document.uri.fsPath, content, webview)
              : [];
            docData = {
              buffer: Buffer.from(content, 'utf8'),
              content,
              binaryUrl: undefined,
              referencedFiles,
            };
            await postDocument(true);
            log(`Live edit update pushed to Webview for: ${document.uri.fsPath}`);
          } catch (err) {
            log('Error in onDidChangeTextDocument sync', err);
          }
        }, 150);
      }
    });
    disposables.push(changeListener);

    // 2. 文件保存与物理改动重载 (onDidSaveTextDocument & FileWatcher)
    const reloadAndPost = async () => {
      if (isWritingFromWebview) {
        log(`Skip reload while writing from webview: ${document.uri.fsPath}`);
        return;
      }
      try {
        docData = await loadDocData();
        await postDocument(true);
        log(`Auto reloaded document from disk: ${document.uri.fsPath}`);
      } catch (err) {
        log(`Failed to auto reload document: ${document.uri.fsPath}`, err);
      }
    };

    const saveListener = vscode.workspace.onDidSaveTextDocument(async (savedDoc) => {
      if (savedDoc.uri.fsPath === document.uri.fsPath) {
        log(`onDidSaveTextDocument triggered for: ${savedDoc.uri.fsPath}`);
        await reloadAndPost();
      }
    });
    disposables.push(saveListener);

    if (document.uri.scheme === 'file' && documentDir && documentDir !== '.') {
      try {
        const fileWatcher = vscode.workspace.createFileSystemWatcher(
          new vscode.RelativePattern(documentDir, basename(document.uri.fsPath))
        );
        fileWatcher.onDidChange(async () => {
          log(`FileSystemWatcher onDidChange triggered for: ${document.uri.fsPath}`);
          await reloadAndPost();
        });
        disposables.push(fileWatcher);
      } catch (err) {
        log(`Failed to initialize fileWatcher for: ${document.uri.fsPath}`, err);
      }
    }

    // 3. 监听编辑器滚动范围变更 (onDidChangeTextEditorVisibleRanges)，建立平滑双向同步
    const visibleRangesListener = vscode.window.onDidChangeTextEditorVisibleRanges((event) => {
      if (isSyncingFromWebview) return;
      if (event?.textEditor?.document?.uri && event.textEditor.document.uri.fsPath === document.uri.fsPath) {
        const visibleRange = event.visibleRanges[0];
        if (!visibleRange) return;
        const topLine = visibleRange.start.line + 1;
        const bottomLine = visibleRange.end.line + 1;
        const activeLine = event.textEditor.selection.active.line + 1;
        const totalLines = event.textEditor.document.lineCount;

        webview.postMessage({
          type: 'editor-scroll-sync',
          topLine,
          bottomLine,
          activeLine,
          totalLines,
        });
      }
    });
    disposables.push(visibleRangesListener);

    // 4. 监听编辑器光标选择位置变更 (onDidChangeTextEditorSelection)
    const selectionListener = vscode.window.onDidChangeTextEditorSelection((event) => {
      if (isSyncingFromWebview) return;
      if (event?.textEditor?.document?.uri && event.textEditor.document.uri.fsPath === document.uri.fsPath) {
        const activeLine = event.selections[0]?.active.line + 1;
        if (activeLine) {
          webview.postMessage({
            type: 'editor-cursor-sync',
            activeLine,
            totalLines: event.textEditor.document.lineCount,
          });
        }
      }
    });
    disposables.push(selectionListener);

    // 监听 VS Code 原生色彩主题切换 (如切换为 One Dark Pro / Dracula / Tokyo Night) 并实时向 Webview 广播
    const themeListener = vscode.window.onDidChangeActiveColorTheme((colorTheme) => {
      const kindStr = colorTheme.kind === vscode.ColorThemeKind.Light
        ? 'light'
        : colorTheme.kind === vscode.ColorThemeKind.HighContrast
        ? 'high-contrast'
        : colorTheme.kind === vscode.ColorThemeKind.HighContrastLight
        ? 'high-contrast-light'
        : 'dark';
      webview.postMessage({
        type: 'theme-changed',
        themeKind: kindStr,
      });
      log(`Active color theme changed: kind=${kindStr}`);
    });
    disposables.push(themeListener);

    // 5. 监听 VS Code 工作区与用户配置变更 (omniview.*)，实现设置双向热更新
    const configListener = vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('omniview')) {
        const currentCfg = getHostConfiguration();
        webview.postMessage({
          type: 'host-configuration',
          settings: currentCfg,
        });
        log('Workspace configuration changed (omniview.*), pushed update to Webview');
      }
    });
    disposables.push(configListener);

    // Webview 销毁时统一释放所有监听器与 Watcher，杜绝内存泄漏
    webviewPanel.onDidDispose(() => {
      clearTimeout(editDebounceTimer);
      clearTimeout(syncFromWebviewTimeout);
      clearTimeout(writeDebounceTimer);
      clearTimeout(writeFromWebviewTimeout);
      log(`Panel disposed, releasing ${disposables.length} watchers/listeners for: ${document.uri.fsPath}`);
      disposables.forEach(d => {
        try {
          d.dispose();
        } catch {
          // ignore
        }
      });
      disposables.length = 0;
    });

    // 初始化 HTML（内嵌首屏初始文档，避免任何异步消息时序延迟与脏缓存）并注册防御性消息投递
    const initialFilePayload = {
      id: document.uri.toString(),
      name: basename(filePath),
      path: filePath,
      extension: extension.replace(/^\./, ''),
      content: docData.content,
      size: docData.buffer.byteLength,
      lastModified: Date.now(),
      binaryUrl: docData.binaryUrl,
      relatedFiles: docData.referencedFiles,
    };
    try {
      webview.html = getWebviewHtml(webview, this.extensionUri, initialFilePayload);
    } catch (error) {
      log('Failed to initialize webview HTML', error);
      throw error instanceof Error ? error : new Error(String(error));
    }
  }
}

export function activate(context: vscode.ExtensionContext): void {
  output = vscode.window.createOutputChannel('OmniView');
  context.subscriptions.push(output);
  log(`Extension activated: ${context.extensionUri?.fsPath ?? 'unknown path'}`);
  const provider = new OmniViewerEditorProvider(context.extensionUri);
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
      initialPayload
    );

    activeWorkbenchPanel.onDidDispose(() => {
      activeWorkbenchPanel = undefined;
    });
  }));

  context.subscriptions.push(vscode.commands.registerCommand('omniview.showLogs', () => output.show(true)));
}

export function deactivate(): void {}
