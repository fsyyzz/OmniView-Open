/**
 * OmniView SVG 编辑引擎 v2 — 命令注册表 + 标准命令实现 (ADR-0001 §2.5)
 *
 * 每个命令是一个纯函数：(doc, sel, params) → CommandResult。
 * 注册表持有所有命令的 spec 描述，便于面板 UI 与未来 MCP 化复用。
 */

import type {
  CommandError,
  CommandHandler,
  CommandId,
  CommandParams,
  CommandRegistry,
  CommandResult,
  CommandSpec,
  ObjectDeleteParams,
  ObjectAlignParams,
  ObjectDistributeParams,
  ObjectGroupParams,
  ObjectMoveParams,
  ObjectReorderParams,
  ObjectRotateParams,
  ObjectScaleParams,
  ObjectSetNameParams,
  ObjectSetVisibleParams,
  ObjectSetLockedParams,
  ObjectTransformParams,
  ObjectUngroupParams,
  PaintSetColorParams,
  PaintSetFillParams,
  PaintSetOpacityParams,
  PaintSetStrokeParams,
  PathCloseParams,
  PathDeleteAnchorParams,
  PathInsertAnchorParams,
  PathSetParams,
  HistoryRedoParams,
  HistoryUndoParams,
  LayerAddParams,
  LayerRemoveParams,
  LayerRenameParams,
  LayerReorderParams,
  LayerSetLockParams,
  LayerSetVisibilityParams,
  SelectAllParams,
  SelectBoxParams,
  SelectClearParams,
  SelectSetParams,
  ToolSetActiveParams,
  ParamSpec,
} from './types';
import type {
  AffineTransform,
  BlendMode,
  Color,
  Document,
  Fill,
  Node,
  NodeId,
  Rect,
  Selection,
  Stroke,
} from '../model/types';
import {
  appendLayer,
  appendToLayer,
  applyTransform,
  cloneDoc,
  cloneFill,
  clonePathGeometry,
  composeTransforms,
  defaultStroke,
  emptySelection,
  identityTransform,
  makeGroup,
  makePath,
  removeNode,
  reorderInLayer,
  selectionAdd,
  selectionClear,
  selectionRemove,
  selectionWith,
  updateNode,
} from '../model/document';
import { parsePathD, serializePathD } from '../model/path';
import { alignDelta, distributeOffsets, nodeBBox, unionRects } from '../model/bbox';
import { findParent } from '../model/tree';

// ============================================================================
// 1. 错误构造
// ============================================================================

function badParams(cmd: CommandId, msg: string): CommandResult {
  return { ok: false, error: { kind: 'bad-params', commandId: cmd, message: msg } };
}

function noNode(cmd: CommandId, id: NodeId): CommandResult {
  return { ok: false, error: { kind: 'no-node', commandId: cmd, message: `node ${id} not found` } };
}

function ok(doc: Document, selection: Selection, warnings?: string[]): CommandResult {
  return { ok: true, doc, selection, warnings };
}

// ============================================================================
// 2. 装饰器：检查节点存在
// ============================================================================

function withNode<R>(
  cmd: CommandId,
  doc: Document,
  id: NodeId,
  fn: (node: Node) => R,
): R | CommandResult {
  const n = doc.nodes.get(id);
  if (!n) return noNode(cmd, id);
  return fn(n);
}

// ============================================================================
// 3. path.* 命令
// ============================================================================

const pathSet: CommandHandler = (doc, sel, params) => {
  const p = params as unknown as PathSetParams;
  return withNode('path.set', doc, p.id, (n) => {
    if (n.kind !== 'Path') return badParams('path.set', `node ${p.id} is not a Path`);
    const next = updateNode(doc, p.id, (node) => ({
      ...(node as any),
      geometry: clonePathGeometry(p.geometry),
    }));
    return ok(next, sel);
  }) as CommandResult;
};

const pathInsertAnchor: CommandHandler = (doc, sel, params) => {
  const p = params as unknown as PathInsertAnchorParams;
  return withNode('path.insertAnchor', doc, p.id, (n) => {
    if (n.kind !== 'Path') return badParams('path.insertAnchor', `node ${p.id} is not a Path`);
    const next = updateNode(doc, p.id, (node) => {
      const pathNode = node as any;
      const subPaths = pathNode.geometry.subPaths.map((sp: any, idx: number) => {
        if (idx !== p.segmentIndex && p.segmentIndex >= pathNode.geometry.subPaths.length) return sp;
        if (idx !== Math.min(p.segmentIndex, pathNode.geometry.subPaths.length - 1)) return sp;
        const anchors = [...sp.anchors];
        const insertAt = Math.min(p.segmentIndex === 0 ? anchors.length : Math.min(anchors.length, p.segmentIndex + 1), anchors.length);
        anchors.splice(insertAt, 0, {
          point: { x: p.point.x, y: p.point.y },
          handleIn: null,
          handleOut: null,
          kind: p.kind,
        });
        return { ...sp, anchors };
      });
      return { ...pathNode, geometry: { ...pathNode.geometry, subPaths } };
    });
    return ok(next, sel);
  }) as CommandResult;
};

const pathDeleteAnchor: CommandHandler = (doc, sel, params) => {
  const p = params as unknown as PathDeleteAnchorParams;
  return withNode('path.deleteAnchor', doc, p.id, (n) => {
    if (n.kind !== 'Path') return badParams('path.deleteAnchor', `node ${p.id} is not a Path`);
    const next = updateNode(doc, p.id, (node) => {
      const pathNode = node as any;
      const subPaths = pathNode.geometry.subPaths.map((sp: any) => {
        if (p.anchorIndex >= sp.anchors.length) return sp;
        const anchors = sp.anchors.filter((_: any, i: number) => i !== p.anchorIndex);
        return { ...sp, anchors };
      });
      return { ...pathNode, geometry: { ...pathNode.geometry, subPaths } };
    });
    return ok(next, sel);
  }) as CommandResult;
};

const pathClose: CommandHandler = (doc, sel, params) => {
  const p = params as unknown as PathCloseParams;
  return withNode('path.close', doc, p.id, (n) => {
    if (n.kind !== 'Path') return badParams('path.close', `node ${p.id} is not a Path`);
    const next = updateNode(doc, p.id, (node) => {
      const pathNode = node as any;
      const subPaths = pathNode.geometry.subPaths.map((sp: any) => ({ ...sp, closed: p.closed }));
      return { ...pathNode, geometry: { ...pathNode.geometry, subPaths } };
    });
    return ok(next, sel);
  }) as CommandResult;
};

// ============================================================================
// 4. object.* 命令（变换 / 编组 / 删除 / 重排）
// ============================================================================

const objectMove: CommandHandler = (doc, sel, params) => {
  const p = params as unknown as ObjectMoveParams;
  let next = doc;
  for (const id of p.ids) {
    if (!next.nodes.has(id)) return noNode('object.move', id);
    next = updateNode(next, id, (n) => {
      const t = n.transform;
      return { ...n, transform: { ...t, e: t.e + p.delta.x, f: t.f + p.delta.y } };
    });
  }
  return ok(next, sel);
};

const objectScale: CommandHandler = (doc, sel, params) => {
  const p = params as unknown as ObjectScaleParams;
  let next = doc;
  for (const id of p.ids) {
    if (!next.nodes.has(id)) return noNode('object.scale', id);
    next = updateNode(next, id, (n) => {
      const t = n.transform;
      // translate to origin, scale, translate back
      const pre: AffineTransform = { a: 1, b: 0, c: 0, d: 1, e: -p.origin.x, f: -p.origin.y };
      const post: AffineTransform = { a: 1, b: 0, c: 0, d: 1, e: p.origin.x, f: p.origin.y };
      const scale: AffineTransform = { a: p.factor.x, b: 0, c: 0, d: p.factor.y, e: 0, f: 0 };
      const scaleAboutOrigin = composeTransforms(post, composeTransforms(scale, pre));
      return { ...n, transform: composeTransforms(scaleAboutOrigin, t) };
    });
  }
  return ok(next, sel);
};

const objectRotate: CommandHandler = (doc, sel, params) => {
  const p = params as unknown as ObjectRotateParams;
  const rad = (p.angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  let next = doc;
  for (const id of p.ids) {
    if (!next.nodes.has(id)) return noNode('object.rotate', id);
    next = updateNode(next, id, (n) => {
      const t = n.transform;
      const rot: AffineTransform = { a: cos, b: sin, c: -sin, d: cos, e: 0, f: 0 };
      const pre: AffineTransform = { a: 1, b: 0, c: 0, d: 1, e: -p.origin.x, f: -p.origin.y };
      const post: AffineTransform = { a: 1, b: 0, c: 0, d: 1, e: p.origin.x, f: p.origin.y };
      const rotAboutOrigin = composeTransforms(post, composeTransforms(rot, pre));
      return { ...n, transform: composeTransforms(rotAboutOrigin, t) };
    });
  }
  return ok(next, sel);
};

const objectTransform: CommandHandler = (doc, sel, params) => {
  const p = params as unknown as ObjectTransformParams;
  let next = doc;
  for (const id of p.ids) {
    if (!next.nodes.has(id)) return noNode('object.transform', id);
    next = updateNode(next, id, (n) => ({
      ...n,
      transform: composeTransforms(p.matrix, n.transform),
    }));
  }
  return ok(next, sel);
};

const objectGroup: CommandHandler = (doc, sel, params) => {
  const p = params as unknown as ObjectGroupParams;
  if (p.ids.length < 2) return badParams('object.group', 'need ≥ 2 nodes');
  // 找到这些节点的公共图层（取第一个节点的图层）
  let hostLayer: NodeId | null = null;
  for (const id of p.ids) {
    const found = findHostLayer(doc, id);
    if (!found) return badParams('object.group', `node ${id} has no host layer`);
    if (!hostLayer) hostLayer = found;
    else if (hostLayer !== found) return badParams('object.group', 'nodes span multiple layers');
  }
  if (!hostLayer) return badParams('object.group', 'no host layer');
  // 创建 Group
  const groupR = appendToLayer(doc, hostLayer, makeGroup(0 as NodeId, p.ids));
  const groupId = groupR.nodeId;
  // 从图层中移除原节点；appendToLayer 已把 group 追加到 children 末位，去重即可
  let next = groupR.doc;
  const layerNode = next.nodes.get(hostLayer) as any;
  const newChildren = layerNode.children.filter((id: NodeId, i: number, arr: readonly NodeId[]) =>
    !p.ids.includes(id) && (id !== groupId || arr.indexOf(groupId) === i),
  );
  next = updateNode(next, hostLayer, (n) => ({ ...(n as any), children: newChildren }));
  // 更新 group 的 children
  next = updateNode(next, groupId, (n) => ({ ...(n as any), children: p.ids, name: p.name ?? null }));
  return ok(next, selectionWith(groupId));
};

const objectUngroup: CommandHandler = (doc, sel, params) => {
  const p = params as unknown as ObjectUngroupParams;
  const id = p.id;
  const group = doc.nodes.get(id);
  if (!group || group.kind !== 'Group') return noNode('object.ungroup', id);
  const hostLayer = findHostLayer(doc, id);
  if (!hostLayer) return badParams('object.ungroup', `node ${id} has no host layer`);
  // 把 group 的 children 提到图层
  let next = doc;
  const layerNode = next.nodes.get(hostLayer) as any;
  const newChildren = layerNode.children.flatMap((c: NodeId) => (c === id ? group.children : [c]));
  next = updateNode(next, hostLayer, (n) => ({ ...(n as any), children: newChildren }));
  next = removeNode(next, id);
  const childIds = [...group.children] as NodeId[];
  return ok(next, selectionWith(id, childIds));
};

const objectReorder: CommandHandler = (doc, sel, params) => {
  const p = params as unknown as ObjectReorderParams;
  if (p.toIndex === undefined && !p.direction) {
    return badParams('object.reorder', 'need direction or toIndex');
  }
  if (!doc.nodes.has(p.id)) return noNode('object.reorder', p.id);
  const parentId = findParent(doc, p.id);
  if (!parentId) return badParams('object.reorder', `node ${p.id} has no parent`);
  if (p.toIndex !== undefined) {
    const parent = doc.nodes.get(parentId);
    if (!parent) return noNode('object.reorder', parentId);
    const arr = [...parent.children];
    const idx = arr.indexOf(p.id);
    if (idx < 0) return badParams('object.reorder', 'not a direct child of parent');
    arr.splice(idx, 1);
    const to = Math.max(0, Math.min(p.toIndex, arr.length));
    arr.splice(to, 0, p.id);
    return ok(updateNode(doc, parentId, (n) => ({ ...n, children: arr })), sel);
  }
  return ok(reorderInLayer(doc, parentId, p.id, p.direction!), sel);
};

const objectDelete: CommandHandler = (doc, sel, params) => {
  const p = params as unknown as ObjectDeleteParams;
  let next = doc;
  for (const id of p.ids) {
    if (!next.nodes.has(id)) return noNode('object.delete', id);
    next = removeNode(next, id);
  }
  return ok(next, emptySelection());
};

const objectSetName: CommandHandler = (doc, sel, params) => {
  const p = params as unknown as ObjectSetNameParams;
  if (!doc.nodes.has(p.id)) return noNode('object.setName', p.id);
  const next = updateNode(doc, p.id, (n) => ({ ...n, name: p.name }));
  return ok(next, sel);
};

const objectSetVisible: CommandHandler = (doc, sel, params) => {
  const p = params as unknown as ObjectSetVisibleParams;
  let next = doc;
  for (const id of p.ids) {
    if (!next.nodes.has(id)) return noNode('object.setVisible', id);
    next = updateNode(next, id, (n) => ({ ...n, visible: p.visible }));
  }
  return ok(next, sel);
};

const objectSetLocked: CommandHandler = (doc, sel, params) => {
  const p = params as unknown as ObjectSetLockedParams;
  let next = doc;
  for (const id of p.ids) {
    if (!next.nodes.has(id)) return noNode('object.setLocked', id);
    next = updateNode(next, id, (n) => ({ ...n, locked: p.locked }));
  }
  return ok(next, sel);
};

const objectAlign: CommandHandler = (doc, sel, params) => {
  const p = params as unknown as ObjectAlignParams;
  if (p.ids.length === 0) return badParams('object.align', 'need ≥ 1 nodes');
  const relative = p.relative ?? 'selection';
  const items: Array<{ id: NodeId; rect: Rect }> = [];
  for (const id of p.ids) {
    if (!doc.nodes.has(id)) return noNode('object.align', id);
    const r = nodeBBox(doc, id);
    if (r) items.push({ id, rect: r });
  }
  if (items.length === 0) return badParams('object.align', 'no mappable geometry');
  let target: Rect;
  if (relative === 'canvas') {
    target = { x: 0, y: 0, width: doc.canvas.width, height: doc.canvas.height };
  } else {
    if (p.ids.length < 2) return badParams('object.align', 'selection relative needs ≥ 2 nodes');
    target = unionRects(items.map((it) => it.rect))!;
  }
  let next = doc;
  for (const it of items) {
    const d = alignDelta(it.rect, target, p.align);
    if (!d || (d.x === 0 && d.y === 0)) continue;
    next = updateNode(next, it.id, (n) => ({
      ...n,
      transform: { ...n.transform, e: n.transform.e + d.x, f: n.transform.f + d.y },
    }));
  }
  return ok(next, sel);
};

const objectDistribute: CommandHandler = (doc, sel, params) => {
  const p = params as unknown as ObjectDistributeParams;
  if (p.ids.length < 3) return badParams('object.distribute', 'need ≥ 3 nodes');
  const items: Array<{ id: NodeId; rect: Rect }> = [];
  for (const id of p.ids) {
    if (!doc.nodes.has(id)) return noNode('object.distribute', id);
    const r = nodeBBox(doc, id);
    if (r) items.push({ id, rect: r });
  }
  if (items.length < 3) return badParams('object.distribute', 'need ≥ 3 nodes with geometry');
  const centers = items.map((it) =>
    p.axis === 'h' ? it.rect.x + it.rect.width / 2 : it.rect.y + it.rect.height / 2,
  );
  const offsets = distributeOffsets(centers);
  let next = doc;
  for (let i = 0; i < items.length; i++) {
    const off = offsets[i]!;
    if (off === 0) continue;
    const dx = p.axis === 'h' ? off : 0;
    const dy = p.axis === 'v' ? off : 0;
    next = updateNode(next, items[i]!.id, (n) => ({
      ...n,
      transform: { ...n.transform, e: n.transform.e + dx, f: n.transform.f + dy },
    }));
  }
  return ok(next, sel);
};

// ============================================================================
// 5. paint.* 命令
// ============================================================================

const paintSetFill: CommandHandler = (doc, sel, params) => {
  const p = params as unknown as PaintSetFillParams;
  let next = doc;
  for (const id of p.ids) {
    if (!next.nodes.has(id)) return noNode('paint.setFill', id);
    next = updateNode(next, id, (n) => {
      if (n.kind !== 'Path' && n.kind !== 'Group') return n;
      const items = (n as any).appearance.items.map((it: any) =>
        it.kind === 'fill' ? { ...it, fill: cloneFill(p.fill) } : it
      );
      // 确保有 fill item
      if (!items.some((it: any) => it.kind === 'fill')) {
        items.unshift({ kind: 'fill', fill: cloneFill(p.fill), blend: 'normal', opacity: 1 });
      }
      return { ...(n as any), appearance: { items } };
    });
  }
  return ok(next, sel);
};

const paintSetStroke: CommandHandler = (doc, sel, params) => {
  const p = params as unknown as PaintSetStrokeParams;
  let next = doc;
  for (const id of p.ids) {
    if (!next.nodes.has(id)) return noNode('paint.setStroke', id);
    next = updateNode(next, id, (n) => {
      if (n.kind !== 'Path' && n.kind !== 'Group') return n;
      const items = (n as any).appearance.items.map((it: any) =>
        it.kind === 'stroke' ? { ...it, stroke: { ...p.stroke } } : it
      );
      if (!items.some((it: any) => it.kind === 'stroke')) {
        items.push({ kind: 'stroke', stroke: { ...p.stroke }, blend: 'normal', opacity: 1 });
      }
      return { ...(n as any), appearance: { items } };
    });
  }
  return ok(next, sel);
};

const paintSetOpacity: CommandHandler = (doc, sel, params) => {
  const p = params as unknown as PaintSetOpacityParams;
  let next = doc;
  for (const id of p.ids) {
    if (!next.nodes.has(id)) return noNode('paint.setOpacity', id);
    next = updateNode(next, id, (n) => ({ ...n, opacity: p.opacity }));
  }
  return ok(next, sel);
};

const paintSetColor: CommandHandler = (doc, sel, params) => {
  const p = params as unknown as PaintSetColorParams;
  const fillPaint: Fill = { type: 'solid', color: p.color, opacity: p.opacity };
  if (p.target === 'fill') return paintSetFill(doc, sel, { ids: p.ids, fill: fillPaint });
  return paintSetStroke(doc, sel, {
    ids: p.ids,
    stroke: { ...defaultStroke(), paint: fillPaint },
  });
};

// ============================================================================
// 6. layer.* 命令
// ============================================================================

const layerAdd: CommandHandler = (doc, sel, params) => {
  const p = params as unknown as LayerAddParams;
  const r = appendLayer(doc, p.name);
  return ok(r.doc, sel);
};

const layerRemove: CommandHandler = (doc, sel, params) => {
  const p = params as unknown as LayerRemoveParams;
  const id = p.id;
  if (!doc.nodes.has(id)) return noNode('layer.remove', id);
  if (doc.layers.length <= 1) return badParams('layer.remove', 'cannot remove last layer');
  return ok(removeNode(doc, id), sel);
};

const layerRename: CommandHandler = (doc, sel, params) => {
  const p = params as unknown as LayerRenameParams;
  if (!doc.nodes.has(p.id)) return noNode('layer.rename', p.id);
  return ok(updateNode(doc, p.id, (n) => (n.kind === 'Layer' ? { ...n, name: p.name } : n)), sel);
};

const layerSetVisibility: CommandHandler = (doc, sel, params) => {
  const p = params as unknown as LayerSetVisibilityParams;
  if (!doc.nodes.has(p.id)) return noNode('layer.setVisibility', p.id);
  return ok(updateNode(doc, p.id, (n) => ({ ...n, visible: p.visible })), sel);
};

const layerSetLock: CommandHandler = (doc, sel, params) => {
  const p = params as unknown as LayerSetLockParams;
  if (!doc.nodes.has(p.id)) return noNode('layer.setLock', p.id);
  return ok(updateNode(doc, p.id, (n) => ({ ...n, locked: p.locked })), sel);
};

const layerReorder: CommandHandler = (doc, sel, params) => {
  const p = params as unknown as LayerReorderParams;
  if (p.toIndex === undefined && !p.direction) {
    return badParams('layer.reorder', 'need direction or toIndex');
  }
  if (!doc.layers.includes(p.id)) return noNode('layer.reorder', p.id);
  const arr = [...doc.layers];
  const idx = arr.indexOf(p.id);
  arr.splice(idx, 1);
  if (p.toIndex !== undefined) {
    const to = Math.max(0, Math.min(p.toIndex, arr.length));
    arr.splice(to, 0, p.id);
  } else {
    switch (p.direction) {
      case 'front': arr.push(p.id); break;
      case 'back': arr.unshift(p.id); break;
      case 'forward': arr.splice(Math.min(idx + 1, arr.length), 0, p.id); break;
      case 'backward': arr.splice(Math.max(idx - 1, 0), 0, p.id); break;
    }
  }
  return ok(cloneDoc(doc, { layers: arr }), sel);
};

// ============================================================================
// 7. select.* 命令（不需要写历史，仅修改 Selection）
// ============================================================================

const selectBox: CommandHandler = (doc, sel, params) => {
  const p = params as unknown as SelectBoxParams;
  const matched: NodeId[] = [];
  for (const id of doc.nodes.keys()) {
    if (id === doc.layers[0]) continue;
    const n = doc.nodes.get(id)!;
    if (!n.visible || n.locked) continue;
    if (n.kind === 'Layer') continue;
    // 简化：用第一个 anchor 作为包围盒
    let x = 0, y = 0, w = 0, h = 0;
    if (n.kind === 'Path' && n.geometry.subPaths.length > 0 && n.geometry.subPaths[0].anchors.length > 0) {
      const a = n.geometry.subPaths[0].anchors[0].point;
      x = a.x; y = a.y; w = 1; h = 1;
    } else if (n.kind === 'Group') {
      x = n.transform.e; y = n.transform.f; w = 1; h = 1;
    } else {
      continue;
    }
    const x2 = x + w;
    const y2 = y + h;
    const intersects = !(x2 < p.rect.x || x > p.rect.x + p.rect.width || y2 < p.rect.y || y > p.rect.y + p.rect.height);
    if (intersects) matched.push(id);
  }
  if (matched.length === 0) return ok(doc, emptySelection());
  const ids = matched as NodeId[];
  const primary = ids[0]!;
  const next = p.additive ? selectionAdd(selectionWith(primary, ids.slice(1)), primary) : selectionWith(primary, ids.slice(1));
  return ok(doc, p.additive ? selectionAdd(sel, ids) : next);
};

const selectSet: CommandHandler = (doc, sel, params) => {
  const p = params as unknown as SelectSetParams;
  if (p.ids.length === 0) return ok(doc, emptySelection());
  const ids = p.ids as NodeId[];
  const primary = ids[0]!;
  return ok(doc, p.additive ? selectionAdd(sel, ids) : selectionWith(primary, ids.slice(1)));
};

const selectAll: CommandHandler = (doc, sel) => {
  const ids: NodeId[] = [];
  for (const [id, n] of doc.nodes) {
    if (n.kind !== 'Layer') ids.push(id);
  }
  if (ids.length === 0) return ok(doc, emptySelection());
  return ok(doc, selectionWith(ids[0] as NodeId, ids.slice(1)));
};

const selectClear: CommandHandler = (doc) => ok(doc, emptySelection());

// ============================================================================
// 8. history.* 与 tool.* 命令（不直接改文档；由 Runtime 特殊处理）
// ============================================================================

const historyUndo: CommandHandler = (doc, sel) => ok(doc, sel);
const historyRedo: CommandHandler = (doc, sel) => ok(doc, sel);
const toolSetActive: CommandHandler = (doc, sel) => ok(doc, sel);

// ============================================================================
// 9. 注册表
// ============================================================================

function createRegistry(): Map<CommandId, CommandSpec> {
  const map = new Map<CommandId, CommandSpec>();
  const reg = (spec: CommandSpec) => {
    map.set(spec.id, spec);
  };

  // path.*
  reg({ id: 'path.set', title: '设置路径几何', undoLabel: '修改路径', params: pathParamsSpec('set'), handler: pathSet });
  reg({ id: 'path.insertAnchor', title: '插入锚点', undoLabel: '插入锚点', params: pathParamsSpec('insertAnchor'), handler: pathInsertAnchor });
  reg({ id: 'path.deleteAnchor', title: '删除锚点', undoLabel: '删除锚点', params: pathParamsSpec('deleteAnchor'), handler: pathDeleteAnchor });
  reg({ id: 'path.close', title: '开闭路径', undoLabel: '开闭路径', params: pathParamsSpec('close'), handler: pathClose });

  // object.*
  reg({ id: 'object.move', title: '移动图元', undoLabel: '移动', params: idsDeltaParams(), handler: objectMove });
  reg({ id: 'object.scale', title: '缩放图元', undoLabel: '缩放', params: idsOriginFactorParams(), handler: objectScale });
  reg({ id: 'object.rotate', title: '旋转图元', undoLabel: '旋转', params: idsOriginAngleParams(), handler: objectRotate });
  reg({ id: 'object.transform', title: '自定义变换', undoLabel: '变换', params: idsMatrixParams(), handler: objectTransform });
  reg({ id: 'object.group', title: '编组', undoLabel: '编组', params: [{ key: 'ids', type: 'nodeIdArray', required: true, description: '图元 ID 列表' }], handler: objectGroup });
  reg({ id: 'object.ungroup', title: '解组', undoLabel: '解组', params: [{ key: 'id', type: 'nodeId', required: true, description: '组 ID' }], handler: objectUngroup });
  reg({ id: 'object.reorder', title: '重排图层顺序', undoLabel: '重排', params: [{ key: 'id', type: 'nodeId', required: true, description: '图元 ID' }, { key: 'direction', type: 'enum', required: false, values: ['front', 'back', 'forward', 'backward'], description: '方向（与 toIndex 二选一）' }, { key: 'toIndex', type: 'integer', required: false, min: 0, description: '插入下标（与 direction 二选一；拖拽排序用）' }], handler: objectReorder });
  reg({ id: 'object.delete', title: '删除图元', undoLabel: '删除', params: [{ key: 'ids', type: 'nodeIdArray', required: true, description: '图元 ID 列表' }], handler: objectDelete });
  reg({ id: 'object.setName', title: '重命名', undoLabel: '重命名', params: [{ key: 'id', type: 'nodeId', required: true, description: '图元 ID' }, { key: 'name', type: 'string', required: false, description: '新名称' }], handler: objectSetName });
  reg({ id: 'object.setVisible', title: '图元显隐', undoLabel: '显隐', params: [{ key: 'ids', type: 'nodeIdArray', required: true, description: '图元 ID 列表' }, { key: 'visible', type: 'boolean', required: true, description: '可见性' }], handler: objectSetVisible });
  reg({ id: 'object.setLocked', title: '图元锁定', undoLabel: '锁定', params: [{ key: 'ids', type: 'nodeIdArray', required: true, description: '图元 ID 列表' }, { key: 'locked', type: 'boolean', required: true, description: '锁定' }], handler: objectSetLocked });
  reg({ id: 'object.align', title: '对齐', undoLabel: '对齐', params: [{ key: 'ids', type: 'nodeIdArray', required: true, description: '图元 ID 列表' }, { key: 'align', type: 'enum', required: true, values: ['left', 'centerH', 'right', 'top', 'centerV', 'bottom'], description: '对齐模式' }, { key: 'relative', type: 'enum', required: false, values: ['selection', 'canvas'], default: 'selection', description: '对齐基准' }], handler: objectAlign });
  reg({ id: 'object.distribute', title: '分布', undoLabel: '分布', params: [{ key: 'ids', type: 'nodeIdArray', required: true, description: '图元 ID 列表（≥3）' }, { key: 'axis', type: 'enum', required: true, values: ['h', 'v'], description: '分布轴' }], handler: objectDistribute });

  // paint.*
  reg({ id: 'paint.setFill', title: '设置填充', undoLabel: '填充', params: [{ key: 'ids', type: 'nodeIdArray', required: true, description: '图元 ID 列表' }, { key: 'fill', type: 'fill', required: true, description: '填充' }], handler: paintSetFill });
  reg({ id: 'paint.setStroke', title: '设置描边', undoLabel: '描边', params: [{ key: 'ids', type: 'nodeIdArray', required: true, description: '图元 ID 列表' }, { key: 'stroke', type: 'stroke', required: true, description: '描边' }], handler: paintSetStroke });
  reg({ id: 'paint.setOpacity', title: '设置透明度', undoLabel: '透明度', params: [{ key: 'ids', type: 'nodeIdArray', required: true, description: '图元 ID 列表' }, { key: 'opacity', type: 'number', required: true, min: 0, max: 1, description: '0..1' }], handler: paintSetOpacity });
  reg({ id: 'paint.setColor', title: '一键着色', undoLabel: '着色', params: [{ key: 'ids', type: 'nodeIdArray', required: true, description: '图元 ID 列表' }, { key: 'target', type: 'enum', required: true, values: ['fill', 'stroke'], description: '目标' }, { key: 'color', type: 'color', required: true, description: '颜色' }, { key: 'opacity', type: 'number', required: true, min: 0, max: 1, description: '0..1' }], handler: paintSetColor });

  // layer.*
  reg({ id: 'layer.add', title: '新建图层', undoLabel: '新建图层', params: [{ key: 'name', type: 'string', required: false, description: '图层名' }], handler: layerAdd });
  reg({ id: 'layer.remove', title: '删除图层', undoLabel: '删除图层', params: [{ key: 'id', type: 'nodeId', required: true, description: '图层 ID' }], handler: layerRemove });
  reg({ id: 'layer.rename', title: '重命名图层', undoLabel: '重命名图层', params: [{ key: 'id', type: 'nodeId', required: true, description: '图层 ID' }, { key: 'name', type: 'string', required: true, description: '新名称' }], handler: layerRename });
  reg({ id: 'layer.setVisibility', title: '图层显隐', undoLabel: '图层显隐', params: [{ key: 'id', type: 'nodeId', required: true, description: '图层 ID' }, { key: 'visible', type: 'boolean', required: true, description: '可见性' }], handler: layerSetVisibility });
  reg({ id: 'layer.setLock', title: '图层锁定', undoLabel: '图层锁定', params: [{ key: 'id', type: 'nodeId', required: true, description: '图层 ID' }, { key: 'locked', type: 'boolean', required: true, description: '锁定' }], handler: layerSetLock });
  reg({ id: 'layer.reorder', title: '图层重排', undoLabel: '图层重排', params: [{ key: 'id', type: 'nodeId', required: true, description: '图层 ID' }, { key: 'direction', type: 'enum', required: false, values: ['front', 'back', 'forward', 'backward'], description: '方向（与 toIndex 二选一）' }, { key: 'toIndex', type: 'integer', required: false, min: 0, description: '插入下标（与 direction 二选一；拖拽排序用）' }], handler: layerReorder });

  // select.*
  reg({ id: 'select.box', title: '框选', undoLabel: '框选', params: [{ key: 'rect', type: 'rect', required: true, description: '矩形' }, { key: 'additive', type: 'boolean', required: false, description: '加选' }], handler: selectBox });
  reg({ id: 'select.set', title: '选中', undoLabel: '选中', params: [{ key: 'ids', type: 'nodeIdArray', required: true, description: '图元 ID 列表' }, { key: 'additive', type: 'boolean', required: false, description: '加选' }], handler: selectSet });
  reg({ id: 'select.all', title: '全选', undoLabel: '全选', params: [], handler: selectAll });
  reg({ id: 'select.clear', title: '清空选择', undoLabel: '清空选择', params: [], handler: selectClear });

  // history.* / tool.*
  reg({ id: 'history.undo', title: '撤销', undoLabel: '撤销', params: [], handler: historyUndo });
  reg({ id: 'history.redo', title: '重做', undoLabel: '重做', params: [], handler: historyRedo });
  reg({ id: 'tool.setActive', title: '切换工具', undoLabel: '切换工具', params: [{ key: 'tool', type: 'enum', required: true, values: ['select', 'node', 'pen'], description: '工具' }], handler: toolSetActive });

  return map;
}

function pathParamsSpec(_kind: string): ReadonlyArray<ParamSpec> {
  return [
    { key: 'id', type: 'nodeId', required: true, description: '路径 ID' },
    { key: 'geometry', type: 'object', required: true, description: 'PathGeometry' },
  ];
}
function idsDeltaParams(): ReadonlyArray<ParamSpec> {
  return [
    { key: 'ids', type: 'nodeIdArray', required: true, description: '图元 ID 列表' },
    { key: 'delta', type: 'vec2', required: true, description: '偏移量' },
  ];
}
function idsOriginFactorParams(): ReadonlyArray<ParamSpec> {
  return [
    { key: 'ids', type: 'nodeIdArray', required: true, description: '图元 ID 列表' },
    { key: 'origin', type: 'vec2', required: true, description: '缩放原点' },
    { key: 'factor', type: 'vec2', required: true, description: '缩放因子' },
  ];
}
function idsOriginAngleParams(): ReadonlyArray<ParamSpec> {
  return [
    { key: 'ids', type: 'nodeIdArray', required: true, description: '图元 ID 列表' },
    { key: 'origin', type: 'vec2', required: true, description: '旋转原点' },
    { key: 'angleDeg', type: 'number', required: true, description: '角度（度）' },
  ];
}
function idsMatrixParams(): ReadonlyArray<ParamSpec> {
  return [
    { key: 'ids', type: 'nodeIdArray', required: true, description: '图元 ID 列表' },
    { key: 'matrix', type: 'transform', required: true, description: '矩阵' },
  ];
}

// ============================================================================
// 10. 工具函数
// ============================================================================

function findHostLayer(doc: Document, id: NodeId): NodeId | null {
  for (const layerId of doc.layers) {
    const layer = doc.nodes.get(layerId);
    if (!layer) continue;
    const stack: NodeId[] = [...layer.children];
    while (stack.length > 0) {
      const cur = stack.pop()!;
      if (cur === id) return layerId;
      const n = doc.nodes.get(cur);
      if (n && n.kind === 'Group') stack.push(...n.children);
    }
  }
  return null;
}

// ============================================================================
// 11. Registry 实例
// ============================================================================

const _registry = createRegistry();

export const commandRegistry: CommandRegistry = {
  commands: _registry,
  list() {
    return Array.from(_registry.values());
  },
  find(id) {
    return _registry.get(id) ?? null;
  },
  register(spec) {
    _registry.set(spec.id, spec);
  },
};