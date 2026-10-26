import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Trash2,
  ArrowLeftRight,
  Folder,
  FolderOpen,
  ArrowUpToLine,
  ArrowDownToLine,
  ArrowUp,
  ArrowDown,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  Pipette,
  Paintbrush,
  Scaling,
  Maximize2,
  Copy,
  Tag,
  Code,
  Sparkles,
  ChevronDown,
  ChevronRight,
  Plus,
} from 'lucide-react';
import {
  getBoundingBox,
  getSelectionBBox,
  defaultStroke,
  isTwoPointLineNode,
  isOpenPolylineNode,
  isCurvedLineNode,
  isRectNode,
  getRectCornerRadius,
  getLineWorldEndpoints,
  getPolylineWorldAnchors,
  nodeWorldBBox,
  nodeWorldTransform,
  parseGlobalStyles,
  getDocumentGlobalStyles,
  SVG_STYLE_PRESETS,
  getClassesInUse,
  RAW_DEFS_METADATA_KEY,
  type AlignMode,
  type CommandId,
  type CommandParams,
  type Document,
  type NodeId,
  type PathNode,
} from './core';

export interface SvgV2InspectorProps {
  readonly document: Document;
  readonly selection: { primaryId: NodeId | null; nodeIds: ReadonlyArray<NodeId> };
  readonly execute: (id: CommandId, params: CommandParams) => void;
}

export interface StyleBuffer {
  fillColor?: string;
  fillOpacity?: number;
  stroke?: {
    color: string;
    width: number;
    cap: 'butt' | 'round' | 'square';
    dashArray: readonly number[] | null;
  };
  markerStart?: string;
  markerEnd?: string;
  cornerRadius?: number;
  text?: {
    fontFamily?: string;
    fontWeight?: string;
    fontSize?: number;
    textAnchor?: 'start' | 'middle' | 'end';
  };
}

export interface SizeBuffer {
  width: number;
  height: number;
  aspectRatio: number;
  sourceName?: string;
}

let globalStyleBuffer: StyleBuffer | null = null;
let globalSizeBuffer: SizeBuffer | null = null;

function collectRectNodes(doc: Document, ids: ReadonlyArray<NodeId>): PathNode[] {
  const result: PathNode[] = [];
  const seen = new Set<NodeId>();
  const visit = (id: NodeId) => {
    if (seen.has(id)) return;
    seen.add(id);
    const n = doc.nodes.get(id);
    if (!n) return;
    if (n.kind === 'Path' && isRectNode(n)) {
      result.push(n);
    } else if (n.kind === 'Group' || n.kind === 'Layer') {
      for (const cid of n.children) visit(cid);
    }
  };
  for (const id of ids) visit(id);
  return result;
}

const ALIGN_BUTTONS: ReadonlyArray<{ mode: AlignMode; label: string; desc: string }> = [
  { mode: 'left', label: '左对齐', desc: '将所有选中图元左边缘对齐' },
  { mode: 'centerH', label: '水平居中', desc: '将所有选中图元水平中心线对齐' },
  { mode: 'right', label: '右对齐', desc: '将所有选中图元右边缘对齐' },
  { mode: 'top', label: '顶对齐', desc: '将所有选中图元上边缘对齐' },
  { mode: 'centerV', label: '垂直居中', desc: '将所有选中图元垂直中心线对齐' },
  { mode: 'bottom', label: '底对齐', desc: '将所有选中图元下边缘对齐' },
];

const SWATCHES = [
  '#111827',
  '#ef4444',
  '#f59e0b',
  '#10b981',
  '#3b82f6',
  '#6366f1',
  '#8b5cf6',
  '#ec4899',
];

export const SvgV2Inspector: React.FC<SvgV2InspectorProps> = ({
  document: doc,
  selection,
  execute,
}) => {
  const [relative, setRelative] = useState<'selection' | 'canvas'>('selection');
  const [hasStyleBuffer, setHasStyleBuffer] = useState(() => globalStyleBuffer !== null);
  const [hasSizeBuffer, setHasSizeBuffer] = useState(() => globalSizeBuffer !== null);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  const [lockCanvasAspect, setLockCanvasAspect] = useState(true);
  const [canvasResizeMode, setCanvasResizeMode] = useState<'scale-content' | 'canvas-only'>('scale-content');
  const [lockElementAspect, setLockElementAspect] = useState(false);
  const [cssEditorOpen, setCssEditorOpen] = useState(false);
  const rawDefs = doc.metadata[RAW_DEFS_METADATA_KEY] ?? '';
  const currentGlobalCss = getDocumentGlobalStyles(doc);
  const [cssDraft, setCssDraft] = useState(currentGlobalCss);

  useEffect(() => {
    setCssDraft(currentGlobalCss);
  }, [currentGlobalCss]);

  const globalStylesInfo = parseGlobalStyles(rawDefs);
  const classesInUse = getClassesInUse(doc);
  const allDefinedClasses = Array.from(
    new Set([
      ...globalStylesInfo.classRules.map((r) => r.className),
      ...Array.from(classesInUse.keys()),
    ]),
  );
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const ids = selection.nodeIds;

  const showFeedback = useCallback((msg: string) => {
    setFeedbackMsg(msg);
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    feedbackTimerRef.current = setTimeout(() => setFeedbackMsg(null), 2500);
  }, []);

  useEffect(() => {
    return () => {
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    };
  }, []);

  const primary = selection.primaryId !== null ? doc.nodes.get(selection.primaryId) : null;
  const fillItem =
    primary && (primary.kind === 'Path' || primary.kind === 'Text')
      ? primary.appearance.items.find((it) => it.kind === 'fill')
      : null;
  const strokeItem =
    primary && primary.kind === 'Path'
      ? primary.appearance.items.find((it) => it.kind === 'stroke')
      : null;

  const curFillColor =
    fillItem && fillItem.kind === 'fill' && fillItem.fill.type === 'solid'
      ? fillItem.fill.color
      : '#3b82f6';

  const curStrokePaint =
    strokeItem && strokeItem.kind === 'stroke' && strokeItem.stroke.paint.type === 'solid'
      ? strokeItem.stroke.paint.color
      : '#000000';
  const curStrokeWidth =
    strokeItem && strokeItem.kind === 'stroke' ? strokeItem.stroke.width : 1;
  const curStrokeCap =
    strokeItem && strokeItem.kind === 'stroke' ? strokeItem.stroke.cap : 'butt';
  const curStrokeDash =
    strokeItem && strokeItem.kind === 'stroke' && strokeItem.stroke.dashArray
      ? strokeItem.stroke.dashArray.join(' ')
      : 'none';

  // 识别选中项中的矩形图元（用于圆角调节，支持单选、多选及编组内矩形批量应用）
  const rectNodes = collectRectNodes(doc, ids);
  const hasRect = rectNodes.length > 0;
  const curRadius = rectNodes.length > 0 ? getRectCornerRadius(rectNodes[0]) : 0;
  const primaryRectBBox = rectNodes.length > 0
    ? (nodeWorldBBox(doc, rectNodes[0].id) ?? getBoundingBox(rectNodes[0].geometry))
    : null;
  const maxSliderRadius = primaryRectBBox && primaryRectBBox.width > 0 && primaryRectBBox.height > 0
    ? Math.max(20, Math.round(Math.min(primaryRectBBox.width, primaryRectBBox.height) / 2))
    : 60;

  // ---- 样式吸取与应用逻辑 (Style Painter) ----
  const handlePickStyle = useCallback(() => {
    if (!primary) return;
    const buffer: StyleBuffer = {};
    if (fillItem && fillItem.kind === 'fill') {
      if (fillItem.fill.type === 'solid') {
        buffer.fillColor = fillItem.fill.color;
      }
      buffer.fillOpacity = fillItem.opacity;
    }
    if (strokeItem && strokeItem.kind === 'stroke') {
      buffer.stroke = {
        color: strokeItem.stroke.paint.type === 'solid' ? strokeItem.stroke.paint.color : '#000000',
        width: strokeItem.stroke.width,
        cap: strokeItem.stroke.cap,
        dashArray: strokeItem.stroke.dashArray,
      };
    }
    if (primary.kind === 'Path') {
      const pAny = primary as any;
      if (pAny.markerStart !== undefined) buffer.markerStart = pAny.markerStart;
      if (pAny.markerEnd !== undefined) buffer.markerEnd = pAny.markerEnd;
      if (isRectNode(primary)) {
        buffer.cornerRadius = getRectCornerRadius(primary);
      }
    } else if (rectNodes.length > 0) {
      buffer.cornerRadius = getRectCornerRadius(rectNodes[0]);
    }
    if (primary.kind === 'Text') {
      buffer.text = {
        fontFamily: primary.fontFamily,
        fontWeight: primary.fontWeight,
        fontSize: primary.fontSize,
        textAnchor: primary.textAnchor,
      };
    }
    globalStyleBuffer = buffer;
    setHasStyleBuffer(true);
    showFeedback('已吸取图元样式 (Alt+C)');
  }, [primary, fillItem, strokeItem, rectNodes, showFeedback]);

  const handleApplyStyle = useCallback(() => {
    if (!globalStyleBuffer || ids.length === 0) return;
    const b = globalStyleBuffer;

    if (b.fillColor) {
      execute('paint.setColor', { ids: [...ids], target: 'fill', color: b.fillColor, opacity: b.fillOpacity ?? 1 });
    }
    if (b.fillOpacity !== undefined) {
      execute('paint.setOpacity', { ids: [...ids], opacity: b.fillOpacity });
    }
    if (b.stroke) {
      for (const id of ids) {
        const node = doc.nodes.get(id);
        if (node && node.kind === 'Path') {
          const curStroke = node.appearance.items.find((it) => it.kind === 'stroke');
          const s = curStroke && curStroke.kind === 'stroke' ? curStroke.stroke : defaultStroke();
          execute('paint.setStroke', {
            ids: [id],
            stroke: {
              ...s,
              paint: { type: 'solid', color: b.stroke.color, opacity: 1 },
              width: b.stroke.width,
              cap: b.stroke.cap,
              dashArray: b.stroke.dashArray,
            },
          });
        }
      }
    }
    if (b.markerStart !== undefined || b.markerEnd !== undefined) {
      for (const id of ids) {
        const node = doc.nodes.get(id);
        if (node && node.kind === 'Path') {
          execute('path.setMarker', {
            id,
            markerStart: b.markerStart ?? 'none',
            markerEnd: b.markerEnd ?? 'none',
          });
        }
      }
    }
    if (b.cornerRadius !== undefined) {
      const targetRects = collectRectNodes(doc, ids);
      if (targetRects.length > 0) {
        execute('path.setRectRadius', { ids: targetRects.map((n) => n.id), rx: b.cornerRadius });
      }
    }
    if (b.text) {
      for (const id of ids) {
        const node = doc.nodes.get(id);
        if (node && node.kind === 'Text') {
          execute('text.setText', {
            id,
            fontFamily: b.text.fontFamily,
            fontWeight: b.text.fontWeight,
            fontSize: b.text.fontSize,
            textAnchor: b.text.textAnchor,
          });
        }
      }
    }
    showFeedback(`已将样式刷新到 ${ids.length} 个图元 (Alt+V)`);
  }, [ids, doc, execute, showFeedback]);

  // ---- 尺寸吸取与匹配逻辑 (Size Matcher) ----
  const handlePickSize = useCallback(() => {
    if (!primary) return;
    const bb = nodeWorldBBox(doc, primary.id) ?? (primary.kind === 'Path' ? getBoundingBox(primary.geometry) : null);
    if (!bb || bb.width <= 0 || bb.height <= 0) return;
    globalSizeBuffer = {
      width: Math.round(bb.width * 10) / 10,
      height: Math.round(bb.height * 10) / 10,
      aspectRatio: bb.width / bb.height,
      sourceName: primary.name ?? primary.kind,
    };
    setHasSizeBuffer(true);
    showFeedback(`已获取尺寸: ${globalSizeBuffer.width} × ${globalSizeBuffer.height} px`);
  }, [primary, doc, showFeedback]);

  const handleApplySize = useCallback((mode: 'both' | 'width' | 'height' | 'fit') => {
    const targetSize = globalSizeBuffer;
    if (!targetSize || ids.length === 0) return;

    for (const id of ids) {
      const node = doc.nodes.get(id);
      if (!node || node.kind === 'Layer') continue;
      const bb = nodeWorldBBox(doc, id) ?? (node.kind === 'Path' ? getBoundingBox(node.geometry) : null);
      if (!bb || bb.width < 1e-4 || bb.height < 1e-4) continue;

      const center = { x: bb.x + bb.width / 2, y: bb.y + bb.height / 2 };
      let factorX = 1;
      let factorY = 1;

      if (mode === 'both') {
        factorX = targetSize.width / bb.width;
        factorY = targetSize.height / bb.height;
      } else if (mode === 'width') {
        factorX = targetSize.width / bb.width;
        factorY = 1;
      } else if (mode === 'height') {
        factorX = 1;
        factorY = targetSize.height / bb.height;
      } else if (mode === 'fit') {
        const targetMax = Math.max(targetSize.width, targetSize.height);
        const curMax = Math.max(bb.width, bb.height);
        const scale = targetMax / curMax;
        factorX = scale;
        factorY = scale;
      }

      if (Number.isFinite(factorX) && Number.isFinite(factorY)) {
        execute('object.scale', {
          ids: [id],
          factor: { x: factorX, y: factorY },
          origin: center,
        });
      }
    }
    const modeLabel = mode === 'both' ? '等尺寸' : mode === 'width' ? '同宽' : mode === 'height' ? '同高' : '等比匹配';
    showFeedback(`已按 ${targetSize.width}×${targetSize.height} 刷新 ${modeLabel}`);
  }, [ids, doc, execute, showFeedback]);

  const handleMatchPrimarySize = useCallback((mode: 'both' | 'width' | 'height') => {
    if (!primary || ids.length < 2) return;
    const pBBox = nodeWorldBBox(doc, primary.id) ?? (primary.kind === 'Path' ? getBoundingBox(primary.geometry) : null);
    if (!pBBox || pBBox.width < 1e-4 || pBBox.height < 1e-4) return;

    const otherIds = ids.filter((id) => id !== primary.id);
    for (const id of otherIds) {
      const node = doc.nodes.get(id);
      if (!node || node.kind === 'Layer') continue;
      const bb = nodeWorldBBox(doc, id) ?? (node.kind === 'Path' ? getBoundingBox(node.geometry) : null);
      if (!bb || bb.width < 1e-4 || bb.height < 1e-4) continue;

      const center = { x: bb.x + bb.width / 2, y: bb.y + bb.height / 2 };
      let factorX = 1;
      let factorY = 1;
      if (mode === 'both') {
        factorX = pBBox.width / bb.width;
        factorY = pBBox.height / bb.height;
      } else if (mode === 'width') {
        factorX = pBBox.width / bb.width;
        factorY = 1;
      } else if (mode === 'height') {
        factorX = 1;
        factorY = pBBox.height / bb.height;
      }
      if (Number.isFinite(factorX) && Number.isFinite(factorY)) {
        execute('object.scale', {
          ids: [id],
          factor: { x: factorX, y: factorY },
          origin: center,
        });
      }
    }
    const modeLabel = mode === 'both' ? '等尺寸' : mode === 'width' ? '同宽' : '同高';
    showFeedback(`已以主选图元为准刷新 ${modeLabel}`);
  }, [primary, ids, doc, execute, showFeedback]);

  // 监听全局快捷键：Alt+C 吸取样式，Alt+V 刷新应用样式
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

      const isC = e.key === 'c' || e.key === 'C';
      const isV = e.key === 'v' || e.key === 'V';
      const altOnly = e.altKey && !e.ctrlKey && !e.metaKey;
      const cmdAlt = e.altKey && (e.metaKey || e.ctrlKey);

      if ((altOnly || cmdAlt) && isC) {
        e.preventDefault();
        handlePickStyle();
      } else if ((altOnly || cmdAlt) && isV) {
        e.preventDefault();
        handleApplyStyle();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handlePickStyle, handleApplyStyle]);

  const canvasW = Math.max(16, Math.round((doc.canvas?.width || doc.canvas?.viewBox?.width || 800) * 10) / 10);
  const canvasH = Math.max(16, Math.round((doc.canvas?.height || doc.canvas?.viewBox?.height || 600) * 10) / 10);
  const canvasAspect = canvasW / Math.max(canvasH, 1);

  if (ids.length === 0) {
    return (
      <div
        className="border-t border-[var(--ov-border)] p-2 text-sm overflow-y-auto max-h-[calc(100vh-280px)] space-y-2"
        data-inspector-panel="true"
      >
        <div className="flex items-center justify-between text-xs font-semibold uppercase text-[var(--ov-fg-muted)]">
          <span>SVG 图形尺寸</span>
          <span className="font-mono text-[10px] text-[var(--ov-accent)]">
            {Math.round(canvasW)} × {Math.round(canvasH)} px
          </span>
        </div>

        {feedbackMsg && (
          <div className="flex items-center justify-between rounded bg-[var(--ov-accent-soft)] px-2 py-1 text-xs text-[var(--ov-accent)] font-medium">
            <span>{feedbackMsg}</span>
          </div>
        )}

        <div className="space-y-2 rounded border border-[var(--ov-border)] bg-[var(--ov-bg)]/40 p-2 text-xs">
          {/* 缩放模式切换：整体缩放图形 vs 仅调画布边界 */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[var(--ov-fg-muted)]">
              <span className="font-semibold">尺寸调整方式</span>
              <button
                type="button"
                title={lockCanvasAspect ? '当前已锁定 SVG 宽高比（点击解锁自由拉伸）' : '当前未锁定宽高比（点击锁定等比缩放）'}
                className={`flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] transition-colors ${
                  lockCanvasAspect
                    ? 'border-[var(--ov-accent)] bg-[var(--ov-accent-soft)] text-[var(--ov-accent)] font-medium'
                    : 'border-[var(--ov-border)] bg-[var(--ov-surface)] text-[var(--ov-fg-muted)] hover:bg-[var(--ov-hover)]'
                }`}
                onClick={() => setLockCanvasAspect((v) => !v)}
              >
                {lockCanvasAspect ? <Lock size={10} /> : <Unlock size={10} />}
                <span>{lockCanvasAspect ? '等比锁定' : '自由比例'}</span>
              </button>
            </div>
            <div className="grid grid-cols-2 gap-1">
              <button
                type="button"
                title="调整宽高时，同步按比例缩放 SVG 内部所有图形与路径（调整整个 SVG 图形大小）"
                className={`rounded border py-1 text-[11px] transition-colors ${
                  canvasResizeMode === 'scale-content'
                    ? 'border-[var(--ov-accent)] bg-[var(--ov-accent-soft)] text-[var(--ov-accent)] font-medium'
                    : 'border-[var(--ov-border)] bg-[var(--ov-surface)] text-[var(--ov-fg)] hover:bg-[var(--ov-hover)]'
                }`}
                onClick={() => setCanvasResizeMode('scale-content')}
              >
                整体缩放图形
              </button>
              <button
                type="button"
                title="仅修改 SVG 画布的宽度与高度边界，内部图元保持原始尺寸不变"
                className={`rounded border py-1 text-[11px] transition-colors ${
                  canvasResizeMode === 'canvas-only'
                    ? 'border-[var(--ov-accent)] bg-[var(--ov-accent-soft)] text-[var(--ov-accent)] font-medium'
                    : 'border-[var(--ov-border)] bg-[var(--ov-surface)] text-[var(--ov-fg)] hover:bg-[var(--ov-hover)]'
                }`}
                onClick={() => setCanvasResizeMode('canvas-only')}
              >
                仅调画布边界
              </button>
            </div>
          </div>

          {/* 宽度与高度数值输入 + 宽高互换 */}
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1.5 pt-1 border-t border-[var(--ov-border)]/50">
            <label className="flex items-center justify-between gap-1">
              <span className="text-[var(--ov-fg-muted)]">宽</span>
              <input
                type="number"
                min={16}
                max={8192}
                value={Math.round(canvasW)}
                title="设置 SVG 图形本身的总宽度 W (px)"
                className="w-16 rounded border border-[var(--ov-border)] bg-[var(--ov-bg)] px-1.5 py-0.5 text-right text-[var(--ov-fg)]"
                onChange={(e) => {
                  const nextW = Math.max(16, Number(e.target.value));
                  if (!Number.isFinite(nextW)) return;
                  const nextH = lockCanvasAspect ? Math.max(16, Math.round(nextW / canvasAspect)) : canvasH;
                  execute('canvas.setSize', {
                    width: nextW,
                    height: nextH,
                    mode: canvasResizeMode,
                  });
                }}
              />
            </label>
            <button
              type="button"
              title="互换 SVG 宽度与高度（横竖版一键切换）"
              className="flex h-6 w-6 items-center justify-center rounded border border-[var(--ov-border)] bg-[var(--ov-surface)] text-[var(--ov-fg-muted)] hover:bg-[var(--ov-hover)] hover:text-[var(--ov-fg)] transition-colors"
              onClick={() => {
                execute('canvas.setSize', {
                  width: canvasH,
                  height: canvasW,
                  mode: canvasResizeMode,
                });
                showFeedback(`已互换宽高为 ${Math.round(canvasH)} × ${Math.round(canvasW)}`);
              }}
            >
              <ArrowLeftRight size={11} />
            </button>
            <label className="flex items-center justify-between gap-1">
              <span className="text-[var(--ov-fg-muted)]">高</span>
              <input
                type="number"
                min={16}
                max={8192}
                value={Math.round(canvasH)}
                title="设置 SVG 图形本身的总高度 H (px)"
                className="w-16 rounded border border-[var(--ov-border)] bg-[var(--ov-bg)] px-1.5 py-0.5 text-right text-[var(--ov-fg)]"
                onChange={(e) => {
                  const nextH = Math.max(16, Number(e.target.value));
                  if (!Number.isFinite(nextH)) return;
                  const nextW = lockCanvasAspect ? Math.max(16, Math.round(nextH * canvasAspect)) : canvasW;
                  execute('canvas.setSize', {
                    width: nextW,
                    height: nextH,
                    mode: canvasResizeMode,
                  });
                }}
              />
            </label>
          </div>

          {/* 快捷倍率等比缩放 */}
          <div className="space-y-1 pt-1 border-t border-[var(--ov-border)]/50">
            <span className="text-[11px] text-[var(--ov-fg-muted)] font-semibold">快捷倍率缩放</span>
            <div className="grid grid-cols-5 gap-1">
              {[0.5, 0.75, 1.25, 1.5, 2].map((factor) => (
                <button
                  key={factor}
                  type="button"
                  title={`将当前 SVG 图形按 ${factor}x 倍率缩放为 ${Math.max(16, Math.round(canvasW * factor))} × ${Math.max(16, Math.round(canvasH * factor))} px`}
                  className="rounded border border-[var(--ov-border)] bg-[var(--ov-surface)] py-0.5 text-[10px] text-[var(--ov-fg)] hover:bg-[var(--ov-hover)] transition-colors"
                  onClick={() => {
                    const nextW = Math.max(16, Math.round(canvasW * factor));
                    const nextH = Math.max(16, Math.round(canvasH * factor));
                    execute('canvas.setSize', {
                      width: nextW,
                      height: nextH,
                      mode: canvasResizeMode,
                    });
                    showFeedback(`已按 ${factor}x 调整为 ${nextW} × ${nextH}`);
                  }}
                >
                  {factor}x
                </button>
              ))}
            </div>
          </div>

          {/* 自适应图元内容边界 */}
          <div className="space-y-1 pt-1 border-t border-[var(--ov-border)]/50">
            <span className="text-[11px] text-[var(--ov-fg-muted)] font-semibold">自适应图元内容边界</span>
            <div className="grid grid-cols-2 gap-1">
              <button
                type="button"
                title="自动包裹画布上所有可见图元并保留 24px 留白边距"
                className="flex items-center justify-center gap-1 rounded border border-[var(--ov-border)] bg-[var(--ov-surface)] py-1 text-[10px] text-[var(--ov-fg)] hover:bg-[var(--ov-hover)] transition-colors"
                onClick={() => {
                  execute('canvas.setSize', { mode: 'fit-content', padding: 24 });
                  showFeedback('已自适应包裹图元内容 (留白 24px)');
                }}
              >
                <Maximize2 size={11} className="text-[var(--ov-accent)]" />
                <span>自适应内容 (24px)</span>
              </button>
              <button
                type="button"
                title="自动紧贴包裹画布上所有可见图元（0px 留白，适合导出紧凑图标）"
                className="flex items-center justify-center gap-1 rounded border border-[var(--ov-border)] bg-[var(--ov-surface)] py-1 text-[10px] text-[var(--ov-fg)] hover:bg-[var(--ov-hover)] transition-colors"
                onClick={() => {
                  execute('canvas.setSize', { mode: 'fit-content', padding: 0 });
                  showFeedback('已紧凑贴边包裹图元内容 (0px)');
                }}
              >
                <Scaling size={11} className="text-emerald-500" />
                <span>紧凑贴边 (0px)</span>
              </button>
            </div>
          </div>

          {/* 常用 SVG 尺寸预设 */}
          <div className="space-y-1 pt-1 border-t border-[var(--ov-border)]/50">
            <span className="text-[11px] text-[var(--ov-fg-muted)] font-semibold">常用尺寸预设</span>
            <div className="grid grid-cols-3 gap-1">
              {[
                { label: '64×64', w: 64, h: 64 },
                { label: '256×256', w: 256, h: 256 },
                { label: '512×512', w: 512, h: 512 },
                { label: '800×600', w: 800, h: 600 },
                { label: '1200×800', w: 1200, h: 800 },
                { label: '1920×1080', w: 1920, h: 1080 },
              ].map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  title={`将 SVG 图形尺寸设置为 ${preset.w} × ${preset.h} px`}
                  className="rounded border border-[var(--ov-border)] bg-[var(--ov-surface)] py-0.5 text-[10px] text-[var(--ov-fg)] hover:bg-[var(--ov-hover)] transition-colors font-mono"
                  onClick={() => {
                    execute('canvas.setSize', {
                      width: preset.w,
                      height: preset.h,
                      mode: canvasResizeMode,
                    });
                    showFeedback(`已设置 SVG 尺寸为 ${preset.label}`);
                  }}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          <div className="text-[10px] text-[var(--ov-fg-muted)] leading-tight pt-0.5">
            💡 提示：直接拖拽画布中 SVG 白色外框四周与四角的 8 个蓝色控制点，即可实时拉伸调整 SVG 图形本身尺寸。
          </div>
        </div>

        {/* 全局样式与 CSS 变量 (Global Styles & CSS) */}
        <div className="space-y-2 rounded border border-[var(--ov-border)] bg-[var(--ov-bg)]/40 p-2 text-xs">
          <div className="flex items-center justify-between text-[var(--ov-fg-muted)]">
            <span className="flex items-center gap-1 font-semibold text-[var(--ov-fg)]">
              <Sparkles size={12} className="text-[var(--ov-accent)]" />
              <span>全局样式与 CSS 变量</span>
            </span>
            <span className="font-mono text-[10px] text-[var(--ov-accent)]">
              {globalStylesInfo.cssVariables.length} 变量 · {globalStylesInfo.classRules.length} 样式类
            </span>
          </div>

          {/* 1. 变量快捷调试器 (CSS Custom Properties) */}
          {globalStylesInfo.cssVariables.length > 0 ? (
            <div className="space-y-1.5 pt-1 border-t border-[var(--ov-border)]/50">
              <span className="text-[11px] font-semibold text-[var(--ov-fg-muted)]">
                CSS 变量实时调色
              </span>
              <div className="space-y-1 max-h-40 overflow-y-auto pr-0.5">
                {globalStylesInfo.cssVariables.map((v) => {
                  const isColor = /^(#[0-9a-fA-F]{3,8}|rgba?\(|hsla?\(|[a-zA-Z]+$)/.test(v.value.trim());
                  return (
                    <div
                      key={`${v.selector}-${v.name}`}
                      className="flex items-center justify-between gap-1.5 rounded border border-[var(--ov-border)]/60 bg-[var(--ov-surface)] px-1.5 py-1"
                    >
                      <span className="font-mono text-[10px] text-[var(--ov-accent)] truncate max-w-[110px]" title={v.name}>
                        {v.name}
                      </span>
                      <div className="flex items-center gap-1">
                        {isColor && (
                          <input
                            type="color"
                            value={v.value.startsWith('#') && (v.value.length === 7 || v.value.length === 4) ? v.value : '#3b82f6'}
                            className="h-5 w-6 cursor-pointer rounded border border-[var(--ov-border)] p-0"
                            title={`修改变量 ${v.name} 的颜色`}
                            onChange={(e) => {
                              execute('canvas.updateCssVariable', { varName: v.name, value: e.target.value });
                              showFeedback(`已更新变量 ${v.name} 为 ${e.target.value}`);
                            }}
                          />
                        )}
                        <input
                          type="text"
                          value={v.value}
                          className="w-20 rounded border border-[var(--ov-border)] bg-[var(--ov-bg)] px-1 py-0.5 font-mono text-[10px] text-[var(--ov-fg)]"
                          onChange={(e) => {
                            execute('canvas.updateCssVariable', { varName: v.name, value: e.target.value });
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="text-[10px] text-[var(--ov-fg-muted)] pt-0.5">
              暂未定义全局 CSS 变量。可通过下方预设或源码编辑器注入 <code className="text-[var(--ov-accent)]">:root &#123; --color: #hex &#125;</code>。
            </div>
          )}

          {/* 2. 常用样式预设一键注入 */}
          <div className="space-y-1 pt-1 border-t border-[var(--ov-border)]/50">
            <span className="text-[11px] font-semibold text-[var(--ov-fg-muted)]">
              预设样式库注入
            </span>
            <div className="grid grid-cols-2 gap-1">
              {SVG_STYLE_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  title={`${p.name}：${p.description}`}
                  className="flex items-center gap-1 rounded border border-[var(--ov-border)] bg-[var(--ov-surface)] px-1.5 py-1 text-[10px] text-[var(--ov-fg)] hover:bg-[var(--ov-hover)] hover:text-[var(--ov-accent)] transition-colors text-left truncate"
                  onClick={() => {
                    const currentCss = getDocumentGlobalStyles(doc);
                    const mergedCss = currentCss.trim()
                      ? `${currentCss.trim()}\n\n/* === ${p.name} === */\n${p.css}`
                      : `/* === ${p.name} === */\n${p.css}`;
                    execute('canvas.setGlobalStyles', { css: mergedCss });
                    showFeedback(`已注入预设: ${p.name}`);
                  }}
                >
                  <Plus size={10} className="text-[var(--ov-accent)] shrink-0" />
                  <span className="truncate">{p.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 3. 已知 CSS 类名清单与关联图元筛选 */}
          {globalStylesInfo.classRules.length > 0 && (
            <div className="space-y-1 pt-1 border-t border-[var(--ov-border)]/50">
              <span className="text-[11px] font-semibold text-[var(--ov-fg-muted)]">
                已定义的样式类 ({globalStylesInfo.classRules.length})
              </span>
              <div className="flex flex-wrap gap-1">
                {globalStylesInfo.classRules.map((c) => {
                  const count = classesInUse.get(c.className) ?? 0;
                  return (
                    <button
                      key={c.selector}
                      type="button"
                      title={`点击选中所有应用了 .${c.className} 类的图元（当前有 ${count} 个图元使用）`}
                      className="flex items-center gap-1 rounded border border-[var(--ov-border)] bg-[var(--ov-surface)] px-1.5 py-0.5 text-[10px] text-[var(--ov-fg)] hover:border-[var(--ov-accent)] transition-colors"
                      onClick={() => {
                        const matchingIds: NodeId[] = [];
                        for (const n of doc.nodes.values()) {
                          if (n.className && n.className.split(/\s+/).includes(c.className)) {
                            matchingIds.push(n.id);
                          }
                        }
                        if (matchingIds.length > 0) {
                          execute('select.set', { ids: matchingIds, additive: false });
                          showFeedback(`已选中 ${matchingIds.length} 个匹配 .${c.className} 的图元`);
                        } else {
                          showFeedback(`画布中暂无图元应用 .${c.className}`);
                        }
                      }}
                    >
                      <span className="font-mono text-[var(--ov-accent)]">.{c.className}</span>
                      <span className="rounded-full bg-[var(--ov-accent-soft)] px-1 font-mono text-[9px] text-[var(--ov-accent)]">
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 4. CSS 源码查看与直接编辑 */}
          <div className="space-y-1 pt-1 border-t border-[var(--ov-border)]/50">
            <div className="flex items-center justify-between">
              <button
                type="button"
                className="flex items-center gap-1 text-[11px] font-semibold text-[var(--ov-fg-muted)] hover:text-[var(--ov-fg)]"
                onClick={() => setCssEditorOpen((v) => !v)}
              >
                {cssEditorOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                <span>全局 &lt;style&gt; CSS 源码编辑器</span>
              </button>
              {cssEditorOpen && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    className="rounded bg-[var(--ov-accent)] px-1.5 py-0.5 text-[10px] text-white hover:opacity-90 font-medium"
                    onClick={() => {
                      execute('canvas.setGlobalStyles', { css: cssDraft });
                      showFeedback('全局 CSS 样式已保存并生效');
                    }}
                  >
                    保存样式
                  </button>
                </div>
              )}
            </div>
            {cssEditorOpen && (
              <div className="space-y-1 pt-1">
                <textarea
                  rows={8}
                  value={cssDraft}
                  placeholder={`/* 在此处输入 SVG 全局 CSS 规则，例如：*/\n:root {\n  --brand: #3b82f6;\n}\n.my-shape {\n  fill: var(--brand);\n  stroke: #1e293b;\n  stroke-width: 2px;\n}`}
                  className="w-full rounded border border-[var(--ov-border)] bg-[var(--ov-bg)] p-1.5 font-mono text-[11px] leading-relaxed text-[var(--ov-fg)] resize-y focus:outline-none focus:border-[var(--ov-accent)]"
                  onChange={(e) => setCssDraft(e.target.value)}
                />
                <div className="flex items-center justify-between text-[10px] text-[var(--ov-fg-muted)]">
                  <span>支持 :root 变量、CSS Class、伪类与媒体查询</span>
                  <button
                    type="button"
                    className="hover:text-rose-500"
                    onClick={() => {
                      if (window.confirm('确定清空 SVG 内的所有全局样式吗？')) {
                        setCssDraft('');
                        execute('canvas.setGlobalStyles', { css: '' });
                        showFeedback('已清空全局样式表');
                      }
                    }}
                  >
                    清空样式
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="border-t border-[var(--ov-border)] p-2 text-sm overflow-y-auto max-h-[calc(100vh-280px)]"
      data-inspector-panel="true"
    >
      <div className="mb-1.5 flex items-center justify-between text-xs font-semibold uppercase text-[var(--ov-fg-muted)]">
        <span>属性</span>
        <span>{ids.length > 1 ? `${ids.length} 个对象` : '1 个对象'}</span>
      </div>

      {/* 提示消息横幅 */}
      {feedbackMsg && (
        <div className="mb-2 flex items-center justify-between rounded bg-[var(--ov-accent-soft)] px-2 py-1 text-xs text-[var(--ov-accent)] font-medium">
          <span>{feedbackMsg}</span>
        </div>
      )}

      {/* 样式吸取与刷新 (Style / Format Painter) */}
      <div className="mb-2 rounded border border-[var(--ov-border)] bg-[var(--ov-bg)]/40 p-1.5 text-xs">
        <div className="mb-1 flex items-center justify-between text-[var(--ov-fg-muted)]">
          <span className="font-semibold">格式刷 (样式吸取与刷新)</span>
          {hasStyleBuffer && (
            <span className="flex items-center gap-1 text-[10px] text-emerald-500 font-medium">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              已暂存样式
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-1">
          <button
            type="button"
            title="吸取当前选中图元的样式（含填充色、描边粗细/线型/端点、箭头标记、圆角与文字样式）快捷键 Alt+C"
            className="flex items-center justify-center gap-1 rounded border border-[var(--ov-border)] bg-[var(--ov-surface)] py-1 text-[11px] text-[var(--ov-fg)] hover:bg-[var(--ov-hover)] transition-colors"
            onClick={handlePickStyle}
          >
            <Pipette size={12} className="text-[var(--ov-accent)]" />
            <span>吸取样式 (Alt+C)</span>
          </button>
          <button
            type="button"
            title={hasStyleBuffer ? "将暂存的样式一键刷新应用到当前选中的图元（支持单选或多选批量应用）快捷键 Alt+V" : "暂无可应用样式，请先选择图元点击「吸取样式」"}
            disabled={!hasStyleBuffer}
            className="flex items-center justify-center gap-1 rounded border border-[var(--ov-border)] bg-[var(--ov-surface)] py-1 text-[11px] text-[var(--ov-fg)] hover:bg-[var(--ov-hover)] disabled:opacity-40 transition-colors"
            onClick={handleApplyStyle}
          >
            <Paintbrush size={12} className="text-emerald-500" />
            <span>刷新样式 (Alt+V)</span>
          </button>
        </div>
      </div>

      {/* CSS 类名与全局样式提取 (CSS Class & Styling) */}
      <div className="mb-2 rounded border border-[var(--ov-border)] bg-[var(--ov-bg)]/40 p-1.5 text-xs">
        <div className="mb-1 flex items-center justify-between text-[var(--ov-fg-muted)]">
          <span className="flex items-center gap-1 font-semibold text-[var(--ov-fg)]">
            <Tag size={12} className="text-[var(--ov-accent)]" />
            <span>CSS 类名 (Class Name)</span>
          </span>
          {primary?.className && (
            <span className="font-mono text-[10px] text-emerald-500 font-medium">
              已绑定类
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <input
            type="text"
            placeholder="如: icon-primary glow"
            value={primary?.className ?? ''}
            className="flex-1 rounded border border-[var(--ov-border)] bg-[var(--ov-bg)] px-1.5 py-1 font-mono text-[11px] text-[var(--ov-fg)] focus:outline-none focus:border-[var(--ov-accent)]"
            onChange={(e) => {
              execute('object.setClassName', { ids, className: e.target.value });
            }}
          />
          <button
            type="button"
            title="将当前选中的图元外观（填充、描边、透明度）一键提取为全局 CSS 类并赋给该图元"
            className="flex items-center gap-1 whitespace-nowrap rounded border border-[var(--ov-border)] bg-[var(--ov-surface)] px-2 py-1 text-[11px] text-[var(--ov-fg)] hover:bg-[var(--ov-hover)] hover:text-[var(--ov-accent)] transition-colors"
            onClick={() => {
              if (primary) {
                execute('object.extractToClass', { id: primary.id });
                showFeedback(`已提取外观为全局 CSS 类 .cls-${primary.id}`);
              }
            }}
          >
            <Sparkles size={11} className="text-[var(--ov-accent)]" />
            <span>提取样式</span>
          </button>
        </div>
        {/* 快速选择文档中已有 Class */}
        {allDefinedClasses.length > 0 && (
          <div className="mt-1.5 flex flex-wrap items-center gap-1 pt-1 border-t border-[var(--ov-border)]/40">
            <span className="text-[10px] text-[var(--ov-fg-muted)]">快捷绑定:</span>
            {allDefinedClasses.map((cls) => {
              const isApplied = (primary?.className || '').split(/\s+/).includes(cls);
              return (
                <button
                  key={cls}
                  type="button"
                  className={`rounded px-1.5 py-0.5 font-mono text-[10px] transition-colors ${
                    isApplied
                      ? 'bg-[var(--ov-accent)] text-white font-medium'
                      : 'border border-[var(--ov-border)] bg-[var(--ov-surface)] text-[var(--ov-fg)] hover:border-[var(--ov-accent)]'
                  }`}
                  onClick={() => {
                    const currentClasses = (primary?.className || '').split(/\s+/).filter(Boolean);
                    const nextClasses = isApplied
                      ? currentClasses.filter((c) => c !== cls)
                      : [...currentClasses, cls];
                    execute('object.setClassName', { ids, className: nextClasses.join(' ') });
                    showFeedback(`${isApplied ? '已移除' : '已添加'}类 .${cls}`);
                  }}
                >
                  .{cls}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 对齐与分布（≥2 才能对齐；≥3 才能分布） */}
      <div className="mb-2">
        <div className="mb-1 flex items-center justify-between text-xs text-[var(--ov-fg-muted)]">
          <span>对齐 / 分布</span>
          <select
            className="rounded border border-[var(--ov-border)] bg-[var(--ov-bg)] px-1 text-[10px] text-[var(--ov-fg)]"
            value={relative}
            onChange={(e) => setRelative(e.target.value as 'selection' | 'canvas')}
            aria-label="对齐基准"
            title="切换对齐参考基准：基于多选联合包围盒（选区基准）或整张画布外边框（画布基准）"
          >
            <option value="selection">选区基准</option>
            <option value="canvas">画布基准</option>
          </select>
        </div>
        <div className="grid grid-cols-6 gap-1">
          {ALIGN_BUTTONS.map((b) => (
            <button
              key={b.mode}
              type="button"
              title={`${b.label}（${relative === 'canvas' ? '画布' : '选区'}基准）: ${b.desc}`}
              disabled={relative === 'canvas' ? ids.length < 1 : ids.length < 2}
              className="rounded border border-[var(--ov-border)] py-1 text-[10px] text-[var(--ov-fg)] hover:bg-[var(--ov-hover)] disabled:opacity-40"
              onClick={() => execute('object.align', { ids, align: b.mode, relative })}
            >
              {b.label.slice(0, 2)}
            </button>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-2 gap-1">
          <button
            type="button"
            title="水平均匀等距分布（固定最左与最右图元，中间图元等间距排列，需选中 3 项以上）"
            disabled={ids.length < 3}
            className="rounded border border-[var(--ov-border)] py-1 text-[10px] text-[var(--ov-fg)] hover:bg-[var(--ov-hover)] disabled:opacity-40"
            onClick={() => execute('object.distribute', { ids, axis: 'h' })}
          >
            水平分布
          </button>
          <button
            type="button"
            title="垂直均匀等距分布（固定最顶与最底图元，中间图元等间距排列，需选中 3 项以上）"
            disabled={ids.length < 3}
            className="rounded border border-[var(--ov-border)] py-1 text-[10px] text-[var(--ov-fg)] hover:bg-[var(--ov-hover)] disabled:opacity-40"
            onClick={() => execute('object.distribute', { ids, axis: 'v' })}
          >
            垂直分布
          </button>
        </div>
      </div>

      {/* 填充色与调色板 */}
      <div className="mb-2">
        <div className="mb-1 text-xs text-[var(--ov-fg-muted)]">填充颜色</div>
        <div className="flex items-center gap-1.5">
          <input
            type="color"
            value={curFillColor}
            className="h-7 w-9 cursor-pointer rounded border border-[var(--ov-border)]"
            title="点击拾取自定义填充颜色 (HEX / RGB)"
            onChange={(e) =>
              execute('paint.setColor', { ids, target: 'fill', color: e.target.value, opacity: 1 })
            }
          />
          <div className="grid flex-1 grid-cols-8 gap-1">
            {SWATCHES.map((color) => (
              <button
                key={color}
                type="button"
                className="h-6 w-full rounded border border-black/10 transition-transform hover:scale-110"
                style={{ backgroundColor: color }}
                title={`应用预设填充色: ${color}`}
                onClick={() => execute('paint.setColor', { ids, target: 'fill', color, opacity: 1 })}
              />
            ))}
          </div>
        </div>
        <label className="mt-1.5 flex items-center justify-between text-xs text-[var(--ov-fg-muted)]">
          <span>透明度</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            defaultValue={1}
            title="调节所选图元的不透明度 (0% - 100%)"
            className="w-28 cursor-pointer"
            onChange={(e) =>
              execute('paint.setOpacity', { ids, opacity: Number(e.target.value) })
            }
          />
        </label>
      </div>

      {/* 矩形圆角调节（Point 3: 支持滑动条、数值输入、快捷预设与胶囊形态） */}
      {hasRect && (
        <div className="mb-2 space-y-1.5 rounded border border-[var(--ov-border)] bg-[var(--ov-bg)]/40 p-2 text-xs">
          <div className="flex items-center justify-between font-semibold text-[var(--ov-fg-muted)]">
            <span>矩形圆角</span>
            <span className="font-mono text-[10px] text-[var(--ov-fg)]">{curRadius}px</span>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="range"
              min={0}
              max={maxSliderRadius}
              step={1}
              value={Math.min(maxSliderRadius, curRadius)}
              title={`滑动调节矩形圆角半径 (0px - ${maxSliderRadius}px)`}
              className="flex-1 cursor-pointer"
              onChange={(e) => {
                const rx = Math.max(0, Number(e.target.value));
                execute('path.setRectRadius', { ids: rectNodes.map((n) => n.id), rx });
              }}
            />
            <div className="flex items-center gap-1">
              <input
                type="number"
                min={0}
                max={500}
                value={curRadius}
                title="精确输入矩形圆角半径 (px)"
                className="w-14 rounded border border-[var(--ov-border)] bg-[var(--ov-bg)] px-1.5 py-0.5 text-right text-[11px] text-[var(--ov-fg)]"
                onChange={(e) => {
                  const rx = Math.max(0, Number(e.target.value));
                  execute('path.setRectRadius', { ids: rectNodes.map((n) => n.id), rx });
                }}
              />
              <span className="text-[10px] text-[var(--ov-fg-muted)]">px</span>
            </div>
          </div>

          {/* 快捷圆角预设 */}
          <div className="grid grid-cols-5 gap-1 pt-0.5">
            {[
              { label: '0px', rx: 0, title: '设置为直角 (0px)' },
              { label: '4px', rx: 4, title: '设置为微圆角 (4px)' },
              { label: '8px', rx: 8, title: '设置为中圆角 (8px)' },
              { label: '16px', rx: 16, title: '设置为大圆角 (16px)' },
              { label: '全圆角', rx: 9999, title: '设置为胶囊 / 全圆角形态 (自适应短边 50%)' },
            ].map((preset) => {
              const isActive = preset.rx === 9999 ? curRadius >= maxSliderRadius : curRadius === preset.rx;
              return (
                <button
                  key={preset.label}
                  type="button"
                  title={preset.title}
                  className={`rounded border py-0.5 text-[10px] transition-colors ${
                    isActive
                      ? 'border-[var(--ov-accent)] bg-[var(--ov-accent-soft)] text-[var(--ov-accent)] font-medium'
                      : 'border-[var(--ov-border)] bg-[var(--ov-surface)] text-[var(--ov-fg)] hover:bg-[var(--ov-hover)]'
                  }`}
                  onClick={() =>
                    execute('path.setRectRadius', { ids: rectNodes.map((n) => n.id), rx: preset.rx })
                  }
                >
                  {preset.label}
                </button>
              );
            })}
          </div>

          <div className="text-[10px] text-[var(--ov-fg-muted)] leading-tight pt-0.5">
            💡 提示：多选矩形可批量统一应用圆角；全圆角将自动限制在矩形短边一半。
          </div>
        </div>
      )}

      {/* 路径描边与端点样式（支持单选与多选批量应用） */}
      {(primary?.kind === 'Path' || ids.some((id) => doc.nodes.get(id)?.kind === 'Path')) && (
        <div className="mb-2 space-y-1.5 rounded border border-[var(--ov-border)] bg-[var(--ov-bg)]/40 p-2 text-xs">
          <div className="font-semibold text-[var(--ov-fg-muted)]">描边与拐角</div>
          <div className="flex items-center justify-between">
            <span className="text-[var(--ov-fg-muted)]">描边颜色</span>
            <input
              type="color"
              value={curStrokePaint}
              className="h-5 w-8 cursor-pointer rounded border border-[var(--ov-border)]"
              title="选择描边线条颜色"
              onChange={(e) => {
                const s = strokeItem && strokeItem.kind === 'stroke' ? strokeItem.stroke : defaultStroke();
                execute('paint.setStroke', {
                  ids,
                  stroke: { ...s, paint: { type: 'solid', color: e.target.value as any, opacity: 1 } },
                });
              }}
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[var(--ov-fg-muted)]">粗细 (px)</span>
            <input
              type="number"
              min={0}
              max={30}
              value={curStrokeWidth}
              title="设置描边粗细 (px)"
              className="w-16 rounded border border-[var(--ov-border)] bg-[var(--ov-bg)] px-1.5 py-0.5 text-[var(--ov-fg)]"
              onChange={(e) => {
                const s = strokeItem && strokeItem.kind === 'stroke' ? strokeItem.stroke : defaultStroke();
                execute('paint.setStroke', {
                  ids,
                  stroke: { ...s, width: Math.max(0, Number(e.target.value)) },
                });
              }}
            />
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <div>
              <span className="text-[var(--ov-fg-muted)]">端点</span>
              <select
                className="mt-0.5 w-full rounded border border-[var(--ov-border)] bg-[var(--ov-bg)] px-1 py-0.5 text-[var(--ov-fg)]"
                value={curStrokeCap}
                title="线段端点样式：平头 (Butt)、圆头 (Round) 或方头 (Square)"
                onChange={(e) => {
                  const s = strokeItem && strokeItem.kind === 'stroke' ? strokeItem.stroke : defaultStroke();
                  execute('paint.setStroke', {
                    ids,
                    stroke: { ...s, cap: e.target.value as any },
                  });
                }}
              >
                <option value="butt">平头 (Butt)</option>
                <option value="round">圆头 (Round)</option>
                <option value="square">方头 (Square)</option>
              </select>
            </div>
            <div>
              <span className="text-[var(--ov-fg-muted)]">虚线</span>
              <select
                className="mt-0.5 w-full rounded border border-[var(--ov-border)] bg-[var(--ov-bg)] px-1 py-0.5 text-[var(--ov-fg)]"
                value={curStrokeDash}
                title="描边线型：实线、常规虚线 (4 4)、点线 (2 2) 或点划线"
                onChange={(e) => {
                  const s = strokeItem && strokeItem.kind === 'stroke' ? strokeItem.stroke : defaultStroke();
                  const dashVal = e.target.value;
                  const dashArray = dashVal === 'none' ? null : dashVal.split(' ').map(Number);
                  execute('paint.setStroke', {
                    ids,
                    stroke: { ...s, dashArray },
                  });
                }}
              >
                <option value="none">实线</option>
                <option value="4 4">虚线 (4 4)</option>
                <option value="2 2">点线 (2 2)</option>
                <option value="8 3 2 3">点划线</option>
              </select>
            </div>
          </div>
          {ids.length === 1 && primary && primary.kind === 'Path' && (
            <>
              <div className="pt-1">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-[var(--ov-fg-muted)]">箭头快捷样式</span>
                  <button
                    type="button"
                    title="对调起点与终点箭头"
                    className="inline-flex items-center gap-0.5 rounded border border-[var(--ov-border)] bg-[var(--ov-surface)] px-1.5 py-0.5 text-[10px] hover:bg-[var(--ov-hover)]"
                    onClick={() => {
                      const ms = (primary as any).markerStart ?? 'none';
                      const me = (primary as any).markerEnd ?? 'none';
                      execute('path.setMarker', {
                        id: primary.id,
                        markerStart: me,
                        markerEnd: ms,
                      });
                    }}
                  >
                    <ArrowLeftRight size={10} /> 反转方向
                  </button>
                </div>
                <div className="grid grid-cols-4 gap-1 mb-1.5">
                  {[
                    { label: '无', start: 'none', end: 'none', desc: '两端无任何箭头标记' },
                    { label: '单向 →', start: 'none', end: 'arrow', desc: '仅在终点显示实心箭头' },
                    { label: '反向 ←', start: 'arrow', end: 'none', desc: '仅在起点显示实心箭头' },
                    { label: '双向 ↔', start: 'arrow', end: 'arrow', desc: '在起点与终点均显示双向箭头' },
                  ].map((preset) => {
                    const curStart = (primary as any).markerStart ?? 'none';
                    const curEnd = (primary as any).markerEnd ?? 'none';
                    const isActive = curStart === preset.start && curEnd === preset.end;
                    return (
                      <button
                        key={preset.label}
                        type="button"
                        title={`快捷标记预设: ${preset.label} — ${preset.desc}`}
                        className={`rounded border py-0.5 text-[10px] transition-colors ${
                          isActive
                            ? 'border-[var(--ov-accent)] bg-[var(--ov-accent-soft)] text-[var(--ov-accent)] font-medium'
                            : 'border-[var(--ov-border)] bg-[var(--ov-surface)] text-[var(--ov-fg)] hover:bg-[var(--ov-hover)]'
                        }`}
                        onClick={() =>
                          execute('path.setMarker', {
                            id: primary.id,
                            markerStart: preset.start,
                            markerEnd: preset.end,
                          })
                        }
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <div>
                  <span className="text-[var(--ov-fg-muted)]">起点标记</span>
                  <select
                    className="mt-0.5 w-full rounded border border-[var(--ov-border)] bg-[var(--ov-bg)] px-1 py-0.5 text-[var(--ov-fg)]"
                    value={(primary as any).markerStart ?? 'none'}
                    title="设置线段起点标记形态：无、箭头或圆点"
                    onChange={(e) => {
                      execute('path.setMarker', {
                        id: primary.id,
                        markerStart: e.target.value,
                      });
                    }}
                  >
                    <option value="none">无 (None)</option>
                    <option value="arrow">箭头 (Arrow)</option>
                    <option value="dot">圆点 (Dot)</option>
                  </select>
                </div>
                <div>
                  <span className="text-[var(--ov-fg-muted)]">终点标记</span>
                  <select
                    className="mt-0.5 w-full rounded border border-[var(--ov-border)] bg-[var(--ov-bg)] px-1 py-0.5 text-[var(--ov-fg)]"
                    value={(primary as any).markerEnd ?? 'none'}
                    title="设置线段终点标记形态：无、箭头或圆点"
                    onChange={(e) => {
                      execute('path.setMarker', {
                        id: primary.id,
                        markerEnd: e.target.value,
                      });
                    }}
                  >
                    <option value="none">无 (None)</option>
                    <option value="arrow">箭头 (Arrow)</option>
                    <option value="dot">圆点 (Dot)</option>
                  </select>
                </div>
              </div>
              {!Boolean(isTwoPointLineNode(primary)) && (
                <div className="pt-1.5 border-t border-[var(--ov-border)]/50 flex items-center justify-between">
                  <span className="text-[var(--ov-fg-muted)]">锚点形态</span>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      title="将锚点转换为尖角拐点 (角点无切线手柄)"
                      className="rounded border border-[var(--ov-border)] bg-[var(--ov-surface)] px-1.5 py-0.5 text-[10px] hover:bg-[var(--ov-hover)]"
                      onClick={() => {
                        execute('path.toggleAnchorKind', { id: primary.id, subPathIndex: 0, anchorIndex: 0, targetKind: 'corner' });
                      }}
                    >
                      转尖角
                    </button>
                    <button
                      type="button"
                      title="将锚点转换为平滑控制拐点 (带有平滑贝塞尔切线)"
                      className="rounded border border-[var(--ov-border)] bg-[var(--ov-surface)] px-1.5 py-0.5 text-[10px] hover:bg-[var(--ov-hover)]"
                      onClick={() => {
                        execute('path.toggleAnchorKind', { id: primary.id, subPathIndex: 0, anchorIndex: 0, targetKind: 'smooth' });
                      }}
                    >
                      转平滑
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* 单选文本编辑 */}
      {ids.length === 1 && primary && primary.kind === 'Text' && (
        <div className="mb-2 space-y-1.5 rounded border border-[var(--ov-border)] bg-[var(--ov-bg)]/40 p-2 text-xs">
          <div className="font-semibold text-[var(--ov-fg-muted)]">文本内容与字体</div>
          <input
            type="text"
            className="w-full rounded border border-[var(--ov-border)] bg-[var(--ov-bg)] px-1.5 py-1 text-[var(--ov-fg)]"
            value={primary.text}
            title="双击或在此直接编辑文本字符内容"
            onChange={(e) => execute('text.setText', { id: primary.id, text: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-1.5">
            <div>
              <span className="text-[var(--ov-fg-muted)]">字体</span>
              <select
                className="mt-0.5 w-full rounded border border-[var(--ov-border)] bg-[var(--ov-bg)] px-1 py-0.5 text-[var(--ov-fg)]"
                value={primary.fontFamily ?? 'sans-serif'}
                title="设置文本字体族 (无衬线、系统默认 UI、衬线、等宽等)"
                onChange={(e) =>
                  execute('text.setText', { id: primary.id, fontFamily: e.target.value })
                }
              >
                {primary.fontFamily &&
                  ![
                    'sans-serif',
                    'system-ui, -apple-system, sans-serif',
                    'serif',
                    'monospace',
                    "'JetBrains Mono', monospace",
                  ].includes(primary.fontFamily) && (
                    <option value={primary.fontFamily}>{primary.fontFamily}</option>
                  )}
                <option value="sans-serif">无衬线 (Sans-serif)</option>
                <option value="system-ui, -apple-system, sans-serif">系统 UI (System)</option>
                <option value="serif">衬线 (Serif)</option>
                <option value="monospace">等宽 (Monospace)</option>
                <option value="'JetBrains Mono', monospace">JetBrains Mono</option>
              </select>
            </div>
            <div>
              <span className="text-[var(--ov-fg-muted)]">字重</span>
              <select
                className="mt-0.5 w-full rounded border border-[var(--ov-border)] bg-[var(--ov-bg)] px-1 py-0.5 text-[var(--ov-fg)]"
                value={primary.fontWeight ?? 'normal'}
                title="设置字体字重粗细 (400 - 800)"
                onChange={(e) =>
                  execute('text.setText', { id: primary.id, fontWeight: e.target.value })
                }
              >
                <option value="normal">常规 (400)</option>
                <option value="500">中等 (500)</option>
                <option value="600">半粗 (600)</option>
                <option value="700">粗体 (700)</option>
                <option value="bold">加粗 (Bold)</option>
                <option value="800">特粗 (800)</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <div>
              <span className="text-[var(--ov-fg-muted)]">字号 (px)</span>
              <input
                type="number"
                min={8}
                max={96}
                title="设置文本字号大小 (px)"
                className="mt-0.5 w-full rounded border border-[var(--ov-border)] bg-[var(--ov-bg)] px-1.5 py-0.5 text-[var(--ov-fg)]"
                value={primary.fontSize ?? 16}
                onChange={(e) =>
                  execute('text.setText', { id: primary.id, fontSize: Number(e.target.value) })
                }
              />
            </div>
            <div>
              <span className="text-[var(--ov-fg-muted)]">对齐</span>
              <select
                className="mt-0.5 w-full rounded border border-[var(--ov-border)] bg-[var(--ov-bg)] px-1 py-0.5 text-[var(--ov-fg)]"
                value={primary.textAnchor ?? 'start'}
                title="设置文本对齐锚点：居左、居中、居右"
                onChange={(e) =>
                  execute('text.setText', { id: primary.id, textAnchor: e.target.value as any })
                }
              >
                <option value="start">居左</option>
                <option value="middle">居中</option>
                <option value="end">居右</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* 单选几何信息：区分折线/直线/箭头 与 常规图形 */}
      {ids.length === 1 && primary && primary.kind === 'Path' && (() => {
        const polyAnchors = getPolylineWorldAnchors(doc, primary.id);
        if (polyAnchors && polyAnchors.length >= 2) {
          const total = polyAnchors.length;
          const p0 = polyAnchors[0]!.point;
          const p1 = polyAnchors[total - 1]!.point;
          const directLength = Math.hypot(p1.x - p0.x, p1.y - p0.y);
          const angleDeg = (Math.atan2(p1.y - p0.y, p1.x - p0.x) * 180) / Math.PI;

          const updateAnchorWorld = (anchorIndex: number, newWorld: { x: number; y: number }) => {
            if (!Number.isFinite(newWorld.x) || !Number.isFinite(newWorld.y)) return;
            const wt = nodeWorldTransform(doc, primary.id);
            const det = wt.a * wt.d - wt.b * wt.c;
            const localPt =
              Math.abs(det) > 1e-12
                ? {
                    x: (wt.d * (newWorld.x - wt.e) - wt.c * (newWorld.y - wt.f)) / det,
                    y: (-wt.b * (newWorld.x - wt.e) + wt.a * (newWorld.y - wt.f)) / det,
                  }
                : newWorld;
            execute('path.updateAnchor', {
              id: primary.id,
              subPathIndex: 0,
              anchorIndex,
              point: localPt,
            });
          };

          const isCurved = isCurvedLineNode(primary);
          return (
            <div className="mb-2 space-y-1.5 rounded border border-[var(--ov-border)] bg-[var(--ov-bg)]/40 p-2 text-xs">
              <div className="flex items-center justify-between font-semibold text-[var(--ov-fg-muted)]">
                <span>线型、折线与曲线走线</span>
                <span className="font-normal text-[10px]">
                  {isCurved ? '贝塞尔曲线' : total === 2 ? '直线' : `${total} 个顶点`} · {directLength.toFixed(0)}px
                </span>
              </div>

              {/* 一键切换线型：直线 / 直角折线 */}
              <div className="grid grid-cols-4 gap-1">
                {[
                  { key: 'straight', label: '直线', title: '收起所有折角与曲率，还原为两端点直线' },
                  { key: 'orthogonal-z', label: 'Z形直角', title: '水平优先直角走线（首段水平）' },
                  { key: 'orthogonal-v', label: 'V形直角', title: '垂直优先直角走线（首段垂直）' },
                  { key: 'orthogonal-l', label: 'L形直角', title: '单折角直角连接线' },
                ].map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    title={item.title}
                    className="rounded border border-[var(--ov-border)] bg-[var(--ov-surface)] py-1 text-[10px] text-[var(--ov-fg)] hover:bg-[var(--ov-hover)] transition-colors"
                    onClick={() =>
                      execute('path.convertLineStyle', {
                        id: primary.id,
                        style: item.key,
                      })
                    }
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {/* 一键切换曲线：C形弧线 / S形曲线 / 连续平滑曲线 */}
              <div className="grid grid-cols-3 gap-1">
                {[
                  { key: 'curve-arc', label: 'C形弧线', title: '单拱平滑弧线（拖拽画布弧顶中点或控制柄可自由弯曲）' },
                  { key: 'curve-s', label: 'S形曲线', title: '平滑 S 形贝塞尔连接线（适合流程图与思维导图连线）' },
                  { key: 'curve-smooth', label: '平滑曲线', title: '将折线所有折点平滑拟合为 Catmull-Rom 连续曲线' },
                ].map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    title={item.title}
                    className="rounded border border-[var(--ov-border)] bg-[var(--ov-surface)] py-1 text-[10px] text-[var(--ov-fg)] hover:bg-[var(--ov-hover)] transition-colors"
                    onClick={() =>
                      execute('path.convertLineStyle', {
                        id: primary.id,
                        style: item.key,
                      })
                    }
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <div className="text-[10px] text-[var(--ov-fg-muted)] leading-tight pt-0.5">
                💡 画布交互：拖拽曲线弧顶中点或橙色控制柄可自由调弧度；拖拽直线中点可拉出折点；双击折点可删除。
              </div>

              {/* 顶点坐标编辑器 */}
              <div className="space-y-1 pt-1 border-t border-[var(--ov-border)]/50">
                {polyAnchors.map((anc, idx) => {
                  const isStart = idx === 0;
                  const isEnd = idx === total - 1;
                  const label = isStart ? '起点' : isEnd ? '终点' : `折点 ${idx}`;
                  return (
                    <div key={idx} className="flex items-center justify-between gap-1">
                      <span className="w-10 text-[var(--ov-fg-muted)] font-mono text-[10px]">{label}</span>
                      <div className="flex items-center gap-1">
                        <label className="flex items-center gap-0.5">
                          <span className="text-[10px] text-[var(--ov-fg-muted)]">X</span>
                          <input
                            type="number"
                            value={Math.round(anc.point.x * 10) / 10}
                            title="该顶点的绝对 X 坐标 (px)"
                            className="w-14 rounded border border-[var(--ov-border)] bg-[var(--ov-bg)] px-1 py-0.5 text-right text-[11px] text-[var(--ov-fg)]"
                            onChange={(e) =>
                              updateAnchorWorld(idx, { x: Number(e.target.value), y: anc.point.y })
                            }
                          />
                        </label>
                        <label className="flex items-center gap-0.5">
                          <span className="text-[10px] text-[var(--ov-fg-muted)]">Y</span>
                          <input
                            type="number"
                            value={Math.round(anc.point.y * 10) / 10}
                            title="该顶点的绝对 Y 坐标 (px)"
                            className="w-14 rounded border border-[var(--ov-border)] bg-[var(--ov-bg)] px-1 py-0.5 text-right text-[11px] text-[var(--ov-fg)]"
                            onChange={(e) =>
                              updateAnchorWorld(idx, { x: anc.point.x, y: Number(e.target.value) })
                            }
                          />
                        </label>
                      </div>
                      {!isStart && !isEnd && (
                        <button
                          type="button"
                          title="删除此折点 (双击画布此折点亦可删除)"
                          className="h-5 w-5 flex items-center justify-center rounded text-rose-500 hover:bg-rose-500/10 text-xs"
                          onClick={() => execute('path.deleteAnchor', { id: primary.id, anchorIndex: idx })}
                        >
                          ×
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-between pt-0.5 text-[10px]">
                <span className="text-[var(--ov-fg-muted)]">跨度与角度</span>
                <span>{directLength.toFixed(1)}px · {angleDeg.toFixed(0)}°</span>
              </div>
            </div>
          );
        }
        return null;
      })()}

      {/* 几何包围盒、多选共性编组与尺寸刷 (Size Matcher) */}
      {(() => {
        const isMulti = ids.length > 1;
        const bb = isMulti
          ? (getSelectionBBox(doc, ids) ?? { x: 0, y: 0, width: 0, height: 0 })
          : primary
            ? (nodeWorldBBox(doc, primary.id) ?? (primary.kind === 'Path' ? getBoundingBox(primary.geometry) : { x: 0, y: 0, width: 0, height: 0 }))
            : { x: 0, y: 0, width: 0, height: 0 };

        const hasAnyGroup = ids.some((id) => doc.nodes.get(id)?.kind === 'Group');

        return (
          <>
            {/* 多选共性操作：编组、层级、锁定与显隐 */}
            {isMulti && (
              <div className="mb-2 space-y-1.5 rounded border border-[var(--ov-border)] bg-[var(--ov-bg)]/40 p-2 text-xs">
                <div className="flex items-center justify-between font-semibold text-[var(--ov-fg-muted)]">
                  <span>共性编组与层级</span>
                  <span className="font-normal text-[10px] text-[var(--ov-accent)] font-medium">
                    已选 {ids.length} 项
                  </span>
                </div>

                {/* 编组与解散编组 */}
                <div className="grid grid-cols-2 gap-1">
                  <button
                    type="button"
                    title="将选中的多个图元合并为一个图元组 (快捷键 ⌘G / Ctrl+G)"
                    className="flex items-center justify-center gap-1 rounded border border-[var(--ov-border)] bg-[var(--ov-surface)] py-1 text-[11px] text-[var(--ov-fg)] hover:bg-[var(--ov-hover)] transition-colors"
                    onClick={() => execute('object.group', { ids: [...ids] })}
                  >
                    <Folder size={12} className="text-[var(--ov-accent)]" />
                    <span>一键编组</span>
                  </button>
                  <button
                    type="button"
                    title="解散选中的图元组 (快捷键 ⇧⌘G / Ctrl+Shift+G)"
                    disabled={!hasAnyGroup}
                    className="flex items-center justify-center gap-1 rounded border border-[var(--ov-border)] bg-[var(--ov-surface)] py-1 text-[11px] text-[var(--ov-fg)] hover:bg-[var(--ov-hover)] disabled:opacity-40 transition-colors"
                    onClick={() => {
                      for (const id of ids) {
                        if (doc.nodes.get(id)?.kind === 'Group') {
                          execute('object.ungroup', { id });
                        }
                      }
                    }}
                  >
                    <FolderOpen size={12} />
                    <span>解散编组</span>
                  </button>
                </div>

                {/* 批量层级置顶与置底 */}
                <div className="grid grid-cols-4 gap-1">
                  <button
                    type="button"
                    title="将选中对象置于当前图层最顶层 (快捷键 ⇧⌘] / Ctrl+Shift+])"
                    className="flex items-center justify-center gap-0.5 rounded border border-[var(--ov-border)] bg-[var(--ov-surface)] py-1 text-[10px] text-[var(--ov-fg)] hover:bg-[var(--ov-hover)] transition-colors"
                    onClick={() => {
                      for (const id of ids) execute('object.reorder', { id, direction: 'front' });
                    }}
                  >
                    <ArrowUpToLine size={11} /> 置顶
                  </button>
                  <button
                    type="button"
                    title="将选中对象在当前图层中上移一层 (快捷键 ⌘] / Ctrl+])"
                    className="flex items-center justify-center gap-0.5 rounded border border-[var(--ov-border)] bg-[var(--ov-surface)] py-1 text-[10px] text-[var(--ov-fg)] hover:bg-[var(--ov-hover)] transition-colors"
                    onClick={() => {
                      for (const id of ids) execute('object.reorder', { id, direction: 'forward' });
                    }}
                  >
                    <ArrowUp size={11} /> 上移
                  </button>
                  <button
                    type="button"
                    title="将选中对象在当前图层中下移一层 (快捷键 ⌘[ / Ctrl+[)"
                    className="flex items-center justify-center gap-0.5 rounded border border-[var(--ov-border)] bg-[var(--ov-surface)] py-1 text-[10px] text-[var(--ov-fg)] hover:bg-[var(--ov-hover)] transition-colors"
                    onClick={() => {
                      for (const id of ids) execute('object.reorder', { id, direction: 'backward' });
                    }}
                  >
                    <ArrowDown size={11} /> 下移
                  </button>
                  <button
                    type="button"
                    title="将选中对象置于当前图层最底层 (快捷键 ⇧⌘[ / Ctrl+Shift+[)"
                    className="flex items-center justify-center gap-0.5 rounded border border-[var(--ov-border)] bg-[var(--ov-surface)] py-1 text-[10px] text-[var(--ov-fg)] hover:bg-[var(--ov-hover)] transition-colors"
                    onClick={() => {
                      for (const id of ids) execute('object.reorder', { id, direction: 'back' });
                    }}
                  >
                    <ArrowDownToLine size={11} /> 置底
                  </button>
                </div>

                {/* 批量锁定与显隐 */}
                <div className="grid grid-cols-2 gap-1 pt-0.5 border-t border-[var(--ov-border)]/50">
                  <div className="flex gap-1">
                    <button
                      type="button"
                      title="批量锁定选中对象（防止误触误拖）"
                      className="flex-1 flex items-center justify-center gap-1 rounded border border-[var(--ov-border)] bg-[var(--ov-surface)] py-0.5 text-[10px] text-[var(--ov-fg)] hover:bg-[var(--ov-hover)]"
                      onClick={() => execute('object.setLocked', { ids: [...ids], locked: true })}
                    >
                      <Lock size={10} /> 锁定
                    </button>
                    <button
                      type="button"
                      title="批量解锁选中对象（恢复正常编辑）"
                      className="flex-1 flex items-center justify-center gap-1 rounded border border-[var(--ov-border)] bg-[var(--ov-surface)] py-0.5 text-[10px] text-[var(--ov-fg)] hover:bg-[var(--ov-hover)]"
                      onClick={() => execute('object.setLocked', { ids: [...ids], locked: false })}
                    >
                      <Unlock size={10} /> 解锁
                    </button>
                  </div>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      title="批量隐藏选中对象（画布暂不渲染）"
                      className="flex-1 flex items-center justify-center gap-1 rounded border border-[var(--ov-border)] bg-[var(--ov-surface)] py-0.5 text-[10px] text-[var(--ov-fg)] hover:bg-[var(--ov-hover)]"
                      onClick={() => execute('object.setVisible', { ids: [...ids], visible: false })}
                    >
                      <EyeOff size={10} /> 隐藏
                    </button>
                    <button
                      type="button"
                      title="批量重新显示选中对象"
                      className="flex-1 flex items-center justify-center gap-1 rounded border border-[var(--ov-border)] bg-[var(--ov-surface)] py-0.5 text-[10px] text-[var(--ov-fg)] hover:bg-[var(--ov-hover)]"
                      onClick={() => execute('object.setVisible', { ids: [...ids], visible: true })}
                    >
                      <Eye size={10} /> 显示
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 位置与尺寸（单选为自身坐标，多选为联合包围盒 Collective Bounding Box） */}
            <div className="mb-2 space-y-1.5 rounded border border-[var(--ov-border)] bg-[var(--ov-bg)]/40 p-2 text-xs">
              <div className="flex items-center justify-between font-semibold text-[var(--ov-fg-muted)]">
                <span>{isMulti ? '联合位置与尺寸' : '位置与尺寸'}</span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    title={lockElementAspect ? '已锁定宽高比（修改宽或高时等比缩放）' : '未锁定宽高比（点击开启等比锁定）'}
                    className={`flex items-center gap-0.5 rounded border px-1 py-0.5 text-[10px] font-normal transition-colors ${
                      lockElementAspect
                        ? 'border-[var(--ov-accent)] bg-[var(--ov-accent-soft)] text-[var(--ov-accent)]'
                        : 'border-[var(--ov-border)] bg-[var(--ov-surface)] text-[var(--ov-fg-muted)] hover:bg-[var(--ov-hover)]'
                    }`}
                    onClick={() => setLockElementAspect((v) => !v)}
                  >
                    {lockElementAspect ? <Lock size={9} /> : <Unlock size={9} />}
                    <span>等比</span>
                  </button>
                  <span className="font-normal text-[10px]">
                    {bb.width.toFixed(1)} × {bb.height.toFixed(1)}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <label className="flex items-center justify-between gap-1">
                  <span className="text-[var(--ov-fg-muted)]">X</span>
                  <input
                    type="number"
                    value={Math.round(bb.x * 10) / 10}
                    title="设置图元或多选联合包围盒的左边缘水平坐标 X (px)"
                    className="w-16 rounded border border-[var(--ov-border)] bg-[var(--ov-bg)] px-1.5 py-0.5 text-right text-[var(--ov-fg)]"
                    onChange={(e) => {
                      const nextX = Number(e.target.value);
                      if (!Number.isFinite(nextX)) return;
                      execute('object.move', { ids: isMulti ? [...ids] : [primary ? primary.id : ids[0]], delta: { x: nextX - bb.x, y: 0 } });
                    }}
                  />
                </label>
                <label className="flex items-center justify-between gap-1">
                  <span className="text-[var(--ov-fg-muted)]">Y</span>
                  <input
                    type="number"
                    value={Math.round(bb.y * 10) / 10}
                    title="设置图元或多选联合包围盒的上边缘垂直坐标 Y (px)"
                    className="w-16 rounded border border-[var(--ov-border)] bg-[var(--ov-bg)] px-1.5 py-0.5 text-right text-[var(--ov-fg)]"
                    onChange={(e) => {
                      const nextY = Number(e.target.value);
                      if (!Number.isFinite(nextY)) return;
                      execute('object.move', { ids: isMulti ? [...ids] : [primary ? primary.id : ids[0]], delta: { x: 0, y: nextY - bb.y } });
                    }}
                  />
                </label>
                <label className="flex items-center justify-between gap-1">
                  <span className="text-[var(--ov-fg-muted)]">宽</span>
                  <input
                    type="number"
                    min={1}
                    value={Math.round(bb.width * 10) / 10}
                    title="设置图元或多选联合包围盒的总宽度 W (px)"
                    className="w-16 rounded border border-[var(--ov-border)] bg-[var(--ov-bg)] px-1.5 py-0.5 text-right text-[var(--ov-fg)]"
                    onChange={(e) => {
                      const nextW = Math.max(1, Number(e.target.value));
                      if (!Number.isFinite(nextW) || bb.width < 1e-6) return;
                      const fx = nextW / bb.width;
                      execute('object.scale', {
                        ids: isMulti ? [...ids] : [primary ? primary.id : ids[0]],
                        factor: { x: fx, y: lockElementAspect ? fx : 1 },
                        origin: { x: bb.x, y: bb.y },
                      });
                    }}
                  />
                </label>
                <label className="flex items-center justify-between gap-1">
                  <span className="text-[var(--ov-fg-muted)]">高</span>
                  <input
                    type="number"
                    min={1}
                    value={Math.round(bb.height * 10) / 10}
                    title="设置图元或多选联合包围盒的总高度 H (px)"
                    className="w-16 rounded border border-[var(--ov-border)] bg-[var(--ov-bg)] px-1.5 py-0.5 text-right text-[var(--ov-fg)]"
                    onChange={(e) => {
                      const nextH = Math.max(1, Number(e.target.value));
                      if (!Number.isFinite(nextH) || bb.height < 1e-6) return;
                      const fy = nextH / bb.height;
                      execute('object.scale', {
                        ids: isMulti ? [...ids] : [primary ? primary.id : ids[0]],
                        factor: { x: lockElementAspect ? fy : 1, y: fy },
                        origin: { x: bb.x, y: bb.y },
                      });
                    }}
                  />
                </label>
              </div>
              {/* 选中图元快捷等比倍率缩放 */}
              <div className="grid grid-cols-5 gap-1 pt-0.5">
                {[0.5, 0.75, 1.25, 1.5, 2].map((factor) => (
                  <button
                    key={factor}
                    type="button"
                    title={`将选中图元按中心等比缩放 ${factor}x`}
                    className="rounded border border-[var(--ov-border)] bg-[var(--ov-surface)] py-0.5 text-[10px] text-[var(--ov-fg)] hover:bg-[var(--ov-hover)] transition-colors"
                    onClick={() => {
                      const cx = bb.x + bb.width / 2;
                      const cy = bb.y + bb.height / 2;
                      execute('object.scale', {
                        ids: isMulti ? [...ids] : [primary ? primary.id : ids[0]],
                        factor: { x: factor, y: factor },
                        origin: { x: cx, y: cy },
                      });
                    }}
                  >
                    {factor}x
                  </button>
                ))}
              </div>
              <div className="flex justify-between pt-0.5">
                <span className="text-[var(--ov-fg-muted)]">{isMulti ? '联合尺寸' : '尺寸'}</span>
                <span>{`${bb.width.toFixed(1)} × ${bb.height.toFixed(1)}`}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--ov-fg-muted)]">{isMulti ? '左上坐标' : '坐标'}</span>
                <span>{`(${bb.x.toFixed(1)}, ${bb.y.toFixed(1)})`}</span>
              </div>
              {!isMulti && primary && (
                <div className="flex justify-between">
                  <span className="text-[var(--ov-fg-muted)]">名称</span>
                  <span className="max-w-[120px] truncate">{primary.name ?? '—'}</span>
                </div>
              )}

              {/* 尺寸吸管与对齐刷 (Size Matcher / 获取尺寸与刷新尺寸) */}
              <div className="pt-1.5 border-t border-[var(--ov-border)]/50 space-y-1">
                <div className="flex items-center justify-between text-[11px] text-[var(--ov-fg-muted)]">
                  <span className="font-semibold">尺寸刷 (获取与刷新尺寸)</span>
                  {hasSizeBuffer && globalSizeBuffer && (
                    <span className="text-[10px] text-[var(--ov-accent)] font-mono font-medium">
                      已获取 {globalSizeBuffer.width} × {globalSizeBuffer.height}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-1">
                  <button
                    type="button"
                    title="获取当前选中图元的包围盒绝对宽度与高度（W, H）"
                    className="flex items-center justify-center gap-1 rounded border border-[var(--ov-border)] bg-[var(--ov-surface)] py-1 text-[10px] text-[var(--ov-fg)] hover:bg-[var(--ov-hover)] transition-colors"
                    onClick={handlePickSize}
                  >
                    <Scaling size={11} className="text-[var(--ov-accent)]" />
                    <span>获取尺寸</span>
                  </button>
                  <button
                    type="button"
                    title={hasSizeBuffer && globalSizeBuffer ? `将选中图元宽高同时刷新为 ${globalSizeBuffer.width} × ${globalSizeBuffer.height} px` : "请先选中图元点击「获取尺寸」"}
                    disabled={!hasSizeBuffer}
                    className="flex items-center justify-center gap-1 rounded border border-[var(--ov-border)] bg-[var(--ov-surface)] py-1 text-[10px] text-[var(--ov-fg)] hover:bg-[var(--ov-hover)] disabled:opacity-40 transition-colors"
                    onClick={() => handleApplySize('both')}
                  >
                    <Maximize2 size={11} className="text-emerald-500" />
                    <span>刷新等尺寸</span>
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-1">
                  <button
                    type="button"
                    title={hasSizeBuffer && globalSizeBuffer ? `将选中图元宽度刷新为 ${globalSizeBuffer.width}px（高度不变）` : "请先获取尺寸"}
                    disabled={!hasSizeBuffer}
                    className="rounded border border-[var(--ov-border)] bg-[var(--ov-surface)] py-0.5 text-[10px] text-[var(--ov-fg)] hover:bg-[var(--ov-hover)] disabled:opacity-40 transition-colors"
                    onClick={() => handleApplySize('width')}
                  >
                    刷新同宽
                  </button>
                  <button
                    type="button"
                    title={hasSizeBuffer && globalSizeBuffer ? `将选中图元高度刷新为 ${globalSizeBuffer.height}px（宽度不变）` : "请先获取尺寸"}
                    disabled={!hasSizeBuffer}
                    className="rounded border border-[var(--ov-border)] bg-[var(--ov-surface)] py-0.5 text-[10px] text-[var(--ov-fg)] hover:bg-[var(--ov-hover)] disabled:opacity-40 transition-colors"
                    onClick={() => handleApplySize('height')}
                  >
                    刷新同高
                  </button>
                  <button
                    type="button"
                    title={hasSizeBuffer && globalSizeBuffer ? `按吸取的最大边长等比缩放选中图元（保持自身纵横比）` : "请先获取尺寸"}
                    disabled={!hasSizeBuffer}
                    className="rounded border border-[var(--ov-border)] bg-[var(--ov-surface)] py-0.5 text-[10px] text-[var(--ov-fg)] hover:bg-[var(--ov-hover)] disabled:opacity-40 transition-colors"
                    onClick={() => handleApplySize('fit')}
                  >
                    等比匹配
                  </button>
                </div>

                {/* 多选时的一键对齐主选图元尺寸 */}
                {ids.length >= 2 && (
                  <div className="pt-1 border-t border-[var(--ov-border)]/30 flex items-center justify-between text-[10px]">
                    <span className="text-[var(--ov-fg-muted)]">以主选对齐:</span>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        title="将其他所有选中图元的宽度刷新为与主选图元一致"
                        className="rounded border border-[var(--ov-border)] bg-[var(--ov-surface)] px-1.5 py-0.5 text-[10px] hover:bg-[var(--ov-hover)]"
                        onClick={() => handleMatchPrimarySize('width')}
                      >
                        同宽
                      </button>
                      <button
                        type="button"
                        title="将其他所有选中图元的高度刷新为与主选图元一致"
                        className="rounded border border-[var(--ov-border)] bg-[var(--ov-surface)] px-1.5 py-0.5 text-[10px] hover:bg-[var(--ov-hover)]"
                        onClick={() => handleMatchPrimarySize('height')}
                      >
                        同高
                      </button>
                      <button
                        type="button"
                        title="将其他所有选中图元的宽高刷新为与主选图元完全一致"
                        className="rounded border border-[var(--ov-border)] bg-[var(--ov-surface)] px-1.5 py-0.5 text-[10px] hover:bg-[var(--ov-hover)]"
                        onClick={() => handleMatchPrimarySize('both')}
                      >
                        全等大
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        );
      })()}

      {/* 删除 */}
      <button
        type="button"
        title="从画布删除当前选中的图元或对象 (快捷键 Delete / Backspace)"
        className="flex w-full items-center justify-center gap-1 rounded bg-[var(--ov-danger)] py-1 text-xs text-white hover:opacity-90 transition-opacity"
        onClick={() => execute('object.delete', { ids })}
      >
        <Trash2 size={13} /> 删除{ids.length > 1 ? `${ids.length} 个对象` : '图元'}
      </button>

      {/* 快速切换到 SVG 整体图形尺寸面板 */}
      <button
        type="button"
        title="取消当前图元选中，进入 SVG 图形整体宽高、比例缩放与画布边界设置"
        className="mt-1.5 flex w-full items-center justify-center gap-1 rounded border border-[var(--ov-border)] bg-[var(--ov-surface)] py-1 text-[11px] text-[var(--ov-fg-muted)] hover:bg-[var(--ov-hover)] hover:text-[var(--ov-fg)] transition-colors"
        onClick={() => execute('select.clear', {})}
      >
        <Scaling size={12} className="text-[var(--ov-accent)]" />
        <span>调整 SVG 整体尺寸 ({Math.round(canvasW)} × {Math.round(canvasH)})</span>
      </button>
    </div>
  );
};

export default SvgV2Inspector;
