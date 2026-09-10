import * as vscode from 'vscode';
import { readFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { basename, dirname, extname, resolve as resolvePath } from 'node:path';

const VIEW_TYPE = 'omniview.editor';
const SUPPORTED_EXTENSIONS = ['.md', '.markdown', '.okf', '.puml', '.plantuml', '.iuml', '.svg', '.pdf', '.csv', '.tsv', '.json', '.yaml', '.yml', '.xml', '.ts', '.tsx', '.js', '.jsx', '.txt', '.markmap', '.mm', '.mindmap', '.km'];
let output: vscode.OutputChannel;

function log(message: string, details?: unknown): void {
  const suffix = details === undefined ? '' : ` ${details instanceof Error ? details.stack : JSON.stringify(details)}`;
  output?.appendLine(`[${new Date().toISOString()}] ${message}${suffix}`);
  console.log(`[OmniView] ${message}${suffix}`);
}

async function loadReferencedMediaFiles(markdownPath: string, markdown: string): Promise<Array<Record<string, unknown>>> {
  const references = [...markdown.matchAll(/!\[[^\]]*\]\(([^)]+\.(?:svg|png|jpg|jpeg|gif|webp|bmp)(?:#[^)]*)?)\)/gi)]
    .map(match => match[1].trim().split(/[?#]/, 1)[0])
    .filter(source => source && !/^[a-z]+:/i.test(source));
  const uniquePaths = [...new Set(references)];
  const assets: Array<Record<string, unknown>> = [];

  for (const source of uniquePaths) {
    const assetPath = resolvePath(dirname(markdownPath), decodeURIComponent(source));
    const ext = extname(assetPath).toLowerCase().replace(/^\./, '');
    try {
      if (ext === 'svg') {
        const asset = await readFile(assetPath);
        assets.push({
          id: assetPath,
          name: basename(assetPath),
          path: assetPath,
          extension: 'svg',
          content: asset.toString('utf8'),
          size: asset.byteLength,
          lastModified: Date.now(),
        });
        log(`Referenced SVG loaded: ${assetPath} (${asset.byteLength} bytes)`);
      } else if (existsSync(assetPath)) {
        const stats = await readFile(assetPath);
        assets.push({
          id: assetPath,
          name: basename(assetPath),
          path: assetPath,
          extension: ext,
          content: '',
          size: stats.byteLength,
          lastModified: Date.now(),
        });
        log(`Referenced image verified: ${assetPath} (${stats.byteLength} bytes)`);
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
  const htmlPath = vscode.Uri.joinPath(extensionUri, 'dist', 'webview', 'index.html');
  log(`Loading Webview HTML: ${htmlPath.fsPath}`);
  if (!existsSync(htmlPath.fsPath)) throw new Error(`Webview HTML not found: ${htmlPath.fsPath}`);
  const html = readFileSync(htmlPath.fsPath, 'utf8');
  const safeJson = initialData ? JSON.stringify(initialData).replace(/</g, '\\u003c') : '';
  const initialDataScript = safeJson ? `<script id="omniview-initial-data" type="application/json">${safeJson}</script>` : '';
  return html
    .replace(/(src|href)="(\.\/)?assets\//g, (_match: string, attribute: string) => `${attribute}="${webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'dist', 'webview', 'assets'))}/`)
    .replace('<head>', `<head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} https: data: vscode-resource: vscode-webview-resource: blob:; style-src ${webview.cspSource} 'unsafe-inline'; script-src ${webview.cspSource} 'unsafe-inline' 'unsafe-eval'; worker-src ${webview.cspSource} blob: data:; connect-src https: data: blob:;">`)
    .replace('</body>', `${initialDataScript}<script>window.__OMNIVIEW_VSCODE__ = true;</script></body>`);
}

class OmniViewerEditorProvider implements vscode.CustomReadonlyEditorProvider<OmniViewerDocument> {
  constructor(private readonly extensionUri: vscode.Uri) {}

  async openCustomDocument(uri: vscode.Uri): Promise<OmniViewerDocument> {
    return new OmniViewerDocument(uri);
  }

  async resolveCustomEditor(document: OmniViewerDocument, webviewPanel: vscode.WebviewPanel): Promise<void> {
    log(`Resolving Custom Editor: ${document.uri.fsPath}`);
    const webview = webviewPanel.webview;
    const documentDir = dirname(document.uri.fsPath);
    const workspaceRoots = vscode.workspace.workspaceFolders?.map(f => f.uri) || [];

    // 授权访问插件静态资源、文档所在目录及工作区根目录
    webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview'),
        vscode.Uri.file(documentDir),
        ...workspaceRoots,
      ],
    };

    const extension = extname(document.uri.fsPath).toLowerCase();
    const isPdf = extension === '.pdf';
    const disposables: vscode.Disposable[] = [];

    const loadDocData = async () => {
      const buffer = await readFile(document.uri.fsPath);
      const content = isPdf ? '' : buffer.toString('utf8');
      const binaryUrl = isPdf ? `data:application/pdf;base64,${buffer.toString('base64')}` : undefined;
      const referencedFiles = extension === '.md' || extension === '.markdown'
        ? await loadReferencedMediaFiles(document.uri.fsPath, content)
        : [];
      return { buffer, content, binaryUrl, referencedFiles };
    };

    let docData = await loadDocData();
    log(`Document loaded: ${document.uri.fsPath} (${docData.buffer.byteLength} bytes, ${extension})`);

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

    // 监听 Webview 消息
    const messageListener = webview.onDidReceiveMessage(async (message) => {
      log(`Webview message received: ${message?.type ?? 'unknown'}`);
      if (message?.type === 'webview-error') {
        log('Webview runtime error', message);
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
      if (message?.type !== 'ready') return;
      try {
        await postDocument(false);
      } catch (error) {
        log('Failed to post document to Webview', error);
      }
    });
    disposables.push(messageListener);

    // 1. 实时编辑监听 (onDidChangeTextDocument): 边打字边实时热刷新 Webview
    let editDebounceTimer: NodeJS.Timeout | undefined;
    const changeListener = vscode.workspace.onDidChangeTextDocument((event) => {
      if (event.document.uri.fsPath === document.uri.fsPath && !isPdf) {
        clearTimeout(editDebounceTimer);
        editDebounceTimer = setTimeout(async () => {
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

    const fileWatcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(documentDir, basename(document.uri.fsPath))
    );
    fileWatcher.onDidChange(async () => {
      log(`FileSystemWatcher onDidChange triggered for: ${document.uri.fsPath}`);
      await reloadAndPost();
    });
    disposables.push(fileWatcher);

    // Webview 销毁时统一释放所有监听器与 Watcher，杜绝内存泄漏
    webviewPanel.onDidDispose(() => {
      clearTimeout(editDebounceTimer);
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
      name: basename(document.uri.fsPath),
      path: document.uri.fsPath,
      extension: extension.replace(/^\./, ''),
      content: docData.content,
      size: docData.buffer.byteLength,
      lastModified: Date.now(),
      binaryUrl: docData.binaryUrl,
      relatedFiles: docData.referencedFiles,
    };
    webview.html = getWebviewHtml(webview, this.extensionUri, initialFilePayload);

    for (const delay of [100, 500, 1500]) {
      setTimeout(() => void postDocument(false).catch((error) => log(`Document retry failed (${delay}ms)`, error)), delay);
    }
  }
}

export function activate(context: vscode.ExtensionContext): void {
  output = vscode.window.createOutputChannel('OmniView');
  context.subscriptions.push(output);
  log(`Extension activated: ${context.extensionUri.fsPath}`);
  const provider = new OmniViewerEditorProvider(context.extensionUri);
  context.subscriptions.push(vscode.window.registerCustomEditorProvider(VIEW_TYPE, provider, {
    webviewOptions: { retainContextWhenHidden: true },
    supportsMultipleEditorsPerDocument: true,
  }));
  log(`Custom Editor registered: ${VIEW_TYPE}`);

  // 在侧边打开预览
  context.subscriptions.push(vscode.commands.registerCommand('omniview.openSidePreview', async (uri?: vscode.Uri) => {
    const target = uri ?? vscode.window.activeTextEditor?.document.uri;
    if (!target || !SUPPORTED_EXTENSIONS.includes(extname(target.fsPath).toLowerCase())) {
      vscode.window.showWarningMessage('请选择 OmniView 支持的文件。');
      return;
    }
    await vscode.commands.executeCommand('vscode.openWith', target, VIEW_TYPE, vscode.ViewColumn.Beside);
  }));

  // 打开源码编辑
  context.subscriptions.push(vscode.commands.registerCommand('omniview.openSource', async (uri?: vscode.Uri) => {
    let target = uri;
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
    await vscode.window.showTextDocument(target, { viewColumn: vscode.ViewColumn.Beside, preview: false });
  }));

  context.subscriptions.push(vscode.commands.registerCommand('omniview.showLogs', () => output.show(true)));
}

export function deactivate(): void {}
