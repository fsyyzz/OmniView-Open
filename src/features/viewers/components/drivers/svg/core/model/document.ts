/**
 * OmniView SVG 编辑引擎 v2 — 不可变 Document + Node helpers (ADR-0001 §2.5)
 *
 * 设计要点：
 * 1. **结构共享**（structural sharing）：更新一个节点时，nodes Map 中其他
 *    条目保持引用相等；只有真正变化的分支被克隆。这让 undo 几乎零成本。
 * 2. **纯函数式 API**：所有 `update*` 函数返回新 Document；不修改入参。
 * 3. **类型品牌**：`NodeId` 是 branded number，防止与普通数字混用。
 *
 * 性能基线：单次 commit O(changed_path_length)；undo/redo O(1) 引用切换。
 */

import type {
  AffineTransform,
  Anchor,
  Appearance,
  BlendMode,
  Canvas,
  Color,
  Document,
  DocumentInternal,
  Fill,
  GroupNode,
  LayerNode,
  LayerColorTag,
  Node,
  NodeId,
  PathGeometry,
  PathNode,
  Selection,
  StableId,
  Stroke,
  SubPath,
  Vec2,
} from './types';

// ============================================================================
// 1. NodeId 工厂
// ============================================================================

/** 内部 raw number → NodeId 品牌化。 */
export function makeNodeId(raw: number): NodeId {
  return raw as NodeId;
}

/** 从 string StableId 反推（导出 SVG 时生成）。仅用于 IO 阶段，不参与模型逻辑。 */
export function stableIdOf(doc: Document, id: NodeId): StableId {
  const node = doc.nodes.get(id);
  if (!node) return `n${id}`;
  // 简化：基于 id 与画布大小做短哈希避免不同文档冲突
  const h = ((id * 2654435761) >>> 0).toString(36).slice(0, 4);
  return `${h}-${id}`;
}

// ============================================================================
// 2. Document 工厂
// ============================================================================

/** 创建一个空文档（含一个默认图层 "Layer 1"）。 */
export function createDocument(canvas: Partial<Canvas> = {}): Document {
  const c: Canvas = {
    width: canvas.width ?? 100,
    height: canvas.height ?? 100,
    unit: canvas.unit ?? 'px',
    viewBox: canvas.viewBox ?? null,
  };
  const layerId = 1 as NodeId;
  const layer: LayerNode = {
    id: layerId,
    kind: 'Layer',
    name: 'Layer 1',
    transform: identityTransform(),
    opacity: 1,
    blend: 'normal',
    visible: true,
    locked: false,
    children: [],
    colorTag: 'none',
  };
  const nodes = new Map<NodeId, Node>();
  nodes.set(layerId, layer);
  return {
    canvas: c,
    layers: [layerId],
    nodes,
    nextNodeId: 2,
    metadata: {},
    _internal: { revision: 0 },
  };
}

export function identityTransform(): AffineTransform {
  return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
}

// ============================================================================
// 3. Node 工厂
// ============================================================================

export function makeLayer(
  id: NodeId,
  name: string,
  colorTag: LayerColorTag = 'none',
  children: ReadonlyArray<NodeId> = [],
): LayerNode {
  return {
    id,
    kind: 'Layer',
    name,
    transform: identityTransform(),
    opacity: 1,
    blend: 'normal',
    visible: true,
    locked: false,
    children,
    colorTag,
  };
}

export function makeGroup(
  id: NodeId,
  children: ReadonlyArray<NodeId>,
  appearance: Appearance = emptyAppearance(),
): GroupNode {
  return {
    id,
    kind: 'Group',
    name: null,
    transform: identityTransform(),
    opacity: 1,
    blend: 'normal',
    visible: true,
    locked: false,
    children,
    appearance,
  };
}

export function makePath(
  id: NodeId,
  geometry: PathGeometry,
  appearance: Appearance = emptyAppearance(),
  hint: PathNode['primitiveHint'] = 'path',
): PathNode {
  return {
    id,
    kind: 'Path',
    name: null,
    transform: identityTransform(),
    opacity: 1,
    blend: 'normal',
    visible: true,
    locked: false,
    children: [],
    geometry,
    appearance,
    primitiveHint: hint,
  };
}

export function emptyAppearance(): Appearance {
  return {
    items: [
      {
        kind: 'fill',
        fill: { type: 'solid', color: '#000000' as Color, opacity: 1 },
        blend: 'normal',
        opacity: 1,
      },
      {
        kind: 'stroke',
        stroke: {
          paint: { type: 'none' },
          width: 1,
          widthUnit: 'px',
          cap: 'butt',
          join: 'miter',
          miterLimit: 4,
          dashArray: null,
          dashOffset: 0,
          alignment: 'center',
        },
        blend: 'normal',
        opacity: 1,
      },
    ],
  };
}

export function defaultStroke(): Stroke {
  return {
    paint: { type: 'solid', color: '#000000' as Color, opacity: 1 },
    width: 1,
    widthUnit: 'px',
    cap: 'butt',
    join: 'miter',
    miterLimit: 4,
    dashArray: null,
    dashOffset: 0,
    alignment: 'center',
  };
}

// ============================================================================
// 4. Document 结构共享更新（核心）
// ============================================================================

/** 不可变更新 nodes Map 中的节点；返回新 Document。 */
export function updateNode(
  doc: Document,
  id: NodeId,
  updater: (node: Node) => Node,
): Document {
  const old = doc.nodes.get(id);
  if (!old) return doc;
  const next = updater(old);
  if (next === old) return doc;
  const newNodes = new Map(doc.nodes);
  newNodes.set(id, next);
  return cloneDoc(doc, { nodes: newNodes, _internal: bumpRevision(doc._internal) });
}

/** 在文档末尾追加一个图层，返回新 Document 与新图层 ID。 */
export function appendLayer(
  doc: Document,
  name?: string,
): { doc: Document; layerId: NodeId } {
  const id = makeNodeId(doc.nextNodeId);
  const layerCount = doc.layers.length;
  const preset = layerCount % 7;
  const colorTag = (['none', 'red', 'orange', 'yellow', 'green', 'blue', 'purple'] as const)[preset] ?? 'none';
  const layerName = name ?? `Layer ${layerCount + 1}`;
  const layer = makeLayer(id, layerName, colorTag);
  const newNodes = new Map(doc.nodes);
  newNodes.set(id, layer);
  return {
    doc: cloneDoc(doc, {
      nodes: newNodes,
      layers: [...doc.layers, id],
      nextNodeId: id + 1,
      _internal: bumpRevision(doc._internal),
    }),
    layerId: id,
  };
}

/** 把一个图元加入指定图层（末尾）。 */
export function appendToLayer(
  doc: Document,
  layerId: NodeId,
  node: Node,
): { doc: Document; nodeId: NodeId } {
  const layer = doc.nodes.get(layerId);
  if (!layer || layer.kind !== 'Layer') return { doc, nodeId: node.id };
  const newId = makeNodeId(doc.nextNodeId);
  const nodeWithId = { ...node, id: newId };
  const newLayer: LayerNode = { ...layer, children: [...layer.children, newId] };
  const newNodes = new Map(doc.nodes);
  newNodes.set(layerId, newLayer);
  newNodes.set(newId, nodeWithId);
  return {
    doc: cloneDoc(doc, {
      nodes: newNodes,
      nextNodeId: newId + 1,
      _internal: bumpRevision(doc._internal),
    }),
    nodeId: newId,
  };
}

/** 从文档中删除一个节点及其所有子节点（递归）。 */
export function removeNode(doc: Document, id: NodeId): Document {
  const node = doc.nodes.get(id);
  if (!node) return doc;
  const toDelete: NodeId[] = [id];
  const queue: NodeId[] = [id];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    const n = doc.nodes.get(cur);
    if (!n) continue;
    if (n.kind === 'Layer' || n.kind === 'Group') {
      queue.push(...n.children);
    }
    toDelete.push(...queue.splice(0));
  }
  const newNodes = new Map(doc.nodes);
  for (const d of new Set(toDelete)) newNodes.delete(d);
  // 从所有图层/组的 children 中移除
  const newNodesFixed = new Map<NodeId, Node>();
  for (const [nid, n] of newNodes) {
    if ((n.kind === 'Layer' || n.kind === 'Group') && n.children.length > 0) {
      const filtered = n.children.filter((c) => !toDelete.includes(c));
      if (filtered.length !== n.children.length) {
        newNodesFixed.set(nid, { ...n, children: filtered });
        continue;
      }
    }
    newNodesFixed.set(nid, n);
  }
  return cloneDoc(doc, {
    nodes: newNodesFixed,
    layers: doc.layers.filter((l) => !toDelete.includes(l)),
    _internal: bumpRevision(doc._internal),
  });
}

/** 在图层间重排：direction ∈ {front, back, forward, backward}。 */
export function reorderInLayer(
  doc: Document,
  layerId: NodeId,
  id: NodeId,
  direction: 'front' | 'back' | 'forward' | 'backward',
): Document {
  const layer = doc.nodes.get(layerId);
  if (!layer || (layer.kind !== 'Layer' && layer.kind !== 'Group')) return doc;
  const arr = [...layer.children];
  const idx = arr.indexOf(id);
  if (idx < 0) return doc;
  arr.splice(idx, 1);
  switch (direction) {
    case 'front':
      arr.push(id);
      break;
    case 'back':
      arr.unshift(id);
      break;
    case 'forward':
      arr.splice(Math.min(idx + 1, arr.length), 0, id);
      break;
    case 'backward':
      arr.splice(Math.max(idx - 1, 0), 0, id);
      break;
  }
  const newNode: Node = { ...layer, children: arr };
  const newNodes = new Map(doc.nodes);
  newNodes.set(layerId, newNode);
  return cloneDoc(doc, { nodes: newNodes, _internal: bumpRevision(doc._internal) });
}

// ============================================================================
// 5. Document 克隆辅助（结构共享）
// ============================================================================

export interface DocumentPatch {
  canvas?: Canvas;
  layers?: ReadonlyArray<NodeId>;
  nodes?: Map<NodeId, Node>;
  nextNodeId?: number;
  metadata?: Readonly<Record<string, string>>;
  _internal?: DocumentInternal;
}

/** 基于入参 patch 克隆 Document（仅覆盖的字段重新分配引用）。 */
export function cloneDoc(doc: Document, patch: DocumentPatch): Document {
  return {
    canvas: patch.canvas ?? doc.canvas,
    layers: patch.layers ?? doc.layers,
    nodes: patch.nodes ?? doc.nodes,
    nextNodeId: patch.nextNodeId ?? doc.nextNodeId,
    metadata: patch.metadata ?? doc.metadata,
    _internal: patch._internal ?? doc._internal,
  };
}

function bumpRevision(internal: DocumentInternal): DocumentInternal {
  return { revision: internal.revision + 1 };
}

// ============================================================================
// 6. 变换应用（局部坐标 ↔ 世界坐标）
// ============================================================================

/** 把变换作用于一个点。 */
export function applyTransform(t: AffineTransform, p: Vec2): Vec2 {
  return {
    x: t.a * p.x + t.c * p.y + t.e,
    y: t.b * p.x + t.d * p.y + t.f,
  };
}

/** 变换组合：A · B。 */
export function composeTransforms(a: AffineTransform, b: AffineTransform): AffineTransform {
  return {
    a: a.a * b.a + a.c * b.b,
    b: a.b * b.a + a.d * b.b,
    c: a.a * b.c + a.c * b.d,
    d: a.b * b.c + a.d * b.d,
    e: a.a * b.e + a.c * b.f + a.e,
    f: a.b * b.e + a.d * b.f + a.f,
  };
}

/** 平移变换。 */
export function translateTransform(dx: number, dy: number): AffineTransform {
  return { a: 1, b: 0, c: 0, d: 1, e: dx, f: dy };
}

/** 缩放变换（关于原点）。 */
export function scaleTransform(sx: number, sy: number = sx): AffineTransform {
  return { a: sx, b: 0, c: 0, d: sy, e: 0, f: 0 };
}

/** 旋转变换（关于原点，角度制）。 */
export function rotateTransform(deg: number): AffineTransform {
  const rad = (deg * Math.PI) / 180;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return { a: c, b: s, c: -s, d: c, e: 0, f: 0 };
}

// ============================================================================
// 7. Selection helpers
// ============================================================================

export function emptySelection(): Selection {
  return { nodeIds: [], primaryId: null };
}

export function selectionWith(primary: NodeId, rest?: ReadonlyArray<NodeId>): Selection {
  const all: NodeId[] = [primary, ...(rest ?? [])];
  return { nodeIds: all, primaryId: primary };
}

export function selectionAdd(sel: Selection, idOrIds: NodeId | ReadonlyArray<NodeId>): Selection {
  const ids = Array.isArray(idOrIds) ? idOrIds : [idOrIds];
  const existing = new Set(sel.nodeIds);
  const merged: NodeId[] = [...sel.nodeIds];
  for (const id of ids) {
    if (!existing.has(id)) merged.push(id);
  }
  if (merged.length === sel.nodeIds.length) return sel;
  return { nodeIds: merged, primaryId: sel.primaryId ?? (merged[merged.length - 1] ?? null) };
}

export function selectionRemove(sel: Selection, idOrIds: NodeId | ReadonlyArray<NodeId>): Selection {
  const ids = Array.isArray(idOrIds) ? new Set(idOrIds) : new Set([idOrIds]);
  const next = sel.nodeIds.filter((n) => !ids.has(n));
  const primary = (sel.primaryId !== null && ids.has(sel.primaryId)) ? (next[0] ?? null) : sel.primaryId;
  return { nodeIds: next, primaryId: primary };
}

export function selectionClear(): Selection {
  return emptySelection();
}

// ============================================================================
// 8. 几何辅助
// ============================================================================

export function vec2(x: number, y: number): Vec2 {
  return { x, y };
}

export function subPath(anchors: ReadonlyArray<Anchor>, closed: boolean): SubPath {
  return { anchors, closed };
}

export function anchorCorner(p: Vec2): Anchor {
  return { point: p, handleIn: null, handleOut: null, kind: 'corner' };
}

export function anchorSmooth(p: Vec2, hIn: Vec2, hOut: Vec2): Anchor {
  return { point: p, handleIn: hIn, handleOut: hOut, kind: 'smooth' };
}

export function pathGeometry(subPaths: SubPath[]): PathGeometry {
  return { subPaths };
}

/** 浅克隆 PathGeometry（含 anchor 数组浅克隆）。 */
export function clonePathGeometry(g: PathGeometry): PathGeometry {
  return {
    subPaths: g.subPaths.map((sp) => ({
      anchors: sp.anchors.slice(),
      closed: sp.closed,
    })),
  };
}

/** 浅克隆 Fill。 */
export function cloneFill(f: Fill): Fill {
  if (f.type === 'solid') return { ...f };
  if (f.type === 'none') return f;
  return { ...f };
}