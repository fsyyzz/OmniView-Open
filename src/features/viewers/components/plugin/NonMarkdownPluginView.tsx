import React, { useRef, useState, useEffect, useCallback } from 'react';
import type { FileItem, ThemeId, DensityMode, WorkbenchSettings } from '../../../../shared/types';
import { ViewerRenderer } from '../../ViewerRenderer';
import { loadStoredSettings, saveStoredSettings } from '../../../../shared/lib/settingsStorage';
import type { VsCodeApi } from '../../../../shared/lib/vscode';
import { KeyboardShortcutsModal } from '../HelpShortcutsModal';
import { Save, Loader2 } from 'lucide-react';

const WorkbenchSettingsModal = React.lazy(() =>
  import('../../../workbench/components/WorkbenchSettingsModal').then(m => ({ default: m.WorkbenchSettingsModal }))
);

export interface NonMarkdownPluginViewProps {
  file: FileItem;
  theme: ThemeId;
  density: DensityMode;
  onThemeChange?: (theme: ThemeId) => void;
  onDensityChange?: (density: DensityMode) => void;
  onContentChange?: (content: string) => void;
  vscode?: VsCodeApi;
}

export const NonMarkdownPluginView: React.FC<NonMarkdownPluginViewProps> = ({
  file,
  theme,
  density,
  onThemeChange,
  onDensityChange,
  onContentChange,
  vscode,
}) => {
  const [currentContent, setCurrentContent] = useState(file.content);
  const [isDirty, setIsDirty] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const initialContentRef = useRef(file.content);
  const latestContentRef = useRef(file.content);

  const [settings, setSettings] = useState<WorkbenchSettings>(() => {
    const stored = loadStoredSettings();
    return {
      ...stored,
      theme: theme || stored.theme,
      density: density || stored.density,
    };
  });

  const handleSettingsChange = (newSettings: WorkbenchSettings) => {
    setSettings(newSettings);
    saveStoredSettings(newSettings);
    if (newSettings.theme !== theme && onThemeChange) {
      onThemeChange(newSettings.theme);
    }
    if (newSettings.density !== density && onDensityChange) {
      onDensityChange(newSettings.density);
    }
  };

  useEffect(() => {
    initialContentRef.current = file.content;
    latestContentRef.current = file.content;
    setCurrentContent(file.content);
    setIsDirty(false);
  }, [file.id, file.content]);

  const handleSaveImmediate = useCallback(() => {
    if (!vscode) return;
    setSaveStatus('saving');
    vscode.postMessage({
      type: 'save-content',
      path: file.path,
      content: latestContentRef.current,
    });
  }, [file.path, vscode]);

  const persistContent = useCallback(
    (newContent: string) => {
      latestContentRef.current = newContent;
      setCurrentContent(newContent);
      const dirty = newContent !== initialContentRef.current;
      setIsDirty(dirty);
      if (dirty) setSaveStatus('idle');
      onContentChange?.(newContent);
      if (vscode) {
        vscode.postMessage({
          type: 'document-change',
          path: file.path,
          content: newContent,
        });
      }
    },
    [file.path, onContentChange, vscode]
  );

  // 快捷键监听 (Ctrl+S / Cmd+S 立即落盘; Ctrl+? 打开指南; Ctrl+A 精准全选正文区)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSaveImmediate();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === '?' || (e.shiftKey && (e.key === '/' || e.code === 'Slash')))) {
        e.preventDefault();
        setIsShortcutsModalOpen(prev => !prev);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'a' || e.key === 'A')) {
        const activeEl = document.activeElement as HTMLElement | null;
        if (
          activeEl &&
          (activeEl.tagName === 'INPUT' ||
            activeEl.tagName === 'TEXTAREA' ||
            activeEl.tagName === 'SELECT' ||
            activeEl.isContentEditable ||
            activeEl.getAttribute('contenteditable') === 'true' ||
            activeEl.closest(
              '.ov-code-editor, textarea, input, select, [contenteditable="true"], [role="dialog"], .ov-modal-backdrop'
            ))
        ) {
          return;
        }
        if (document.querySelector('.ov-modal-backdrop, [role="dialog"]')) {
          return;
        }

        // 查找正文区域容器，避免选中插件顶栏与状态栏
        const contentCanvas = (document.querySelector(
          '#markdown-viewer-canvas, .markdown-document, #structured-data-body, #csv-table-canvas, #code-viewer-canvas, .markdown-plugin-scroll > div'
        ) ||
          document.querySelector(
            '#structured-data-viewer, #code-viewer-container, .notebook-viewer, .typst-viewer-container'
          )) as HTMLElement | null;

        if (contentCanvas) {
          e.preventDefault();
          e.stopPropagation();
          const sel = window.getSelection();
          if (sel) {
            const range = document.createRange();
            range.selectNodeContents(contentCanvas);
            sel.removeAllRanges();
            sel.addRange(range);
          }
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [handleSaveImmediate]);

  // 监听来自 VS Code 宿主的 content-saved 反馈消息
  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (e.data?.type === 'content-saved' && e.data?.ok) {
        initialContentRef.current = latestContentRef.current;
        setIsDirty(false);
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  return (
    <main
      className="flex h-full w-full min-h-0 flex-col overflow-hidden transition-colors relative"
      data-theme={theme}
      data-density={density}
      style={{
        background: 'var(--ov-bg)',
        color: 'var(--ov-text)',
      }}
    >
      {/* 视图主体容器 (非 Markdown 格式由驱动自包含 Studio 工具栏完全掌控，消除外壳重复顶栏) */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden h-full w-full">
        <ViewerRenderer
          file={{ ...file, content: currentContent }}
          files={[{ ...file, content: currentContent }]}
          mode="preview"
          theme={theme}
          density={density}
          onContentChange={persistContent}
          onOpenInEditor={vscode ? () => vscode.postMessage({ type: 'open-source', path: file.path }) : undefined}
          onOpenSettings={() => setIsSettingsModalOpen(true)}
          onOpenShortcuts={() => setIsShortcutsModalOpen(true)}
        />
      </div>

      {/* 悬浮保存状态提示胶囊 (仅在存在未落盘修改时优雅浮现，杜绝挤占顶部视口) */}
      {vscode && isDirty && (
        <div
          className="absolute bottom-5 right-5 z-40 flex items-center gap-2 px-3 py-1.5 rounded-full shadow-lg border backdrop-blur-md text-xs select-none"
          style={{
            background: 'var(--ov-surface-header)',
            borderColor: 'var(--ov-border)',
            color: 'var(--ov-text)',
            boxShadow: 'var(--ov-shadow, 0 4px 14px rgba(0, 0, 0, 0.25))',
          }}
        >
          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
          <span className="text-amber-500 font-medium">存在未落盘修改</span>
          <button
            onClick={handleSaveImmediate}
            disabled={saveStatus === 'saving'}
            className="flex items-center gap-1 px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-full text-xs font-medium cursor-pointer shadow-xs transition disabled:opacity-50"
            title="立即保存文件 (Ctrl+S)"
          >
            {saveStatus === 'saving' ? (
              <Loader2 size={12} className="animate-spin shrink-0" />
            ) : (
              <Save size={12} className="shrink-0" />
            )}
            <span>保存</span>
          </button>
        </div>
      )}

      <KeyboardShortcutsModal isOpen={isShortcutsModalOpen} onClose={() => setIsShortcutsModalOpen(false)} />

      <React.Suspense fallback={null}>
        {isSettingsModalOpen && (
          <WorkbenchSettingsModal
            isOpen={isSettingsModalOpen}
            onClose={() => setIsSettingsModalOpen(false)}
            settings={settings}
            onSettingsChange={handleSettingsChange}
            initialTab="appearance"
          />
        )}
      </React.Suspense>
    </main>
  );
};
