/**
 * OmniView Word (.docx) 大纲与检索聚类引擎 (兼容代理层)
 * 底层已全量汇聚至通用 documentSearchAggregator 引擎
 */
import {
  aggregateSearchMatchesByDocumentToc,
  type DocumentSectionSearchMatch,
  type DocumentSearchAggregationResult,
  type DocumentTocItem,
} from './documentSearchAggregator';
import type { DocxTocItem } from './docxEngine';

export type DocxSectionSearchMatch = DocumentSectionSearchMatch;
export type DocxSearchAggregationResult = DocumentSearchAggregationResult;

/**
 * 兼容旧版 aggregateSearchMatchesByToc 接口
 */
export function aggregateSearchMatchesByToc(
  container: HTMLElement | null,
  tocItems: DocxTocItem[]
): DocxSearchAggregationResult {
  const genericItems: DocumentTocItem[] = tocItems.map(item => ({
    id: item.id,
    text: item.text,
    level: item.level,
    element: item.element,
  }));
  return aggregateSearchMatchesByDocumentToc(container, genericItems);
}
