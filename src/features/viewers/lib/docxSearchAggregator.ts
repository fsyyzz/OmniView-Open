/**
 * OmniView Word (.docx) 大纲与全文检索热力聚类引擎
 * 建立「大纲章节树」与「DOM 搜索命中项 (mark.ov-search-match)」的映射关系，
 * 实现无需切屏、在大纲树上就地呈现关键词分布热力、章节匹配计数与上下文卡片展开。
 *
 * 作者: 周赞
 */
import type { DocxTocItem } from './docxEngine';

export interface DocxSectionSearchMatch {
  /** 全局匹配项索引 (0-indexed) */
  matchIndex: number;
  /** 上下文片段前缀 (最多 25 字符) */
  prefix: string;
  /** 命中关键词文本 */
  matched: string;
  /** 上下文片段后缀 (最多 25 字符) */
  suffix: string;
  /** 对应的 DOM mark 节点引用 */
  element?: HTMLElement;
}

export interface DocxSearchAggregationResult {
  /** 章节 headingId 到其所辖匹配列表的映射表 (特殊 key "__intro__" 表示前言) */
  groups: Map<string, DocxSectionSearchMatch[]>;
  /** 存在至少 1 处匹配的章节数 */
  matchedSectionsCount: number;
  /** 全文匹配总数 */
  totalMatchesCount: number;
}

/**
 * 提取 mark 节点周围的纯文本上下文摘要
 */
function extractMatchSnippet(mark: HTMLElement): { prefix: string; matched: string; suffix: string } {
  const matched = mark.textContent || '';
  const parent = mark.parentElement;
  if (!parent) {
    return { prefix: '', matched, suffix: '' };
  }

  const parentText = parent.textContent || '';
  const matchIndexInParent = parentText.indexOf(matched);

  let prefix = '';
  let suffix = '';

  if (matchIndexInParent !== -1) {
    const rawPrefix = parentText.substring(Math.max(0, matchIndexInParent - 26), matchIndexInParent);
    prefix = rawPrefix.replace(/^[\s\r\n]+/, '');
    if (matchIndexInParent > 26) {
      prefix = '…' + prefix;
    }

    const afterIndex = matchIndexInParent + matched.length;
    const rawSuffix = parentText.substring(afterIndex, afterIndex + 26);
    suffix = rawSuffix.replace(/[\s\r\n]+$/, '');
    if (parentText.length > afterIndex + 26) {
      suffix = suffix + '…';
    }
  }

  return { prefix, matched, suffix };
}

/**
 * 将容器内已高亮的搜索标记 (mark.ov-search-match) 按照文档大纲章节进行归属聚类
 */
export function aggregateSearchMatchesByToc(
  container: HTMLElement | null,
  tocItems: DocxTocItem[]
): DocxSearchAggregationResult {
  const groups = new Map<string, DocxSectionSearchMatch[]>();
  let totalMatchesCount = 0;

  if (!container) {
    return { groups, matchedSectionsCount: 0, totalMatchesCount: 0 };
  }

  const marks = Array.from(container.querySelectorAll<HTMLElement>('mark.ov-search-match'));
  totalMatchesCount = marks.length;

  if (marks.length === 0) {
    return { groups, matchedSectionsCount: 0, totalMatchesCount: 0 };
  }

  // 1. 若文档本身无大纲，将全部命中归入虚拟前言组
  if (tocItems.length === 0) {
    const introMatches: DocxSectionSearchMatch[] = marks.map((mark, idx) => {
      const matchIndex = parseInt(mark.dataset.matchIndex || String(idx), 10);
      const snippet = extractMatchSnippet(mark);
      return {
        matchIndex: isNaN(matchIndex) ? idx : matchIndex,
        ...snippet,
        element: mark,
      };
    });
    groups.set('__intro__', introMatches);
    return { groups, matchedSectionsCount: 1, totalMatchesCount };
  }

  // 2. 收集每个大纲条目对应的实际 DOM 元素
  const headingEntries = tocItems
    .map(item => {
      const el = item.element || document.getElementById(item.id);
      return { id: item.id, item, el };
    })
    .filter(entry => entry.el !== null);

  if (headingEntries.length === 0) {
    // 找不到任何实际 heading 节点时降级
    return { groups, matchedSectionsCount: 0, totalMatchesCount };
  }

  // 3. 按照 DOM 文档流顺序对每个 mark 寻找其所属章节
  // 一个 mark 属于在其前面最近的那个 heading
  marks.forEach((mark, idx) => {
    const matchIndex = parseInt(mark.dataset.matchIndex || String(idx), 10);
    const validMatchIndex = isNaN(matchIndex) ? idx : matchIndex;
    const snippet = extractMatchSnippet(mark);
    const matchObj: DocxSectionSearchMatch = {
      matchIndex: validMatchIndex,
      ...snippet,
      element: mark,
    };

    // 在 heading 列表中倒序查找位于 mark 之前的最后一个 heading
    const FOLLOWING_FLAG = typeof Node !== 'undefined' ? Node.DOCUMENT_POSITION_FOLLOWING : 4;
    const CONTAINED_FLAG = typeof Node !== 'undefined' ? Node.DOCUMENT_POSITION_CONTAINED_BY : 16;

    let assignedHeadingId = '__intro__';
    for (let i = headingEntries.length - 1; i >= 0; i--) {
      const headingEl = headingEntries[i].el!;
      const pos = headingEl.compareDocumentPosition(mark);
      // 如果 mark 在 headingEl 之后或者是其子节点
      if ((pos & FOLLOWING_FLAG) || (pos & CONTAINED_FLAG)) {
        assignedHeadingId = headingEntries[i].id;
        break;
      }
    }

    // 若位于第一个标题之前，归入第一个标题或前言
    if (assignedHeadingId === '__intro__' && headingEntries.length > 0) {
      assignedHeadingId = headingEntries[0].id;
    }

    if (!groups.has(assignedHeadingId)) {
      groups.set(assignedHeadingId, []);
    }
    groups.get(assignedHeadingId)!.push(matchObj);
  });

  const matchedSectionsCount = groups.size;

  return {
    groups,
    matchedSectionsCount,
    totalMatchesCount,
  };
}
