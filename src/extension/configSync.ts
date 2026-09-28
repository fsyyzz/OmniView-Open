import * as vscode from 'vscode';
import type { HostConfiguration } from './types';

/** 读取并归一化 VS Code 宿主工作区中的 omniview 配置 */
export function getHostConfiguration(): HostConfiguration {
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
