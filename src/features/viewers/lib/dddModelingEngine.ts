/**
 * OmniView DDD 领域驱动设计建模引擎
 * 涵盖：
 * 1. 领域故事图 (Domain Storytelling)
 * 2. 事件风暴时间轴 (Event Storming Timeline)
 * 3. 战略限界上下文映射图 (Context Map)
 * 4. 核心域战略投资象限图 (Core Domain Chart)
 * 5. 限界上下文战略画布 (Bounded Context Canvas)
 * 纯本地优先、零网络依赖、MIT 协议兼容
 * 与 DiagramStepPlayer 逐帧步进演播无缝集成
 */

import type { DiagramStep } from './diagramPlaybackEngine.ts';
import { escapeXml } from './domainStoryEngine.ts';

export type DddDiagramMode =
  | 'domain-story'
  | 'event-storming'
  | 'context-map'
  | 'core-domain-chart'
  | 'context-canvas';

export type StickyNoteKind =
  | 'actor'
  | 'command'
  | 'aggregate'
  | 'event'
  | 'policy'
  | 'external'
  | 'readmodel'
  | 'hotspot';

export interface EventStormingNode {
  id: string;
  name: string;
  kind: StickyNoteKind;
}

export interface EventStormingFlow {
  id: string;
  number: number;
  nodes: EventStormingNode[];
  hotspots: string[];
  readModels: string[];
}

export interface EventStormingSpec {
  context?: string;
  flows: EventStormingFlow[];
}

export type SubdomainType = 'core' | 'supporting' | 'generic';

export interface BoundedContextNode {
  id: string;
  name: string;
  subdomain: SubdomainType;
  team?: string;
  description?: string;
  aggregates?: string[];
  x?: number;
  y?: number;
}

export interface ContextRelationship {
  id: string;
  number: number;
  from: string; // Context ID
  to: string;   // Context ID
  label: string;
  upstreamPattern?: string;   // e.g. 'OHS, PL', 'PL', 'U'
  downstreamPattern?: string; // e.g. 'ACL', 'Conformist', 'D'
  pattern?: string;           // e.g. 'Shared Kernel', 'Partnership', 'Customer-Supplier'
  isAsync?: boolean;          // true when ->> or ~>
}

export interface ContextMapSpec {
  contexts: BoundedContextNode[];
  relationships: ContextRelationship[];
}

// ============================================================
// 4. 核心域战略投资象限图 (Core Domain Chart)
// ============================================================
export interface CoreDomainItem {
  id: string;
  name: string;
  subdomain: SubdomainType;
  complexity: number;      // 0-100 (业务模型复杂度 / 状态机与算法)
  differentiation: number; // 0-100 (商业差异化壁垒 / 核心竞争力)
  investment?: string;     // e.g. "自研攻坚", "外包定制", "采购SaaS"
  team?: string;
  note?: string;
  evolution?: string;      // 演进战略方向文字或目标说明
  evolutionTo?: {
    complexity: number;
    differentiation: number;
    note?: string;
  };
}

export interface CoreDomainChartSpec {
  domains: CoreDomainItem[];
}

// ============================================================
// 5. 限界上下文战略画布 (Bounded Context Canvas)
// ============================================================
export interface ContextCanvasLanguageTerm {
  term: string;
  definition: string;
}

export interface ContextCanvasSpec {
  contextName: string;
  classification: SubdomainType | string;
  team?: string;
  description?: string;
  language: ContextCanvasLanguageTerm[];
  inbound: {
    commands: string[];
    events: string[];
    queries: string[];
  };
  decisions: string[];
  outbound: {
    events: string[];
    dependencies: string[];
  };
}

/**
 * 自动探测输入文本或 JSON 属于哪种 DDD 视图模式
 */
export function detectDddMode(input: string): DddDiagramMode {
  if (!input || typeof input !== 'string') return 'domain-story';
  const trimmed = input.trim();

  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed);
      const root = parsed.model || parsed;
      const explicitMode = String(root.mode || parsed.mode || '').toLowerCase();
      if (explicitMode.includes('quadrant') || explicitMode.includes('core-domain') || Array.isArray(root.domains)) {
        return 'core-domain-chart';
      }
      if (explicitMode.includes('canvas') || root.inbound || root.decisions || root.classification) {
        return 'context-canvas';
      }
      if (explicitMode.includes('event') || Array.isArray(root.flows) || Array.isArray(root.timeline)) {
        return 'event-storming';
      }
      if (
        explicitMode.includes('context') ||
        Array.isArray(root.contexts) ||
        Array.isArray(root.boundedContexts)
      ) {
        return 'context-map';
      }
      return 'domain-story';
    } catch {
      // fallthrough to text inspection
    }
  }

  // 检查显式 mode: 声明
  const modeMatch = trimmed.match(/^(?:mode|type|view)\s*:\s*([a-zA-Z0-9_-]+)/im);
  if (modeMatch) {
    const val = modeMatch[1].toLowerCase();
    if (val.includes('quadrant') || val.includes('core-domain') || val === 'cdc') {
      return 'core-domain-chart';
    }
    if (val.includes('canvas') || val === 'bc-canvas' || val === 'bcc') {
      return 'context-canvas';
    }
    if (val.includes('event') || val === 'storming' || val === 'es') {
      return 'event-storming';
    }
    if (val.includes('context') || val === 'map' || val === 'cm') {
      return 'context-map';
    }
    if (val.includes('story') || val === 'dst' || val === 'egn') {
      return 'domain-story';
    }
  }

  // 隐式语法特征探测
  if (
    /^(?:domains?|quadrant)\s*:/im.test(trimmed) ||
    (/(?:complexity|differentiation)\s*:/i.test(trimmed) && /\[(?:core|supporting|generic)\]/i.test(trimmed))
  ) {
    return 'core-domain-chart';
  }

  if (
    /^(?:classification|inbound|decisions|outbound)\s*:/im.test(trimmed) ||
    (/inbound\s*:/i.test(trimmed) && /outbound\s*:/i.test(trimmed))
  ) {
    return 'context-canvas';
  }

  if (
    /^(?:timeline|event-?storming|flows)\s*:/im.test(trimmed) ||
    /\[(?:cmd|command|evt|event|agg|aggregate|policy|hotspot|readmodel|query)\]/i.test(trimmed)
  ) {
    return 'event-storming';
  }

  if (
    /^(?:contexts|bounded-?contexts|relationships|mappings)\s*:/im.test(trimmed) ||
    /\[(?:core|supporting|generic)\]/i.test(trimmed) ||
    /\[(?:U|D)\s*:/i.test(trimmed)
  ) {
    return 'context-map';
  }

  return 'domain-story';
}

function truncateLabel(str: string, maxLen: number): string {
  if (!str) return '';
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 1) + '…';
}

function splitTwoLines(str: string, lineMax: number): [string, string?] {
  if (!str) return [''];
  if (str.length <= lineMax) return [str];
  return [str.slice(0, lineMax), truncateLabel(str.slice(lineMax), lineMax + 1)];
}

function parseStickyToken(raw: string, positionIndex: number): EventStormingNode {
  let text = raw.trim();
  let explicitKind: StickyNoteKind | null = null;

  const bracketMatch = text.match(/^(.+?)\s*[\[\(]([a-zA-Z0-9_-]+)[\]\)]$/);
  if (bracketMatch) {
    const tag = bracketMatch[2].toLowerCase();
    const candidateName = bracketMatch[1].trim();
    if (['actor', 'person', 'user', 'role'].includes(tag)) {
      explicitKind = 'actor';
      text = candidateName;
    } else if (['cmd', 'command'].includes(tag)) {
      explicitKind = 'command';
      text = candidateName;
    } else if (['agg', 'aggregate', 'root'].includes(tag)) {
      explicitKind = 'aggregate';
      text = candidateName;
    } else if (['evt', 'event', 'domainevent'].includes(tag)) {
      explicitKind = 'event';
      text = candidateName;
    } else if (['policy', 'rule', 'reaction', 'saga'].includes(tag)) {
      explicitKind = 'policy';
      text = candidateName;
    } else if (['ext', 'external', 'system', 'gateway'].includes(tag)) {
      explicitKind = 'external';
      text = candidateName;
    } else if (['read', 'readmodel', 'query', 'view', 'projection'].includes(tag)) {
      explicitKind = 'readmodel';
      text = candidateName;
    } else if (['hotspot', 'risk', 'question', 'issue'].includes(tag)) {
      explicitKind = 'hotspot';
      text = candidateName;
    }
  }

  if (!explicitKind) {
    if (text.startsWith('@')) {
      explicitKind = 'aggregate';
      text = text.slice(1).trim();
    } else if (text.startsWith('!')) {
      explicitKind = 'event';
      text = text.slice(1).trim();
    } else if (text.startsWith('?') || text.startsWith('~')) {
      explicitKind = 'policy';
      text = text.slice(1).trim();
    } else if (text.startsWith('$')) {
      explicitKind = 'external';
      text = text.slice(1).trim();
    } else if (text.startsWith('*')) {
      explicitKind = 'hotspot';
      text = text.slice(1).trim();
    }
  }

  if (!explicitKind) {
    if (/已|完成|成功|失败|Created|Updated|Deleted|Paid|Shipped|Cancelled|Event$/i.test(text)) {
      explicitKind = 'event';
    } else if (/聚合|Aggregate$/i.test(text)) {
      explicitKind = 'aggregate';
    } else if (/策略|规则|当.+时|Policy|Saga$/i.test(text)) {
      explicitKind = 'policy';
    } else if (/网关|外部|第三方|中心|系统|平台|服务|Gateway|External/i.test(text) && positionIndex > 0) {
      explicitKind = 'external';
    } else if (/视图|看板|报表|列表|查询|ReadModel|View$/i.test(text)) {
      explicitKind = 'readmodel';
    } else if (
      positionIndex === 0 &&
      /买家|卖家|用户|客户|管理员|运营|员工|专员|骑手|商户|Actor|User|Customer/i.test(text)
    ) {
      explicitKind = 'actor';
    } else {
      explicitKind = 'command';
    }
  }

  text = text.replace(/^[@!?$*]\s*/, '').trim();

  return {
    id: `es-node-${positionIndex}-${text.replace(/\s+/g, '_')}`,
    name: text,
    kind: explicitKind,
  };
}

/**
 * 解析事件风暴 DSL
 */
export function parseEventStormingDsl(dsl: string): {
  title: string;
  description: string;
  spec: EventStormingSpec;
} {
  let title = 'DDD 事件风暴 (Event Storming)';
  let description = '';
  let context = '';
  const flows: EventStormingFlow[] = [];

  const lines = dsl.split('\n');
  let lastFlow: EventStormingFlow | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || line.startsWith('//')) continue;
    if (/^(?:mode|type|view|timeline|flows|events)\s*:/i.test(line)) {
      const m = line.match(/^(?:mode|type|view)\s*:\s*(.+)$/i);
      if (m) continue;
      if (/^(?:timeline|flows|events)\s*:$/i.test(line)) continue;
    }

    const titleMatch = line.match(/^(?:title|name)\s*:\s*(.+)$/i);
    if (titleMatch) {
      title = titleMatch[1].trim();
      continue;
    }

    const descMatch = line.match(/^(?:description|desc)\s*:\s*(.+)$/i);
    if (descMatch) {
      description = descMatch[1].trim();
      continue;
    }

    const ctxMatch = line.match(/^(?:context|domain|subdomain)\s*:\s*(.+)$/i);
    if (ctxMatch) {
      context = ctxMatch[1].trim();
      continue;
    }

    const hotspotMatch = line.match(/^(?:hotspot|note|risk|issue|question)\s*:\s*(.+)$/i);
    if (hotspotMatch && lastFlow) {
      const cleanNote = hotspotMatch[1].replace(/\s*\[(?:hotspot|risk|note)\]\s*$/i, '').trim();
      lastFlow.hotspots.push(cleanNote);
      continue;
    }

    const readMatch = line.match(/^(?:read|readmodel|query|view)\s*:\s*(.+)$/i);
    if (readMatch && lastFlow) {
      const cleanRead = readMatch[1].replace(/\s*\[(?:readmodel|query|view|read)\]\s*$/i, '').trim();
      lastFlow.readModels.push(cleanRead);
      continue;
    }

    if (line.includes('->')) {
      let stepNum = flows.length + 1;
      let body = line.replace(/^[-*]\s*/, '');
      const numMatch = body.match(/^(\d+)[\.\、\:\)]\s*(.+)$/);
      if (numMatch) {
        stepNum = parseInt(numMatch[1], 10);
        body = numMatch[2].trim();
      }

      const segments = body
        .split(/\s*->\s*/)
        .map(s => s.trim())
        .filter(Boolean);

      if (segments.length >= 2) {
        const nodes: EventStormingNode[] = [];
        const inlineHotspots: string[] = [];
        const inlineReadModels: string[] = [];

        segments.forEach((seg, idx) => {
          const parsedNode = parseStickyToken(seg, idx);
          if (parsedNode.kind === 'hotspot') {
            inlineHotspots.push(parsedNode.name);
          } else {
            nodes.push(parsedNode);
          }
        });

        const flow: EventStormingFlow = {
          id: `es-flow-${stepNum}`,
          number: stepNum,
          nodes,
          hotspots: inlineHotspots,
          readModels: inlineReadModels,
        };
        flows.push(flow);
        lastFlow = flow;
      }
    }
  }

  flows.sort((a, b) => a.number - b.number);

  return {
    title,
    description,
    spec: {
      context: context || undefined,
      flows,
    },
  };
}

/**
 * 解析限界上下文映射 DSL (Context Map)
 */
export function parseContextMapDsl(dsl: string): {
  title: string;
  description: string;
  spec: ContextMapSpec;
} {
  let title = 'DDD 限界上下文映射图 (Context Map)';
  let description = '';
  const contextsMap = new Map<string, BoundedContextNode>();
  const relationships: ContextRelationship[] = [];

  const lines = dsl.split('\n');
  let section: 'header' | 'contexts' | 'relationships' = 'header';

  const ensureContext = (rawName: string, defaultSubdomain: SubdomainType = 'supporting'): BoundedContextNode => {
    const cleanName = rawName.trim();
    if (contextsMap.has(cleanName)) {
      return contextsMap.get(cleanName)!;
    }
    const node: BoundedContextNode = {
      id: `ctx-${cleanName.replace(/\s+/g, '_')}`,
      name: cleanName,
      subdomain: defaultSubdomain,
    };
    contextsMap.set(cleanName, node);
    return node;
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || line.startsWith('//')) continue;

    if (/^(?:mode|type|view)\s*:/i.test(line)) continue;

    const titleMatch = line.match(/^(?:title|name)\s*:\s*(.+)$/i);
    if (titleMatch) {
      title = titleMatch[1].trim();
      continue;
    }

    const descMatch = line.match(/^(?:description|desc)\s*:\s*(.+)$/i);
    if (descMatch) {
      description = descMatch[1].trim();
      continue;
    }

    if (/^(?:contexts|bounded-?contexts|domains)\s*:/i.test(line)) {
      section = 'contexts';
      continue;
    }

    if (/^(?:relationships|mappings|links|integrations)\s*:/i.test(line)) {
      section = 'relationships';
      continue;
    }

    if (/(->>|->|<->|~>)/.test(line)) {
      let stepNum = relationships.length + 1;
      let body = line.replace(/^[-*]\s*/, '');
      const numMatch = body.match(/^(\d+)[\.\、\:\)]\s*(.+)$/);
      if (numMatch) {
        stepNum = parseInt(numMatch[1], 10);
        body = numMatch[2].trim();
      }

      let relExpr = body;
      let relLabel = '';
      const colonIdx = body.lastIndexOf(' : ');
      if (colonIdx !== -1) {
        relExpr = body.slice(0, colonIdx).trim();
        relLabel = body.slice(colonIdx + 3).trim();
      } else {
        const tailColonMatch = body.match(/^(.+?\]|\S+)\s*(?:->>|->|<->|~>)\s*(.+?\]|[^:]+?)\s*:\s*(.+)$/);
        if (tailColonMatch) {
          relExpr = `${tailColonMatch[1]} ${body.includes('->>') ? '->>' : body.includes('<->') ? '<->' : body.includes('~>') ? '~>' : '->'} ${tailColonMatch[2]}`;
          relLabel = tailColonMatch[3].trim();
        }
      }

      const arrowMatch = relExpr.match(/^(.+?)\s*(->>|<->|~>|->)\s*(.+)$/);
      if (arrowMatch) {
        const leftRaw = arrowMatch[1].trim();
        const arrowOp = arrowMatch[2];
        const rightRaw = arrowMatch[3].trim();

        const parseEndpoint = (token: string) => {
          const m = token.match(/^(.+?)(?:\s*\[([^\]]+)\])?$/);
          const name = (m ? m[1] : token).trim();
          const roleSpec = m && m[2] ? m[2].trim() : '';
          return { name, roleSpec };
        };

        const left = parseEndpoint(leftRaw);
        const right = parseEndpoint(rightRaw);

        const fromCtx = ensureContext(left.name);
        const toCtx = ensureContext(right.name);

        const upstreamPattern = left.roleSpec || (arrowOp === '<->' ? 'Partnership' : 'U');
        const downstreamPattern = right.roleSpec || (arrowOp === '<->' ? 'Partnership' : 'D');
        let pattern: string | undefined = undefined;

        if (/shared\s*kernel|共享内核|sk/i.test(left.roleSpec + ' ' + right.roleSpec + ' ' + relLabel)) {
          pattern = 'Shared Kernel';
        } else if (arrowOp === '<->') {
          pattern = 'Partnership';
        }

        relationships.push({
          id: `ctx-rel-${stepNum}`,
          number: stepNum,
          from: fromCtx.id,
          to: toCtx.id,
          label: relLabel || (arrowOp === '->>' || arrowOp === '~>' ? '领域事件发布' : '上下文集成契约'),
          upstreamPattern,
          downstreamPattern,
          pattern,
          isAsync: arrowOp === '->>' || arrowOp === '~>',
        });
      }
      continue;
    }

    if (section === 'contexts' || line.startsWith('-') || line.startsWith('*')) {
      const clean = line.replace(/^[-*]\s*/, '').trim();
      let mainPart = clean;
      let metaStr = '';
      const parenMatch = clean.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
      if (parenMatch) {
        mainPart = parenMatch[1].trim();
        metaStr = parenMatch[2].trim();
      }

      let ctxName = mainPart;
      let subdomain: SubdomainType = 'supporting';
      const subMatch = mainPart.match(/^(.+?)\s*\[([a-zA-Z0-9_\u4e00-\u9fa5-]+)\]\s*$/);
      if (subMatch) {
        ctxName = subMatch[1].trim();
        const tag = subMatch[2].toLowerCase();
        if (tag.includes('core') || tag.includes('核心')) {
          subdomain = 'core';
        } else if (tag.includes('generic') || tag.includes('通用')) {
          subdomain = 'generic';
        } else {
          subdomain = 'supporting';
        }
      }

      const node = ensureContext(ctxName, subdomain);
      node.subdomain = subdomain;

      if (metaStr) {
        const teamMatch = metaStr.match(/(?:team|owner|团队)\s*:\s*([^,;，；]+)/i);
        if (teamMatch) node.team = teamMatch[1].trim();

        const descMetaMatch = metaStr.match(/(?:desc|description|职责|说明)\s*:\s*([^,;，；]+)/i);
        if (descMetaMatch) node.description = descMetaMatch[1].trim();

        const aggMatch = metaStr.match(/(?:aggregates?|services?|capabilities|聚合|能力)\s*:\s*(.+)$/i);
        if (aggMatch) {
          node.aggregates = aggMatch[1]
            .split(/[,，、/]/)
            .map(s => s.trim())
            .filter(Boolean);
        }
      }
    }
  }

  return {
    title,
    description,
    spec: {
      contexts: Array.from(contextsMap.values()),
      relationships,
    },
  };
}

// ============================================================
// 2. 渲染：DDD 事件风暴时间轴 (Event Storming)
// ============================================================
export interface DddRenderOptions {
  currentStep?: number;
  isDark?: boolean;
  theme?: string;
}

export interface DddThemePalette {
  bg: string;
  cardBg: string;
  cardBorder: string;
  title: string;
  subtitle: string;
  line: string;
  boxBg: string;
  accent: string;
}

export const DDD_THEME_PALETTES: Record<string, DddThemePalette> = {
  dracula: {
    bg: '#282a36',
    cardBg: '#21222c',
    cardBorder: '#6272a4',
    title: '#f8f8f2',
    subtitle: '#bd93f9',
    line: '#bd93f9',
    boxBg: '#191a21',
    accent: '#bd93f9',
  },
  catppuccin: {
    bg: '#1e1e2e',
    cardBg: '#181825',
    cardBorder: '#45475a',
    title: '#cdd6f4',
    subtitle: '#a6adc8',
    line: '#cba6f7',
    boxBg: '#11111b',
    accent: '#cba6f7',
  },
  nord: {
    bg: '#2e3440',
    cardBg: '#242933',
    cardBorder: '#4c566a',
    title: '#eceff4',
    subtitle: '#d8dee9',
    line: '#88c0d0',
    boxBg: '#1e222a',
    accent: '#88c0d0',
  },
  'tokyo-night': {
    bg: '#1a1b26',
    cardBg: '#16161e',
    cardBorder: '#414868',
    title: '#c0caf5',
    subtitle: '#9aa5ce',
    line: '#7aa2f7',
    boxBg: '#0f1017',
    accent: '#7aa2f7',
  },
  sepia: {
    bg: '#fef9ed',
    cardBg: '#fffbf2',
    cardBorder: '#fde68a',
    title: '#78350f',
    subtitle: '#92400e',
    line: '#b45309',
    boxBg: '#fef3c7',
    accent: '#b45309',
  },
  forest: {
    bg: '#0f1712',
    cardBg: '#0a100c',
    cardBorder: '#2d4535',
    title: '#e2f0e6',
    subtitle: '#a3c4ad',
    line: '#10b981',
    boxBg: '#070c09',
    accent: '#10b981',
  },
  solarized: {
    bg: '#002b36',
    cardBg: '#073642',
    cardBorder: '#586e75',
    title: '#839496',
    subtitle: '#93a1a1',
    line: '#2aa198',
    boxBg: '#00212b',
    accent: '#2aa198',
  },
  notion: {
    bg: '#ffffff',
    cardBg: '#f7f6f3',
    cardBorder: '#e5e5e5',
    title: '#37352f',
    subtitle: '#787774',
    line: '#0f172a',
    boxBg: '#ffffff',
    accent: '#0284c7',
  },
  'github-dark': {
    bg: '#0d1117',
    cardBg: '#161b22',
    cardBorder: '#30363d',
    title: '#e6edf3',
    subtitle: '#8b949e',
    line: '#58a6ff',
    boxBg: '#010409',
    accent: '#58a6ff',
  },
  midnight: {
    bg: '#020617',
    cardBg: '#0b1120',
    cardBorder: '#1e293b',
    title: '#f8fafc',
    subtitle: '#94a3b8',
    line: '#38bdf8',
    boxBg: '#020617',
    accent: '#38bdf8',
  },
  cyber: {
    bg: '#09090b',
    cardBg: '#18181b',
    cardBorder: '#27272a',
    title: '#fafafa',
    subtitle: '#a1a1aa',
    line: '#06b6d4',
    boxBg: '#09090b',
    accent: '#06b6d4',
  },
  dark: {
    bg: '#0b1120',
    cardBg: '#1e293b',
    cardBorder: '#334155',
    title: '#f8fafc',
    subtitle: '#94a3b8',
    line: '#38bdf8',
    boxBg: '#0f172a',
    accent: '#38bdf8',
  },
  light: {
    bg: '#f8fafc',
    cardBg: '#ffffff',
    cardBorder: '#cbd5e1',
    title: '#0f172a',
    subtitle: '#475569',
    line: '#0284c7',
    boxBg: '#f1f5f9',
    accent: '#0284c7',
  },
};

export function resolveDddPalette(theme?: string, isDark?: boolean): DddThemePalette {
  if (theme && DDD_THEME_PALETTES[theme]) {
    return DDD_THEME_PALETTES[theme];
  }
  return isDark !== false ? DDD_THEME_PALETTES.dark : DDD_THEME_PALETTES.light;
}

export function renderEventStormingToSvg(
  spec: EventStormingSpec,
  info?: { name?: string; description?: string },
  options: DddRenderOptions = {}
): string {
  const { currentStep = -1, isDark = true, theme } = options;
  const palette = resolveDddPalette(theme, isDark);
  const flows = spec.flows || [];

  const noteW = 120;
  const noteH = 80;
  const noteGap = 24;
  const laneGap = 36;
  const laneHeaderW = 60;
  const flowLeftPadding = 94;

  // 精准累加每条 Flow 实际占用的真实像素宽度，彻底根治右侧溢出界限与便利贴截断
  let maxRequiredFlowW = 0;
  flows.forEach(flow => {
    let flowW = flowLeftPadding;
    if (flow.nodes && flow.nodes.length > 0) {
      flowW += flow.nodes.length * noteW + (flow.nodes.length - 1) * noteGap;
    }
    if (flow.readModels && flow.readModels.length > 0) {
      flowW += noteGap + 8 + flow.readModels.length * (noteW + 10 + noteGap);
    }
    if (flow.hotspots && flow.hotspots.length > 0) {
      flowW += 8 + flow.hotspots.length * (noteW + 14 + noteGap);
    }
    // 泳道卡片右侧留出 80px 充裕呼吸留白，防止紧贴外框
    flowW += 80;
    if (flowW > maxRequiredFlowW) {
      maxRequiredFlowW = flowW;
    }
  });

  const vw = Math.max(1280, Math.ceil(maxRequiredFlowW + 40));

  // 计算高度
  const headerH = 84;
  const laneH = 130;
  const vh = headerH + Math.max(1, flows.length) * (laneH + laneGap) + 40;

  const bg = palette.bg;
  const textTitle = palette.title;
  const textSub = palette.subtitle;
  const laneBg = palette.cardBg;
  const laneBorder = palette.cardBorder;

  const stickyStyles: Record<StickyNoteKind, { bg: string; border: string; text: string; label: string }> = {
    actor: { bg: '#fef08a', border: '#eab308', text: '#854d0e', label: 'ACTOR' },
    command: { bg: '#bae6fd', border: '#0284c7', text: '#0369a1', label: 'COMMAND' },
    aggregate: { bg: '#fef08a', border: '#ca8a04', text: '#713f12', label: 'AGGREGATE' },
    event: { bg: '#fed7aa', border: '#ea580c', text: '#9a3412', label: 'EVENT' },
    policy: { bg: '#e9d5ff', border: '#9333ea', text: '#6b21a8', label: 'POLICY' },
    external: { bg: '#fecdd3', border: '#e11d48', text: '#9f1239', label: 'EXTERNAL' },
    readmodel: { bg: '#bbf7d0', border: '#16a34a', text: '#14532d', label: 'READMODEL' },
    hotspot: { bg: '#f43f5e', border: '#be123c', text: '#ffffff', label: 'HOTSPOT' },
  };

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vw} ${vh}" width="${vw}" height="${vh}" class="ov-domain-story-svg ov-ddd-event-storming" style="background-color: transparent; max-width: 100%; height: auto; user-select: none; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">\n`;

  svg += `  <defs>
    <filter id="es-shadow" x="-8%" y="-8%" width="116%" height="116%">
      <feDropShadow dx="1" dy="3" stdDeviation="3" flood-color="#000000" flood-opacity="${isDark ? '0.4' : '0.15'}" />
    </filter>
    <marker id="es-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1 L 9 5 L 0 9 z" fill="${isDark ? '#60a5fa' : '#0284c7'}" />
    </marker>
  </defs>\n`;

  // 1. Header
  const title = info?.name || 'DDD 事件风暴时间轴 (Event Storming)';
  const desc = info?.description || (spec.context ? `限界上下文: ${spec.context}` : '');
  svg += `  <g class="es-header">
    <rect x="20" y="14" width="${vw - 40}" height="56" rx="10" fill="${laneBg}" stroke="${laneBorder}" stroke-width="1.2" />
    <text x="40" y="44" fill="${textTitle}" font-size="17" font-weight="700">⚡ ${escapeXml(title)}</text>
    ${desc ? `<text x="40" y="60" fill="${textSub}" font-size="11">${escapeXml(truncateLabel(desc, 65))}</text>` : ''}
    <g transform="translate(${vw - 520}, 30)">
      <rect x="0" y="0" width="60" height="20" rx="4" fill="${stickyStyles.command.bg}" stroke="${stickyStyles.command.border}" />
      <text x="30" y="14" fill="${stickyStyles.command.text}" font-size="9" font-weight="700" text-anchor="middle">COMMAND</text>
      <rect x="68" y="0" width="65" height="20" rx="4" fill="${stickyStyles.aggregate.bg}" stroke="${stickyStyles.aggregate.border}" />
      <text x="100" y="14" fill="${stickyStyles.aggregate.text}" font-size="9" font-weight="700" text-anchor="middle">AGGREGATE</text>
      <rect x="140" y="0" width="55" height="20" rx="4" fill="${stickyStyles.event.bg}" stroke="${stickyStyles.event.border}" />
      <text x="167" y="14" fill="${stickyStyles.event.text}" font-size="9" font-weight="700" text-anchor="middle">EVENT</text>
      <rect x="202" y="0" width="55" height="20" rx="4" fill="${stickyStyles.policy.bg}" stroke="${stickyStyles.policy.border}" />
      <text x="229" y="14" fill="${stickyStyles.policy.text}" font-size="9" font-weight="700" text-anchor="middle">POLICY</text>
      <rect x="264" y="0" width="60" height="20" rx="4" fill="${stickyStyles.hotspot.bg}" stroke="${stickyStyles.hotspot.border}" />
      <text x="294" y="14" fill="${stickyStyles.hotspot.text}" font-size="9" font-weight="700" text-anchor="middle">HOTSPOT</text>
      <rect x="330" y="0" width="65" height="20" rx="4" fill="${stickyStyles.readmodel.bg}" stroke="${stickyStyles.readmodel.border}" />
      <text x="362" y="14" fill="${stickyStyles.readmodel.text}" font-size="9" font-weight="700" text-anchor="middle">READMODEL</text>
    </g>
  </g>\n`;

  // 2. Flows Lanes
  flows.forEach((flow, flowIndex) => {
    const isStepActive = currentStep === flowIndex;
    const isStepDimmed = currentStep !== -1 && !isStepActive;
    const laneY = headerH + flowIndex * (laneH + laneGap);

    svg += `  <!-- Flow #${flow.number} -->
  <g class="es-flow-lane" opacity="${isStepDimmed ? '0.3' : '1'}" style="transition: opacity 0.2s ease;">
    <rect x="20" y="${laneY}" width="${vw - 40}" height="${laneH}" rx="12" fill="${laneBg}" stroke="${isStepActive ? '#38bdf8' : laneBorder}" stroke-width="${isStepActive ? '2.5' : '1.2'}" filter="url(#es-shadow)" />
    
    <!-- Flow Header Badge -->
    <rect x="36" y="${laneY + 16}" width="42" height="26" rx="6" fill="#0284c7" />
    <text x="57" y="${laneY + 33}" fill="#ffffff" font-size="12" font-weight="700" text-anchor="middle">#${flow.number}</text>

    <!-- Sticky Notes Sequence -->
    <g transform="translate(94, ${laneY + 14})">
`;

    let curX = 0;
    flow.nodes.forEach((node, nodeIdx) => {
      const style = stickyStyles[node.kind] || stickyStyles.command;
      const [line1, line2] = splitTwoLines(node.name, 8);

      svg += `      <!-- Node: ${escapeXml(node.name)} -->
      <g class="es-note" transform="translate(${curX}, 0)" filter="url(#es-shadow)">
        <rect x="0" y="0" width="${noteW}" height="${noteH}" rx="6" fill="${style.bg}" stroke="${style.border}" stroke-width="1.2" />
        <rect x="6" y="6" width="62" height="15" rx="3" fill="${style.border}" />
        <text x="37" y="17" fill="#ffffff" font-size="8.5" font-weight="700" text-anchor="middle">${style.label}</text>
        <text x="${noteW / 2}" y="42" fill="${style.text}" font-size="11.5" font-weight="700" text-anchor="middle">${escapeXml(line1)}</text>
        ${line2 ? `<text x="${noteW / 2}" y="58" fill="${style.text}" font-size="11" font-weight="600" text-anchor="middle">${escapeXml(line2)}</text>` : ''}
      </g>\n`;

      curX += noteW;

      // 节点间连线箭头
      if (nodeIdx < flow.nodes.length - 1) {
        svg += `      <line x1="${curX + 4}" y1="${noteH / 2}" x2="${curX + noteGap - 6}" y2="${noteH / 2}" stroke="${isDark ? '#60a5fa' : '#0284c7'}" stroke-width="2" marker-end="url(#es-arrow)" />\n`;
        curX += noteGap;
      }
    });

    // 读模型与风险痛点便利贴挂接在流程右侧
    if (flow.readModels.length > 0) {
      curX += noteGap + 8;
      flow.readModels.forEach(rm => {
        const style = stickyStyles.readmodel;
        svg += `      <g class="es-readmodel" transform="translate(${curX}, 0)" filter="url(#es-shadow)">
        <rect x="0" y="0" width="${noteW + 10}" height="${noteH}" rx="6" fill="${style.bg}" stroke="${style.border}" stroke-width="1.2" />
        <rect x="6" y="6" width="68" height="15" rx="3" fill="${style.border}" />
        <text x="40" y="17" fill="#ffffff" font-size="8.5" font-weight="700" text-anchor="middle">READMODEL</text>
        <text x="${(noteW + 10) / 2}" y="46" fill="${style.text}" font-size="10.5" font-weight="700" text-anchor="middle">${escapeXml(truncateLabel(rm, 11))}</text>
      </g>\n`;
        curX += noteW + 10 + noteGap;
      });
    }

    if (flow.hotspots.length > 0) {
      curX += 8;
      flow.hotspots.forEach(hs => {
        const style = stickyStyles.hotspot;
        const [hLine1, hLine2] = splitTwoLines(hs, 9);
        svg += `      <g class="es-hotspot" transform="translate(${curX}, 0)" filter="url(#es-shadow)">
        <title>${escapeXml(hs)}</title>
        <polygon points="0,0 ${noteW + 14},0 ${noteW + 6},${noteH} -8,${noteH}" fill="${style.bg}" stroke="${style.border}" stroke-width="1.2" />
        <text x="${(noteW + 6) / 2}" y="24" fill="#ffffff" font-size="10" font-weight="800" text-anchor="middle">🔥 HOTSPOT 痛点</text>
        <text x="${(noteW + 6) / 2}" y="44" fill="#ffffff" font-size="10" font-weight="700" text-anchor="middle">${escapeXml(hLine1)}</text>
        ${hLine2 ? `<text x="${(noteW + 6) / 2}" y="60" fill="#ffffff" font-size="9.5" text-anchor="middle">${escapeXml(hLine2)}</text>` : ''}
      </g>\n`;
        curX += noteW + 14 + noteGap;
      });
    }

    svg += `    </g>
  </g>\n`;
  });

  svg += `</svg>`;
  return svg;
}

// ============================================================
// 3. 渲染：DDD 战略设计限界上下文映射图 (Context Map)
// ============================================================
export function renderContextMapToSvg(
  spec: ContextMapSpec,
  info?: { name?: string; description?: string },
  options: DddRenderOptions = {}
): string {
  const { currentStep = -1, isDark = true, theme } = options;
  const contexts = spec.contexts || [];
  const relationships = spec.relationships || [];

  // 画布尺寸宽敞化，留足节点与关系连线防遮盖呼吸空间
  const vw = Math.max(1520, 500 + contexts.length * 160);
  const vh = Math.max(960, 420 + contexts.length * 90);

  const colors = resolveDddPalette(theme, isDark);

  const domainBadges: Record<SubdomainType, { label: string; bg: string; text: string }> = {
    core: { label: '★ CORE DOMAIN', bg: '#0284c7', text: '#ffffff' },
    supporting: { label: '⚡ SUPPORTING', bg: '#d97706', text: '#ffffff' },
    generic: { label: '⚙ GENERIC', bg: '#475569', text: '#ffffff' },
  };

  // 坐标布局计算：卡片尺寸
  const cardW = 260;
  const cardH = 130;
  const ctxPositions = new Map<string, { x: number; y: number }>();

  if (contexts.length <= 3) {
    const startX = (vw - contexts.length * cardW) / (contexts.length + 1);
    contexts.forEach((ctx, idx) => {
      const cx = (idx + 1) * startX + idx * cardW;
      const cy = 260 + (idx % 2 === 1 ? 120 : 0);
      ctxPositions.set(ctx.id, { x: cx, y: cy });
    });
  } else if (contexts.length <= 4) {
    const pos = [
      { x: 220, y: 200 },
      { x: 980, y: 200 },
      { x: 220, y: 560 },
      { x: 980, y: 560 },
    ];
    contexts.forEach((ctx, idx) => {
      ctxPositions.set(ctx.id, pos[idx] || { x: 220, y: 200 });
    });
  } else {
    // 5+ 节点采用大幅度扩展的圆周环绕布局，节点间距扩大至 190px+，彻底消除拥挤与遮盖
    const centerX = vw / 2 - cardW / 2;
    const centerY = (vh + 90) / 2 - cardH / 2;
    const radiusX = 540;
    const radiusY = 320;
    contexts.forEach((ctx, idx) => {
      const angle = (idx / contexts.length) * 2 * Math.PI - Math.PI / 2;
      ctxPositions.set(ctx.id, {
        x: Math.round(centerX + radiusX * Math.cos(angle)),
        y: Math.round(centerY + radiusY * Math.sin(angle)),
      });
    });
  }

  // 辅助函数：计算卡片中心与目标点连线与卡片外框边界的交点（实现精准边缘停靠，不穿透卡片）
  const getCardBorderPoint = (
    cx: number,
    cy: number,
    tx: number,
    ty: number,
    margin: number = 6
  ): { x: number; y: number } => {
    const dx = tx - cx;
    const dy = ty - cy;
    if (Math.abs(dx) < 1e-4 && Math.abs(dy) < 1e-4) return { x: cx, y: cy };
    const hw = cardW / 2 + margin;
    const hh = cardH / 2 + margin;
    const sx = Math.abs(dx) > 0 ? hw / Math.abs(dx) : Infinity;
    const sy = Math.abs(dy) > 0 ? hh / Math.abs(dy) : Infinity;
    const s = Math.min(sx, sy);
    return { x: cx + dx * s, y: cy + dy * s };
  };

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vw} ${vh}" width="${vw}" height="${vh}" class="ov-domain-story-svg ov-ddd-context-map" style="background-color: transparent; max-width: 100%; height: auto; user-select: none; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">\n`;

  svg += `  <defs>
    <filter id="cm-shadow" x="-8%" y="-8%" width="116%" height="116%">
      <feDropShadow dx="1" dy="4" stdDeviation="4" flood-color="#000000" flood-opacity="${isDark ? '0.45' : '0.15'}" />
    </filter>
    <filter id="cm-glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
    <marker id="cm-arrow-solid" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1 L 9 5 L 0 9 z" fill="${colors.line}" />
    </marker>
    <marker id="cm-arrow-open" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 1 1 L 8 5 L 1 9" fill="none" stroke="${colors.line}" stroke-width="2" />
    </marker>
  </defs>\n`;

  // 1. Header
  const title = info?.name || 'DDD 限界上下文映射图 (Context Map)';
  const desc = info?.description || '展现核心域、支撑域与通用域之间的协作拓扑与上下游防腐架构契约';
  svg += `  <g class="cm-header">
    <rect x="24" y="16" width="${vw - 48}" height="56" rx="10" fill="${colors.cardBg}" stroke="${colors.cardBorder}" stroke-width="1.2" />
    <text x="44" y="44" fill="${colors.title}" font-size="17" font-weight="700">🗺️ ${escapeXml(title)}</text>
    <text x="44" y="60" fill="${colors.subtitle}" font-size="11">${escapeXml(truncateLabel(desc, 65))}</text>
    <g transform="translate(${vw - 360}, 32)">
      <rect x="0" y="0" width="96" height="22" rx="5" fill="${domainBadges.core.bg}" />
      <text x="48" y="15" fill="#ffffff" font-size="9.5" font-weight="700" text-anchor="middle">CORE DOMAIN</text>
      <rect x="108" y="0" width="100" height="22" rx="5" fill="${domainBadges.supporting.bg}" />
      <text x="158" y="15" fill="#ffffff" font-size="9.5" font-weight="700" text-anchor="middle">SUPPORTING</text>
      <rect x="220" y="0" width="90" height="22" rx="5" fill="${domainBadges.generic.bg}" />
      <text x="265" y="15" fill="#ffffff" font-size="9.5" font-weight="700" text-anchor="middle">GENERIC</text>
    </g>
  </g>\n`;

  // 2. 底层图层：关系连线 (Lines Layer)
  svg += `  <!-- Layer 1: 关系连线 (端点精确停靠在卡片外框边界) -->\n  <g class="cm-relationships-lines">\n`;
  const computedRelPoints: Array<{
    rel: typeof relationships[0];
    relIdx: number;
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    badgeX: number;
    badgeY: number;
    badgeW: number;
  }> = [];

  relationships.forEach((rel, relIdx) => {
    const fromPos = ctxPositions.get(rel.from);
    const toPos = ctxPositions.get(rel.to);
    if (!fromPos || !toPos) return;

    const isStepActive = currentStep === relIdx;
    const isStepDimmed = currentStep !== -1 && !isStepActive;

    const c1x = fromPos.x + cardW / 2;
    const c1y = fromPos.y + cardH / 2;
    const c2x = toPos.x + cardW / 2;
    const c2y = toPos.y + cardH / 2;

    // 端点停靠点
    const p1 = getCardBorderPoint(c1x, c1y, c2x, c2y, 4);
    const p2 = getCardBorderPoint(c2x, c2y, c1x, c1y, 4);

    const marker = rel.isAsync ? 'url(#cm-arrow-open)' : 'url(#cm-arrow-solid)';

    svg += `    <line x1="${p1.x}" y1="${p1.y}" x2="${p2.x}" y2="${p2.y}" stroke="${isStepActive ? '#38bdf8' : colors.line}" stroke-width="${isStepActive ? '3.5' : '2'}" stroke-dasharray="${rel.isAsync ? '6,4' : 'none'}" marker-end="${marker}" opacity="${isStepDimmed ? '0.2' : '1'}" filter="${isStepActive ? 'url(#cm-glow)' : 'none'}" />\n`;

    // 预计算标签铭牌宽度与位置：精致紧凑型胶囊设计，确保在卡片间隙中留有纯净留白
    const badgeW = Math.max(140, Math.min(176, rel.label.length * 9 + 48));
    let badgeX = (p1.x + p2.x) / 2;
    let badgeY = (p1.y + p2.y) / 2;

    // 避让检测：若中点距离任何卡片中心太近，微调 t
    const isCollidingWithCard = (bx: number, by: number) => {
      for (const [, pos] of ctxPositions) {
        const kx = pos.x + cardW / 2;
        const ky = pos.y + cardH / 2;
        if (Math.abs(bx - kx) < (cardW + badgeW) / 2 && Math.abs(by - ky) < (cardH + 36) / 2) {
          return true;
        }
      }
      return false;
    };

    if (isCollidingWithCard(badgeX, badgeY)) {
      const candidates = [0.4, 0.6, 0.32, 0.68];
      for (const t of candidates) {
        const candX = p1.x + (p2.x - p1.x) * t;
        const candY = p1.y + (p2.y - p1.y) * t;
        if (!isCollidingWithCard(candX, candY)) {
          badgeX = candX;
          badgeY = candY;
          break;
        }
      }
    }

    computedRelPoints.push({
      rel,
      relIdx,
      startX: p1.x,
      startY: p1.y,
      endX: p2.x,
      endY: p2.y,
      badgeX,
      badgeY,
      badgeW,
    });
  });
  svg += `  </g>\n`;

  // 3. 中层图层：上下文卡片节点 (Context Cards Layer)
  svg += `  <!-- Layer 2: 上下文卡片节点 -->\n  <g class="cm-context-cards">\n`;
  contexts.forEach(ctx => {
    const pos = ctxPositions.get(ctx.id) || { x: 100, y: 100 };
    const badge = domainBadges[ctx.subdomain] || domainBadges.supporting;

    svg += `  <g class="cm-context-card" transform="translate(${pos.x}, ${pos.y})" filter="url(#cm-shadow)">
    <rect x="0" y="0" width="${cardW}" height="${cardH}" rx="10" fill="${colors.cardBg}" stroke="${badge.bg}" stroke-width="2" />
    <rect x="0" y="0" width="${cardW}" height="28" rx="10" fill="${badge.bg}" />
    <text x="${cardW / 2}" y="18" fill="${badge.text}" font-size="11" font-weight="700" text-anchor="middle">${badge.label}</text>

    <!-- Context 标题与描述 -->
    <text x="14" y="48" fill="${colors.title}" font-size="13" font-weight="700">${escapeXml(truncateLabel(ctx.name, 16))}</text>
    ${ctx.team ? `<text x="14" y="66" fill="${colors.subtitle}" font-size="10" font-weight="600">👥 团队: ${escapeXml(truncateLabel(ctx.team, 16))}</text>` : ''}
    ${ctx.description ? `<text x="14" y="82" fill="${colors.subtitle}" font-size="10">${escapeXml(truncateLabel(ctx.description, 20))}</text>` : ''}

    <!-- 内部核心聚合根标签 -->
    ${
      ctx.aggregates && ctx.aggregates.length > 0
        ? `<g transform="translate(14, 94)">
            ${ctx.aggregates.slice(0, 2).map((agg, i) => `
              <rect x="${i * 115}" y="0" width="110" height="22" rx="4" fill="${colors.boxBg}" stroke="${colors.cardBorder}" stroke-width="1" />
              <text x="${i * 115 + 55}" y="15" fill="${colors.title}" font-size="9.5" font-weight="600" text-anchor="middle">@ ${escapeXml(truncateLabel(agg, 9))}</text>
            `).join('')}
           </g>`
        : ''
    }
  </g>\n`;
  });
  svg += `  </g>\n`;

  // 4. 顶层图层：关系标签与防腐契约铭牌 (Top Badges Layer，置于卡片上方，彻底杜绝文字被卡片遮盖)
  svg += `  <!-- Layer 3: 顶层关系标签与契约铭牌 (永远浮在卡片与连线上方) -->\n  <g class="cm-relationship-badges">\n`;
  computedRelPoints.forEach(item => {
    const { rel, relIdx, badgeX, badgeY, badgeW } = item;
    const isStepActive = currentStep === relIdx;
    const isStepDimmed = currentStep !== -1 && !isStepActive;

    svg += `  <g class="cm-rel-badge" transform="translate(${badgeX}, ${badgeY})" opacity="${isStepDimmed ? '0.35' : '1'}" filter="url(#cm-shadow)" style="transition: opacity 0.2s ease;">
      <rect x="${-badgeW / 2}" y="-18" width="${badgeW}" height="36" rx="6" fill="${colors.cardBg}" stroke="${isStepActive ? '#38bdf8' : colors.cardBorder}" stroke-width="${isStepActive ? '2' : '1.2'}" />
      
      <!-- 上游 U 标签 -->
      ${rel.upstreamPattern ? `<rect x="${-badgeW / 2 + 6}" y="-13" width="52" height="14" rx="3" fill="#0284c7" />
      <text x="${-badgeW / 2 + 32}" y="-2" fill="#ffffff" font-size="8.5" font-weight="700" text-anchor="middle">${escapeXml(rel.upstreamPattern)}</text>` : ''}
      
      <!-- 下游 D 标签 -->
      ${rel.downstreamPattern ? `<rect x="${badgeW / 2 - 58}" y="-13" width="52" height="14" rx="3" fill="#ea580c" />
      <text x="${badgeW / 2 - 32}" y="-2" fill="#ffffff" font-size="8.5" font-weight="700" text-anchor="middle">${escapeXml(rel.downstreamPattern)}</text>` : ''}
      
      <!-- 关系说明文字 -->
      <text x="0" y="11" fill="${colors.title}" font-size="10" font-weight="700" text-anchor="middle">#${rel.number} ${escapeXml(truncateLabel(rel.label, 13))}</text>
    </g>\n`;
  });
  svg += `  </g>\n`;

  svg += `</svg>`;
  return svg;
}

// ============================================================
// 4. 解析与渲染：核心域战略投资象限图 (Core Domain Chart)
// ============================================================
export function parseCoreDomainChartDsl(dsl: string): {
  title: string;
  description: string;
  spec: CoreDomainChartSpec;
} {
  let title = 'DDD 核心域战略投资象限图 (Core Domain Chart)';
  let description = '';
  const domains: CoreDomainItem[] = [];

  const lines = dsl.split('\n');
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || line.startsWith('//')) continue;
    if (/^(?:mode|type|view)\s*:/i.test(line)) continue;

    const titleMatch = line.match(/^(?:title|name)\s*:\s*(.+)$/i);
    if (titleMatch) {
      title = titleMatch[1].trim();
      continue;
    }
    const descMatch = line.match(/^(?:description|desc)\s*:\s*(.+)$/i);
    if (descMatch) {
      description = descMatch[1].trim();
      continue;
    }

    if (line.startsWith('-') || line.startsWith('*')) {
      const clean = line.replace(/^[-*]\s*/, '').trim();

      // 提取行尾演进描述: -> 保持核心差异化壁垒 或 => 85, 90
      let tailEvo = '';
      let cleanWithoutEvo = clean;
      const evoArrowMatch = clean.match(/^(.+?)\s*(?:->|=>|演进)\s*(.+)$/);
      if (evoArrowMatch) {
        cleanWithoutEvo = evoArrowMatch[1].trim();
        tailEvo = evoArrowMatch[2].trim();
      }

      let mainPart = cleanWithoutEvo;
      let metaStr = '';
      const parenMatch = cleanWithoutEvo.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
      if (parenMatch) {
        mainPart = parenMatch[1].trim();
        metaStr = parenMatch[2].trim();
      }

      let domainName = mainPart;
      let subdomain: SubdomainType = 'supporting';
      const subMatch = mainPart.match(/^(.+?)\s*\[([a-zA-Z0-9_\u4e00-\u9fa5-]+)\]\s*$/);
      if (subMatch) {
        domainName = subMatch[1].trim();
        const tag = subMatch[2].toLowerCase();
        if (tag.includes('core') || tag.includes('核心')) {
          subdomain = 'core';
        } else if (tag.includes('generic') || tag.includes('通用')) {
          subdomain = 'generic';
        } else {
          subdomain = 'supporting';
        }
      }

      let complexity = subdomain === 'core' ? 80 : subdomain === 'supporting' ? 60 : 30;
      let differentiation = subdomain === 'core' ? 85 : subdomain === 'supporting' ? 45 : 15;
      let investment: string | undefined = undefined;
      let team: string | undefined = undefined;
      let note: string | undefined = undefined;
      let evolution: string | undefined = tailEvo || undefined;
      let evolutionTo: { complexity: number; differentiation: number; note?: string } | undefined = undefined;

      if (tailEvo) {
        const coordMatch = tailEvo.match(/(\d{1,3})\s*[,，]\s*(\d{1,3})/);
        if (coordMatch) {
          evolutionTo = {
            complexity: Math.max(0, Math.min(100, parseInt(coordMatch[1], 10))),
            differentiation: Math.max(0, Math.min(100, parseInt(coordMatch[2], 10))),
            note: tailEvo,
          };
        }
      }

      if (metaStr) {
        const compMatch = metaStr.match(/(?:complexity|comp|复杂|复杂度)\s*:\s*(\d{1,3})/i);
        if (compMatch) complexity = Math.max(0, Math.min(100, parseInt(compMatch[1], 10)));

        const diffMatch = metaStr.match(/(?:differentiation|diff|差异|壁垒|竞争)\s*:\s*(\d{1,3})/i);
        if (diffMatch) differentiation = Math.max(0, Math.min(100, parseInt(diffMatch[1], 10)));

        const investMatch = metaStr.match(/(?:investment|invest|strategy|策略|投入|投资)\s*:\s*([^,;，；]+)/i);
        if (investMatch) investment = investMatch[1].trim();

        const teamMatch = metaStr.match(/(?:team|owner|团队)\s*:\s*([^,;，；]+)/i);
        if (teamMatch) team = teamMatch[1].trim();

        const noteMatch = metaStr.match(/(?:note|desc|说明)\s*:\s*([^,;，；]+)/i);
        if (noteMatch) note = noteMatch[1].trim();

        const evoMetaMatch = metaStr.match(/(?:evolution|->|演进)\s*[:\s]*([^,;，；]+)/i);
        if (evoMetaMatch) {
          const val = evoMetaMatch[1].trim();
          evolution = val;
          const coordMatch = val.match(/(\d{1,3})\s*[,，]\s*(\d{1,3})/);
          if (coordMatch) {
            evolutionTo = {
              complexity: Math.max(0, Math.min(100, parseInt(coordMatch[1], 10))),
              differentiation: Math.max(0, Math.min(100, parseInt(coordMatch[2], 10))),
              note: val,
            };
          }
        }
      }

      domains.push({
        id: `domain-${domainName.replace(/\s+/g, '_')}`,
        name: domainName,
        subdomain,
        complexity,
        differentiation,
        investment,
        team,
        note,
        evolution,
        evolutionTo,
      });
    }
  }

  return {
    title,
    description,
    spec: { domains },
  };
}

export function renderCoreDomainChartToSvg(
  spec: CoreDomainChartSpec,
  info?: { name?: string; description?: string },
  options: DddRenderOptions = {}
): string {
  const { currentStep = -1, isDark = true, theme } = options;
  const palette = resolveDddPalette(theme, isDark);
  const domains = spec.domains || [];

  const vw = 960;
  const vh = 640;
  const plotLeft = 110;
  const plotTop = 110;
  const plotW = 760;
  const plotH = 430;

  const toPlotX = (comp: number) => plotLeft + (comp / 100) * plotW;
  const toPlotY = (diff: number) => plotTop + plotH - (diff / 100) * plotH;

  const titleText = info?.name || 'DDD 核心域战略投资象限图 (Core Domain Chart)';
  const subText = info?.description || '横轴：业务模型与算法复杂度 (Complexity) | 纵轴：商业差异化竞争力壁垒 (Differentiation)';

  const colors = isDark
    ? {
        bg: palette.bg,
        panelBg: palette.cardBg,
        gridLine: palette.cardBorder,
        axisLine: '#475569',
        axisText: palette.subtitle,
        coreBg: 'rgba(14, 165, 233, 0.12)',
        coreBorder: '#0284c7',
        supportingBg: 'rgba(139, 92, 246, 0.08)',
        supportingBorder: '#7c3aed',
        genericBg: 'rgba(100, 116, 139, 0.08)',
        genericBorder: '#475569',
        specializedBg: 'rgba(16, 185, 129, 0.08)',
        specializedBorder: '#059669',
        bubbleText: palette.title,
      }
    : {
        bg: palette.bg,
        panelBg: palette.cardBg,
        gridLine: palette.cardBorder,
        axisLine: '#64748b',
        axisText: '#475569',
        coreBg: 'rgba(2, 132, 199, 0.09)',
        coreBorder: '#0ea5e9',
        supportingBg: 'rgba(109, 40, 217, 0.07)',
        supportingBorder: '#8b5cf6',
        genericBg: 'rgba(148, 163, 184, 0.09)',
        genericBorder: '#94a3b8',
        specializedBg: 'rgba(5, 150, 105, 0.07)',
        specializedBorder: '#10b981',
        bubbleText: '#0f172a',
      };

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vw} ${vh}" width="${vw}" height="${vh}" class="ov-domain-story-svg ov-ddd-core-domain-chart" style="background-color: transparent; max-width: 100%; height: auto; user-select: none; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">\n`;

  svg += `  <defs>
    <filter id="cdc-shadow" x="-15%" y="-15%" width="130%" height="130%">
      <feDropShadow dx="0" dy="4" stdDeviation="5" flood-color="#000000" flood-opacity="${isDark ? '0.5' : '0.15'}" />
    </filter>
    <filter id="cdc-glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="6" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
    <marker id="cdc-arrow-evo" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6.5" markerHeight="6.5" orient="auto-start-reverse">
      <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#38bdf8" />
    </marker>
  </defs>\n`;

  // 1. 顶部标题
  svg += `  <g class="cdc-header">
    <text x="36" y="42" fill="${isDark ? '#f8fafc' : '#0f172a'}" font-size="18" font-weight="700">${escapeXml(titleText)}</text>
    <text x="36" y="68" fill="${isDark ? '#94a3b8' : '#64748b'}" font-size="13">${escapeXml(subText)}</text>
  </g>\n`;

  // 2. 四象限背景底板与战略分区水印
  const midX = plotLeft + plotW / 2;
  const midY = plotTop + plotH / 2;

  // Q1: 右上 (Core Domain: 高复杂 + 高差异)
  svg += `  <g class="cdc-quadrants">
    <rect x="${midX}" y="${plotTop}" width="${plotW / 2}" height="${plotH / 2}" fill="${colors.coreBg}" stroke="${colors.gridLine}" stroke-width="1" />
    <text x="${midX + plotW / 4}" y="${plotTop + 36}" fill="#38bdf8" font-size="14" font-weight="800" text-anchor="middle" letter-spacing="1">★ CORE DOMAIN (核心域)</text>
    <text x="${midX + plotW / 4}" y="${plotTop + 58}" fill="${isDark ? '#94a3b8' : '#64748b'}" font-size="11" text-anchor="middle">战略重心 · 核心差异壁垒 · 精英团队专属自研</text>

    <!-- Q2: 左上 (Specialized: 低复杂 + 高差异) -->
    <rect x="${plotLeft}" y="${plotTop}" width="${plotW / 2}" height="${plotH / 2}" fill="${colors.specializedBg}" stroke="${colors.gridLine}" stroke-width="1" />
    <text x="${plotLeft + plotW / 4}" y="${plotTop + 36}" fill="#10b981" font-size="13" font-weight="700" text-anchor="middle">◆ SPECIALIZED (差异化域)</text>
    <text x="${plotLeft + plotW / 4}" y="${plotTop + 58}" fill="${isDark ? '#94a3b8' : '#64748b'}" font-size="11" text-anchor="middle">高壁垒快速孵化 · 敏捷定制闭环</text>

    <!-- Q3: 左下 (Generic: 低复杂 + 低差异) -->
    <rect x="${plotLeft}" y="${midY}" width="${plotW / 2}" height="${plotH / 2}" fill="${colors.genericBg}" stroke="${colors.gridLine}" stroke-width="1" />
    <text x="${plotLeft + plotW / 4}" y="${midY + plotH / 4 + 8}" fill="#94a3b8" font-size="13" font-weight="700" text-anchor="middle">● GENERIC (通用域)</text>
    <text x="${plotLeft + plotW / 4}" y="${midY + plotH / 4 + 28}" fill="${isDark ? '#94a3b8' : '#64748b'}" font-size="11" text-anchor="middle">行业成熟方案 · 直接采购 SaaS / 开源集成</text>

    <!-- Q4: 右下 (Supporting: 高复杂 + 低差异) -->
    <rect x="${midX}" y="${midY}" width="${plotW / 2}" height="${plotH / 2}" fill="${colors.supportingBg}" stroke="${colors.gridLine}" stroke-width="1" />
    <text x="${midX + plotW / 4}" y="${midY + plotH / 4 + 8}" fill="#a78bfa" font-size="13" font-weight="700" text-anchor="middle">◆ SUPPORTING (支撑域)</text>
    <text x="${midX + plotW / 4}" y="${midY + plotH / 4 + 28}" fill="${isDark ? '#94a3b8' : '#64748b'}" font-size="11" text-anchor="middle">业务规则重型 · 外包定制 / 规则引擎沉淀</text>
  </g>\n`;

  // 3. 坐标轴与箭头
  svg += `  <g class="cdc-axes">
    <!-- X 轴 -->
    <line x1="${plotLeft}" y1="${plotTop + plotH}" x2="${plotLeft + plotW + 18}" y2="${plotTop + plotH}" stroke="${colors.axisLine}" stroke-width="2" />
    <polygon points="${plotLeft + plotW + 16},${plotTop + plotH - 5} ${plotLeft + plotW + 28},${plotTop + plotH} ${plotLeft + plotW + 16},${plotTop + plotH + 5}" fill="${colors.axisLine}" />
    <text x="${plotLeft + plotW / 2}" y="${plotTop + plotH + 34}" fill="${colors.axisText}" font-size="12" font-weight="700" text-anchor="middle">业务模型与算法复杂度 (Complexity 0 → 100%)</text>

    <!-- Y 轴 -->
    <line x1="${plotLeft}" y1="${plotTop + plotH}" x2="${plotLeft}" y2="${plotTop - 18}" stroke="${colors.axisLine}" stroke-width="2" />
    <polygon points="${plotLeft - 5},${plotTop - 16} ${plotLeft},${plotTop - 28} ${plotLeft + 5},${plotTop - 16}" fill="${colors.axisLine}" />
    <text x="32" y="${plotTop + plotH / 2}" fill="${colors.axisText}" font-size="12" font-weight="700" text-anchor="middle" transform="rotate(-90 32 ${plotTop + plotH / 2})">商业差异化竞争力壁垒 (Differentiation 0 → 100%)</text>
  </g>\n`;

  // 4. 绘制领域气泡节点与演进箭头
  domains.forEach((dom, idx) => {
    const px = toPlotX(dom.complexity);
    const py = toPlotY(dom.differentiation);
    const isStepActive = currentStep === idx;
    const isStepFuture = currentStep >= 0 && idx > currentStep;
    const opacity = isStepFuture ? 0.22 : 1;

    const badgeColor = dom.subdomain === 'core' ? '#0ea5e9' : dom.subdomain === 'supporting' ? '#8b5cf6' : '#64748b';
    const bubbleBg = dom.subdomain === 'core' ? (isDark ? '#0284c7' : '#e0f2fe') : dom.subdomain === 'supporting' ? (isDark ? '#6d28d9' : '#ede9fe') : (isDark ? '#334155' : '#f1f5f9');
    const bubbleText = dom.subdomain === 'core' ? (isDark ? '#ffffff' : '#0369a1') : dom.subdomain === 'supporting' ? (isDark ? '#ffffff' : '#5b21b6') : (isDark ? '#f8fafc' : '#334155');

    // 演进轨迹箭头
    if (dom.evolutionTo) {
      const epx = toPlotX(dom.evolutionTo.complexity);
      const epy = toPlotY(dom.evolutionTo.differentiation);
      svg += `  <g class="cdc-evolution" opacity="${opacity}">
    <path d="M ${px} ${py} Q ${(px + epx) / 2 + 18} ${(py + epy) / 2 - 24} ${epx} ${epy}" fill="none" stroke="#38bdf8" stroke-width="2" stroke-dasharray="6,4" marker-end="url(#cdc-arrow-evo)" />
    ${
      dom.evolutionTo.note
        ? `<text x="${(px + epx) / 2 + 22}" y="${(py + epy) / 2 - 30}" fill="#38bdf8" font-size="10.5" font-weight="600">${escapeXml(
            dom.evolutionTo.note
          )}</text>`
        : ''
    }
  </g>\n`;
    }

    const cardW = Math.max(136, Math.min(220, dom.name.length * 13 + 32));
    const cardH = dom.investment || dom.team ? 54 : 38;

    svg += `  <g class="cdc-domain-bubble" id="${escapeXml(dom.id)}" opacity="${opacity}" transform="translate(${px}, ${py})" filter="${
      isStepActive ? 'url(#cdc-glow)' : 'url(#cdc-shadow)'
    }">
    <!-- 中心指示光圈 -->
    <circle cx="0" cy="0" r="8" fill="${badgeColor}" stroke="#ffffff" stroke-width="2" />
    
    <!-- 悬浮说明卡片 (偏移防遮挡) -->
    <g transform="translate(12, -${cardH / 2})">
      <rect x="0" y="0" width="${cardW}" height="${cardH}" rx="8" fill="${bubbleBg}" stroke="${badgeColor}" stroke-width="1.4" opacity="0.96" />
      <text x="12" y="20" fill="${bubbleText}" font-size="12" font-weight="700">${escapeXml(dom.name)}</text>
      ${
        dom.investment || dom.team
          ? `<text x="12" y="38" fill="${isDark ? '#cbd5e1' : '#475569'}" font-size="10" font-weight="500">${escapeXml(
              [dom.investment ? `策略: ${dom.investment}` : '', dom.team ? `团队: ${dom.team}` : ''].filter(Boolean).join(' · ')
            )}</text>`
          : ''
      }
    </g>
  </g>\n`;
  });

  // 5. 底部图例栏
  const legendY = vh - 48;
  svg += `  <g class="cdc-legend" transform="translate(36, ${legendY})">
    <rect x="0" y="0" width="${vw - 72}" height="36" rx="8" fill="${isDark ? '#0f172a' : '#f1f5f9'}" stroke="${
    isDark ? '#1e293b' : '#cbd5e1'
  }" stroke-width="1.2" />
    <text x="24" y="23" fill="#38bdf8" font-size="11.5" font-weight="700">★ Core 核心域 (高壁垒+高复杂)</text>
    <text x="260" y="23" fill="#a78bfa" font-size="11.5" font-weight="700">◆ Supporting 支撑域 (高复杂规则)</text>
    <text x="500" y="23" fill="#94a3b8" font-size="11.5" font-weight="700">● Generic 通用域 (SaaS采购)</text>
    <text x="710" y="23" fill="#10b981" font-size="11.5" font-weight="700">◆ Specialized 差异专属域</text>
  </g>\n</svg>`;

  return svg;
}

// ============================================================
// 5. 解析与渲染：限界上下文战略画布 (Bounded Context Canvas)
// ============================================================
export function parseContextCanvasDsl(dsl: string): {
  title: string;
  description: string;
  spec: ContextCanvasSpec;
} {
  let contextName = '核心限界上下文 (Bounded Context)';
  let classification: SubdomainType | string = 'core';
  let team = '';
  let description = '';
  const language: ContextCanvasLanguageTerm[] = [];
  const inboundCommands: string[] = [];
  const inboundEvents: string[] = [];
  const inboundQueries: string[] = [];
  const decisions: string[] = [];
  const outboundEvents: string[] = [];
  const outboundDeps: string[] = [];

  const lines = dsl.split('\n');
  let currentSection: 'header' | 'language' | 'inbound' | 'decisions' | 'outbound' = 'header';
  let inboundSub: 'commands' | 'events' | 'queries' = 'commands';
  let outboundSub: 'events' | 'dependencies' = 'events';

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || line.startsWith('//')) continue;
    if (/^(?:mode|type|view)\s*:/i.test(line)) continue;

    const titleMatch = line.match(/^(?:title|name|context)\s*:\s*(.+)$/i);
    if (titleMatch) {
      contextName = titleMatch[1].trim();
      continue;
    }

    const classMatch = line.match(/^classification\s*:\s*(.+)$/i);
    if (classMatch) {
      classification = classMatch[1].toLowerCase().includes('supporting')
        ? 'supporting'
        : classMatch[1].toLowerCase().includes('generic')
        ? 'generic'
        : 'core';
      continue;
    }

    const teamMatch = line.match(/^(?:team|owner)\s*:\s*(.+)$/i);
    if (teamMatch) {
      team = teamMatch[1].trim();
      continue;
    }

    const descMatch = line.match(/^(?:description|mission|desc)\s*:\s*(.+)$/i);
    if (descMatch) {
      description = descMatch[1].trim();
      continue;
    }

    // 区域识别
    if (/^(?:language|ubiquitous-?language|terms|词汇表)\s*:/i.test(line)) {
      currentSection = 'language';
      continue;
    }
    if (/^inbound\s*:/i.test(line)) {
      currentSection = 'inbound';
      inboundSub = 'commands';
      continue;
    }
    if (/^(?:decisions|rules|invariants|规则)\s*:/i.test(line)) {
      currentSection = 'decisions';
      continue;
    }
    if (/^outbound\s*:/i.test(line)) {
      currentSection = 'outbound';
      outboundSub = 'events';
      continue;
    }

    // 行内解析
    if (currentSection === 'inbound') {
      const cmdMatch = line.match(/^(?:commands?|命令)\s*:(.*)$/i);
      if (cmdMatch) {
        inboundSub = 'commands';
        const val = cmdMatch[1].trim();
        if (val) {
          val.split(/[,，、]/).forEach(s => s.trim() && inboundCommands.push(s.trim()));
        }
        continue;
      }
      const evtMatch = line.match(/^(?:events?|事件)\s*:(.*)$/i);
      if (evtMatch) {
        inboundSub = 'events';
        const val = evtMatch[1].trim();
        if (val) {
          val.split(/[,，、]/).forEach(s => s.trim() && inboundEvents.push(s.trim()));
        }
        continue;
      }
      const qryMatch = line.match(/^(?:queries?|查询)\s*:(.*)$/i);
      if (qryMatch) {
        inboundSub = 'queries';
        const val = qryMatch[1].trim();
        if (val) {
          val.split(/[,，、]/).forEach(s => s.trim() && inboundQueries.push(s.trim()));
        }
        continue;
      }
      if (line.startsWith('-') || line.startsWith('*')) {
        const item = line.replace(/^[-*]\s*/, '').trim();
        if (inboundSub === 'commands') inboundCommands.push(item);
        else if (inboundSub === 'events') inboundEvents.push(item);
        else if (inboundSub === 'queries') inboundQueries.push(item);
      }
    } else if (currentSection === 'outbound') {
      const evtMatch = line.match(/^(?:events?|事件)\s*:(.*)$/i);
      if (evtMatch) {
        outboundSub = 'events';
        const val = evtMatch[1].trim();
        if (val) {
          val.split(/[,，、]/).forEach(s => s.trim() && outboundEvents.push(s.trim()));
        }
        continue;
      }
      const depMatch = line.match(/^(?:dependencies|deps|依赖)\s*:(.*)$/i);
      if (depMatch) {
        outboundSub = 'dependencies';
        const val = depMatch[1].trim();
        if (val) {
          val.split(/[,，、]/).forEach(s => s.trim() && outboundDeps.push(s.trim()));
        }
        continue;
      }
      if (line.startsWith('-') || line.startsWith('*')) {
        const item = line.replace(/^[-*]\s*/, '').trim();
        if (outboundSub === 'events') outboundEvents.push(item);
        else if (outboundSub === 'dependencies') outboundDeps.push(item);
      }
    } else if (currentSection === 'language' && (line.startsWith('-') || line.startsWith('*'))) {
      const clean = line.replace(/^[-*]\s*/, '').trim();
      const m = clean.match(/^(.+?)\s*[:：]\s*(.+)$/);
      if (m) {
        language.push({ term: m[1].trim(), definition: m[2].trim() });
      } else {
        language.push({ term: clean, definition: '' });
      }
    } else if (currentSection === 'decisions' && (line.startsWith('-') || line.startsWith('*'))) {
      decisions.push(line.replace(/^[-*]\s*/, '').trim());
    }
  }

  return {
    title: `${contextName} 战略画布`,
    description,
    spec: {
      contextName,
      classification,
      team,
      description,
      language,
      inbound: {
        commands: inboundCommands,
        events: inboundEvents,
        queries: inboundQueries,
      },
      decisions,
      outbound: {
        events: outboundEvents,
        dependencies: outboundDeps,
      },
    },
  };
}

export function renderContextCanvasToSvg(
  spec: ContextCanvasSpec,
  info?: { name?: string; description?: string },
  options: DddRenderOptions = {}
): string {
  const { currentStep = -1, isDark = true, theme } = options;
  const palette = resolveDddPalette(theme, isDark);

  const vw = 1060;
  const vh = 680;
  const headerH = 110;
  const colY = headerH + 20;
  const colH = vh - colY - 40;

  const col1W = 296;
  const col2W = 408;
  const col3W = 296;
  const gap = 16;
  const col1X = 20;
  const col2X = col1X + col1W + gap;
  const col3X = col2X + col2W + gap;

  const colors = isDark
    ? {
        bg: palette.bg,
        cardBg: palette.cardBg,
        cardBorder: palette.cardBorder,
        title: palette.title,
        subtitle: palette.subtitle,
        inboundHeader: '#0369a1',
        heartHeader: '#5b21b6',
        outboundHeader: '#047857',
        badgeBorder: palette.accent,
        boxBg: palette.boxBg,
      }
    : {
        bg: palette.bg,
        cardBg: palette.cardBg,
        cardBorder: palette.cardBorder,
        title: palette.title,
        subtitle: palette.subtitle,
        inboundHeader: '#0284c7',
        heartHeader: '#6d28d9',
        outboundHeader: '#059669',
        badgeBorder: palette.accent,
        boxBg: palette.boxBg,
      };

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vw} ${vh}" width="${vw}" height="${vh}" class="ov-domain-story-svg ov-ddd-context-canvas" style="background-color: transparent; max-width: 100%; height: auto; user-select: none; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">\n`;

  svg += `  <defs>
    <filter id="bcc-shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="4" stdDeviation="5" flood-color="#000000" flood-opacity="${isDark ? '0.45' : '0.12'}" />
    </filter>
    <filter id="bcc-glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="6" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>\n`;

  // 1. 顶部 Header 状态栏
  svg += `  <g class="bcc-header">
    <rect x="20" y="16" width="${vw - 40}" height="${headerH - 24}" rx="14" fill="${colors.cardBg}" stroke="${colors.cardBorder}" stroke-width="1.4" filter="url(#bcc-shadow)" />
    <text x="44" y="52" fill="${colors.title}" font-size="20" font-weight="700">📋 ${escapeXml(spec.contextName)}</text>
    
    <!-- 分类标签 -->
    <rect x="44" y="66" width="130" height="24" rx="6" fill="#0284c7" />
    <text x="109" y="82" fill="#ffffff" font-size="11" font-weight="700" text-anchor="middle">★ ${String(spec.classification).toUpperCase()} DOMAIN</text>

    ${
      spec.team
        ? `<text x="194" y="82" fill="${colors.subtitle}" font-size="12" font-weight="600">👥 负责人/团队: ${escapeXml(spec.team)}</text>`
        : ''
    }

    ${
      spec.description
        ? `<text x="${vw - 56}" y="62" fill="${colors.subtitle}" font-size="12" text-anchor="end">${escapeXml(truncateLabel(spec.description, 45))}</text>`
        : ''
    }
  </g>\n`;

  // 2. Column 1: Inbound Communication (📥 输入通信)
  const isCol1Active = currentStep === 0;
  svg += `  <!-- Column 1: Inbound Communication -->
  <g class="bcc-col-inbound" transform="translate(${col1X}, ${colY})" filter="${isCol1Active ? 'url(#bcc-glow)' : 'url(#bcc-shadow)'}">
    <rect x="0" y="0" width="${col1W}" height="${colH}" rx="14" fill="${colors.cardBg}" stroke="${isCol1Active ? '#38bdf8' : colors.cardBorder}" stroke-width="${isCol1Active ? '2.5' : '1.4'}" />
    <rect x="0" y="0" width="${col1W}" height="36" rx="14" fill="${colors.inboundHeader}" />
    <text x="${col1W / 2}" y="23" fill="#ffffff" font-size="13" font-weight="700" text-anchor="middle">📥 INBOUND COMMUNICATION (输入通信)</text>
    
    <!-- 领域命令 Commands -->
    <text x="18" y="62" fill="#38bdf8" font-size="12" font-weight="700">⚡ 接收命令 (Commands):</text>
    ${
      spec.inbound.commands.slice(0, 5).map((cmd, i) =>
        `<g class="bcc-cmd-item">
           <title>${escapeXml(cmd)}</title>
           <rect x="18" y="${74 + i * 32}" width="${col1W - 36}" height="26" rx="6" fill="${colors.boxBg}" stroke="#0284c7" stroke-width="1" />
           <text x="28" y="${91 + i * 32}" fill="${colors.title}" font-size="11" font-weight="600">${escapeXml(truncateLabel(cmd, 26))}</text>
         </g>`
      ).join('\n    ')
    }

    <!-- 订阅事件 Events -->
    <text x="18" y="252" fill="#f59e0b" font-size="12" font-weight="700">🔔 订阅外部事件 (Events):</text>
    ${
      spec.inbound.events.slice(0, 4).map((evt, i) =>
        `<g class="bcc-evt-item">
           <title>${escapeXml(evt)}</title>
           <rect x="18" y="${264 + i * 32}" width="${col1W - 36}" height="26" rx="6" fill="${colors.boxBg}" stroke="#ea580c" stroke-width="1" />
           <text x="28" y="${281 + i * 32}" fill="${colors.title}" font-size="11" font-weight="600">${escapeXml(truncateLabel(evt, 26))}</text>
         </g>`
      ).join('\n    ')
    }

    <!-- 查询 Queries -->
    <text x="18" y="412" fill="#10b981" font-size="12" font-weight="700">🔍 提供查询视图 (Queries):</text>
    ${
      spec.inbound.queries.slice(0, 3).map((qry, i) =>
        `<g class="bcc-qry-item">
           <title>${escapeXml(qry)}</title>
           <rect x="18" y="${424 + i * 32}" width="${col1W - 36}" height="26" rx="6" fill="${colors.boxBg}" stroke="#059669" stroke-width="1" />
           <text x="28" y="${441 + i * 32}" fill="${colors.title}" font-size="11" font-weight="600">${escapeXml(truncateLabel(qry, 26))}</text>
         </g>`
      ).join('\n    ')
    }
  </g>\n`;

  // 3. Column 2: Strategic Heart (💡 核心决策与统一语言)
  const isCol2Active = currentStep === 1;
  svg += `  <!-- Column 2: Strategic Heart -->
  <g class="bcc-col-heart" transform="translate(${col2X}, ${colY})" filter="${isCol2Active ? 'url(#bcc-glow)' : 'url(#bcc-shadow)'}">
    <rect x="0" y="0" width="${col2W}" height="${colH}" rx="14" fill="${colors.cardBg}" stroke="${isCol2Active ? '#a78bfa' : colors.cardBorder}" stroke-width="${isCol2Active ? '2.5' : '1.4'}" />
    <rect x="0" y="0" width="${col2W}" height="36" rx="14" fill="${colors.heartHeader}" />
    <text x="${col2W / 2}" y="23" fill="#ffffff" font-size="13" font-weight="700" text-anchor="middle">💡 STRATEGIC HEART (核心决策与统一语言)</text>

    <!-- 统一语言词汇表 -->
    <text x="18" y="62" fill="#c084fc" font-size="12" font-weight="700">📖 统一语言词汇表 (Ubiquitous Language):</text>
    ${
      spec.language.slice(0, 4).map((lang, i) =>
        `<g class="bcc-lang-item">
           <title>${escapeXml(lang.term)}: ${escapeXml(lang.definition)}</title>
           <rect x="18" y="${74 + i * 48}" width="${col2W - 36}" height="42" rx="8" fill="${colors.boxBg}" stroke="#7c3aed" stroke-width="1" />
           <text x="28" y="${92 + i * 48}" fill="#a78bfa" font-size="11.5" font-weight="700">${escapeXml(lang.term)}</text>
           <text x="28" y="${108 + i * 48}" fill="${colors.subtitle}" font-size="10.5">${escapeXml(truncateLabel(lang.definition, 28))}</text>
         </g>`
      ).join('\n    ')
    }

    <!-- 核心业务决策与不变式规则 -->
    <text x="18" y="286" fill="#facc15" font-size="12" font-weight="700">⚖️ 核心业务决策与不变式 (Business Decisions):</text>
    ${
      spec.decisions.slice(0, 4).map((dec, i) =>
        `<g class="bcc-dec-item">
           <title>${escapeXml(dec)}</title>
           <rect x="18" y="${298 + i * 48}" width="${col2W - 36}" height="42" rx="8" fill="${colors.boxBg}" stroke="#ca8a04" stroke-width="1" />
           <text x="28" y="${324 + i * 48}" fill="${colors.title}" font-size="11" font-weight="600">✓ ${escapeXml(truncateLabel(dec, 26))}</text>
         </g>`
      ).join('\n    ')
    }
  </g>\n`;

  // 4. Column 3: Outbound Communication (📤 输出依赖)
  const isCol3Active = currentStep === 2;
  svg += `  <!-- Column 3: Outbound Communication -->
  <g class="bcc-col-outbound" transform="translate(${col3X}, ${colY})" filter="${isCol3Active ? 'url(#bcc-glow)' : 'url(#bcc-shadow)'}">
    <rect x="0" y="0" width="${col3W}" height="${colH}" rx="14" fill="${colors.cardBg}" stroke="${isCol3Active ? '#34d399' : colors.cardBorder}" stroke-width="${isCol3Active ? '2.5' : '1.4'}" />
    <rect x="0" y="0" width="${col3W}" height="36" rx="14" fill="${colors.outboundHeader}" />
    <text x="${col3W / 2}" y="23" fill="#ffffff" font-size="13" font-weight="700" text-anchor="middle">📤 OUTBOUND COMMUNICATION (输出通信)</text>

    <!-- 发布领域事件 -->
    <text x="18" y="62" fill="#34d399" font-size="12" font-weight="700">🔔 对外发布事件 (Domain Events):</text>
    ${
      spec.outbound.events.slice(0, 5).map((evt, i) =>
        `<g class="bcc-out-evt-item">
           <title>${escapeXml(evt)}</title>
           <rect x="18" y="${74 + i * 32}" width="${col3W - 36}" height="26" rx="6" fill="${colors.boxBg}" stroke="#059669" stroke-width="1" />
           <text x="28" y="${91 + i * 32}" fill="${colors.title}" font-size="11" font-weight="600">${escapeXml(truncateLabel(evt, 26))}</text>
         </g>`
      ).join('\n    ')
    }

    <!-- 外部依赖关系 -->
    <text x="18" y="262" fill="#fb923c" font-size="12" font-weight="700">🔗 外部系统与上下文依赖 (Dependencies):</text>
    ${
      spec.outbound.dependencies.slice(0, 5).map((dep, i) =>
        `<g class="bcc-out-dep-item">
           <title>${escapeXml(dep)}</title>
           <rect x="18" y="${274 + i * 36}" width="${col3W - 36}" height="30" rx="6" fill="${colors.boxBg}" stroke="#ea580c" stroke-width="1" />
           <text x="28" y="${293 + i * 36}" fill="${colors.title}" font-size="11" font-weight="600">🛡️ ${escapeXml(truncateLabel(dep, 26))}</text>
         </g>`
      ).join('\n    ')
    }
  </g>\n</svg>`;

  return svg;
}

/**
 * 将 DDD 各视图步骤提取为 DiagramStep[]，赋能 DiagramStepPlayer 逐帧回放
 */
export function extractDddSteps(
  mode: DddDiagramMode,
  eventStorming?: EventStormingSpec,
  contextMap?: ContextMapSpec,
  coreDomainChart?: CoreDomainChartSpec,
  contextCanvas?: ContextCanvasSpec
): DiagramStep[] {
  if (mode === 'event-storming' && eventStorming) {
    return eventStorming.flows.map((flow, index) => {
      const chainText = flow.nodes.map(n => n.name).join(' -> ');
      const firstNode = flow.nodes[0]?.name || '触发源';
      const lastNode = flow.nodes[flow.nodes.length - 1]?.name || '领域结果';
      const hsNote = flow.hotspots.length > 0 ? ` (🔥 痛点: ${flow.hotspots.join('; ')})` : '';
      return {
        index,
        id: flow.id,
        type: 'message',
        from: firstNode,
        to: lastNode,
        label: `#${flow.number} ${chainText}`,
        rawLine: chainText,
        lineNumber: flow.number,
        description: `事件风暴因果流 #${flow.number}: ${chainText}${hsNote}`,
        arrowType: '->',
      };
    });
  }

  if (mode === 'context-map' && contextMap) {
    const ctxNameMap = new Map<string, string>();
    contextMap.contexts.forEach(c => ctxNameMap.set(c.id, c.name));
    return contextMap.relationships.map((rel, index) => {
      const fromName = ctxNameMap.get(rel.from) || rel.from;
      const toName = ctxNameMap.get(rel.to) || rel.to;
      const up = rel.upstreamPattern ? `[${rel.upstreamPattern}]` : '';
      const down = rel.downstreamPattern ? `[${rel.downstreamPattern}]` : '';
      const label = `${rel.number}. ${fromName} ${up} ${rel.isAsync ? '->>' : '->'} ${toName} ${down} : ${rel.label}`;
      return {
        index,
        id: rel.id,
        type: 'message',
        from: fromName,
        to: toName,
        label,
        rawLine: label,
        lineNumber: rel.number,
        description: `上下文映射 #${rel.number}: ${fromName} ${up} 与 ${toName} ${down} 通过「${rel.label}」协同`,
        arrowType: rel.isAsync ? '-->>' : '->',
      };
    });
  }

  if (mode === 'core-domain-chart' && coreDomainChart) {
    return coreDomainChart.domains.map((dom, index) => ({
      index,
      id: dom.id,
      type: 'message',
      from: dom.name,
      to: `${dom.subdomain.toUpperCase()} DOMAIN`,
      label: `${index + 1}. ${dom.name} [${dom.subdomain}]`,
      rawLine: dom.name,
      lineNumber: index + 1,
      description: `战略子域 #${index + 1}: ${dom.name} (复杂度 ${dom.complexity}%, 差异化 ${dom.differentiation}%, 策略: ${dom.investment || '自研'})`,
      arrowType: '->',
    }));
  }

  if (mode === 'context-canvas' && contextCanvas) {
    return [
      {
        index: 0,
        id: 'step-inbound',
        type: 'message',
        from: '外部系统/调用方',
        to: contextCanvas.contextName,
        label: '1. Inbound Communication (输入通信契约)',
        rawLine: 'Inbound',
        lineNumber: 1,
        description: `${contextCanvas.contextName} 接收 ${contextCanvas.inbound.commands.length} 项命令、订阅 ${contextCanvas.inbound.events.length} 项事件并提供 ${contextCanvas.inbound.queries.length} 项读查询`,
        arrowType: '->',
      },
      {
        index: 1,
        id: 'step-heart',
        type: 'message',
        from: contextCanvas.contextName,
        to: 'Strategic Heart',
        label: '2. Strategic Heart (核心决策与统一语言)',
        rawLine: 'Heart',
        lineNumber: 2,
        description: `核心业务决策规则 ${contextCanvas.decisions.length} 条，统一语言词汇 ${contextCanvas.language.length} 项`,
        arrowType: '->',
      },
      {
        index: 2,
        id: 'step-outbound',
        type: 'message',
        from: contextCanvas.contextName,
        to: '下游上下文',
        label: '3. Outbound Communication (对外发布与依赖)',
        rawLine: 'Outbound',
        lineNumber: 3,
        description: `对外发布 ${contextCanvas.outbound.events.length} 项领域事件，向下游依赖 ${contextCanvas.outbound.dependencies.length} 个外部上下文`,
        arrowType: '->',
      },
    ];
  }

  return [];
}
