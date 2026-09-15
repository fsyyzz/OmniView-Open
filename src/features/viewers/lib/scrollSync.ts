/**
 * Markdown 源码/预览双向滚动映射
 */

export interface ScrollSyncBlock {
  startLine: number;
  endLine: number;
  offsetTop: number;
  offsetHeight: number;
}

export interface ScrollMapInput {
  targetLine: number;
  elements: ScrollSyncBlock[];
  viewportHeight: number;
  scrollHeight: number;
  totalLines?: number;
  edgePadding?: number;
}

export interface LineFromScrollInput {
  scrollTop: number;
  elements: ScrollSyncBlock[];
  viewportHeight: number;
  scrollHeight: number;
  totalLines?: number;
  edgePadding?: number;
}

/**
 * 源码行号 → 预览 scrollTop（节点内线性插值，边界贴顶/贴底）
 */
export function calculateTargetScrollTop({
  targetLine,
  elements,
  viewportHeight,
  scrollHeight,
  totalLines,
  edgePadding = 24,
}: ScrollMapInput): number {
  if (typeof targetLine !== 'number' || Number.isNaN(targetLine) || targetLine < 1) return 0;
  if (!elements || elements.length === 0) return 0;

  if (targetLine <= 1) return 0;
  if (totalLines && targetLine >= totalLines) {
    return Math.max(0, scrollHeight - viewportHeight);
  }

  for (let i = 0; i < elements.length; i++) {
    const item = elements[i];
    if (targetLine >= item.startLine && targetLine <= item.endLine) {
      const lineProgress = (targetLine - item.startLine) / Math.max(1, item.endLine - item.startLine);
      const targetScrollTop = item.offsetTop + lineProgress * item.offsetHeight;
      return Math.max(0, targetScrollTop - edgePadding);
    }
    if (targetLine < item.startLine) {
      const prevItem = elements[i - 1];
      if (prevItem) {
        const prevBottom = prevItem.offsetTop + prevItem.offsetHeight;
        const ratio = (targetLine - prevItem.endLine) / Math.max(1, item.startLine - prevItem.endLine);
        const targetScrollTop = prevBottom + ratio * Math.max(0, item.offsetTop - prevBottom);
        return Math.max(0, targetScrollTop - edgePadding);
      }
      const targetScrollTop = Math.max(0, item.offsetTop * (targetLine / item.startLine));
      return Math.max(0, targetScrollTop - edgePadding);
    }
  }

  const last = elements[elements.length - 1];
  return Math.max(0, last.offsetTop - edgePadding);
}

/**
 * 预览 scrollTop → 源码行号（calculateTargetScrollTop 的近似逆映射）
 */
export function calculateLineFromScrollTop({
  scrollTop,
  elements,
  viewportHeight,
  scrollHeight,
  totalLines,
  edgePadding = 24,
}: LineFromScrollInput): number {
  if (!elements || elements.length === 0) return 1;
  const maxScroll = Math.max(0, scrollHeight - viewportHeight);
  if (scrollTop <= 1) return 1;
  if (maxScroll > 0 && scrollTop >= maxScroll - 2) {
    return totalLines || elements[elements.length - 1].endLine;
  }

  const y = scrollTop + edgePadding;
  for (let i = 0; i < elements.length; i++) {
    const item = elements[i];
    const bottom = item.offsetTop + item.offsetHeight;
    if (y >= item.offsetTop && y <= bottom) {
      const progress = (y - item.offsetTop) / Math.max(1, item.offsetHeight);
      const line = item.startLine + progress * Math.max(0, item.endLine - item.startLine);
      return Math.max(1, Math.round(line));
    }
    if (y < item.offsetTop) {
      const prev = elements[i - 1];
      if (!prev) return item.startLine;
      const prevBottom = prev.offsetTop + prev.offsetHeight;
      const gap = Math.max(1, item.offsetTop - prevBottom);
      const ratio = (y - prevBottom) / gap;
      const line = prev.endLine + ratio * Math.max(1, item.startLine - prev.endLine);
      return Math.max(1, Math.round(line));
    }
  }

  return totalLines || elements[elements.length - 1].endLine;
}

export type ContentApplyDecision = 'ignore' | 'apply-external' | 'keep-local';

/**
 * 判定父级 content 回写是否应覆盖正在编辑的源码，避免光标被拽到文末。
 */
export function decideExternalContentApply(params: {
  incoming: string;
  localValue: string;
  lastEmitted: string;
  editorFocused: boolean;
}): ContentApplyDecision {
  const { incoming, localValue, lastEmitted, editorFocused } = params;
  if (incoming === localValue) return 'ignore';
  if (incoming === lastEmitted) return 'keep-local';
  if (editorFocused) return 'keep-local';
  return 'apply-external';
}

export function lineFromTextareaScroll(scrollTop: number, lineHeight: number, paddingTop: number, lineCount: number): number {
  const safeHeight = Math.max(1, lineHeight);
  const line = Math.floor((Math.max(0, scrollTop - paddingTop) + 1) / safeHeight) + 1;
  return Math.min(Math.max(1, line), Math.max(1, lineCount));
}

export function scrollTopForTextareaLine(line: number, lineHeight: number, paddingTop: number): number {
  return Math.max(0, paddingTop + (Math.max(1, line) - 1) * Math.max(1, lineHeight));
}

export const PANE_SYNC_EVENT = 'omniview-editor-sync';

export type PaneSyncOrigin = 'host' | 'source' | 'preview';

export interface PaneSyncDetail {
  type: 'editor-scroll-sync' | 'editor-cursor-sync';
  origin?: PaneSyncOrigin;
  topLine?: number;
  bottomLine?: number;
  activeLine?: number;
  totalLines?: number;
  path?: string;
}

export function findMarkdownScrollViewport(container: HTMLElement): HTMLElement {
  const tagged = container.closest('.markdown-plugin-scroll, .ov-split-preview-scroll') as HTMLElement | null;
  if (tagged) return tagged;

  let node: HTMLElement | null = container.parentElement;
  while (node && node !== document.body) {
    const overflowY = window.getComputedStyle(node).overflowY;
    if ((overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') && node.clientHeight > 32) {
      return node;
    }
    node = node.parentElement;
  }
  return document.documentElement;
}

export function measureSourceBlocks(container: HTMLElement, viewport: HTMLElement): Array<ScrollSyncBlock & { element: HTMLElement }> {
  const vr = viewport.getBoundingClientRect();
  return Array.from(container.querySelectorAll<HTMLElement>('[data-source-line]'))
    .map((el) => {
      const start = parseInt(el.getAttribute('data-source-line') || '1', 10);
      const end = parseInt(el.getAttribute('data-source-end-line') || String(start), 10);
      const rect = el.getBoundingClientRect();
      return {
        element: el,
        startLine: start,
        endLine: Math.max(start, end),
        offsetTop: rect.top - vr.top + viewport.scrollTop,
        offsetHeight: rect.height || el.offsetHeight,
      };
    })
    .sort((a, b) => a.offsetTop - b.offsetTop);
}
