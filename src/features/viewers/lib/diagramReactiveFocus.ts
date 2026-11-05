/**
 * OmniView Markdown 图文双向聚焦高亮引擎 (Diagram-to-Text & Text-to-Diagram Reactive Focus Engine)
 * 解决图表作为“静态孤岛”与正文定义相互割裂的痛点。
 * 支持：
 * 1. 点击 Mermaid / Graphviz 节点 -> 智能检索正文对应标题/名词/段落 -> 平滑滚动并触发双色脉冲光晕
 * 2. 正文划词/点击锚点 -> 逆向反查图表对应 SVG 节点 -> 触发 SVG 节点辉光脉冲
 *
 * 作者: 周赞
 */

export interface DiagramFocusResult {
  matched: boolean;
  targetElement?: HTMLElement;
  nodeLabel: string;
  matchType?: 'heading' | 'keyword' | 'paragraph' | 'sourceLine';
}

/**
 * 清洗图表节点文本标签（移除括号、引号、换行符和内联 HTML）
 */
export function cleanDiagramNodeLabel(rawLabel: string): string {
  if (!rawLabel) return '';
  return rawLabel
    .replace(/<[^>]+>/g, ' ') // 移除 HTML 标签如 <br/> <b>
    .replace(/[\[\]\(\)\{\}\"\'\`]/g, '') // 移除括号与引号
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * 从 Markdown 预览容器中智能检索与图表节点匹配的正文 DOM 元素
 */
export function findMatchingTextElementForDiagramNode(
  container: HTMLElement,
  rawNodeLabel: string,
  diagramElement?: HTMLElement | null
): { element: HTMLElement; matchType: 'heading' | 'keyword' | 'paragraph' } | null {
  const cleanLabel = cleanDiagramNodeLabel(rawNodeLabel);
  if (!cleanLabel || cleanLabel.length < 2) return null;

  const lowerLabel = cleanLabel.toLowerCase();

  // 1. 优先检索各级标题 (H1 ~ H6)
  const headings = Array.from(
    container.querySelectorAll<HTMLElement>('h1, h2, h3, h4, h5, h6')
  );
  for (const h of headings) {
    if (diagramElement && diagramElement.contains(h)) continue;
    const hText = (h.textContent || '').trim().toLowerCase();
    if (hText === lowerLabel || hText.includes(lowerLabel) || lowerLabel.includes(hText)) {
      return { element: h, matchType: 'heading' };
    }
  }

  // 2. 次优检索粗体名词、行内代码块、定义列表术语与任务项
  const keywords = Array.from(
    container.querySelectorAll<HTMLElement>(
      'strong, b, dt, code:not(pre code), .ov-callout-title-text, .ov-task-text'
    )
  );
  for (const kw of keywords) {
    if (diagramElement && diagramElement.contains(kw)) continue;
    if (kw.closest('.markdown-diagram, .diagram-header, .ov-code-editor, pre')) continue;
    const kwText = (kw.textContent || '').trim().toLowerCase();
    if (kwText === lowerLabel || (kwText.length >= 3 && lowerLabel.includes(kwText))) {
      const target = kw.closest('p, li, dt, dd, .ov-callout-header') as HTMLElement || kw;
      return { element: target, matchType: 'keyword' };
    }
  }

  // 3. 兜底检索普通自然段与列表项 (排除图表自身内部元素)
  const paragraphs = Array.from(
    container.querySelectorAll<HTMLElement>('p, li, blockquote > p')
  );
  for (const p of paragraphs) {
    if (diagramElement && diagramElement.contains(p)) continue;
    if (p.closest('.markdown-diagram, .diagram-header, .ov-code-editor, pre')) continue;
    const pText = (p.textContent || '').trim().toLowerCase();
    if (pText.includes(lowerLabel)) {
      return { element: p, matchType: 'paragraph' };
    }
  }

  return null;
}

/**
 * 触发“图 -> 文”双向聚焦高亮：
 * 1. 平滑滚动至目标正文
 * 2. 注入 .ov-diagram-reactive-highlight 脉冲光环
 * 3. 弹出轻量反馈气泡 (Toast)
 */
export function triggerDiagramToTextFocus(
  container: HTMLElement,
  rawNodeLabel: string,
  diagramElement?: HTMLElement | null,
  sourceLine?: number,
  onOpenSourceAtLine?: (line: number) => void
): DiagramFocusResult {
  const cleanLabel = cleanDiagramNodeLabel(rawNodeLabel);
  const matchResult = findMatchingTextElementForDiagramNode(container, rawNodeLabel, diagramElement);

  if (matchResult) {
    const { element, matchType } = matchResult;
    // 平滑滚动定位至正文视口居中
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // 激活高亮动效
    element.classList.remove('ov-diagram-reactive-highlight');
    void element.offsetWidth; // 触发 reflow 重新激活动画
    element.classList.add('ov-diagram-reactive-highlight');

    setTimeout(() => {
      element.classList.remove('ov-diagram-reactive-highlight');
    }, 2400);

    // 触发轻量吐司反馈
    showDiagramReactiveToast(container, cleanLabel, matchType);

    // 同步 VS Code 源码行 (若具备行号)
    if (sourceLine && onOpenSourceAtLine) {
      onOpenSourceAtLine(sourceLine);
    }

    return {
      matched: true,
      targetElement: element,
      nodeLabel: cleanLabel,
      matchType,
    };
  }

  // 若正文中未搜索到强匹配文本，但在有源码行的情况下降级为行号跳转
  if (sourceLine && onOpenSourceAtLine) {
    onOpenSourceAtLine(sourceLine);
    showDiagramReactiveToast(container, cleanLabel, 'sourceLine');
    return {
      matched: true,
      nodeLabel: cleanLabel,
      matchType: 'sourceLine',
    };
  }

  return {
    matched: false,
    nodeLabel: cleanLabel,
  };
}

/**
 * 触发“文 -> 图”逆向聚焦高亮：
 * 在文档内检索图表并高亮匹配的 SVG 节点
 */
export function highlightDiagramNodeFromText(
  container: HTMLElement,
  searchTerm: string
): boolean {
  const cleanTerm = cleanDiagramNodeLabel(searchTerm).toLowerCase();
  if (!cleanTerm || cleanTerm.length < 2) return false;

  const diagrams = Array.from(container.querySelectorAll<HTMLElement>('.markdown-diagram'));
  for (const diagram of diagrams) {
    const nodes = Array.from(
      diagram.querySelectorAll<SVGElement>(
        'g.node, g.actor, g.statediagram-state, g.classGroup, g.messageText, g.cluster'
      )
    );
    for (const node of nodes) {
      const nodeText = (node.textContent || '').trim().toLowerCase();
      if (nodeText.includes(cleanTerm) || cleanTerm.includes(nodeText)) {
        // 平滑滚动到图表
        diagram.scrollIntoView({ behavior: 'smooth', block: 'center' });

        // 注入 SVG 辉光样式
        node.classList.remove('ov-diagram-node-glow');
        void (node as any).offsetWidth;
        node.classList.add('ov-diagram-node-glow');

        setTimeout(() => {
          node.classList.remove('ov-diagram-node-glow');
        }, 2500);

        return true;
      }
    }
  }

  return false;
}

/**
 * 弹出轻量、无干扰的图文联动状态提示气泡
 */
function showDiagramReactiveToast(
  container: HTMLElement,
  label: string,
  matchType: 'heading' | 'keyword' | 'paragraph' | 'sourceLine'
) {
  const existingToast = container.querySelector('.ov-diagram-reactive-toast');
  if (existingToast) {
    existingToast.remove();
  }

  const toast = document.createElement('div');
  toast.className =
    'ov-diagram-reactive-toast fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-sans shadow-lg border backdrop-blur-md animate-in fade-in zoom-in-95 duration-150 transition-all pointer-events-none';
  toast.style.background = 'var(--ov-surface-header, rgba(15, 23, 42, 0.88))';
  toast.style.borderColor = 'var(--ov-border, rgba(6, 182, 212, 0.4))';
  toast.style.color = 'var(--ov-text, #e2e8f0)';

  const typeLabel =
    matchType === 'heading'
      ? '章节标题'
      : matchType === 'keyword'
      ? '正文关键词'
      : matchType === 'paragraph'
      ? '详细说明'
      : '源码行号';

  toast.innerHTML = `
    <span class="inline-block w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
    <span class="text-cyan-400 font-medium">图文联动</span>
    <span class="opacity-60">|</span>
    <span>已聚焦${typeLabel}：<b class="text-white font-semibold">"${label}"</b></span>
  `;

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translate(-50%, 8px)';
    setTimeout(() => toast.remove(), 250);
  }, 2000);
}
