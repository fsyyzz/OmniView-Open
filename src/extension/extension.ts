import * as vscode from 'vscode';
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, extname, join as joinPath, resolve as resolvePath } from 'node:path';

const VIEW_TYPE = 'omniview.editor';
const SUPPORTED_EXTENSIONS = ['.md', '.markdown', '.okf', '.puml', '.plantuml', '.iuml', '.mmd', '.mermaid', '.dot', '.gv', '.svg', '.pdf', '.csv', '.tsv', '.json', '.yaml', '.yml', '.xml', '.ts', '.tsx', '.js', '.jsx', '.txt', '.markmap', '.mm', '.mindmap', '.km', '.typ', '.typst', '.excalidraw', '.ipynb', '.egn', '.domainstory'];
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
    scrollSync: config.get<boolean>('editor.scrollSync', true),
    wordWrap: config.get<boolean>('editor.wordWrap', true),
    showLineNumbers: config.get<boolean>('editor.showLineNumbers', true),
    plantUmlServerUrl: config.get<string>('plantuml.serverUrl', 'https://www.plantuml.com/plantuml'),
    enableOkfRendering: config.get<boolean>('knowledge.enableOkfRendering', true),
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

async function loadReferencedMediaFiles(markdownPath: string, markdown: string): Promise<Array<Record<string, unknown>>> {
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
    if (rawTarget && !/^[a-z]+:/i.test(rawTarget)) {
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
      for (const candidateExt of ['md', 'egn', 'excalidraw', 'puml', 'mmd', 'svg', 'dot', 'markmap']) {
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
        // 对于文本类/图形工程类/矢量类文件，读取 utf8 文本作为 content 供 Webview 内联渲染
        const isBinaryImg = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'].includes(ext);
        const textContent = isBinaryImg ? '' : stats.toString('utf8');

        assets.push({
          id: assetPath,
          name: basename(assetPath),
          path: assetPath,
          extension: ext,
          content: textContent,
          size: stats.byteLength,
          lastModified: Date.now(),
        });
        log(`Referenced media/diagram asset loaded: ${assetPath} (${stats.byteLength} bytes, ext: ${ext})`);
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
    const isPdf = extension === '.pdf';
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
      const content = isPdf ? '' : buffer.toString('utf8');
      const binaryUrl = isPdf ? `data:application/pdf;base64,${buffer.toString('base64')}` : undefined;
      const referencedFiles = (extension === '.md' || extension === '.markdown') && document.uri.fsPath
        ? await loadReferencedMediaFiles(document.uri.fsPath, content)
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
      if (isPdf) {
        log(`Skip text persist for PDF (${reason})`);
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
            ? await loadReferencedMediaFiles(document.uri.fsPath, content)
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
      if (message?.type === 'save-configuration' && message?.settings && typeof message.settings === 'object') {
        // Webview 设置弹窗修改后，向 VS Code 工作区持久化写回配置
        try {
          const config = vscode.workspace.getConfiguration('omniview');
          const s = message.settings as Record<string, unknown>;
          if (s.theme !== undefined) await config.update('preview.theme', s.theme, vscode.ConfigurationTarget.Global);
          if (s.density !== undefined) await config.update('preview.density', s.density, vscode.ConfigurationTarget.Global);
          if (typeof s.fontSize === 'number') await config.update('preview.fontSize', s.fontSize, vscode.ConfigurationTarget.Global);
          if (s.contentWidth !== undefined) await config.update('preview.contentWidth', s.contentWidth, vscode.ConfigurationTarget.Global);
          if (s.scrollSync !== undefined) await config.update('editor.scrollSync', s.scrollSync, vscode.ConfigurationTarget.Global);
          if (s.wordWrap !== undefined) await config.update('editor.wordWrap', s.wordWrap, vscode.ConfigurationTarget.Global);
          if (s.showLineNumbers !== undefined) await config.update('editor.showLineNumbers', s.showLineNumbers, vscode.ConfigurationTarget.Global);
          if (typeof s.plantUmlServerUrl === 'string') await config.update('plantuml.serverUrl', s.plantUmlServerUrl, vscode.ConfigurationTarget.Global);
          if (s.enableOkfRendering !== undefined) await config.update('knowledge.enableOkfRendering', s.enableOkfRendering, vscode.ConfigurationTarget.Global);
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
      if (event.document.uri.fsPath === document.uri.fsPath && !isPdf) {
        clearTimeout(editDebounceTimer);
        editDebounceTimer = setTimeout(async () => {
          if (isWritingFromWebview) return;
          try {
            const content = event.document.getText();
            const referencedFiles = extension === '.md' || extension === '.markdown'
              ? await loadReferencedMediaFiles(document.uri.fsPath, content)
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

    for (const delay of [100, 500, 1500]) {
      setTimeout(() => void postDocument(false).catch((error) => log(`Document retry failed (${delay}ms)`, error)), delay);
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

  // 在侧边打开预览
  context.subscriptions.push(vscode.commands.registerCommand('omniview.openSidePreview', async (uri?: vscode.Uri | vscode.Uri[]) => {
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
      await vscode.commands.executeCommand('vscode.openWith', target, VIEW_TYPE, vscode.ViewColumn.Beside);
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

  // 打开插件配置面板
  context.subscriptions.push(vscode.commands.registerCommand('omniview.openSettings', async () => {
    try {
      await vscode.commands.executeCommand('workbench.action.openSettings', 'omniview');
    } catch (error) {
      log('openSettings failed', error);
    }
  }));

  context.subscriptions.push(vscode.commands.registerCommand('omniview.showLogs', () => output.show(true)));
}

export function deactivate(): void {}
