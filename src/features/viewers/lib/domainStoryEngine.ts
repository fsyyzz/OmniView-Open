/**
 * OmniView 领域故事讲授法核心引擎 (Domain Storytelling Engine)
 * 纯本地优先、零网络依赖、MIT 兼容实现
 * 兼容 WPS egon.io 官方标准 .dst (JSON) 格式、.egn 扩展及 Markdown story/domainstory DSL 语法
 * 支持自动拓扑布局、矢量 SVG 渲染、DiagramStepPlayer 逐帧步进播放与 Polyglot SVG 导出
 */

import type { DiagramStep } from './diagramPlaybackEngine.ts';
import type {
  DddDiagramMode,
  EventStormingSpec,
  ContextMapSpec,
  CoreDomainItem,
  CoreDomainChartSpec,
  ContextCanvasLanguageTerm,
  ContextCanvasSpec,
} from './dddModelingEngine.ts';
import {
  detectDddMode,
  parseEventStormingDsl,
  parseContextMapDsl,
  parseCoreDomainChartDsl,
  parseContextCanvasDsl,
  renderEventStormingToSvg,
  renderContextMapToSvg,
  renderCoreDomainChartToSvg,
  renderContextCanvasToSvg,
  extractDddSteps,
} from './dddModelingEngine.ts';

export type {
  DddDiagramMode,
  StickyNoteKind,
  EventStormingNode,
  EventStormingFlow,
  EventStormingSpec,
  SubdomainType,
  BoundedContextNode,
  ContextRelationship,
  ContextMapSpec,
  CoreDomainItem,
  CoreDomainChartSpec,
  ContextCanvasLanguageTerm,
  ContextCanvasSpec,
} from './dddModelingEngine.ts';
export {
  detectDddMode,
  parseEventStormingDsl,
  parseContextMapDsl,
  parseCoreDomainChartDsl,
  parseContextCanvasDsl,
  renderEventStormingToSvg,
  renderContextMapToSvg,
  renderCoreDomainChartToSvg,
  renderContextCanvasToSvg,
} from './dddModelingEngine.ts';

export interface DomainStoryActor {
  id: string;
  name: string;
  type: 'person' | 'system' | 'group' | 'database' | string;
  x?: number;
  y?: number;
}

export interface DomainStoryWorkObject {
  id: string;
  name: string;
  type: 'document' | 'email' | 'call' | 'data' | 'folder' | 'package' | 'money' | string;
}

export interface DomainStoryActivity {
  id: string;
  number: number;
  from: string; // Actor ID
  to: string;   // Actor ID
  label: string; // 动作描述，如 "提交", "校验", "派发"
  workObjectId?: string;
  workObjectName?: string;
  workObjectType?: string;
}

export interface DomainStoryGroup {
  id: string;
  name: string;
  actors: string[];
}

export interface DomainStoryModel {
  mode?: DddDiagramMode;
  info?: {
    name?: string;
    description?: string;
    version?: string;
  };
  actors: DomainStoryActor[];
  workObjects: DomainStoryWorkObject[];
  activities: DomainStoryActivity[];
  groups?: DomainStoryGroup[];
  eventStorming?: EventStormingSpec;
  contextMap?: ContextMapSpec;
  coreDomainChart?: CoreDomainChartSpec;
  contextCanvas?: ContextCanvasSpec;
}

/**
 * 转义 XML / SVG 实体字符，杜绝 XSS 与格式破损
 */
export function escapeXml(str?: string): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * 解析 Domain Story（自适应 egon.io .egn JSON 与文本 DSL）
 */
export function parseDomainStory(input: string): DomainStoryModel {
  if (!input || typeof input !== 'string') {
    return { mode: 'domain-story', actors: [], workObjects: [], activities: [] };
  }

  const trimmed = input.trim();

  // 1. 尝试作为 JSON (.egn / .dst / .ddd 原生格式) 解析
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      return normalizeJsonModel(parsed);
    } catch {
      // 容错降级到 DSL 解析
    }
  }

  // 2. 自动识别 DDD 视图模式 (Domain Story / Event Storming / Context Map / Core Domain / Context Canvas)
  const detectedMode = detectDddMode(trimmed);
  if (detectedMode === 'event-storming') {
    const es = parseEventStormingDsl(trimmed);
    return {
      mode: 'event-storming',
      info: { name: es.title, description: es.description, version: '1.0' },
      actors: [],
      workObjects: [],
      activities: [],
      eventStorming: es.spec,
    };
  }

  if (detectedMode === 'context-map') {
    const cm = parseContextMapDsl(trimmed);
    return {
      mode: 'context-map',
      info: { name: cm.title, description: cm.description, version: '1.0' },
      actors: [],
      workObjects: [],
      activities: [],
      contextMap: cm.spec,
    };
  }

  if (detectedMode === 'core-domain-chart') {
    const cdc = parseCoreDomainChartDsl(trimmed);
    return {
      mode: 'core-domain-chart',
      info: { name: cdc.title, description: cdc.description, version: '1.0' },
      actors: [],
      workObjects: [],
      activities: [],
      coreDomainChart: cdc.spec,
    };
  }

  if (detectedMode === 'context-canvas') {
    const cc = parseContextCanvasDsl(trimmed);
    return {
      mode: 'context-canvas',
      info: { name: cc.title, description: cc.description, version: '1.0' },
      actors: [],
      workObjects: [],
      activities: [],
      contextCanvas: cc.spec,
    };
  }

  // 3. 作为领域故事文本 DSL 解析
  return parseDomainStoryDsl(trimmed);
}

/**
 * 归一化 JSON 格式（支持官方 egon.io 模型、Event Storming JSON 与 Context Map JSON）
 */
function normalizeJsonModel(json: any): DomainStoryModel {
  const root = json.model || json;
  const rawInfo = root.info || json.info || {};
  const info = {
    name: rawInfo.name || rawInfo.title || 'Domain Story',
    description: rawInfo.description || '',
    version: rawInfo.version || '1.0',
  };

  if (root.mode === 'event-storming' || root.eventStorming || Array.isArray(root.flows)) {
    const spec: EventStormingSpec = root.eventStorming || {
      context: root.context,
      flows: Array.isArray(root.flows) ? root.flows : [],
    };
    return {
      mode: 'event-storming',
      info,
      actors: [],
      workObjects: [],
      activities: [],
      eventStorming: spec,
    };
  }

  if (root.mode === 'context-map' || root.contextMap || Array.isArray(root.contexts)) {
    const spec: ContextMapSpec = root.contextMap || {
      contexts: Array.isArray(root.contexts) ? root.contexts : [],
      relationships: Array.isArray(root.relationships) ? root.relationships : [],
    };
    return {
      mode: 'context-map',
      info,
      actors: [],
      workObjects: [],
      activities: [],
      contextMap: spec,
    };
  }

  if (root.mode === 'core-domain-chart' || root.coreDomainChart || Array.isArray(root.domains)) {
    const spec: CoreDomainChartSpec = root.coreDomainChart || {
      domains: Array.isArray(root.domains) ? root.domains : [],
    };
    return {
      mode: 'core-domain-chart',
      info,
      actors: [],
      workObjects: [],
      activities: [],
      coreDomainChart: spec,
    };
  }

  if (root.mode === 'context-canvas' || root.contextCanvas || root.contextName) {
    const spec: ContextCanvasSpec = root.contextCanvas || {
      contextName: root.contextName || info.name || 'Bounded Context',
      classification: root.classification || 'core',
      team: root.team,
      description: root.description,
      inbound: root.inbound || { commands: [], events: [], queries: [] },
      decisions: root.decisions || [],
      language: root.language || [],
      outbound: root.outbound || { events: [], dependencies: [] },
    };
    return {
      mode: 'context-canvas',
      info,
      actors: [],
      workObjects: [],
      activities: [],
      contextCanvas: spec,
    };
  }

  const actors: DomainStoryActor[] = [];
  const workObjects: DomainStoryWorkObject[] = [];
  const activities: DomainStoryActivity[] = [];
  const groups: DomainStoryGroup[] = [];

  // 兼容官方 egon.io elements 数组或分离式对象
  if (Array.isArray(root.elements)) {
    // diagram-js 风格元素数组
    for (const el of root.elements) {
      const type = (el.type || '').toLowerCase();
      if (type.includes('actor') || type.includes('person') || type.includes('system')) {
        actors.push({
          id: el.id || `actor-${actors.length + 1}`,
          name: el.name || el.businessObject?.name || el.id,
          type: type.includes('person') ? 'person' : 'system',
          x: el.x || el.bounds?.x,
          y: el.y || el.bounds?.y,
        });
      } else if (type.includes('workobject') || type.includes('object') || type.includes('document')) {
        workObjects.push({
          id: el.id || `wo-${workObjects.length + 1}`,
          name: el.name || el.businessObject?.name || el.id,
          type: 'document',
        });
      } else if (type.includes('activity')) {
        activities.push({
          id: el.id || `act-${activities.length + 1}`,
          number: el.number || activities.length + 1,
          from: el.source || el.from || '',
          to: el.target || el.to || '',
          label: el.label || el.action || '',
          workObjectId: el.workObjectId,
          workObjectName: el.workObjectName,
        });
      } else if (type.includes('group')) {
        groups.push({
          id: el.id || `group-${groups.length + 1}`,
          name: el.name || 'Group',
          actors: Array.isArray(el.actors) ? el.actors : [],
        });
      }
    }
  } else {
    // 标准分离式 JSON 结构
    if (Array.isArray(root.actors)) {
      for (const a of root.actors) {
        actors.push({
          id: String(a.id || a.name),
          name: a.name || a.id,
          type: a.type || 'person',
          x: typeof a.x === 'number' ? a.x : undefined,
          y: typeof a.y === 'number' ? a.y : undefined,
        });
      }
    }
    if (Array.isArray(root.workObjects)) {
      for (const w of root.workObjects) {
        workObjects.push({
          id: String(w.id || w.name),
          name: w.name || w.id,
          type: w.type || 'document',
        });
      }
    }
    if (Array.isArray(root.activities)) {
      let actSeq = 1;
      for (const act of root.activities) {
        activities.push({
          id: act.id || `act-${actSeq}`,
          number: typeof act.number === 'number' ? act.number : actSeq,
          from: String(act.from || ''),
          to: String(act.to || ''),
          label: act.label || act.action || '',
          workObjectId: act.workObjectId,
          workObjectName: act.workObjectName,
          workObjectType: act.workObjectType,
        });
        actSeq++;
      }
    }
    if (Array.isArray(root.groups)) {
      for (const g of root.groups) {
        groups.push({
          id: g.id || `group-${groups.length + 1}`,
          name: g.name || 'Group',
          actors: Array.isArray(g.actors) ? g.actors : [],
        });
      }
    }
  }

  // 排序活动序号
  activities.sort((a, b) => a.number - b.number);

  return { info, actors, workObjects, activities, groups };
}

/**
 * 解析文本 DSL (Markdown ```domainstory 或 ```story 代码块)
 *
 * 语法支持两种形式：
 * 1. 结构化 YAML 风格：
 * title: ...
 * actors:
 *   - 客户 [person]
 *   - 财务系统 [system]
 * activities:
 *   1. 客户 -> 提交 -> 报销单 [document] -> 财务系统
 *
 * 2. 紧凑单行流式：
 * 1. 客户 (person) -> 提交报销单 (document) -> 财务系统 (system)
 */
export function parseDomainStoryDsl(dsl: string): DomainStoryModel {
  const actorsMap = new Map<string, DomainStoryActor>();
  const workObjectsMap = new Map<string, DomainStoryWorkObject>();
  const activities: DomainStoryActivity[] = [];
  const groups: DomainStoryGroup[] = [];

  let title = 'Domain Story';
  let description = '';

  const lines = dsl.split('\n');
  let currentSection: 'header' | 'actors' | 'activities' | 'groups' = 'header';

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || line.startsWith('//')) continue;

    // 识别标题与描述
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

    // 识别与忽略 DDD 模式声明 (如 mode: domain-story / view: domainstory)
    if (/^(?:mode|view|type)\s*:/i.test(line)) {
      continue;
    }

    // 识别区域切换
    if (/^actors?\s*:/i.test(line)) {
      currentSection = 'actors';
      continue;
    }
    if (/^(?:activities|steps|actions)\s*:/i.test(line)) {
      currentSection = 'activities';
      continue;
    }
    if (/^groups?\s*:/i.test(line)) {
      currentSection = 'groups';
      continue;
    }

    // 解析 actors 列表段落
    if (currentSection === 'actors' && (line.startsWith('-') || line.startsWith('*'))) {
      const clean = line.replace(/^[-*]\s*/, '').trim();
      // 支持: 客户 [person] 或 客户 (person)
      const m = clean.match(/^(.+?)(?:\s*[\[\(]([a-zA-Z0-9_-]+)[\]\)])?$/);
      if (m) {
        const name = m[1].trim();
        const type = m[2] ? m[2].toLowerCase() : 'person';
        const id = `actor-${name.replace(/\s+/g, '_')}`;
        actorsMap.set(name, { id, name, type });
      }
      continue;
    }

    // 解析 groups 列表段落
    if (currentSection === 'groups' && (line.startsWith('-') || line.startsWith('*'))) {
      const clean = line.replace(/^[-*]\s*/, '').trim();
      // 形式: 核心域: 客户, 电商平台
      const gm = clean.match(/^(.+?)\s*:\s*(.+)$/);
      if (gm) {
        const groupName = gm[1].trim();
        const actorNames = gm[2].split(/[,，、]/).map(s => s.trim()).filter(Boolean);
        groups.push({
          id: `group-${groups.length + 1}`,
          name: groupName,
          actors: actorNames.map(n => `actor-${n.replace(/\s+/g, '_')}`),
        });
      }
      continue;
    }

    // 尝试解析 Activity 行
    // 语法 1 (4段式): 1. 客户 -> 提交 -> 订单 [document] -> 平台
    // 语法 2 (3段式): 1. 客户 (person) -> 提交订单 [document] -> 平台 (system)
    // 语法 3 (2段式): 客户 -> 平台
    if (line.includes('->')) {
      let stepNum = activities.length + 1;
      let lineWithoutNum = line;

      const numMatch = line.match(/^(\d+)[\.\、\:\s]\s*(.+)$/);
      if (numMatch) {
        stepNum = parseInt(numMatch[1], 10);
        lineWithoutNum = numMatch[2].trim();
      }

      const segments = lineWithoutNum.split(/\s*->\s*/).map(s => s.trim()).filter(Boolean);

      if (segments.length >= 2) {
        const rawFrom = segments[0];
        const rawTo = segments[segments.length - 1];

        // 解析 From Actor
        const fromParsed = parseActorToken(rawFrom);
        if (!actorsMap.has(fromParsed.name)) {
          actorsMap.set(fromParsed.name, fromParsed);
        }
        const fromActor = actorsMap.get(fromParsed.name)!;

        // 解析 To Actor
        const toParsed = parseActorToken(rawTo);
        if (!actorsMap.has(toParsed.name)) {
          actorsMap.set(toParsed.name, toParsed);
        }
        const toActor = actorsMap.get(toParsed.name)!;

        let label = '流转';
        let workObjectName = '';
        let workObjectType = 'document';

        if (segments.length === 4) {
          // 4段式: From -> Action -> WorkObject -> To
          label = segments[1];
          const woToken = segments[2];
          const woParsed = parseWorkObjectToken(woToken);
          workObjectName = woParsed.name;
          workObjectType = woParsed.type;
        } else if (segments.length === 3) {
          // 3段式: From -> Action & WorkObject -> To
          const middle = segments[1];
          const woParsed = parseWorkObjectToken(middle);
          label = woParsed.action || woParsed.name;
          workObjectName = woParsed.name;
          workObjectType = woParsed.type;
        } else {
          // 2段式: From -> To
          label = '协作';
          workObjectName = '业务指令';
        }

        if (!workObjectName) {
          workObjectName = `${label}凭据`;
        }

        const woId = `wo-${workObjectName.replace(/\s+/g, '_')}`;
        if (!workObjectsMap.has(workObjectName)) {
          workObjectsMap.set(workObjectName, {
            id: woId,
            name: workObjectName,
            type: workObjectType,
          });
        }

        activities.push({
          id: `act-${stepNum}`,
          number: stepNum,
          from: fromActor.id,
          to: toActor.id,
          label,
          workObjectId: woId,
          workObjectName,
          workObjectType,
        });
      }
    }
  }

  // 排序 activities
  activities.sort((a, b) => a.number - b.number);

  return {
    mode: 'domain-story',
    info: { name: title, description },
    actors: Array.from(actorsMap.values()),
    workObjects: Array.from(workObjectsMap.values()),
    activities,
    groups,
  };
}

function parseActorToken(token: string): DomainStoryActor {
  // 解析 "客户 [person]" 或 "ERP系统 (system)"
  const m = token.match(/^(.+?)(?:\s*[\[\(]([a-zA-Z0-9_-]+)[\]\)])?$/);
  const name = m ? m[1].trim() : token.trim();
  let type = m && m[2] ? m[2].toLowerCase() : 'person';

  if (/系统|服务|平台|system|server|api|db|中台|网关/i.test(name)) {
    type = 'system';
  } else if (/组|部门|团队|group|team/i.test(name)) {
    type = 'group';
  }

  return {
    id: `actor-${name.replace(/\s+/g, '_')}`,
    name,
    type,
  };
}

function parseWorkObjectToken(token: string): { name: string; type: string; action?: string } {
  // 支持: "差旅报销单 [document]" 或 "提交订单 (单据)" 或 "采购单"
  const m = token.match(/^(.+?)(?:\s*[\[\(]([a-zA-Z0-9_\u4e00-\u9fa5]+)[\]\)])?$/);
  const text = m ? m[1].trim() : token.trim();
  const extra = m && m[2] ? m[2].trim() : '';

  let name = text;
  let action: string | undefined = undefined;
  let type = 'document';

  const parts = text.split(/\s+/);
  if (parts.length >= 2) {
    action = parts[0];
    name = parts.slice(1).join(' ');
  }

  if (extra) {
    const lower = extra.toLowerCase();
    if (['document', 'email', 'call', 'data', 'package', 'money', 'folder'].includes(lower)) {
      type = lower;
    } else {
      name = extra;
    }
  }

  return { name, type, action };
}

/**
 * 自动计算优雅的拓扑布局坐标（若未自带坐标）
 * 支持 Group 业务中枢聚类感知、无交叉分层与动态防重叠
 */
export function computeAutoLayout(model: DomainStoryModel): DomainStoryModel {
  const actors = model.actors.map(a => ({ ...a }));
  const hasCoords = actors.length > 0 && actors.every(a => typeof a.x === 'number' && typeof a.y === 'number');

  if (hasCoords) {
    return model;
  }

  const count = actors.length;
  if (count === 0) return model;

  // 1. 优先检测是否包含 Groups 业务中枢分组
  const hasGroups = Array.isArray(model.groups) && model.groups.length > 0 && model.groups.some(g => g.actors && g.actors.length > 0);

  if (hasGroups) {
    const groupActorIds = new Set<string>();
    model.groups!.forEach(g => {
      (g.actors || []).forEach(nameOrId => {
        const matched = actors.find(a => a.id === nameOrId || a.name === nameOrId);
        if (matched) groupActorIds.add(matched.id);
      });
    });

    const internalActors = actors.filter(a => groupActorIds.has(a.id));
    const externalActors = actors.filter(a => !groupActorIds.has(a.id));

    // 如果同时存在内部中枢 Group 和外部角色（典型的 DDD 业务协同全景）
    if (internalActors.length > 0 && externalActors.length > 0) {
      // 内部 group 角色在中轴区域垂直清晰对齐
      const centerX = 680;
      const startY = 220;
      const internalSpacingY = 340;

      internalActors.forEach((a, idx) => {
        a.x = centerX;
        a.y = startY + idx * internalSpacingY;
      });

      // 外部角色精准分流：
      // - leftActors: 业务输入驱动者/客户/发起人（如买家、申请人、person 角色、或第1步发起方）
      // - rightActors: 外部支撑系统/依赖网关/第三方通道（由内部系统发起的下游系统，如支付网关、短信中心）
      const leftActors: typeof externalActors = [];
      const rightActors: typeof externalActors = [];

      externalActors.forEach(ext => {
        // 如果是真实人员/客户端角色，天然排在左侧
        if (ext.type === 'person') {
          leftActors.push(ext);
          return;
        }

        // 检查该角色第一次在 activities 中登场的角色地位
        const firstAct = model.activities.find(act => act.from === ext.id || act.to === ext.id);
        if (firstAct) {
          // 如果该角色第一次出现是被内部中枢调用（to 端），属于典型的出站下游支撑系统 -> 右侧
          if (firstAct.to === ext.id && groupActorIds.has(firstAct.from)) {
            rightActors.push(ext);
            return;
          }
          // 如果该角色是第 1 步的发起方且发往内部系统，属于业务源头发起点 -> 左侧
          if (firstAct.from === ext.id && firstAct.number === 1 && groupActorIds.has(firstAct.to)) {
            leftActors.push(ext);
            return;
          }
        }

        // 统计内部中枢对它的主动调用次数与它主动调用内部中枢的次数
        const inFromInternal = model.activities.filter(act => act.to === ext.id && groupActorIds.has(act.from)).length;
        const outToInternal = model.activities.filter(act => act.from === ext.id && groupActorIds.has(act.to)).length;

        if (inFromInternal > outToInternal) {
          rightActors.push(ext);
        } else if (outToInternal > inFromInternal) {
          leftActors.push(ext);
        } else {
          // 次数相等时：如果是 system 且内部更早发起了对它的调用 -> 右侧
          const callFromInternalIdx = model.activities.findIndex(act => act.to === ext.id && groupActorIds.has(act.from));
          const callToInternalIdx = model.activities.findIndex(act => act.from === ext.id && groupActorIds.has(act.to));
          if (callFromInternalIdx !== -1 && (callToInternalIdx === -1 || callFromInternalIdx < callToInternalIdx)) {
            rightActors.push(ext);
          } else {
            leftActors.push(ext);
          }
        }
      });

      // 防单边倾斜平衡：如果外部角色全被推到左侧且 >= 2 个，且右侧为空，将最后一个系统级角色平衡至右侧
      if (leftActors.length >= 2 && rightActors.length === 0) {
        let nonPersonIdx = -1;
        for (let i = leftActors.length - 1; i >= 0; i--) {
          if (leftActors[i].type !== 'person') {
            nonPersonIdx = i;
            break;
          }
        }
        if (nonPersonIdx !== -1) {
          rightActors.push(leftActors.splice(nonPersonIdx, 1)[0]);
        }
      }

      // 排布左侧角色（如买家、前端客户、申请人）
      const leftX = 220;
      const leftStartY = internalActors.length === 1 ? 260 : 220;
      leftActors.forEach((a, idx) => {
        a.x = leftX;
        a.y = leftStartY + idx * 300;
      });

      // 排布右侧外部系统（如统一支付网关、仓配外协、物流跟踪）
      const rightX = 1140;
      const rightStartY = 220;
      rightActors.forEach((a, idx) => {
        a.x = rightX;
        a.y = rightStartY + idx * 300;
      });

      return {
        ...model,
        actors,
      };
    }
  }

  // 2. 无分组时的通用拓扑排布
  if (count <= 3) {
    const startX = 220;
    const spacingX = 500;
    const centerY = 260;

    actors.forEach((a, idx) => {
      a.x = startX + idx * spacingX;
      a.y = count === 3 && idx === 1 ? centerY - 100 : centerY + (idx % 2 === 0 ? 30 : -30);
    });
  } else if (count === 4) {
    // 4 节点顺时针环形流矩阵布局，消除 Z 字形主副对角线中央交叉
    const coords = [
      { x: 240, y: 200 }, // 0: 左上
      { x: 800, y: 200 }, // 1: 右上
      { x: 800, y: 560 }, // 2: 右下
      { x: 240, y: 560 }, // 3: 左下
    ];
    actors.forEach((a, idx) => {
      a.x = coords[idx].x;
      a.y = coords[idx].y;
    });
  } else {
    // 5+ 节点大半径环绕布局
    const centerX = Math.max(560, count * 110);
    const centerY = Math.max(420, count * 80);
    const radiusX = Math.max(480, count * 96);
    const radiusY = Math.max(340, count * 68);

    actors.forEach((a, idx) => {
      const angle = (idx / count) * 2 * Math.PI - Math.PI / 2;
      a.x = Math.round(centerX + radiusX * Math.cos(angle));
      a.y = Math.round(centerY + radiusY * Math.sin(angle));
    });
  }

  return {
    ...model,
    actors,
  };
}

export interface RenderDomainStoryOptions {
  currentStep?: number; // 0-indexed; -1 或 undefined 显示全景
  isDark?: boolean;
  width?: number | string;
  height?: number | string;
}

/**
 * 渲染 Domain Story 为高精度矢量 SVG
 */
export function renderDomainStoryToSvg(
  rawModel: DomainStoryModel,
  options: RenderDomainStoryOptions = {}
): string {
  const { currentStep = -1, isDark = true } = options;

  if (rawModel.mode === 'event-storming' && rawModel.eventStorming) {
    return renderEventStormingToSvg(rawModel.eventStorming, rawModel.info, {
      currentStep,
      isDark,
    });
  }

  if (rawModel.mode === 'context-map' && rawModel.contextMap) {
    return renderContextMapToSvg(rawModel.contextMap, rawModel.info, {
      currentStep,
      isDark,
    });
  }

  if (rawModel.mode === 'core-domain-chart' && rawModel.coreDomainChart) {
    return renderCoreDomainChartToSvg(rawModel.coreDomainChart, rawModel.info, {
      currentStep,
      isDark,
    });
  }

  if (rawModel.mode === 'context-canvas' && rawModel.contextCanvas) {
    return renderContextCanvasToSvg(rawModel.contextCanvas, rawModel.info, {
      currentStep,
      isDark,
    });
  }

  const model = computeAutoLayout(rawModel);

  // 1. 计算画布尺寸
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  if (model.actors.length === 0) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 200" width="100%" height="200"><rect width="100%" height="100%" fill="${isDark ? '#0f172a' : '#f8fafc'}"/><text x="300" y="105" fill="${isDark ? '#94a3b8' : '#64748b'}" font-family="sans-serif" font-size="14" text-anchor="middle">未发现有效的领域故事角色与活动 (Empty Domain Story)</text></svg>`;
  }

  for (const a of model.actors) {
    const x = a.x || 100;
    const y = a.y || 100;
    minX = Math.min(minX, x - 145);
    maxX = Math.max(maxX, x + 145);
    minY = Math.min(minY, y - 145);
    maxY = Math.max(maxY, y + 140);
  }

  // 边界安全外补白（留足呼吸感与自环/标题空间）
  const padX = 110;
  const padY = 110;
  const vx = Math.floor(minX - padX);
  const vy = Math.floor(minY - padY);
  const vw = Math.ceil(maxX - minX + padX * 2);
  const vh = Math.ceil(maxY - minY + padY * 2);

  // 查找表
  const actorMap = new Map<string, DomainStoryActor>();
  model.actors.forEach(a => actorMap.set(a.id, a));

  const totalSteps = model.activities.length;
  const isPlaybackMode = currentStep >= 0 && currentStep < totalSteps;
  const activeActivity = isPlaybackMode ? model.activities[currentStep] : null;

  // 配色方案（遵循 anti-slop 工业级高对比度）
  const themeColors = isDark
    ? {
        bg: '#090d16',
        actorBg: '#111827',
        actorBorder: '#38bdf8',
        actorText: '#f8fafc',
        actorSubText: '#cbd5e1',
        lineDefault: '#60a5fa',
        lineActive: '#38bdf8',
        linePast: '#94a3b8',
        badgeBg: '#0f172a',
        badgeText: '#f8fafc',
        badgeBorder: '#38bdf8',
        activeBadgeBg: '#0284c7',
        activeBadgeText: '#ffffff',
        woBg: '#1e293b',
        woBorder: '#38bdf8',
        woText: '#38bdf8',
        groupBg: 'rgba(15, 23, 42, 0.55)',
        groupBorder: '#64748b',
        groupText: '#93c5fd',
      }
    : {
        bg: '#ffffff',
        actorBg: '#ffffff',
        actorBorder: '#2563eb',
        actorText: '#0f172a',
        actorSubText: '#334155',
        lineDefault: '#1e293b',
        lineActive: '#2563eb',
        linePast: '#64748b',
        badgeBg: '#f8fafc',
        badgeText: '#0f172a',
        badgeBorder: '#94a3b8',
        activeBadgeBg: '#2563eb',
        activeBadgeText: '#ffffff',
        woBg: '#eff6ff',
        woBorder: '#2563eb',
        woText: '#1d4ed8',
        groupBg: 'rgba(241, 245, 249, 0.7)',
        groupBorder: '#94a3b8',
        groupText: '#1d4ed8',
      };

  let svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vx} ${vy} ${vw} ${vh}" width="${vw}" height="${vh}" class="ov-domain-story-svg" style="background-color: transparent; max-width: 100%; height: auto; user-select: none; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">\n`;

  // Defs: 滤镜与箭头标记
  svgContent += `
  <defs>
    <!-- 发光脉冲滤镜 -->
    <filter id="ds-glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="4" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
    <!-- 普通箭头 -->
    <marker id="ds-arrow-default" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="${themeColors.lineDefault}" />
    </marker>
    <!-- 激活高亮箭头 -->
    <marker id="ds-arrow-active" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="${themeColors.lineActive}" />
    </marker>
    <!-- 过去步骤箭头 -->
    <marker id="ds-arrow-past" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="${themeColors.linePast}" />
    </marker>
  </defs>\n`;

  // 2. 渲染 Groups / System Boundaries (底层背景)
  if (model.groups && model.groups.length > 0) {
    for (const g of model.groups) {
      const gActors = g.actors.map(id => actorMap.get(id)).filter(Boolean) as DomainStoryActor[];
      if (gActors.length === 0) continue;

      let gMinX = Infinity;
      let gMaxX = -Infinity;
      let gMinY = Infinity;
      let gMaxY = -Infinity;

      for (const a of gActors) {
        const ax = a.x || 0;
        const ay = a.y || 0;
        gMinX = Math.min(gMinX, ax - 84);
        gMaxX = Math.max(gMaxX, ax + 84);
        gMinY = Math.min(gMinY, ay - 72);
        gMaxY = Math.max(gMaxY, ay + 86);
      }

      let gx = gMinX - 32;
      let gy = gMinY - 36;
      let gw = gMaxX - gMinX + 64;
      let gh = gMaxY - gMinY + 64;

      // Group 边界横向最小宽度保证，消除单列窄条感，提供舒展的领域边界空间
      const minGroupW = 280;
      if (gw < minGroupW) {
        const diff = minGroupW - gw;
        gx -= diff / 2;
        gw = minGroupW;
      }

      svgContent += `  <g class="ds-group" id="${escapeXml(g.id)}">
    <rect x="${gx}" y="${gy}" width="${gw}" height="${gh}" rx="16" fill="${themeColors.groupBg}" stroke="${themeColors.groupBorder}" stroke-width="1.5" stroke-dasharray="6,4" />
    <text x="${gx + 18}" y="${gy + 22}" fill="${themeColors.groupText}" font-size="12.5" font-weight="600" text-anchor="start">${escapeXml(g.name)}</text>
  </g>\n`;
    }
  }

  // 3. 渲染 Activities 连线与工作对象 (中层)
  // 预先统计节点对之间的连线总数
  const pairTotalMap = new Map<string, number>();
  model.activities.forEach(act => {
    if (act.from !== act.to) {
      const pairKey = [act.from, act.to].sort().join('::');
      pairTotalMap.set(pairKey, (pairTotalMap.get(pairKey) || 0) + 1);
    }
  });

  const pairEdgeMap = new Map<string, number>();
  // 维护已放置活动卡片的矩形包围盒，用于精准碰撞检测与贝塞尔参数滑动避让
  const placedLabels: Array<{ x: number; y: number; w: number; h: number }> = [];

  model.activities.forEach((act, idx) => {
    const fromActor = actorMap.get(act.from);
    const toActor = actorMap.get(act.to);
    if (!fromActor || !toActor) return;

    const x1 = fromActor.x || 0;
    const y1 = fromActor.y || 0;
    const x2 = toActor.x || 0;
    const y2 = toActor.y || 0;

    const isActive = isPlaybackMode && currentStep === idx;
    const isPast = isPlaybackMode && idx < currentStep;
    const isFuture = isPlaybackMode && idx > currentStep;

    const strokeColor = isActive
      ? themeColors.lineActive
      : isPast
      ? themeColors.linePast
      : themeColors.lineDefault;

    const strokeWidth = isActive ? 3 : 2;
    const marker = isActive ? 'url(#ds-arrow-active)' : isPast ? 'url(#ds-arrow-past)' : 'url(#ds-arrow-default)';
    const opacity = isFuture ? 0.22 : 1.0;

    const boxW = Math.max(146, Math.min(188, Math.max(act.label.length, (act.workObjectName || '').length + 2) * 12 + 44));
    const boxH = 48;

    let pathD = '';
    let labelX = (x1 + x2) / 2;
    let labelY = (y1 + y2) / 2;

    if (act.from === act.to) {
      // 自环处理 (Self loop)，留出更充裕的上方回环与工件便签空间
      pathD = `M ${x1 - 24} ${y1 - 44} C ${x1 - 68} ${y1 - 138}, ${x1 + 68} ${y1 - 138}, ${x1 + 24} ${y1 - 44}`;
      labelX = x1;
      labelY = y1 - 120;
    } else {
      const pairKey = [act.from, act.to].sort().join('::');
      const seenIndex = pairEdgeMap.get(pairKey) || 0;
      pairEdgeMap.set(pairKey, seenIndex + 1);
      const totalInPair = pairTotalMap.get(pairKey) || 1;

      // 规范化基准方向向量（固定由 pairKey[0] 指向 pairKey[1]），彻底杜绝反向边法向同向叠加的数学 Bug
      const sortedIds = [act.from, act.to].sort();
      const firstActor = actorMap.get(sortedIds[0])!;
      const secondActor = actorMap.get(sortedIds[1])!;
      const baseDx = (secondActor.x || 0) - (firstActor.x || 0);
      const baseDy = (secondActor.y || 0) - (firstActor.y || 0);
      const baseDist = Math.sqrt(baseDx * baseDx + baseDy * baseDy) || 1;
      const basePerpX = -baseDy / baseDist;
      const basePerpY = baseDx / baseDist;

      // 如果节点对仅有 1 条边，使用平直路径；如果是双向或多条边，交替向基准法向的两侧饱满隆起
      let curvature = 0;
      if (totalInPair > 1) {
        const sign = seenIndex % 2 === 0 ? 1 : -1;
        const tier = Math.floor(seenIndex / 2) + 1;
        curvature = 84 * tier * sign;
      }

      const dx = x2 - x1;
      const dy = y2 - y1;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const ux = dx / dist;
      const uy = dy / dist;

      const startX = x1 + ux * 66;
      const startY = y1 + uy * 44;
      const endX = x2 - ux * 66;
      const endY = y2 - uy * 44;

      const cx = (startX + endX) / 2 + basePerpX * curvature;
      const cy = (startY + endY) / 2 + basePerpY * curvature;

      pathD = `M ${startX} ${startY} Q ${cx} ${cy} ${endX} ${endY}`;

      // 沿二次贝塞尔曲线计算任意 t 点的坐标
      const evalBezier = (t: number) => {
        const invT = 1 - t;
        return {
          x: invT * invT * startX + 2 * invT * t * cx + t * t * endX,
          y: invT * invT * startY + 2 * invT * t * cy + t * t * endY,
        };
      };

      // 碰撞检测：检查卡片中心 (px, py) 是否与已放置卡片重合，或过于遮挡端点 Actor
      const checkCollision = (px: number, py: number) => {
        const collidesWithLabel = placedLabels.some(
          l => Math.abs(l.x - px) < (l.w + boxW) / 2 + 14 && Math.abs(l.y - py) < (l.h + boxH) / 2 + 14
        );
        if (collidesWithLabel) return true;

        // 避免过于遮挡两端 Actor 卡片中心
        const distToStart = Math.hypot(px - x1, py - y1);
        const distToEnd = Math.hypot(px - x2, py - y2);
        return distToStart < 92 || distToEnd < 92;
      };

      // 候选 t 参数集合：优先中点 0.5，遇碰撞时向两侧滑动错位 (0.35/0.65/0.26/0.74...)
      const candidateTs = [0.5, 0.35, 0.65, 0.28, 0.72, 0.42, 0.58];
      let bestT = 0.5;
      let foundSafe = false;

      for (const t of candidateTs) {
        const pos = evalBezier(t);
        if (!checkCollision(pos.x, pos.y)) {
          bestT = t;
          foundSafe = true;
          break;
        }
      }

      if (!foundSafe) {
        // 若所有候选点都有轻微干涉，选择与已有标签欧氏距离最大化的 t
        let maxMinDist = -1;
        for (const t of candidateTs) {
          const pos = evalBezier(t);
          let minDist = Infinity;
          for (const l of placedLabels) {
            const d = Math.hypot(l.x - pos.x, l.y - pos.y);
            if (d < minDist) minDist = d;
          }
          if (minDist > maxMinDist) {
            maxMinDist = minDist;
            bestT = t;
          }
        }
      }

      const finalPos = evalBezier(bestT);
      labelX = finalPos.x;
      labelY = finalPos.y;
    }

    // 记录已放置卡片坐标与包围盒
    placedLabels.push({ x: labelX, y: labelY, w: boxW, h: boxH });

    const badgeBg = isActive ? themeColors.activeBadgeBg : themeColors.badgeBg;
    const badgeText = isActive ? themeColors.activeBadgeText : themeColors.badgeText;
    const badgeBorder = isActive ? themeColors.lineActive : themeColors.badgeBorder;

    svgContent += `  <g class="ds-activity" id="${escapeXml(act.id)}" opacity="${opacity}" ${isActive ? 'filter="url(#ds-glow)"' : ''}>
    <!-- 活动连线 -->
    <path d="${pathD}" fill="none" stroke="${strokeColor}" stroke-width="${strokeWidth}" marker-end="${marker}" />

    <!-- 序号圆圈与动作文本标签 -->
    <g transform="translate(${labelX}, ${labelY})">
      <!-- 阴影与底牌 -->
      <rect x="${-boxW / 2}" y="-24" width="${boxW}" height="48" rx="10" fill="${themeColors.actorBg}" stroke="${badgeBorder}" stroke-width="1.3" opacity="0.96" />
      <!-- 序号圆标 -->
      <circle cx="${-boxW / 2 + 20}" cy="0" r="12" fill="${badgeBg}" stroke="${badgeBorder}" stroke-width="1.2" />
      <text x="${-boxW / 2 + 20}" y="4" fill="${badgeText}" font-size="11.5" font-weight="700" text-anchor="middle">${act.number}</text>

      <!-- 动词动作 -->
      <text x="${-boxW / 2 + 38}" y="-4" fill="${themeColors.actorText}" font-size="11.5" font-weight="600" text-anchor="start">${escapeXml(truncateText(act.label, 14))}</text>

      <!-- 工作对象便签 (Work Object) -->
      ${
        act.workObjectName
          ? `<text x="${-boxW / 2 + 38}" y="14" fill="${themeColors.woText}" font-size="10.5" font-weight="500" text-anchor="start">📄 ${escapeXml(truncateText(act.workObjectName, 13))}</text>`
          : ''
      }
    </g>
  </g>\n`;
  });

  // 4. 渲染 Actors 角色节点 (顶层卡片)
  for (const a of model.actors) {
    const ax = a.x || 0;
    const ay = a.y || 0;

    const isFromActive = activeActivity && activeActivity.from === a.id;
    const isToActive = activeActivity && activeActivity.to === a.id;
    const isActorHighlighted = isPlaybackMode && (isFromActive || isToActive);

    const cardBorder = isActorHighlighted ? themeColors.lineActive : themeColors.actorBorder;
    const cardBorderWidth = isActorHighlighted ? 2.4 : 1.4;

    const isPerson = a.type === 'person';
    const isSystem = a.type === 'system';
    const isGroup = a.type === 'group';

    // 角色图标路径
    const iconSvg = isPerson
      ? `<path d="M12 11c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" fill="${isActorHighlighted ? themeColors.lineActive : themeColors.actorSubText}"/>`
      : isSystem
      ? `<path d="M20 18c1.1 0 1.99-.9 1.99-2L22 6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2H0v2h24v-2h-4zM4 6h16v10H4V6z" fill="${isActorHighlighted ? themeColors.lineActive : themeColors.actorSubText}"/>`
      : `<path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" fill="${isActorHighlighted ? themeColors.lineActive : themeColors.actorSubText}"/>`;

    svgContent += `  <g class="ds-actor" id="${escapeXml(a.id)}" transform="translate(${ax}, ${ay})" ${isActorHighlighted ? 'filter="url(#ds-glow)"' : ''}>
    <!-- 节点底色卡片 -->
    <rect x="-56" y="-36" width="112" height="72" rx="10" fill="${themeColors.actorBg}" stroke="${cardBorder}" stroke-width="${cardBorderWidth}" />
    
    <!-- 顶部状态指示条 -->
    ${
      isFromActive
        ? `<rect x="-56" y="-36" width="112" height="4" rx="2" fill="${themeColors.lineActive}" />`
        : isToActive
        ? `<rect x="-56" y="-36" width="112" height="4" rx="2" fill="#10b981" />`
        : ''
    }

    <!-- 角色图标 -->
    <g transform="translate(-12, -28) scale(1)">
      <svg width="24" height="24" viewBox="0 0 24 24">${iconSvg}</svg>
    </g>

    <!-- 角色名称 -->
    <text x="0" y="14" fill="${themeColors.actorText}" font-size="12" font-weight="600" text-anchor="middle">${escapeXml(truncateText(a.name, 12))}</text>
    <!-- 角色类型小标 -->
    <text x="0" y="27" fill="${themeColors.actorSubText}" font-size="9.5" font-weight="500" text-anchor="middle">${escapeXml(a.type.toUpperCase())}</text>
  </g>\n`;
  }

  // 5. 水印与标题
  if (model.info?.name) {
    svgContent += `  <text x="${vx + 24}" y="${vy + 30}" fill="${themeColors.actorText}" font-size="14" font-weight="700" opacity="0.85">${escapeXml(model.info.name)}</text>\n`;
  }

  svgContent += '</svg>';
  return svgContent;
}

function truncateText(str: string, maxLen: number): string {
  if (!str) return '';
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 1) + '…';
}

/**
 * 将领域故事活动序列提取为 DiagramStep 数组，无缝接入 DiagramStepPlayer
 */
export function extractDomainStorySteps(model: DomainStoryModel): DiagramStep[] {
  if (
    model.mode === 'event-storming' ||
    model.mode === 'context-map' ||
    model.mode === 'core-domain-chart' ||
    model.mode === 'context-canvas'
  ) {
    return extractDddSteps(
      model.mode,
      model.eventStorming,
      model.contextMap,
      model.coreDomainChart,
      model.contextCanvas
    );
  }

  const actorMap = new Map<string, string>();
  model.actors.forEach(a => actorMap.set(a.id, a.name));

  return model.activities.map((act, index) => {
    const fromName = actorMap.get(act.from) || act.from;
    const toName = actorMap.get(act.to) || act.to;
    const wo = act.workObjectName ? ` [${act.workObjectName}]` : '';

    const label = `${act.number}. ${fromName} -> ${act.label} -> ${toName}${wo}`;
    const description = `${fromName} 执行「${act.label}」动作，向 ${toName} 交付/流转 ${act.workObjectName || '业务凭证'}`;

    return {
      index,
      id: act.id || `step-${act.number}`,
      type: 'message',
      from: fromName,
      to: toName,
      label,
      rawLine: label,
      lineNumber: act.number,
      description,
      arrowType: '->',
    };
  });
}

/**
 * 阶段三：导出为 Polyglot SVG (内嵌 .egn JSON 元数据，双向无损互通)
 */
export function exportPolyglotSvg(model: DomainStoryModel, isDark = true): string {
  const svg = renderDomainStoryToSvg(model, { isDark });
  const jsonStr = JSON.stringify(model, null, 2);

  const metadataTag = `
  <metadata id="egn-metadata">
    <script type="application/json" id="domain-story-json">
<![CDATA[
${jsonStr}
]]>
    </script>
  </metadata>\n`;

  // 插入到 </svg> 之前
  const closingIdx = svg.lastIndexOf('</svg>');
  if (closingIdx !== -1) {
    return svg.slice(0, closingIdx) + metadataTag + svg.slice(closingIdx);
  }
  return svg;
}

/**
 * 阶段三：从 Polyglot SVG 中提取内嵌的 DomainStoryModel
 */
export function extractModelFromPolyglotSvg(svgContent: string): DomainStoryModel | null {
  if (!svgContent || typeof svgContent !== 'string') return null;

  const match = svgContent.match(/<script[^>]*id=["']domain-story-json["'][^>]*>([\s\S]*?)<\/script>/i);
  if (match && match[1]) {
    try {
      let raw = match[1].trim();
      if (raw.startsWith('<![CDATA[')) {
        raw = raw.replace(/^<!\[CDATA\[/, '').replace(/\]\]>$/, '').trim();
      }
      return parseDomainStory(raw);
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * 阶段三：导出为 WPS / egon.io 官方标准 .dst (JSON) 文件字符串（兼容 DDD 扩展视图）
 */
export function exportDstJson(model: DomainStoryModel): string {
  const payload: Record<string, unknown> = {
    mode: model.mode || 'domain-story',
    info: {
      name: model.info?.name || 'Domain Story',
      description: model.info?.description || '',
      version: model.info?.version || '1.0',
    },
    actors: model.actors,
    workObjects: model.workObjects,
    activities: model.activities,
    groups: model.groups || [],
  };
  if (model.eventStorming) {
    payload.eventStorming = model.eventStorming;
  }
  if (model.contextMap) {
    payload.contextMap = model.contextMap;
  }
  if (model.coreDomainChart) {
    payload.coreDomainChart = model.coreDomainChart;
  }
  if (model.contextCanvas) {
    payload.contextCanvas = model.contextCanvas;
  }
  return JSON.stringify(payload, null, 2);
}

/**
 * 阶段三：导出为标准 .dst JSON 文件字符串 (向下兼容 .egn 别名)
 */
export function exportEgnJson(model: DomainStoryModel): string {
  return exportDstJson(model);
}
