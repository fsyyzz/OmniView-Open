/**
 * PlantUML 多图表块 (@startuml ... @enduml) 解析与切分引擎
 */

export interface PlantUmlBlockInfo {
  id: string;
  index: number;
  title: string;
  diagramType: 'uml' | 'sequence' | 'class' | 'state' | 'gantt' | 'mindmap' | 'wbs' | 'json' | 'yaml' | 'c4';
  code: string;
  fullSourceRange: {
    start: number;
    end: number;
  };
}

/**
 * 从多图表 DSL 文件中切分所有独立的 @start... 到 @end... 块
 */
export function extractPlantUmlBlocks(fullCode: string): PlantUmlBlockInfo[] {
  const code = (fullCode || '').trim();
  if (!code) return [];

  const blockRegex = /@start([a-z0-9_-]+)(?:[ \t]+([^\r\n]+))?([\s\S]*?)@end\1/gi;
  const blocks: PlantUmlBlockInfo[] = [];
  let match: RegExpExecArray | null;
  let idx = 0;

  while ((match = blockRegex.exec(fullCode)) !== null) {
    const rawType = match[1].toLowerCase();
    const declaredTitle = (match[2] || '').trim();
    const innerBody = match[3] || '';
    const fullBlockStr = match[0];

    // 智能提取图表标题
    let title = declaredTitle;
    if (!title) {
      const titleMatch = innerBody.match(/^[ \t]*title[ \t]+([^\r\n]+)/im);
      if (titleMatch) {
        title = titleMatch[1].trim();
      }
    }

    if (!title) {
      title = `图表 ${idx + 1} (${rawType.toUpperCase()})`;
    }

    // 识别细分图表类型
    let diagramType: PlantUmlBlockInfo['diagramType'] = 'uml';
    if (rawType === 'gantt') diagramType = 'gantt';
    else if (rawType === 'mindmap') diagramType = 'mindmap';
    else if (rawType === 'wbs') diagramType = 'wbs';
    else if (rawType === 'json') diagramType = 'json';
    else if (rawType === 'yaml') diagramType = 'yaml';
    else if (innerBody.includes('C4_Container') || innerBody.includes('C4_Context')) diagramType = 'c4';
    else if (/->>|-->>|->|-->/i.test(innerBody) && /participant|actor/i.test(innerBody)) diagramType = 'sequence';
    else if (/class\s+\w+|interface\s+\w+/i.test(innerBody)) diagramType = 'class';
    else if (/\[\*\]\s*-->|state\s+\w+/i.test(innerBody)) diagramType = 'state';

    blocks.push({
      id: `puml-block-${idx}`,
      index: idx,
      title,
      diagramType,
      code: fullBlockStr,
      fullSourceRange: {
        start: match.index,
        end: match.index + fullBlockStr.length,
      },
    });

    idx++;
  }

  return blocks;
}
