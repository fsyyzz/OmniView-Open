import { readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, extname } from 'node:path';
import * as vscode from 'vscode';
import { BINARY_EXTENSIONS, getMimeType } from './types';
import { isSameDocumentUri } from './utils';
import { getHostConfiguration } from './configSync';
import { loadReferencedMediaFiles } from './fileBridge';
import { openPrintableHtmlInBrowser } from './printBridge';
import { getWebviewHtml } from './webviewHtml';

export class OmniViewerDocument implements vscode.CustomDocument {
  constructor(public readonly uri: vscode.Uri) {}
  dispose(): void {}
}

export class OmniViewerEditorProvider implements vscode.CustomReadonlyEditorProvider<OmniViewerDocument> {
  constructor(private readonly extensionUri: vscode.Uri, private readonly log: (message: string, details?: unknown) => void) {}

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

    this.log(`Resolving Custom Editor: ${document.uri.fsPath || document.uri.toString()}`);
    const log = this.log;
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
        ? await loadReferencedMediaFiles(document.uri.fsPath, content, webview, log)
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
          (doc) => isSameDocumentUri(doc.uri, document.uri) && !doc.isClosed
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
            ? await loadReferencedMediaFiles(document.uri.fsPath, content, webview, log)
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
      if (message?.type === 'reload-document') {
        log(`Manual reload requested from webview: ${document.uri.fsPath}`);
        await reloadAndPost(true);
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
          (editor) => isSameDocumentUri(editor.document.uri, document.uri)
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
            typeof message.html === 'string' ? message.html : '',
            log
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
      if (isSameDocumentUri(event.document.uri, document.uri) && !isBinary) {
        clearTimeout(editDebounceTimer);
        editDebounceTimer = setTimeout(async () => {
          if (isWritingFromWebview) return;
          try {
            const content = event.document.getText();
            const referencedFiles = extension === '.md' || extension === '.markdown'
              ? await loadReferencedMediaFiles(document.uri.fsPath, content, webview, log)
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
    const reloadAndPost = async (forceFromDisk = false) => {
      if (isWritingFromWebview && !forceFromDisk) {
        log(`Skip reload while writing from webview: ${document.uri.fsPath}`);
        return;
      }
      try {
        const openDoc = vscode.workspace.textDocuments.find(
          (doc) => isSameDocumentUri(doc.uri, document.uri) && !doc.isClosed
        );
        if (openDoc && !isBinary && !forceFromDisk) {
          const content = openDoc.getText();
          const bytes = Buffer.from(content, 'utf8');
          const referencedFiles =
            (extension === '.md' || extension === '.markdown') && document.uri.fsPath
              ? await loadReferencedMediaFiles(document.uri.fsPath, content, webview, log)
              : [];
          docData = {
            buffer: bytes,
            content,
            binaryUrl: undefined,
            referencedFiles,
          };
        } else {
          docData = await loadDocData();
        }
        await postDocument(true);
        log(`Auto reloaded document from memory/disk: ${document.uri.fsPath}`);
      } catch (err) {
        log(`Failed to auto reload document: ${document.uri.fsPath}`, err);
      }
    };

    const saveListener = vscode.workspace.onDidSaveTextDocument(async (savedDoc) => {
      if (isSameDocumentUri(savedDoc.uri, document.uri)) {
        log(`onDidSaveTextDocument triggered for: ${savedDoc.uri.fsPath}`);
        await reloadAndPost(true);
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
          await reloadAndPost(true);
        });
        fileWatcher.onDidCreate(async () => {
          log(`FileSystemWatcher onDidCreate triggered for: ${document.uri.fsPath}`);
          await reloadAndPost(true);
        });
        disposables.push(fileWatcher);
      } catch (err) {
        log(`Failed to initialize fileWatcher for: ${document.uri.fsPath}`, err);
      }
    }

    // 3. 监听编辑器滚动范围变更 (onDidChangeTextEditorVisibleRanges)，建立平滑双向同步
    const visibleRangesListener = vscode.window.onDidChangeTextEditorVisibleRanges((event) => {
      if (isSyncingFromWebview) return;
      if (event?.textEditor?.document?.uri && isSameDocumentUri(event.textEditor.document.uri, document.uri)) {
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
      if (event?.textEditor?.document?.uri && isSameDocumentUri(event.textEditor.document.uri, document.uri)) {
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
      webview.html = getWebviewHtml(webview, this.extensionUri, initialFilePayload, log);
    } catch (error) {
      log('Failed to initialize webview HTML', error);
      throw error instanceof Error ? error : new Error(String(error));
    }
  }
}
