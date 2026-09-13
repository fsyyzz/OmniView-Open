/**
 * OmniView 图表步进播放引擎 (Diagram Step-by-Step Playback Engine)
 * 支持 Mermaid 时序图 (sequenceDiagram)、状态图 (stateDiagram)、流程图 (flowchart) 与 PlantUML
 * 提供 AST 步进提取、步骤索引计算、SVG 动态高亮注入与自愈清洗
 */

export interface DiagramStep {
  index: number;
  id: string;
  type: 'message' | 'state' | 'transition' | 'flow' | 'note' | 'group' | 'generic';
  from?: string;
  to?: string;
  label: string;
  rawLine: string;
  lineNumber: number;
  description?: string;
  arrowType?: string;
}

export interface PlaybackDetectionResult {
  isSupported: boolean;
  diagramType: 'sequence' | 'state' | 'flowchart' | 'plantuml-sequence' | 'plantuml-state' | 'generic';
  stepCount: number;
  steps: DiagramStep[];
}

/**
 * 探测图表是否支持步进播放并预提取步骤列表
 */
export function detectDiagramPlaybackSupport(code: string): PlaybackDetectionResult {
  if (!code || typeof code !== 'string') {
    return { isSupported: false, diagramType: 'generic', stepCount: 0, steps: [] };
  }

  const clean = code.trim();
  const lower = clean.toLowerCase();

  let diagramType: PlaybackDetectionResult['diagramType'] = 'generic';

  if (lower.includes('sequencediagram')) {
    diagramType = 'sequence';
  } else if (lower.includes('statediagram') || lower.includes('statediagram-v2')) {
    diagramType = 'state';
  } else if (lower.startsWith('flowchart') || lower.startsWith('graph')) {
    diagramType = 'flowchart';
  } else if (lower.includes('@startuml')) {
    if (lower.includes('->') || lower.includes('-->') || lower.includes('participant') || lower.includes('actor')) {
      diagramType = 'plantuml-sequence';
    } else if (lower.includes('[*]') || lower.includes('state ')) {
      diagramType = 'plantuml-state';
    }
  }

  if (diagramType === 'generic') {
    // 兜底检测是否包含明显的时序箭头或状态转移
    if (/^\s*[a-zA-Z0-9_-]+\s*(?:->>|-->>|->|-->)\s*[a-zA-Z0-9_-]+/m.test(clean)) {
      diagramType = 'sequence';
    }
  }

  const steps = extractDiagramSteps(clean, diagramType);
  const isSupported = steps.length > 0;

  return {
    isSupported,
    diagramType,
    stepCount: steps.length,
    steps,
  };
}

/**
 * 从 DSL 源码中精准提取有序执行步骤
 */
export function extractDiagramSteps(code: string, diagramType?: string): DiagramStep[] {
  if (!code) return [];

  const lines = code.split('\n');
  const steps: DiagramStep[] = [];
  let stepIndex = 0;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    // 跳过空行、注释与头部声明
    if (!trimmed || trimmed.startsWith('%%') || trimmed.startsWith("'") || trimmed.startsWith('//')) {
      continue;
    }
    if (/^(sequenceDiagram|stateDiagram|stateDiagram-v2|flowchart|graph|@startuml|@enduml)/i.test(trimmed)) {
      continue;
    }

    // 1. Mermaid / PlantUML 时序图消息 (正向与反向箭头)
    // 例如: Client->>Server: POST /api/v1/auth
    // 例如: Alice -> Bob : Hello
    // 例如: Alice <-- Bob: Response
    const rightSeqMatch = trimmed.match(/^([a-zA-Z0-9_\u4e00-\u9fa5\s\(\)\[\]\-]+?)\s*(-->>|->>|->|-->|-\)|-x|--\)|--x)\s*([a-zA-Z0-9_\u4e00-\u9fa5\s\(\)\[\]\-]+?)(?:\s*:\s*(.*))?$/);
    if (rightSeqMatch) {
      const from = rightSeqMatch[1].trim();
      const arrow = rightSeqMatch[2].trim();
      const to = rightSeqMatch[3].trim();
      const msg = (rightSeqMatch[4] || '').trim();

      const label = msg ? `${from} ➔ ${to}: ${msg}` : `${from} ➔ ${to}`;
      steps.push({
        index: stepIndex++,
        id: `step-${stepIndex}`,
        type: 'message',
        from,
        to,
        arrowType: arrow,
        label,
        rawLine,
        lineNumber: i + 1,
        description: msg || `消息传递: ${from} 到 ${to}`,
      });
      continue;
    }

    const leftSeqMatch = trimmed.match(/^([a-zA-Z0-9_\u4e00-\u9fa5\s\(\)\[\]\-]+?)\s*(<<--|<<-|<--|<-|\(-|x-|x--)\s*([a-zA-Z0-9_\u4e00-\u9fa5\s\(\)\[\]\-]+?)(?:\s*:\s*(.*))?$/);
    if (leftSeqMatch) {
      const to = leftSeqMatch[1].trim();
      const arrow = leftSeqMatch[2].trim();
      const from = leftSeqMatch[3].trim();
      const msg = (leftSeqMatch[4] || '').trim();

      const label = msg ? `${from} ➔ ${to}: ${msg}` : `${from} ➔ ${to}`;
      steps.push({
        index: stepIndex++,
        id: `step-${stepIndex}`,
        type: 'message',
        from,
        to,
        arrowType: arrow,
        label,
        rawLine,
        lineNumber: i + 1,
        description: msg || `消息传递: ${from} 到 ${to}`,
      });
      continue;
    }

    // 2. 时序图 Note / 注释块
    // 例如: Note over Client, Server: 双方建立安全通信
    // 例如: Note right of Server: 写入 Redis 缓存
    const noteMatch = trimmed.match(/^Note\s+(?:over|(?:left|right)\s+of)\s+([^:]+):\s*(.*)$/i);
    if (noteMatch) {
      const target = noteMatch[1].trim();
      const noteText = noteMatch[2].trim();
      steps.push({
        index: stepIndex++,
        id: `step-${stepIndex}`,
        type: 'note',
        from: target,
        label: `📝 [说明] ${target}: ${noteText}`,
        rawLine,
        lineNumber: i + 1,
        description: noteText,
      });
      continue;
    }

    // 3. 状态图迁移 (State Transition)
    // 例如: [*] --> Idle: 容器就绪
    // 例如: Idle --> Rendering: 接收编译指令
    // 例如: Rendering --> Error: 语法异常
    const stateMatch = trimmed.match(/^([a-zA-Z0-9_\u4e00-\u9fa5\[\*\]]+)\s*-->\s*([a-zA-Z0-9_\u4e00-\u9fa5\[\*\]]+)(?:\s*:\s*(.*))?$/);
    if (stateMatch) {
      const fromState = stateMatch[1].trim() === '[*]' ? 'Start(初始)' : stateMatch[1].trim();
      const toState = stateMatch[2].trim() === '[*]' ? 'End(终止)' : stateMatch[2].trim();
      const eventDesc = (stateMatch[3] || '').trim();

      const label = eventDesc ? `${fromState} ➔ ${toState}: ${eventDesc}` : `${fromState} ➔ ${toState}`;
      steps.push({
        index: stepIndex++,
        id: `step-${stepIndex}`,
        type: 'transition',
        from: fromState,
        to: toState,
        label,
        rawLine,
        lineNumber: i + 1,
        description: eventDesc || `状态转移: 从 ${fromState} 到 ${toState}`,
      });
      continue;
    }

    // 4. 流程图节点连接 (Flowchart Edge)
    // 例如: A[用户发起] --> B{参数校验}
    // 例如: B -->|通过| C[执行渲染]
    const flowMatch = trimmed.match(/^([a-zA-Z0-9_-]+(?:\[.*?\]|\(.*?\)|\{.*?\}|\>.*?\])?)\s*-->\|?(.*?)\|?\s*([a-zA-Z0-9_-]+(?:\[.*?\]|\(.*?\)|\{.*?\}|\>.*?\])?)$/);
    if (flowMatch) {
      const fromNode = flowMatch[1].trim();
      const edgeLabel = (flowMatch[2] || '').trim();
      const toNode = flowMatch[3].trim();

      const label = edgeLabel ? `${fromNode} ➔ [${edgeLabel}] ➔ ${toNode}` : `${fromNode} ➔ ${toNode}`;
      steps.push({
        index: stepIndex++,
        id: `step-${stepIndex}`,
        type: 'flow',
        from: fromNode,
        to: toNode,
        label,
        rawLine,
        lineNumber: i + 1,
        description: edgeLabel || `流转步骤: 从 ${fromNode} 到 ${toNode}`,
      });
      continue;
    }
  }

  return steps;
}

/**
 * 将步进高亮与动态渐隐样式注入到渲染后的 SVG 字符串中
 * @param svgString 原始编译出的 SVG 内容
 * @param currentStepIndex 当前选中的步骤下标（0 ~ totalSteps - 1）；若为 -1 表示退出播放返回全图
 * @param totalSteps 步骤总数
 */
export function applyStepHighlightToSvg(
  svgString: string,
  currentStepIndex: number,
  totalSteps: number,
  diagramType: string = 'sequence'
): string {
  if (!svgString || typeof svgString !== 'string') return svgString;
  if (currentStepIndex < 0 || totalSteps <= 0) return svgString;

  const activeIdx = Math.min(totalSteps - 1, Math.max(0, currentStepIndex));

  // 构造步进播放高亮专用的注入 CSS
  const highlightStyles = `
    <style id="omniview-step-playback-style">
      @keyframes omniviewStepPulse {
        0%, 100% {
          filter: drop-shadow(0 0 4px #06b6d4) drop-shadow(0 0 10px rgba(6, 182, 212, 0.6));
          stroke-width: 3.5px !important;
        }
        50% {
          filter: drop-shadow(0 0 8px #22d3ee) drop-shadow(0 0 16px rgba(34, 211, 238, 0.9));
          stroke-width: 4.5px !important;
        }
      }

      @keyframes omniviewNodeGlow {
        0%, 100% {
          filter: drop-shadow(0 0 6px rgba(168, 85, 247, 0.5));
        }
        50% {
          filter: drop-shadow(0 0 12px rgba(168, 85, 247, 0.9));
        }
      }

      /* 基础降亮：未来步骤弱化显示 */
      .messageLine${activeIdx},
      path.messageLine${activeIdx},
      text.messageText${activeIdx},
      #flowchart-link-${activeIdx},
      .edge-thickness-normal:nth-of-type(${activeIdx + 1}) {
        stroke: #06b6d4 !important;
        fill: #22d3ee !important;
        animation: omniviewStepPulse 1.8s infinite ease-in-out !important;
        opacity: 1 !important;
      }

      /* 针对 Mermaid 时序图 */
      ${Array.from({ length: totalSteps })
        .map((_, i) => {
          if (i === activeIdx) {
            return `
              .messageLine${i}, text.messageText${i} {
                stroke: #06b6d4 !important;
                stroke-width: 3.5px !important;
                font-weight: bold !important;
                opacity: 1 !important;
                animation: omniviewStepPulse 1.8s infinite ease-in-out !important;
              }
            `;
          } else if (i < activeIdx) {
            return `
              .messageLine${i}, text.messageText${i} {
                opacity: 0.65 !important;
                stroke: #94a3b8 !important;
              }
            `;
          } else {
            return `
              .messageLine${i}, text.messageText${i} {
                opacity: 0.15 !important;
                filter: grayscale(100%) !important;
              }
            `;
          }
        })
        .join('\n')}

      /* 针对通用状态图与流程图边 */
      .edgePath:nth-of-type(${activeIdx + 1}) path {
        stroke: #06b6d4 !important;
        stroke-width: 3.5px !important;
        animation: omniviewStepPulse 1.8s infinite ease-in-out !important;
      }
      .edgeLabel:nth-of-type(${activeIdx + 1}) {
        font-weight: bold !important;
        color: #22d3ee !important;
      }
    </style>
  `;

  // 将 <style> 注入到 SVG 的最顶部 <svg ...> 标签之后
  if (svgString.includes('</svg>')) {
    const svgTagMatch = svgString.match(/<svg[^>]*>/i);
    if (svgTagMatch) {
      const insertPos = svgTagMatch.index! + svgTagMatch[0].length;
      return svgString.slice(0, insertPos) + highlightStyles + svgString.slice(insertPos);
    }
  }

  return svgString;
}
