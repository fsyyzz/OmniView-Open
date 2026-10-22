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
  Pentagon,
  Circle,
  Minus,
  Spline,
  MoveUpRight,
  Type,
  AlignStartHorizontal,
  AlignCenterHorizontal,
  AlignEndHorizontal,
  AlignStartVertical,
  AlignCenterVertical,
  AlignEndVertical,
  AlignHorizontalDistributeCenter,
  AlignVerticalDistributeCenter,
  FileCode,
  FileImage,
  Check,
} from 'lucide-react';
import {
  decideBackup,
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
import { convertSvgToReact, exportSvgAsPng } from './svgUtils';

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
    isInteracting,
    execute,
    undo,
    redo,
    setActiveTool,
  } = useSvgRuntime();

  const [copiedJsx, setCopiedJsx] = useState(false);
  const [exportingPng, setExportingPng] = useState(false);

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

  // 2) 文档真实变更 → 导出回写 + 首次编辑一次性 .bak（手势进行中不回写，释放后统一回写）
  useEffect(() => {
    if (isInteracting) return;
    const st = loadedStateRef.current;
    if (!shouldExport({ loaded: st.loaded, lastExportedDoc: st.doc, isInteracting }, document)) return;
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
          decideBackup(backupOnceRef.current, firstEdit, content, 'v2', shouldWriteBackup)
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

  const handleCopyJsx = async () => {
    try {
      const svg = await runtime.exportToSvg();
      const rawName = fileName.replace(/\.svg$/i, '').replace(/[^a-zA-Z0-9]/g, '') || 'SvgIcon';
      const compName = rawName.charAt(0).toUpperCase() + rawName.slice(1);
      const jsx = convertSvgToReact(svg, compName);
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(jsx);
        setCopiedJsx(true);
        setTimeout(() => setCopiedJsx(false), 2000);
      }
    } catch {
      /* clipboard write ignored */
    }
  };

  const handleExportPng = async () => {
    try {
      setExportingPng(true);
      const svg = await runtime.exportToSvg();
      const pngName = fileName.endsWith('.svg') ? fileName.replace(/\.svg$/i, '.png') : `${fileName}.png`;
      await exportSvgAsPng(svg, pngName, 2);
    } catch {
      /* export failed ignored */
    } finally {
      setExportingPng(false);
    }
  };

  const selectedCount = selection.nodeIds.length;
  const canAlign = selectedCount >= 2;
  const canDistribute = selectedCount >= 3;

  return (
    <div className="flex h-full w-full bg-[var(--ov-bg)] text-[var(--ov-fg)]">
      {/* 左侧工具栏 */}
      <aside className="flex w-12 flex-col items-center border-r border-[var(--ov-border)] bg-[var(--ov-panel)] py-2 select-none">
        <ToolButton icon={<MousePointer2 size={17} />} active={activeToolId === 'select'} label="选择工具 (V)" onClick={() => setActiveTool('select')} />
        <ToolButton icon={<CircleDot size={17} />} active={activeToolId === 'node'} label="直接选区 / 锚点编辑 (A)" onClick={() => setActiveTool('node')} />
        <ToolButton icon={<PenLine size={17} />} active={activeToolId === 'pen'} label="钢笔工具 (P)" onClick={() => setActiveTool('pen')} />
        <div className="my-1.5 h-px w-8 bg-[var(--ov-border)]" />
        <ToolButton icon={<Square size={17} />} active={activeToolId === 'rect'} label="矩形工具 (R — 拖拽绘制圆角矩形，Shift 正方形 / Alt 中心起绘)" onClick={() => setActiveTool('rect')} />
        <ToolButton icon={<Pentagon size={17} />} active={activeToolId === 'polygon'} label="自由多边形工具 (G — 单击添加顶点，双击、点击起点或 Enter 完成，Escape 取消)" onClick={() => setActiveTool('polygon')} />
        <ToolButton icon={<Circle size={17} />} active={activeToolId === 'ellipse'} label="椭圆/圆形工具 (O — 拖拽绘制，Shift 正圆 / Alt 中心起绘)" onClick={() => setActiveTool('ellipse')} />
        <ToolButton icon={<Minus size={17} />} active={activeToolId === 'line'} label="直线工具 (L — 拖拽连接两端点，Shift 15° 锁定)" onClick={() => setActiveTool('line')} />
        <ToolButton icon={<Spline size={17} />} active={activeToolId === 'curve'} label="曲线工具 (C — 拖拽绘制贝塞尔曲线，Shift 切换拱形弧线)" onClick={() => setActiveTool('curve')} />
        <ToolButton icon={<MoveUpRight size={17} />} active={activeToolId === 'arrow'} label="箭头工具 (W — 拖拽连接两端点，Shift 15° 锁定)" onClick={() => setActiveTool('arrow')} />
        <ToolButton icon={<Type size={17} />} active={activeToolId === 'text'} label="文本工具 (T)" onClick={() => setActiveTool('text')} />
        <div className="my-1.5 h-px w-8 bg-[var(--ov-border)]" />
        <ToolButton icon={<Undo2 size={17} />} active={false} label="撤销 (Ctrl+Z)" disabled={!canUndo} onClick={undo} />
        <ToolButton icon={<Redo2 size={17} />} active={false} label="重做 (Ctrl+Y)" disabled={!canRedo} onClick={redo} />
        <div className="my-1.5 h-px w-8 bg-[var(--ov-border)]" />
        <ToolButton icon={<Plus size={17} />} active={false} label="新建图层" onClick={() => execute('layer.add', {})} />
      </aside>

      {/* 中央主工作区 */}
      <main className="relative flex flex-1 flex-col overflow-hidden">
        {/* 顶部操作栏 (对齐、分布、复制 JSX、导出 PNG) */}
        <header className="flex h-9 shrink-0 items-center justify-between border-b border-[var(--ov-border)] bg-[var(--ov-panel)] px-2.5 text-xs select-none">
          {/* 左侧：对齐与分布群组 */}
          <div className="flex items-center space-x-1">
            {/* 水平对齐 */}
            <ActionButton
              icon={<AlignStartHorizontal size={15} />}
              label="左对齐 (至少选 2 项)"
              disabled={!canAlign}
              onClick={() => execute('object.align', { ids: selection.nodeIds, align: 'left' })}
            />
            <ActionButton
              icon={<AlignCenterHorizontal size={15} />}
              label="水平居中 (至少选 2 项)"
              disabled={!canAlign}
              onClick={() => execute('object.align', { ids: selection.nodeIds, align: 'center' })}
            />
            <ActionButton
              icon={<AlignEndHorizontal size={15} />}
              label="右对齐 (至少选 2 项)"
              disabled={!canAlign}
              onClick={() => execute('object.align', { ids: selection.nodeIds, align: 'right' })}
            />

            <div className="mx-1 h-3.5 w-px bg-[var(--ov-border)]" />

            {/* 垂直对齐 */}
            <ActionButton
              icon={<AlignStartVertical size={15} />}
              label="顶对齐 (至少选 2 项)"
              disabled={!canAlign}
              onClick={() => execute('object.align', { ids: selection.nodeIds, align: 'top' })}
            />
            <ActionButton
              icon={<AlignCenterVertical size={15} />}
              label="垂直居中 (至少选 2 项)"
              disabled={!canAlign}
              onClick={() => execute('object.align', { ids: selection.nodeIds, align: 'middle' })}
            />
            <ActionButton
              icon={<AlignEndVertical size={15} />}
              label="底对齐 (至少选 2 项)"
              disabled={!canAlign}
              onClick={() => execute('object.align', { ids: selection.nodeIds, align: 'bottom' })}
            />

            <div className="mx-1 h-3.5 w-px bg-[var(--ov-border)]" />

            {/* 分布 */}
            <ActionButton
              icon={<AlignHorizontalDistributeCenter size={15} />}
              label="水平均匀分布 (至少选 3 项)"
              disabled={!canDistribute}
              onClick={() => execute('object.distribute', { ids: selection.nodeIds, axis: 'horizontal' })}
            />
            <ActionButton
              icon={<AlignVerticalDistributeCenter size={15} />}
              label="垂直均匀分布 (至少选 3 项)"
              disabled={!canDistribute}
              onClick={() => execute('object.distribute', { ids: selection.nodeIds, axis: 'vertical' })}
            />

            {selectedCount > 1 && (
              <span className="ml-2 rounded bg-[var(--ov-hover)] px-1.5 py-0.5 text-[10px] text-[var(--ov-fg-muted)]">
                已选 {selectedCount} 项
              </span>
            )}
          </div>

          {/* 右侧：导出与开发者互操作群组 */}
          <div className="flex items-center space-x-1.5">
            <button
              type="button"
              onClick={handleCopyJsx}
              title="将当前 SVG 转换为 React JSX 组件并复制到剪贴板"
              className="flex items-center space-x-1 rounded border border-[var(--ov-border)] px-2 py-0.5 text-[11px] hover:bg-[var(--ov-hover)] transition-colors"
            >
              {copiedJsx ? (
                <>
                  <Check size={13} className="text-emerald-400" />
                  <span className="text-emerald-400 font-medium">已复制 JSX</span>
                </>
              ) : (
                <>
                  <FileCode size={13} className="text-[var(--ov-fg-muted)]" />
                  <span>复制 JSX</span>
                </>
              )}
            </button>

            <button
              type="button"
              disabled={exportingPng}
              onClick={handleExportPng}
              title="将当前 SVG 渲染为高清 2x PNG 位图并导出下载"
              className="flex items-center space-x-1 rounded border border-[var(--ov-border)] px-2 py-0.5 text-[11px] hover:bg-[var(--ov-hover)] transition-colors disabled:opacity-50"
            >
              <FileImage size={13} className="text-[var(--ov-fg-muted)]" />
              <span>{exportingPng ? '导出中...' : '导出 PNG'}</span>
            </button>
          </div>
        </header>

        {/* 画布视口 */}
        <div className="relative flex-1 overflow-hidden">
          <SvgV2Canvas
            document={document}
            selection={selection}
            runtime={runtime}
            activeToolId={activeToolId}
          />
        </div>
      </main>

      {/* 右侧面板 */}
      <aside className="flex w-72 flex-col border-l border-[var(--ov-border)] bg-[var(--ov-panel)]">
        <SvgV2LayersPanel document={document} selection={selection} execute={execute} />
        <SvgV2Inspector document={document} selection={selection} execute={execute} />
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
    className={`group relative m-1 flex h-8 w-8 items-center justify-center rounded transition-colors ${active ? 'bg-[var(--ov-accent)] text-white' : 'hover:bg-[var(--ov-hover)]'} ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
    title={label}
    aria-label={label}
    onClick={disabled ? undefined : onClick}
  >
    {icon}
    <span
      role="tooltip"
      className="pointer-events-none invisible absolute left-full top-1/2 z-50 ml-2 -translate-y-1/2 whitespace-nowrap rounded border border-[var(--ov-border)] bg-[var(--ov-panel)] px-2 py-1 text-left text-[11px] font-normal text-[var(--ov-fg)] opacity-0 shadow-md transition-opacity group-hover:visible group-hover:opacity-100 group-focus-visible:visible group-focus-visible:opacity-100"
    >
      {label}
    </span>
  </button>
);

interface ActionButtonProps {
  readonly icon: React.ReactNode;
  readonly label: string;
  readonly disabled?: boolean;
  readonly onClick: () => void;
}

const ActionButton: React.FC<ActionButtonProps> = ({ icon, label, disabled, onClick }) => (
  <button
    type="button"
    className={`flex h-6 w-6 items-center justify-center rounded transition-colors ${disabled ? 'opacity-30 cursor-not-allowed' : 'hover:bg-[var(--ov-hover)] text-[var(--ov-fg)]'}`}
    title={label}
    disabled={disabled}
    onClick={disabled ? undefined : onClick}
  >
    {icon}
  </button>
);

export default SvgV2Studio;
