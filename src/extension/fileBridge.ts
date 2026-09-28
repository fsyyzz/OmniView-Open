import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { basename, dirname, extname, resolve as resolvePath } from 'node:path';
import * as vscode from 'vscode';
import { getMimeType } from './types';

export function loadReferencedMediaFiles(
  markdownPath: string,
  markdown: string,
  webview: vscode.Webview | undefined,
  log: (message: string, details?: unknown) => void
): Promise<Array<Record<string, unknown>>> {
  return loadReferencedMediaFilesAsync(markdownPath, markdown, webview, log);
}

async function loadReferencedMediaFilesAsync(
  markdownPath: string,
  markdown: string,
  webview: vscode.Webview | undefined,
  log: (message: string, details?: unknown) => void
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
