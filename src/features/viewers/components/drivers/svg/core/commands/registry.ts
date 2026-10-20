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
  ObjectDuplicateParams,
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
  ObjectCreatePathParams,
  ObjectCreateTextParams,
  TextSetTextParams,
  PathUpdateAnchorParams,
  PathToggleAnchorKindParams,
  PathSetMarkerParams,
} from './types';
import type {
  AffineTransform,
  BlendMode,
  Color,
  Document,
  Fill,
  Node,
  NodeId,
  PathNode,
  TextNode,
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
  emptyAppearance,
  emptySelection,
  identityTransform,
  invertTransform,
  makeGroup,
  makePath,
  removeNode,
  reorderInLayer,
  selectionAdd,
  selectionClear,
  selectionRemove,
  selectionToggle,
  selectionWith,
  updateNode,
} from '../model/document';
import { parsePathD, serializePathD } from '../model/path';
import { alignDelta, distributeOffsets, nodeBBox, nodeWorldBBox, nodeWorldTransform, unionRects } from '../model/bbox';
import { findParent, keepDisjointRoots } from '../model/tree';

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

const pathUpdateAnchor: CommandHandler = (doc, sel, params) => {
  const p = params as unknown as PathUpdateAnchorParams;
  return withNode('path.updateAnchor', doc, p.id, (n) => {
    if (n.kind !== 'Path') return badParams('path.updateAnchor', `node ${p.id} is not a Path`);
    const pathNode = n as PathNode;
    const subPathIdx = p.subPathIndex ?? 0;
    const subPaths = pathNode.geometry.subPaths.map((sp, idx) => {
      if (idx !== subPathIdx) return sp;
      const anchors = sp.anchors.map((a, aIdx) => {
        if (aIdx !== p.anchorIndex) return a;
        return {
          ...a,
          point: p.point ? { x: p.point.x, y: p.point.y } : a.point,
          handleIn: p.handleIn !== undefined ? p.handleIn : a.handleIn,
          handleOut: p.handleOut !== undefined ? p.handleOut : a.handleOut,
        };
      });
      return { ...sp, anchors };
    });
    const next = updateNode(doc, p.id, (node) => ({
      ...(node as any),
      geometry: { ...pathNode.geometry, subPaths },
    }));
    return ok(next, sel);
  }) as CommandResult;
};

const pathToggleAnchorKind: CommandHandler = (doc, sel, params) => {
  const p = params as unknown as PathToggleAnchorKindParams;
  return withNode('path.toggleAnchorKind', doc, p.id, (n) => {
    if (n.kind !== 'Path') return badParams('path.toggleAnchorKind', `node ${p.id} is not a Path`);
    const pathNode = n as PathNode;
    const subPathIdx = p.subPathIndex ?? 0;
    const sp = pathNode.geometry.subPaths[subPathIdx];
    if (!sp || !sp.anchors[p.anchorIndex]) return badParams('path.toggleAnchorKind', 'invalid anchor index');
    const a = sp.anchors[p.anchorIndex]!;
    const nextKind = p.targetKind ?? (a.kind === 'corner' ? 'smooth' : 'corner');
    const subPaths = pathNode.geometry.subPaths.map((sub, idx) => {
      if (idx !== subPathIdx) return sub;
      const anchors = sub.anchors.map((anc, aIdx) => {
        if (aIdx !== p.anchorIndex) return anc;
        if (nextKind === 'corner') {
          return { ...anc, kind: 'corner' as const, handleIn: null, handleOut: null };
        } else {
          const prev = sub.anchors[(aIdx - 1 + sub.anchors.length) % sub.anchors.length]!;
          const next = sub.anchors[(aIdx + 1) % sub.anchors.length]!;
          const tangent = { x: (next.point.x - prev.point.x) * 0.25, y: (next.point.y - prev.point.y) * 0.25 };
          return {
            ...anc,
            kind: 'smooth' as const,
            handleIn: { x: -tangent.x, y: -tangent.y },
            handleOut: { x: tangent.x, y: tangent.y },
          };
        }
      });
      return { ...sub, anchors };
    });
    const nextDoc = updateNode(doc, p.id, (node) => ({
      ...(node as any),
      geometry: { ...pathNode.geometry, subPaths },
    }));
    return ok(nextDoc, sel);
  }) as CommandResult;
};

const pathSetMarker: CommandHandler = (doc, sel, params) => {
  const p = params as unknown as PathSetMarkerParams;
  return withNode('path.setMarker', doc, p.id, (n) => {
    if (n.kind !== 'Path') return badParams('path.setMarker', `node ${p.id} is not a Path`);
    const nextDoc = updateNode(doc, p.id, (node) => ({
      ...node,
      markerStart: p.markerStart !== undefined ? (p.markerStart === 'none' || p.markerStart === null ? undefined : p.markerStart) : (node as PathNode).markerStart,
      markerEnd: p.markerEnd !== undefined ? (p.markerEnd === 'none' || p.markerEnd === null ? undefined : p.markerEnd) : (node as PathNode).markerEnd,
    }));
    return ok(nextDoc, sel);
  }) as CommandResult;
};

// ============================================================================
// 4. object.* 命令（变换 / 编组 / 删除 / 重排）
// ============================================================================

const objectMove: CommandHandler = (doc, sel, params) => {
  const p = params as unknown as ObjectMoveParams;
  let next = doc;
  const cleanIds = keepDisjointRoots(next, p.ids);
  for (const id of cleanIds) {
    if (!next.nodes.has(id)) return noNode('object.move', id);
    const parentId = findParent(next, id);
    let delta = p.delta;
    if (parentId) {
      const parentWorldT = nodeWorldTransform(next, parentId);
      const det = parentWorldT.a * parentWorldT.d - parentWorldT.b * parentWorldT.c;
      if (Math.abs(det) > 1e-6) {
        const dx = (p.delta.x * parentWorldT.d - p.delta.y * parentWorldT.c) / det;
        const dy = (p.delta.y * parentWorldT.a - p.delta.x * parentWorldT.b) / det;
        delta = { x: dx, y: dy };
      }
    }
    next = updateNode(next, id, (n) => {
      const t = n.transform;
      return { ...n, transform: { ...t, e: t.e + delta.x, f: t.f + delta.y } };
    });
  }
  return ok(next, sel);
};

const objectScale: CommandHandler = (doc, sel, params) => {
  const p = params as unknown as ObjectScaleParams;
  let next = doc;
  const cleanIds = keepDisjointRoots(next, p.ids);
  for (const id of cleanIds) {
    if (!next.nodes.has(id)) return noNode('object.scale', id);
    const parentId = findParent(next, id);
    const parentT = parentId ? nodeWorldTransform(next, parentId) : identityTransform();
    const invParentT = invertTransform(parentT) ?? identityTransform();
    next = updateNode(next, id, (n) => {
      const t = n.transform;
      // translate to origin, scale, translate back
      const pre: AffineTransform = { a: 1, b: 0, c: 0, d: 1, e: -p.origin.x, f: -p.origin.y };
      const post: AffineTransform = { a: 1, b: 0, c: 0, d: 1, e: p.origin.x, f: p.origin.y };
      const scale: AffineTransform = { a: p.factor.x, b: 0, c: 0, d: p.factor.y, e: 0, f: 0 };
      const scaleAboutOrigin = composeTransforms(post, composeTransforms(scale, pre));
      const localM = composeTransforms(invParentT, composeTransforms(scaleAboutOrigin, parentT));
      return { ...n, transform: composeTransforms(localM, t) };
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
  const cleanIds = keepDisjointRoots(next, p.ids);
  for (const id of cleanIds) {
    if (!next.nodes.has(id)) return noNode('object.rotate', id);
    const parentId = findParent(next, id);
    const parentT = parentId ? nodeWorldTransform(next, parentId) : identityTransform();
    const invParentT = invertTransform(parentT) ?? identityTransform();
    next = updateNode(next, id, (n) => {
      const t = n.transform;
      const rot: AffineTransform = { a: cos, b: sin, c: -sin, d: cos, e: 0, f: 0 };
      const pre: AffineTransform = { a: 1, b: 0, c: 0, d: 1, e: -p.origin.x, f: -p.origin.y };
      const post: AffineTransform = { a: 1, b: 0, c: 0, d: 1, e: p.origin.x, f: p.origin.y };
      const rotAboutOrigin = composeTransforms(post, composeTransforms(rot, pre));
      const localM = composeTransforms(invParentT, composeTransforms(rotAboutOrigin, parentT));
      return { ...n, transform: composeTransforms(localM, t) };
    });
  }
  return ok(next, sel);
};

const objectTransform: CommandHandler = (doc, sel, params) => {
  const p = params as unknown as ObjectTransformParams;
  let next = doc;
  const cleanIds = keepDisjointRoots(next, p.ids);
  for (const id of cleanIds) {
    if (!next.nodes.has(id)) return noNode('object.transform', id);
    next = updateNode(next, id, (n) => ({
      ...n,
      transform: composeTransforms(p.matrix, n.transform),
    }));
  }
  return ok(next, sel);
};

const objectDuplicate: CommandHandler = (doc, sel, params) => {
  const p = params as unknown as ObjectDuplicateParams;
  const rawTargetIds = (p.ids && p.ids.length > 0) ? p.ids : sel.nodeIds;
  if (!rawTargetIds || rawTargetIds.length === 0) return ok(doc, sel);
  const targetIds = keepDisjointRoots(doc, rawTargetIds);
  if (!targetIds || targetIds.length === 0) return ok(doc, sel);

  const offset = p.offset ?? { x: 10, y: 10 };
  let next = doc;
  const newIds: NodeId[] = [];

  function cloneSubtree(d: Document, sourceId: NodeId, isRoot: boolean): { d: Document; newId: NodeId } {
    const src = d.nodes.get(sourceId);
    if (!src) return { d, newId: sourceId };
    const newId = d.nextNodeId as NodeId;
    let updatedDoc: Document = { ...d, nextNodeId: ((d.nextNodeId as number) + 1) as NodeId };
    const t = isRoot
      ? { ...src.transform, e: src.transform.e + offset.x, f: src.transform.f + offset.y }
      : src.transform;

    if (src.kind === 'Group') {
      const clonedChildIds: NodeId[] = [];
      for (const chId of src.children) {
        const res = cloneSubtree(updatedDoc, chId, false);
        updatedDoc = res.d;
        clonedChildIds.push(res.newId);
      }
      const clonedGroup: Node = {
        ...src,
        id: newId,
        children: clonedChildIds,
        transform: t,
      };
      const newNodes = new Map(updatedDoc.nodes);
      newNodes.set(newId, clonedGroup);
      return { d: { ...updatedDoc, nodes: newNodes }, newId };
    } else {
      const clonedNode: Node = {
        ...src,
        id: newId,
        transform: t,
      };
      const newNodes = new Map(updatedDoc.nodes);
      newNodes.set(newId, clonedNode);
      return { d: { ...updatedDoc, nodes: newNodes }, newId };
    }
  }

  for (const srcId of targetIds) {
    if (!next.nodes.has(srcId)) continue;
    const parentId = findParent(next, srcId);
    if (!parentId) continue;

    const res = cloneSubtree(next, srcId, true);
    next = res.d;
    const clonedId = res.newId;
    newIds.push(clonedId);

    const parent = next.nodes.get(parentId);
    if (parent && 'children' in parent) {
      const children = [...(parent as any).children];
      const idx = children.indexOf(srcId);
      if (idx >= 0) {
        children.splice(idx + 1, 0, clonedId);
      } else {
        children.push(clonedId);
      }
      next = updateNode(next, parentId, (n) => ({ ...(n as any), children }));
    }
  }

  if (newIds.length === 0) return ok(doc, sel);
  return ok(next, { nodeIds: newIds, primaryId: newIds[0] });
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
  const p = params as any;
  const targetIds: NodeId[] = p.id != null ? [p.id] : (Array.isArray(p.ids) ? p.ids : []);
  if (targetIds.length === 0) return badParams('object.ungroup', 'need id or ids');
  let next = doc;
  const allNewSelection: NodeId[] = [];
  for (const id of targetIds) {
    const group = next.nodes.get(id);
    if (!group || group.kind !== 'Group') continue;
    const parentId = findParent(next, id);
    if (!parentId) continue;
    const parentNode = next.nodes.get(parentId);
    if (!parentNode || !('children' in parentNode)) continue;

    // 把 group 的每个子图元吸收 group.transform，确保解组后在画布上的绝对坐标保持不变
    for (const cid of group.children) {
      next = updateNode(next, cid, (child) => ({
        ...child,
        transform: composeTransforms(group.transform, child.transform),
      }));
    }

    // 把 group 替换为其直接子图元序列
    const parentChildren = [...(parentNode as any).children];
    const groupIdx = parentChildren.indexOf(id);
    const newChildren = groupIdx >= 0
      ? [...parentChildren.slice(0, groupIdx), ...group.children, ...parentChildren.slice(groupIdx + 1)]
      : [...parentChildren.filter((c: NodeId) => c !== id), ...group.children];

    next = updateNode(next, parentId, (n) => ({ ...(n as any), children: newChildren }));
    next = removeNode(next, id);
    allNewSelection.push(...group.children);
  }
  return ok(next, allNewSelection.length > 0 ? selectionWith(allNewSelection[0]!, allNewSelection.slice(1)) : emptySelection());
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
  const cleanIds = keepDisjointRoots(next, p.ids);
  for (const id of cleanIds) {
    if (!doc.nodes.has(id)) return noNode('object.delete', id);
    if (!next.nodes.has(id)) continue;
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
  const cleanIds = keepDisjointRoots(doc, p.ids);
  if (cleanIds.length === 0) return badParams('object.align', 'no valid nodes');
  const items: Array<{ id: NodeId; rect: Rect }> = [];
  for (const id of cleanIds) {
    if (!doc.nodes.has(id)) return noNode('object.align', id);
    const r = nodeWorldBBox(doc, id);
    if (r) items.push({ id, rect: r });
  }
  if (items.length === 0) return badParams('object.align', 'no mappable geometry');
  let target: Rect;
  if (relative === 'canvas') {
    target = {
      x: doc.canvas.viewBox?.x ?? 0,
      y: doc.canvas.viewBox?.y ?? 0,
      width: doc.canvas.viewBox?.width ?? doc.canvas.width,
      height: doc.canvas.viewBox?.height ?? doc.canvas.height,
    };
  } else {
    if (cleanIds.length < 2) return badParams('object.align', 'selection relative needs ≥ 2 nodes');
    target = unionRects(items.map((it) => it.rect))!;
  }
  let next = doc;
  for (const it of items) {
    const d = alignDelta(it.rect, target, p.align);
    if (!d || (d.x === 0 && d.y === 0)) continue;
    const parentId = findParent(next, it.id);
    const parentT = parentId ? nodeWorldTransform(next, parentId) : identityTransform();
    const det = parentT.a * parentT.d - parentT.b * parentT.c;
    let localDx = d.x;
    let localDy = d.y;
    if (Math.abs(det) > 1e-9) {
      localDx = (parentT.d * d.x - parentT.c * d.y) / det;
      localDy = (-parentT.b * d.x + parentT.a * d.y) / det;
    }
    next = updateNode(next, it.id, (n) => ({
      ...n,
      transform: { ...n.transform, e: n.transform.e + localDx, f: n.transform.f + localDy },
    }));
  }
  return ok(next, sel);
};

const objectDistribute: CommandHandler = (doc, sel, params) => {
  const p = params as unknown as ObjectDistributeParams;
  const cleanIds = keepDisjointRoots(doc, p.ids);
  if (cleanIds.length < 3) return badParams('object.distribute', 'need ≥ 3 nodes');
  const items: Array<{ id: NodeId; rect: Rect }> = [];
  for (const id of cleanIds) {
    if (!doc.nodes.has(id)) return noNode('object.distribute', id);
    const r = nodeWorldBBox(doc, id);
    if (r) items.push({ id, rect: r });
  }
  if (items.length < 3) return badParams('object.distribute', 'need ≥ 3 nodes with geometry');
  const isH = p.axis === 'h' || p.axis === 'horizontal';
  const centers = items.map((it) =>
    isH ? it.rect.x + it.rect.width / 2 : it.rect.y + it.rect.height / 2,
  );
  const offsets = distributeOffsets(centers);
  let next = doc;
  for (let i = 0; i < items.length; i++) {
    const off = offsets[i]!;
    if (off === 0) continue;
    const dx = isH ? off : 0;
    const dy = isH ? 0 : off;
    const parentId = findParent(next, items[i]!.id);
    const parentT = parentId ? nodeWorldTransform(next, parentId) : identityTransform();
    const det = parentT.a * parentT.d - parentT.b * parentT.c;
    let localDx = dx;
    let localDy = dy;
    if (Math.abs(det) > 1e-9) {
      localDx = (parentT.d * dx - parentT.c * dy) / det;
      localDy = (-parentT.b * dx + parentT.a * dy) / det;
    }
    next = updateNode(next, items[i]!.id, (n) => ({
      ...n,
      transform: { ...n.transform, e: n.transform.e + localDx, f: n.transform.f + localDy },
    }));
  }
  return ok(next, sel);
};

const objectCreatePath: CommandHandler = (doc, _sel, params) => {
  const p = params as unknown as ObjectCreatePathParams;
  const targetLayer = p.layerId ?? (doc.layers.length > 0 ? doc.layers[doc.layers.length - 1] : null);
  if (!targetLayer) return badParams('object.createPath', 'no layer available in document');
  const pathNode = makePath(
    0 as NodeId,
    p.geometry,
    p.appearance ?? emptyAppearance(),
    p.hint ?? 'path'
  );
  if (p.name) (pathNode as any).name = p.name;
  const { doc: nextDoc, nodeId } = appendToLayer(doc, targetLayer, pathNode);
  return ok(nextDoc, selectionWith(nodeId));
};

const objectCreateText: CommandHandler = (doc, _sel, params) => {
  const p = params as unknown as ObjectCreateTextParams;
  const targetLayer = p.layerId ?? (doc.layers.length > 0 ? doc.layers[doc.layers.length - 1] : null);
  if (!targetLayer) return badParams('object.createText', 'no layer available in document');
  const textNode: TextNode = {
    id: 0 as NodeId,
    kind: 'Text',
    name: p.name ?? null,
    transform: identityTransform(),
    opacity: 1,
    blend: 'normal',
    visible: true,
    locked: false,
    children: [],
    text: p.text || '文本',
    x: p.x,
    y: p.y,
    fontSize: p.fontSize ?? 16,
    fontFamily: p.fontFamily ?? 'system-ui, sans-serif',
    textAnchor: p.textAnchor ?? 'start',
    appearance: p.appearance ?? {
      items: [
        {
          kind: 'fill',
          fill: { type: 'solid', color: '#111827' as Color, opacity: 1 },
          blend: 'normal',
          opacity: 1,
        },
      ],
    },
  };
  const { doc: nextDoc, nodeId } = appendToLayer(doc, targetLayer, textNode);
  return ok(nextDoc, selectionWith(nodeId));
};

const textSetText: CommandHandler = (doc, sel, params) => {
  const p = params as unknown as TextSetTextParams;
  return withNode('text.setText', doc, p.id, (n) => {
    if (n.kind !== 'Text') return badParams('text.setText', `node ${p.id} is not a Text`);
    const next = updateNode(doc, p.id, (node) => {
      const tn = node as TextNode;
      return {
        ...tn,
        text: p.text !== undefined ? p.text : tn.text,
        fontSize: p.fontSize !== undefined ? p.fontSize : tn.fontSize,
        fontFamily: p.fontFamily !== undefined ? p.fontFamily : tn.fontFamily,
        textAnchor: p.textAnchor !== undefined ? p.textAnchor : tn.textAnchor,
      };
    });
    return ok(next, sel);
  }) as CommandResult;
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
      if (n.kind !== 'Path' && n.kind !== 'Group' && n.kind !== 'Text') return n;
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
  const mode = p.mode ?? 'enclosed';

  const isContained = (r: { x: number; y: number; width: number; height: number }): boolean =>
    r.x >= p.rect.x &&
    r.y >= p.rect.y &&
    r.x + r.width <= p.rect.x + p.rect.width &&
    r.y + r.height <= p.rect.y + p.rect.height;

  const intersects = (r: { x: number; y: number; width: number; height: number }): boolean =>
    !(r.x + r.width < p.rect.x || r.x > p.rect.x + p.rect.width || r.y + r.height < p.rect.y || r.y > p.rect.y + p.rect.height);

  const checkMatch = mode === 'intersect' ? intersects : isContained;

  // 画布面积：用于防止小范围框选时误选大背景
  const canvasW = doc.canvas?.width || 800;
  const canvasH = doc.canvas?.height || 600;
  const canvasArea = canvasW * canvasH;
  const selArea = p.rect.width * p.rect.height;

  // 检查是否正在某个 Group 内部编辑（当前选区恰为单一 Group）
  const activeGroup = (sel.nodeIds.length === 1 && doc.nodes.get(sel.nodeIds[0]!)?.kind === 'Group')
    ? (doc.nodes.get(sel.nodeIds[0]!) as Extract<Node, { kind: 'Group' }>)
    : null;

  const candidateIds: NodeId[] = [];
  if (activeGroup) {
    for (const cid of activeGroup.children) candidateIds.push(cid);
  } else {
    for (const layerId of doc.layers) {
      const layer = doc.nodes.get(layerId);
      if (!layer || layer.kind !== 'Layer' || !layer.visible || layer.locked) continue;
      for (const childId of layer.children) candidateIds.push(childId);
    }
  }

  for (const childId of candidateIds) {
    const n = doc.nodes.get(childId);
    if (!n || !n.visible || n.locked) continue;
    const bb = nodeWorldBBox(doc, childId);
    if (!bb) continue;

    // 面积占满 80% 画布以上的大底图，在非大面积框选时予以忽略保护
    const isHugeBackground = (bb.width * bb.height) >= canvasArea * 0.8 && selArea < canvasArea * 0.6;
    if (isHugeBackground && mode !== 'enclosed') continue;

    if (checkMatch(bb)) matched.push(childId);
  }

  if (matched.length === 0) return ok(doc, p.additive ? sel : emptySelection());
  const ids = matched as NodeId[];
  const primary = ids[0]!;
  const next = p.additive ? selectionAdd(sel, ids) : selectionWith(primary, ids.slice(1));
  return ok(doc, next);
};

const selectSet: CommandHandler = (doc, sel, params) => {
  const p = params as unknown as SelectSetParams;
  if (p.ids.length === 0) return ok(doc, emptySelection());
  const ids = p.ids as NodeId[];
  const primary = ids[0]!;

  // 显式指定 toggle，或者按住 Shift/修饰键 (additive) 且仅针对单个已有图元时触发反选剔除
  if (p.toggle || (p.additive && ids.length === 1 && sel.nodeIds.includes(primary))) {
    return ok(doc, selectionToggle(sel, primary));
  }

  return ok(doc, p.additive ? selectionAdd(sel, ids) : selectionWith(primary, ids.slice(1)));
};

const selectAll: CommandHandler = (doc, sel) => {
  const ids: NodeId[] = [];
  for (const layerId of doc.layers) {
    const layer = doc.nodes.get(layerId);
    if (!layer || layer.kind !== 'Layer' || layer.locked || !layer.visible) continue;
    for (const childId of layer.children) {
      const child = doc.nodes.get(childId);
      if (child && !child.locked && child.visible) {
        ids.push(childId);
      }
    }
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
  reg({ id: 'path.updateAnchor', title: '更新锚点', undoLabel: '移动锚点', params: [{ key: 'id', type: 'nodeId', required: true, description: '路径 ID' }], handler: pathUpdateAnchor });
  reg({ id: 'path.toggleAnchorKind', title: '切换锚点类型', undoLabel: '切换锚点类型', params: [{ key: 'id', type: 'nodeId', required: true, description: '路径 ID' }], handler: pathToggleAnchorKind });
  reg({ id: 'path.setMarker', title: '设置端点箭头', undoLabel: '设置箭头', params: [{ key: 'id', type: 'nodeId', required: true, description: '路径 ID' }], handler: pathSetMarker });
  reg({ id: 'path.close', title: '开闭路径', undoLabel: '开闭路径', params: pathParamsSpec('close'), handler: pathClose });

  // object.*
  reg({ id: 'object.createPath', title: '创建形状', undoLabel: '创建形状', params: [{ key: 'geometry', type: 'object', required: true, description: '几何' }], handler: objectCreatePath });
  reg({ id: 'object.createText', title: '创建文本', undoLabel: '创建文本', params: [{ key: 'text', type: 'string', required: true, description: '文本内容' }], handler: objectCreateText });
  reg({ id: 'text.setText', title: '编辑文本', undoLabel: '编辑文本', params: [{ key: 'id', type: 'nodeId', required: true, description: '文本 ID' }], handler: textSetText });
  reg({ id: 'object.move', title: '移动图元', undoLabel: '移动', params: idsDeltaParams(), handler: objectMove });
  reg({ id: 'object.scale', title: '缩放图元', undoLabel: '缩放', params: idsOriginFactorParams(), handler: objectScale });
  reg({ id: 'object.rotate', title: '旋转图元', undoLabel: '旋转', params: idsOriginAngleParams(), handler: objectRotate });
  reg({ id: 'object.transform', title: '自定义变换', undoLabel: '变换', params: idsMatrixParams(), handler: objectTransform });
  reg({ id: 'object.duplicate', title: '复制图元', undoLabel: '复制', params: [{ key: 'ids', type: 'nodeIdArray', required: false, description: '图元 ID 列表' }, { key: 'offset', type: 'vec2', required: false, description: '复制偏移量' }], handler: objectDuplicate });
  reg({ id: 'object.group', title: '编组', undoLabel: '编组', params: [{ key: 'ids', type: 'nodeIdArray', required: true, description: '图元 ID 列表' }], handler: objectGroup });
  reg({ id: 'object.ungroup', title: '解组', undoLabel: '解组', params: [{ key: 'id', type: 'nodeId', required: true, description: '组 ID' }], handler: objectUngroup });
  reg({ id: 'object.reorder', title: '重排图层顺序', undoLabel: '重排', params: [{ key: 'id', type: 'nodeId', required: true, description: '图元 ID' }, { key: 'direction', type: 'enum', required: false, values: ['front', 'back', 'forward', 'backward'], description: '方向（与 toIndex 二选一）' }, { key: 'toIndex', type: 'integer', required: false, min: 0, description: '插入下标（与 direction 二选一；拖拽排序用）' }], handler: objectReorder });
  reg({ id: 'object.delete', title: '删除图元', undoLabel: '删除', params: [{ key: 'ids', type: 'nodeIdArray', required: true, description: '图元 ID 列表' }], handler: objectDelete });
  reg({ id: 'object.setName', title: '重命名', undoLabel: '重命名', params: [{ key: 'id', type: 'nodeId', required: true, description: '图元 ID' }, { key: 'name', type: 'string', required: false, description: '新名称' }], handler: objectSetName });
  reg({ id: 'object.setVisible', title: '图元显隐', undoLabel: '显隐', params: [{ key: 'ids', type: 'nodeIdArray', required: true, description: '图元 ID 列表' }, { key: 'visible', type: 'boolean', required: true, description: '可见性' }], handler: objectSetVisible });
  reg({ id: 'object.setLocked', title: '图元锁定', undoLabel: '锁定', params: [{ key: 'ids', type: 'nodeIdArray', required: true, description: '图元 ID 列表' }, { key: 'locked', type: 'boolean', required: true, description: '锁定' }], handler: objectSetLocked });
  reg({ id: 'object.align', title: '对齐', undoLabel: '对齐', params: [{ key: 'ids', type: 'nodeIdArray', required: true, description: '图元 ID 列表' }, { key: 'align', type: 'enum', required: true, values: ['left', 'centerH', 'center', 'right', 'top', 'centerV', 'middle', 'bottom'], description: '对齐模式' }, { key: 'relative', type: 'enum', required: false, values: ['selection', 'canvas'], default: 'selection', description: '对齐基准' }], handler: objectAlign });
  reg({ id: 'object.distribute', title: '分布', undoLabel: '分布', params: [{ key: 'ids', type: 'nodeIdArray', required: true, description: '图元 ID 列表（≥3）' }, { key: 'axis', type: 'enum', required: true, values: ['h', 'v', 'horizontal', 'vertical'], description: '分布轴' }], handler: objectDistribute });

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
  reg({ id: 'tool.setActive', title: '切换工具', undoLabel: '切换工具', params: [{ key: 'tool', type: 'enum', required: true, values: ['select', 'node', 'pen', 'rect', 'ellipse', 'line', 'text'], description: '工具' }], handler: toolSetActive });

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