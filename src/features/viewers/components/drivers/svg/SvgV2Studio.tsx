/**
 * OmniView SVG v2 Studio Viewer (M4 + M5 + M6 + P0 修复)
 *
 * 基于 v2 文档模型 + 命令管线的全新 SVG 编辑器。
 * 拥有撤销栈、图层面板、Inspector、改写后 SVG 输出。
 *
 * P0-2 数据安全时序（详见 `core/runtime/exportSync.ts`）：
 * - 加载完成前绝不回写；加载基线不回写（格式化差异不打脏宿主）；
 * - 仅文档真实变更（新 Document 对象）导出并 `onContentChange`；
 * - 宿主回灌自身输出（echo）不重复加载，外部真实变更才重载。
 *
 * @see docs/adr/0001-svg-edit-engine-v2-document-model.md
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  Undo2,
  Redo2,
  Plus,
  MousePointer2,
  CircleDot,
  PenLine,
  Square,
  Circle,
  Minus,
  Type,
} from 'lucide-react';
import {
  decideBackup,
  getSvgEngineFlag,
  setSvgEngineFlag,
  shouldExport,
  shouldReloadFromHost,
  shouldWriteBackup,
  tagBackupContent,
  useSvgRuntime,
  writeBackup,
  type Document as SvgDocument,
} from './core';
import { SvgV2LayersPanel } from './SvgV2LayersPanel';
import { SvgV2Inspector } from './SvgV2Inspector';
import { SvgV2Canvas } from './SvgV2Canvas';

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

  // ---- 加载状态（P0 数据安全关键）----
  /** 加载状态 + 最近导出（或加载基线）的 Document 引用。 */
  const loadedStateRef = useRef<{ loaded: boolean; doc: SvgDocument | null }>({ loaded: false, doc: null });
  /** 自身上次导出的 SVG 文本（宿主回灌 echo 判定）。 */
  const lastExportedContentRef = useRef<string | null>(null);
  const backupOnceRef = useRef(false);
  const exportCountRef = useRef(0);

  // 1) 内容加载 / 外部真实变更重载
  useEffect(() => {
    if (!shouldReloadFromHost(lastExportedContentRef.current, content)) return;
    loadedStateRef.current = { loaded: false, doc: null };
    let cancelled = false;
    runtime
      .loadFromSvg(content)
      .then(() => {
        if (cancelled) return;
        // 加载即视为「已导出基线」：不回写，避免格式化差异打脏宿主
        loadedStateRef.current = { loaded: true, doc: runtime.currentDocument };
        lastExportedContentRef.current = content;
      })
      .catch(() => {
        /* 保持 loaded=false：宁可不导出也不误清文件 */
      });
    return () => {
      cancelled = true;
    };
  }, [runtime, content]);

  // 2) 文档真实变更 → 导出回写 + 首次编辑一次性 .bak
  useEffect(() => {
    const st = loadedStateRef.current;
    if (!shouldExport({ loaded: st.loaded, lastExportedDoc: st.doc }, document)) return;
    let cancelled = false;
    runtime
      .exportToSvg()
      .then((svg) => {
        if (cancelled) return;
        const firstEdit = exportCountRef.current === 0;
        exportCountRef.current += 1;
        loadedStateRef.current = { loaded: true, doc: document };
        lastExportedContentRef.current = svg;
        if (
          decideBackup(backupOnceRef.current, firstEdit, content, getSvgEngineFlag(), shouldWriteBackup)
        ) {
          backupOnceRef.current = true;
          const tagged = tagBackupContent(svg, document, content);
          writeBackup({ originalContent: content, newContent: tagged, fileName, doc: document });
        }
        if (svg !== content) onContentChange?.(svg);
      })
      .catch(() => {
        /* 导出失败不回写 */
      });
    return () => {
      cancelled = true;
    };
  }, [document, runtime, content, fileName, onContentChange]);

  return (
    <div className="flex h-full w-full bg-[var(--ov-bg)] text-[var(--ov-fg)]">
      {/* 左侧工具栏 */}
      <aside className="flex w-12 flex-col items-center border-r border-[var(--ov-border)] bg-[var(--ov-panel)] py-2 select-none">
        <ToolButton icon={<MousePointer2 size={17} />} active={activeToolId === 'select'} label="选择工具 (V)" onClick={() => setActiveTool('select')} />
        <ToolButton icon={<CircleDot size={17} />} active={activeToolId === 'node'} label="直接选区 / 锚点编辑 (A)" onClick={() => setActiveTool('node')} />
        <ToolButton icon={<PenLine size={17} />} active={activeToolId === 'pen'} label="钢笔工具 (P)" onClick={() => setActiveTool('pen')} />
        <div className="my-1.5 h-px w-8 bg-[var(--ov-border)]" />
        <ToolButton icon={<Square size={17} />} active={activeToolId === 'rect'} label="矩形工具 (R)" onClick={() => setActiveTool('rect')} />
        <ToolButton icon={<Circle size={17} />} active={activeToolId === 'ellipse'} label="椭圆工具 (O)" onClick={() => setActiveTool('ellipse')} />
        <ToolButton icon={<Minus size={17} />} active={activeToolId === 'line'} label="直线工具 (L)" onClick={() => setActiveTool('line')} />
        <ToolButton icon={<Type size={17} />} active={activeToolId === 'text'} label="文本工具 (T)" onClick={() => setActiveTool('text')} />
        <div className="my-1.5 h-px w-8 bg-[var(--ov-border)]" />
        <ToolButton icon={<Undo2 size={17} />} active={false} label="撤销 (Ctrl+Z)" disabled={!canUndo} onClick={undo} />
        <ToolButton icon={<Redo2 size={17} />} active={false} label="重做 (Ctrl+Y)" disabled={!canRedo} onClick={redo} />
        <div className="my-1.5 h-px w-8 bg-[var(--ov-border)]" />
        <ToolButton icon={<Plus size={17} />} active={false} label="新建图层" onClick={() => execute('layer.add', {})} />
      </aside>

      {/* 中央画布 */}
      <main className="relative flex-1 overflow-hidden">
        <SvgV2Canvas
          document={document}
          selection={selection}
          runtime={runtime}
          activeToolId={activeToolId}
        />
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
