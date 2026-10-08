/**
 * OmniView SVG v2 Studio Viewer (M4 + M5 + M6)
 *
 * 基于 v2 文档模型 + 命令管线的全新 SVG 编辑器。
 * 拥有撤销栈、图层面板、Inspector、改写后 SVG 输出。
 *
 * @see docs/adr/0001-svg-edit-engine-v2-document-model.md
 */
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Undo2,
  Redo2,
  Plus,
  MousePointer2,
  PenLine,
  Circle,
} from 'lucide-react';
import {
  getSvgEngineFlag,
  serializePathD,
  setSvgEngineFlag,
  shouldWriteBackup,
  tagBackupContent,
  useSvgRuntime,
  writeBackup,
  type Document as SvgDocument,
  type Node,
  type NodeId,
  type Selection,
} from './core';
import { SvgV2LayersPanel } from './SvgV2LayersPanel';
import { SvgV2Inspector } from './SvgV2Inspector';

export interface SvgV2StudioProps {
  readonly content: string;
  readonly fileName?: string;
  readonly onContentChange?: (newContent: string) => void;
}

export const SvgV2Studio: React.FC<SvgV2StudioProps> = ({
  content,
  fileName = 'graphic.svg',
  onContentChange,
}) => {
  const {
    runtime,
    document,
    selection,
    activeToolId,
    canUndo,
    canRedo,
    execute,
    undo,
    redo,
    setActiveTool,
  } = useSvgRuntime();

  const initialLoadedRef = useRef(false);
  useEffect(() => {
    if (initialLoadedRef.current) return;
    initialLoadedRef.current = true;
    runtime.loadFromSvg(content).catch(() => { /* fallback */ });
  }, [runtime, content]);

  // 内容变化时同步导出
  const lastRevisionRef = useRef(-1);
  useEffect(() => {
    if (lastRevisionRef.current === document._internal.revision) return;
    lastRevisionRef.current = document._internal.revision;
    runtime.exportToSvg().then((svg) => {
      // 备份策略：第一次切到 v2 引擎时落 .bak.svg
      if (shouldWriteBackup(content, getSvgEngineFlag())) {
        const tagged = tagBackupContent(svg, document, content);
        writeBackup({ originalContent: content, newContent: tagged, fileName, doc: document });
      }
      onContentChange?.(svg);
    }).catch(() => { /* ignore */ });
  }, [document, runtime, content, fileName, onContentChange]);

  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const nodeIdAttr = target.closest('[data-omni-id]')?.getAttribute('data-omni-id');
    const point = { x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY };
    runtime.dispatchPointer({
      kind: 'down',
      point,
      mods: { shift: e.shiftKey, alt: e.altKey, meta: e.metaKey, ctrl: e.ctrlKey, space: false },
      pressure: 1,
    });
    void nodeIdAttr; // 备用：可在此点击事件中提取 element id 加速 hit-test
  }, [runtime]);

  return (
    <div className="flex h-full w-full bg-[var(--ov-bg)] text-[var(--ov-fg)]">
      {/* 左侧工具栏 */}
      <aside className="flex w-12 flex-col items-center border-r border-[var(--ov-border)] bg-[var(--ov-panel)] py-2">
        <ToolButton icon={<MousePointer2 size={18} />} active={activeToolId === 'select'} label="选择" onClick={() => setActiveTool('select')} />
        <ToolButton icon={<Circle size={18} />} active={activeToolId === 'node'} label="节点" onClick={() => setActiveTool('node')} />
        <ToolButton icon={<PenLine size={18} />} active={activeToolId === 'pen'} label="钢笔" onClick={() => setActiveTool('pen')} />
        <div className="my-2 h-px w-8 bg-[var(--ov-border)]" />
        <ToolButton icon={<Undo2 size={18} />} active={false} label="撤销" disabled={!canUndo} onClick={undo} />
        <ToolButton icon={<Redo2 size={18} />} active={false} label="重做" disabled={!canRedo} onClick={redo} />
        <div className="my-2 h-px w-8 bg-[var(--ov-border)]" />
        <ToolButton icon={<Plus size={18} />} active={false} label="新建图层" onClick={() => execute('layer.add', {})} />
      </aside>

      {/* 中央画布 */}
      <main className="relative flex-1 overflow-hidden" onClick={handleCanvasClick}>
        <SvgV2Canvas document={document} selection={selection} />
      </main>

      {/* 右侧面板 */}
      <aside className="flex w-72 flex-col border-l border-[var(--ov-border)] bg-[var(--ov-panel)]">
        <SvgV2LayersPanel document={document} selection={selection} execute={execute} />
        <SvgV2Inspector document={document} selection={selection} execute={execute} />
        <SvgV2EngineSwitcher />
      </aside>
    </div>
  );
};

// ============================================================================
// 子组件
// ============================================================================

interface ToolButtonProps {
  readonly icon: React.ReactNode;
  readonly active: boolean;
  readonly label: string;
  readonly disabled?: boolean;
  readonly onClick: () => void;
}

const ToolButton: React.FC<ToolButtonProps> = ({ icon, active, label, disabled, onClick }) => (
  <button
    type="button"
    className={`m-1 flex h-8 w-8 items-center justify-center rounded transition-colors ${active ? 'bg-[var(--ov-accent)] text-white' : 'hover:bg-[var(--ov-hover)]'} ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
    title={label}
    onClick={disabled ? undefined : onClick}
  >
    {icon}
  </button>
);

interface SvgV2CanvasProps {
  readonly document: SvgDocument;
  readonly selection: Selection;
}

const SvgV2Canvas: React.FC<SvgV2CanvasProps> = ({ document: doc, selection }) => {
  const elements = useMemo(() => {
    const out: React.ReactNode[] = [];
    for (const layerId of doc.layers) {
      const layer = doc.nodes.get(layerId);
      if (!layer || layer.kind !== 'Layer' || !layer.visible) continue;
      for (const childId of layer.children) {
        const child = doc.nodes.get(childId);
        if (!child) continue;
        const el = renderNode(child, doc, selection);
        if (el) out.push(el);
      }
    }
    return out;
  }, [doc, selection]);

  return (
    <div className="flex h-full w-full items-center justify-center overflow-auto bg-[var(--ov-canvas-bg)] p-4">
      <svg
        viewBox={`0 0 ${doc.canvas.width} ${doc.canvas.height}`}
        className="h-auto max-h-full max-w-full border border-[var(--ov-border)] bg-white"
        style={{ aspectRatio: `${doc.canvas.width} / ${doc.canvas.height}` }}
      >
        {elements}
      </svg>
    </div>
  );
};

function renderNode(node: Node, doc: SvgDocument, selection: Selection): React.ReactNode {
  if (!node.visible) return null;
  const isSelected = selection.nodeIds.includes(node.id);
  if (node.kind === 'Group') {
    return (
      <g key={`g-${node.id}`} data-omni-id={node.id} opacity={node.opacity}>
        {node.children.map((cid) => {
          const child = doc.nodes.get(cid);
          return child ? renderNode(child, doc, selection) : null;
        })}
      </g>
    );
  }
  if (node.kind !== 'Path') return null;
  const fill = node.appearance.items.find((it) => it.kind === 'fill');
  const stroke = node.appearance.items.find((it) => it.kind === 'stroke');
  const fillValue = fill && fill.fill.type === 'solid' ? fill.fill.color : fill && fill.fill.type === 'none' ? 'none' : '#000';
  const strokeValue = stroke && stroke.stroke.paint.type === 'solid' ? stroke.stroke.paint.color : stroke && stroke.stroke.paint.type === 'none' ? 'none' : '#000';
  const strokeWidth = stroke ? stroke.stroke.width : 0;
  const t = node.transform;
  const transform = t.a === 1 && t.b === 0 && t.c === 0 && t.d === 1 && t.e === 0 && t.f === 0
    ? undefined
    : `matrix(${t.a} ${t.b} ${t.c} ${t.d} ${t.e} ${t.f})`;
  return (
    <path
      key={`p-${node.id}`}
      data-omni-id={node.id}
      d={serializePathD(node.geometry)}
      fill={fillValue}
      stroke={strokeValue}
      strokeWidth={strokeWidth}
      transform={transform}
      opacity={node.opacity}
      style={{ outline: isSelected ? '2px solid var(--ov-accent)' : undefined, cursor: 'default' }}
    />
  );
}

const SvgV2EngineSwitcher: React.FC = () => {
  const [engine, setEngine] = useState<'v1' | 'v2'>(() => getSvgEngineFlag());
  return (
    <div className="mt-auto border-t border-[var(--ov-border)] p-2 text-xs text-[var(--ov-fg-muted)]">
      <div className="mb-1">编辑引擎</div>
      <select
        className="w-full rounded border border-[var(--ov-border)] bg-[var(--ov-bg)] px-1 py-1 text-[var(--ov-fg)]"
        value={engine}
        onChange={(e) => {
          const v = e.target.value as 'v1' | 'v2';
          setEngine(v);
          setSvgEngineFlag(v);
          if (typeof window !== 'undefined') window.location.reload();
        }}
      >
        <option value="v1">v1（当前）</option>
        <option value="v2">v2（实验）</option>
      </select>
    </div>
  );
};

export default SvgV2Studio;