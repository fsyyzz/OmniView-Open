/**
 * OmniView 领域故事讲授法核心引擎 (Domain Storytelling Engine)
 * 纯本地优先、零网络依赖、MIT 兼容实现
 * 兼容 egon.io 标准 .egn 格式与 Markdown story/domainstory DSL 语法
 * 支持自动拓扑布局、矢量 SVG 渲染、DiagramStepPlayer 逐帧步进播放与 Polyglot SVG 导出
 */

import type { DiagramStep } from './diagramPlaybackEngine.ts';

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
  info?: {
    name?: string;
    description?: string;
    version?: string;
  };
  actors: DomainStoryActor[];
  workObjects: DomainStoryWorkObject[];
  activities: DomainStoryActivity[];
  groups?: DomainStoryGroup[];
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
    return { actors: [], workObjects: [], activities: [] };
  }

  const trimmed = input.trim();

  // 1. 尝试作为 JSON (.egn 原生格式) 解析
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      return normalizeJsonModel(parsed);
    } catch {
      // 容错降级到 DSL 解析
    }
  }

  // 2. 作为文本 DSL 解析
  return parseDomainStoryDsl(trimmed);
}

/**
 * 归一化 JSON 格式（支持官方 egon.io 模型与扁平 JSON）
 */
function normalizeJsonModel(json: any): DomainStoryModel {
  const root = json.model || json;
  const actors: DomainStoryActor[] = [];
  const workObjects: DomainStoryWorkObject[] = [];
  const activities: DomainStoryActivity[] = [];
  const groups: DomainStoryGroup[] = [];

  const rawInfo = root.info || json.info || {};
  const info = {
    name: rawInfo.name || rawInfo.title || 'Domain Story',
    description: rawInfo.description || '',
    version: rawInfo.version || '1.0',
  };

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
 */
export function computeAutoLayout(model: DomainStoryModel): DomainStoryModel {
  const actors = model.actors.map(a => ({ ...a }));
  const hasCoords = actors.length > 0 && actors.every(a => typeof a.x === 'number' && typeof a.y === 'number');

  if (hasCoords) {
    return model;
  }

  const count = actors.length;
  if (count === 0) return model;

  if (count <= 4) {
    // 线性横向流布局
    const startX = 140;
    const spacingX = 260;
    const centerY = 190;

    actors.forEach((a, idx) => {
      a.x = startX + idx * spacingX;
      a.y = centerY;
    });
  } else {
    // 环形/网格椭圆布局（防止复杂图连线混乱）
    const centerX = Math.max(380, count * 65);
    const centerY = 240;
    const radiusX = Math.max(260, count * 50);
    const radiusY = 160;

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
  const model = computeAutoLayout(rawModel);
  const { currentStep = -1, isDark = true } = options;

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
    minX = Math.min(minX, x - 100);
    maxX = Math.max(maxX, x + 100);
    minY = Math.min(minY, y - 80);
    maxY = Math.max(maxY, y + 100);
  }

  // 边界安全外补白
  const padX = 70;
  const padY = 70;
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
        actorBg: '#131b2e',
        actorBorder: '#27354f',
        actorText: '#f1f5f9',
        actorSubText: '#94a3b8',
        lineDefault: '#475569',
        lineActive: '#38bdf8',
        linePast: '#64748b',
        badgeBg: '#1e293b',
        badgeText: '#e2e8f0',
        badgeBorder: '#475569',
        activeBadgeBg: '#0284c7',
        activeBadgeText: '#ffffff',
        woBg: '#1e293b',
        woBorder: '#38bdf8',
        woText: '#38bdf8',
        groupBg: 'rgba(30, 41, 59, 0.35)',
        groupBorder: '#334155',
        groupText: '#64748b',
      }
    : {
        bg: '#ffffff',
        actorBg: '#ffffff',
        actorBorder: '#cbd5e1',
        actorText: '#0f172a',
        actorSubText: '#64748b',
        lineDefault: '#94a3b8',
        lineActive: '#0284c7',
        linePast: '#94a3b8',
        badgeBg: '#f1f5f9',
        badgeText: '#334155',
        badgeBorder: '#cbd5e1',
        activeBadgeBg: '#0284c7',
        activeBadgeText: '#ffffff',
        woBg: '#f0f9ff',
        woBorder: '#0284c7',
        woText: '#0369a1',
        groupBg: 'rgba(241, 245, 249, 0.65)',
        groupBorder: '#cbd5e1',
        groupText: '#475569',
      };

  let svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vx} ${vy} ${vw} ${vh}" width="100%" height="100%" class="ov-domain-story-svg" style="background-color: transparent; user-select: none; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">\n`;

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
        gMinX = Math.min(gMinX, ax - 70);
        gMaxX = Math.max(gMaxX, ax + 70);
        gMinY = Math.min(gMinY, ay - 60);
        gMaxY = Math.max(gMaxY, ay + 75);
      }

      const gx = gMinX - 16;
      const gy = gMinY - 24;
      const gw = gMaxX - gMinX + 32;
      const gh = gMaxY - gMinY + 40;

      svgContent += `  <g class="ds-group" id="${escapeXml(g.id)}">
    <rect x="${gx}" y="${gy}" width="${gw}" height="${gh}" rx="14" fill="${themeColors.groupBg}" stroke="${themeColors.groupBorder}" stroke-width="1.5" stroke-dasharray="6,4" />
    <text x="${gx + 16}" y="${gy + 18}" fill="${themeColors.groupText}" font-size="12" font-weight="600" text-anchor="start">${escapeXml(g.name)}</text>
  </g>\n`;
    }
  }

  // 3. 渲染 Activities 连线与工作对象 (中层)
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

    const strokeWidth = isActive ? 3 : 1.8;
    const marker = isActive ? 'url(#ds-arrow-active)' : isPast ? 'url(#ds-arrow-past)' : 'url(#ds-arrow-default)';
    const opacity = isFuture ? 0.22 : 1.0;

    let pathD = '';
    let labelX = (x1 + x2) / 2;
    let labelY = (y1 + y2) / 2;

    if (act.from === act.to) {
      // 自环处理 (Self loop)
      const loopR = 36;
      pathD = `M ${x1 - 18} ${y1 - 42} C ${x1 - 36} ${y1 - 100}, ${x1 + 36} ${y1 - 100}, ${x1 + 18} ${y1 - 42}`;
      labelX = x1;
      labelY = y1 - 92;
    } else {
      // 平滑二次贝塞尔曲线：稍微向正交方向拱起，使双向连线不重叠
      const dx = x2 - x1;
      const dy = y2 - y1;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const perpX = -dy / (dist || 1);
      const perpY = dx / (dist || 1);
      // 拱起幅度根据步序号奇偶轻微错开
      const curvature = 26 * ((act.number % 2 === 0) ? -1 : 1);
      const cx = (x1 + x2) / 2 + perpX * curvature;
      const cy = (y1 + y2) / 2 + perpY * curvature;

      pathD = `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`;
      labelX = cx;
      labelY = cy;
    }

    const badgeBg = isActive ? themeColors.activeBadgeBg : themeColors.badgeBg;
    const badgeText = isActive ? themeColors.activeBadgeText : themeColors.badgeText;
    const badgeBorder = isActive ? themeColors.lineActive : themeColors.badgeBorder;

    svgContent += `  <g class="ds-activity" id="${escapeXml(act.id)}" opacity="${opacity}" ${isActive ? 'filter="url(#ds-glow)"' : ''}>
    <!-- 活动连线 -->
    <path d="${pathD}" fill="none" stroke="${strokeColor}" stroke-width="${strokeWidth}" marker-end="${marker}" stroke-dasharray="${isActive ? 'none' : 'none'}" />

    <!-- 序号圆圈与动作文本标签 -->
    <g transform="translate(${labelX}, ${labelY})">
      <!-- 阴影与底牌 -->
      <rect x="-65" y="-22" width="130" height="44" rx="8" fill="${themeColors.actorBg}" stroke="${badgeBorder}" stroke-width="1.2" opacity="0.94" />
      <!-- 序号圆标 -->
      <circle cx="-42" cy="0" r="11" fill="${badgeBg}" stroke="${badgeBorder}" stroke-width="1.2" />
      <text x="-42" y="4" fill="${badgeText}" font-size="11" font-weight="700" text-anchor="middle">${act.number}</text>

      <!-- 动词动作 -->
      <text x="-24" y="-3" fill="${themeColors.actorText}" font-size="11" font-weight="600" text-anchor="start">${escapeXml(truncateText(act.label, 12))}</text>

      <!-- 工作对象便签 (Work Object) -->
      ${
        act.workObjectName
          ? `<text x="-24" y="13" fill="${themeColors.woText}" font-size="10" font-weight="500" text-anchor="start">📄 ${escapeXml(truncateText(act.workObjectName, 11))}</text>`
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
 * 阶段三：导出为标准 .egn JSON 文件字符串
 */
export function exportEgnJson(model: DomainStoryModel): string {
  return JSON.stringify(
    {
      info: {
        name: model.info?.name || 'Domain Story',
        description: model.info?.description || '',
        version: model.info?.version || '1.0',
      },
      actors: model.actors,
      workObjects: model.workObjects,
      activities: model.activities,
      groups: model.groups || [],
    },
    null,
    2
  );
}
