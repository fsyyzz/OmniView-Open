/**
 * OmniView Markdown 双向滚动同步与点击交互 Hook
 * 遵循 SRP (单一职责原则)
 */
import { useEffect, useRef } from 'react';
import { slugifyHeading } from '../lib/markdownWikiLinks';
import { loadStoredSettings } from '../../../shared/lib/settingsStorage';
import {
  PANE_SYNC_EVENT,
  calculateLineFromScrollTop,
  calculateTargetScrollTop,
  findMarkdownScrollViewport,
  measureSourceBlocks,
  type PaneSyncDetail,
} from '../lib/scrollSync';

export interface UseMarkdownScrollSyncOptions {
  containerRef: React.RefObject<HTMLDivElement | null>;
  content: string;
  files: Array<{ name: string; content: string; extension: string; path?: string }>;
  onOpenSourceAtLine?: (line: number) => void;
  onSelectFile?: (file: any) => void;
  onContentChange?: (content: string) => void;
  onOpenLightbox?: (item: { title: string; url?: string; content?: string }) => void;
}

export function useMarkdownScrollSync({
  containerRef,
  content,
  files,
  onOpenSourceAtLine,
  onSelectFile,
  onContentChange,
  onOpenLightbox,
}: UseMarkdownScrollSyncOptions) {
  const filesRef = useRef(files);
  filesRef.current = files;
  const applyingRemoteScrollRef = useRef(false);

  // 1. 点击交互与双击源码定位事件监听
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleContainerClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;

      // 1. Task List 任务列表复选框可交互勾选回写
      if (
        target.tagName.toLowerCase() === 'input' &&
        target.getAttribute('type') === 'checkbox' &&
        target.classList.contains('ov-task-checkbox')
      ) {
        const lineAttr = target.getAttribute('data-task-line');
        if (lineAttr && onContentChange) {
          const lineNum = parseInt(lineAttr, 10);
          if (!isNaN(lineNum) && lineNum > 0) {
            const lines = content.split('\n');
            const targetIdx = lineNum - 1;
            if (targetIdx >= 0 && targetIdx < lines.length) {
              const currentLine = lines[targetIdx];
              const isChecked = (target as HTMLInputElement).checked;
              let updatedLine = currentLine;
              if (isChecked) {
                updatedLine = currentLine.replace(/^(\s*[-*+]\s*\[)[ xX](\])/, '$1x$2');
              } else {
                updatedLine = currentLine.replace(/^(\s*[-*+]\s*\[)[ xX](\])/, '$1 $2');
              }
              if (updatedLine !== currentLine) {
                lines[targetIdx] = updatedLine;
                onContentChange(lines.join('\n'));
              }
            }
          }
        }
        return;
      }

      // 2. 图片灯箱放大
      if (target.tagName.toLowerCase() === 'img') {
        const img = target as HTMLImageElement;
        if (img.classList.contains('ov-img-broken')) return;
        e.preventDefault();
        e.stopPropagation();
        onOpenLightbox?.({
          title: img.alt || img.title || 'Image Preview',
          url: img.src,
        });
        return;
      }

      // 3. 智能拦截相对 Markdown/OKF/Wiki 链接
      const anchor = target.closest('a');
      if (anchor) {
        const href = anchor.getAttribute('href') || '';
        const isWiki = anchor.getAttribute('data-wiki-link') === 'true';
        const wikiTarget = (anchor.getAttribute('data-wiki-target') || '').trim();
        const wikiHeading = (anchor.getAttribute('data-wiki-heading') || '').trim();

        const scrollToHeading = (headingText: string) => {
          const slug = slugifyHeading(headingText);
          if (!slug || !container) return false;
          const el =
            container.querySelector<HTMLElement>(`#${CSS.escape(slug)}`) ||
            container.querySelector<HTMLElement>(`[id="${slug}"]`);
          if (!el) return false;
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          return true;
        };

        if (isWiki && wikiHeading && !wikiTarget) {
          e.preventDefault();
          e.stopPropagation();
          scrollToHeading(wikiHeading);
          return;
        }

        if (
          href &&
          !href.startsWith('http://') &&
          !href.startsWith('https://') &&
          !href.startsWith('mailto:')
        ) {
          if (href.startsWith('#')) {
            if (isWiki) {
              e.preventDefault();
              e.stopPropagation();
              const id = decodeURIComponent(href.slice(1));
              const el = container?.querySelector<HTMLElement>(`#${CSS.escape(id)}`);
              el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
            return;
          }

          const cleanHref = decodeURIComponent(href.trim().split(/[?#]/, 1)[0])
            .replace(/\\/g, '/')
            .replace(/^\/+/, '');
          const baseName = cleanHref.split('/').pop() || '';
          const targetFile = filesRef.current.find(
            (f) =>
              f.name.toLowerCase() === baseName.toLowerCase() ||
              f.name.replace(/\.[^.]+$/, '').toLowerCase() === baseName.replace(/\.[^.]+$/, '').toLowerCase() ||
              (f.path && f.path.replace(/^\//, '').toLowerCase().endsWith(cleanHref.toLowerCase()))
          );
          if (targetFile && onSelectFile) {
            e.preventDefault();
            e.stopPropagation();
            onSelectFile(targetFile);
            return;
          }
          if (isWiki) {
            e.preventDefault();
            e.stopPropagation();
          }
        }
      }
    };

    const handleContainerDblClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('button, input, textarea, select, details, summary')) return;
      const sourceElement = target.closest('[data-source-line]');
      if (sourceElement) {
        const lineAttr = sourceElement.getAttribute('data-source-line');
        if (lineAttr) {
          const lineNum = parseInt(lineAttr, 10);
          if (!isNaN(lineNum) && lineNum > 0) {
            onOpenSourceAtLine?.(lineNum);
          }
        }
      }
    };

    container.addEventListener('click', handleContainerClick);
    container.addEventListener('dblclick', handleContainerDblClick);
    return () => {
      container.removeEventListener('click', handleContainerClick);
      container.removeEventListener('dblclick', handleContainerDblClick);
    };
  }, [onSelectFile, onOpenSourceAtLine, onContentChange, onOpenLightbox, content]);

  // 2. 双向滚动与光标高亮同步
  useEffect(() => {
    let activeHighlightTimer: ReturnType<typeof setTimeout> | null = null;
    let boundViewport: HTMLElement | null = null;

    const collect = (container: HTMLElement, scrollViewport: HTMLElement) =>
      measureSourceBlocks(container, scrollViewport);

    const handleEditorSync = (e: Event) => {
      const detail = (e as CustomEvent<PaneSyncDetail>).detail;
      if (!detail || detail.origin === 'preview') return;

      const settings = loadStoredSettings();
      if (settings.scrollSync === false) return;

      const container = containerRef.current;
      if (!container) return;

      const scrollViewport = findMarkdownScrollViewport(container);
      const isScrollSync = detail.type === 'editor-scroll-sync';
      const targetLine = isScrollSync
        ? (detail.topLine ?? 1)
        : (detail.activeLine ?? 1);

      if (typeof targetLine !== 'number' || Number.isNaN(targetLine) || targetLine < 1) return;

      const elements = collect(container, scrollViewport);
      if (elements.length === 0) return;

      const mapped = elements.map(({ startLine, endLine, offsetTop, offsetHeight }) => ({
        startLine,
        endLine,
        offsetTop,
        offsetHeight,
      }));
      const matched =
        elements.find((item) => targetLine >= item.startLine && targetLine <= item.endLine) ||
        elements.reduce(
          (best, item) => (Math.abs(item.startLine - targetLine) < Math.abs(best.startLine - targetLine) ? item : best),
          elements[0]
        );

      applyingRemoteScrollRef.current = true;
      scrollViewport.scrollTo({
        top: calculateTargetScrollTop({
          targetLine,
          elements: mapped,
          viewportHeight: scrollViewport.clientHeight,
          scrollHeight: scrollViewport.scrollHeight,
          totalLines: detail.totalLines,
        }),
        behavior: isScrollSync ? 'auto' : 'smooth',
      });
      window.setTimeout(() => {
        applyingRemoteScrollRef.current = false;
      }, 80);

      if (detail.type === 'editor-cursor-sync' && matched?.element) {
        container.querySelectorAll('.ov-cursor-synced-line').forEach((el) => {
          el.classList.remove('ov-cursor-synced-line');
        });
        matched.element.classList.add('ov-cursor-synced-line');
        if (activeHighlightTimer) clearTimeout(activeHighlightTimer);
        activeHighlightTimer = setTimeout(() => {
          matched.element.classList.remove('ov-cursor-synced-line');
        }, 1800);
      }
    };

    const handlePreviewScroll = () => {
      if (applyingRemoteScrollRef.current) return;
      if (loadStoredSettings().scrollSync === false) return;
      const container = containerRef.current;
      if (!container) return;
      const scrollViewport = findMarkdownScrollViewport(container);
      const elements = collect(container, scrollViewport);
      if (elements.length === 0) return;
      const mapped = elements.map(({ startLine, endLine, offsetTop, offsetHeight }) => ({
        startLine,
        endLine,
        offsetTop,
        offsetHeight,
      }));
      const lastEnd = mapped[mapped.length - 1].endLine;
      const topLine = calculateLineFromScrollTop({
        scrollTop: scrollViewport.scrollTop,
        elements: mapped,
        viewportHeight: scrollViewport.clientHeight,
        scrollHeight: scrollViewport.scrollHeight,
        totalLines: lastEnd,
      });
      const detail: PaneSyncDetail = {
        type: 'editor-scroll-sync',
        origin: 'preview',
        topLine,
        activeLine: topLine,
        totalLines: lastEnd,
      };
      window.dispatchEvent(new CustomEvent(PANE_SYNC_EVENT, { detail }));
    };

    const bindViewport = () => {
      const container = containerRef.current;
      if (!container) return;
      const next = findMarkdownScrollViewport(container);
      if (boundViewport === next) return;
      boundViewport?.removeEventListener('scroll', handlePreviewScroll);
      boundViewport = next;
      boundViewport.addEventListener('scroll', handlePreviewScroll, { passive: true });
    };

    bindViewport();
    const bindTimer = window.setTimeout(bindViewport, 200);
    window.addEventListener(PANE_SYNC_EVENT, handleEditorSync);
    return () => {
      window.clearTimeout(bindTimer);
      window.removeEventListener(PANE_SYNC_EVENT, handleEditorSync);
      boundViewport?.removeEventListener('scroll', handlePreviewScroll);
      if (activeHighlightTimer) clearTimeout(activeHighlightTimer);
    };
  }, [containerRef]);
}
