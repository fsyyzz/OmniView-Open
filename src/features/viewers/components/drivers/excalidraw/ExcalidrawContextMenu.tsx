import React from 'react';
import {
  Copy,
  ClipboardPaste,
  CopyPlus,
  ArrowUpToLine,
  ArrowUp,
  ArrowDown,
  ArrowDownToLine,
  Group,
  Ungroup,
  BookmarkPlus,
  Trash2,
  Focus,
  CheckSquare,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Map as MapIcon,
} from 'lucide-react';
import { getElementBounds, LayerOrderAction } from './excalidrawStudioEngine';

export interface ExcalidrawContextMenuProps {
  isZh: boolean;
  x: number;
  y: number;
  selectedCount: number;
  hasClipboard: boolean;
  hasGroup: boolean;
  onCopy: () => void;
  onPaste: () => void;
  onDuplicate: () => void;
  onLayerOrder: (action: LayerOrderAction) => void;
  onGroup: () => void;
  onUngroup: () => void;
  onSaveAsStencil: () => void;
  onDelete: () => void;
  onSelectAll: () => void;
  onFitView: () => void;
  onClose: () => void;
}

export const ExcalidrawContextMenu: React.FC<ExcalidrawContextMenuProps> = ({
  isZh,
  x,
  y,
  selectedCount,
  hasClipboard,
  hasGroup,
  onCopy,
  onPaste,
  onDuplicate,
  onLayerOrder,
  onGroup,
  onUngroup,
  onSaveAsStencil,
  onDelete,
  onSelectAll,
  onFitView,
  onClose,
}) => {
  const run = (fn: () => void) => {
    fn();
    onClose();
  };

  return (
    <div
      style={{
        left: x,
        top: y,
        backgroundColor: 'var(--ov-surface-header)',
        borderColor: 'var(--ov-border)',
        color: 'var(--ov-text)',
      }}
      onContextMenu={(e) => e.preventDefault()}
      className="fixed z-50 w-56 py-1 rounded-lg border shadow-2xl text-xs select-none"
    >
      {selectedCount > 0 ? (
        <>
          <button
            type="button"
            onClick={() => run(onCopy)}
            className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[var(--ov-surface)] transition cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <Copy className="w-3.5 h-3.5" />
              <span>{isZh ? '复制' : 'Copy'}</span>
            </span>
            <kbd className="text-[10px] font-mono opacity-60">Ctrl+C</kbd>
          </button>
          <button
            type="button"
            onClick={() => run(onDuplicate)}
            className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[var(--ov-surface)] transition cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <CopyPlus className="w-3.5 h-3.5" />
              <span>{isZh ? '克隆副本' : 'Duplicate'}</span>
            </span>
            <kbd className="text-[10px] font-mono opacity-60">Ctrl+D</kbd>
          </button>

          <div className="my-1 border-t" style={{ borderColor: 'var(--ov-border)' }} />

          <button
            type="button"
            onClick={() => run(() => onLayerOrder('front'))}
            className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[var(--ov-surface)] transition cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <ArrowUpToLine className="w-3.5 h-3.5" />
              <span>{isZh ? '置于顶层' : 'Bring to Front'}</span>
            </span>
            <kbd className="text-[10px] font-mono opacity-60">Ctrl+Shift+]</kbd>
          </button>
          <button
            type="button"
            onClick={() => run(() => onLayerOrder('forward'))}
            className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[var(--ov-surface)] transition cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <ArrowUp className="w-3.5 h-3.5" />
              <span>{isZh ? '上移一层' : 'Bring Forward'}</span>
            </span>
            <kbd className="text-[10px] font-mono opacity-60">Ctrl+]</kbd>
          </button>
          <button
            type="button"
            onClick={() => run(() => onLayerOrder('backward'))}
            className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[var(--ov-surface)] transition cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <ArrowDown className="w-3.5 h-3.5" />
              <span>{isZh ? '下移一层' : 'Send Backward'}</span>
            </span>
            <kbd className="text-[10px] font-mono opacity-60">Ctrl+[</kbd>
          </button>
          <button
            type="button"
            onClick={() => run(() => onLayerOrder('back'))}
            className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[var(--ov-surface)] transition cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <ArrowDownToLine className="w-3.5 h-3.5" />
              <span>{isZh ? '置于底层' : 'Send to Back'}</span>
            </span>
            <kbd className="text-[10px] font-mono opacity-60">Ctrl+Shift+[</kbd>
          </button>

          {(selectedCount >= 2 || hasGroup) && (
            <>
              <div className="my-1 border-t" style={{ borderColor: 'var(--ov-border)' }} />
              {selectedCount >= 2 && (
                <button
                  type="button"
                  onClick={() => run(onGroup)}
                  className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[var(--ov-surface)] transition cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <Group className="w-3.5 h-3.5" />
                    <span>{isZh ? '编组选中图元' : 'Group Selection'}</span>
                  </span>
                  <kbd className="text-[10px] font-mono opacity-60">Ctrl+G</kbd>
                </button>
              )}
              {hasGroup && (
                <button
                  type="button"
                  onClick={() => run(onUngroup)}
                  className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[var(--ov-surface)] transition cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <Ungroup className="w-3.5 h-3.5" />
                    <span>{isZh ? '解除编组' : 'Ungroup'}</span>
                  </span>
                  <kbd className="text-[10px] font-mono opacity-60">Ctrl+Shift+G</kbd>
                </button>
              )}
            </>
          )}

          <div className="my-1 border-t" style={{ borderColor: 'var(--ov-border)' }} />

          <button
            type="button"
            onClick={() => run(onSaveAsStencil)}
            className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[var(--ov-surface)] transition cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <BookmarkPlus className="w-3.5 h-3.5" style={{ color: 'var(--ov-accent)' }} />
              <span>{isZh ? '收藏至本地物料库' : 'Save to Stencils'}</span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => run(onDelete)}
            className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[var(--ov-surface)] text-red-400 transition cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <Trash2 className="w-3.5 h-3.5" />
              <span>{isZh ? '删除选中图元' : 'Delete'}</span>
            </span>
            <kbd className="text-[10px] font-mono opacity-60">Del</kbd>
          </button>
        </>
      ) : (
        <>
          <button
            type="button"
            disabled={!hasClipboard}
            onClick={() => run(onPaste)}
            className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[var(--ov-surface)] disabled:opacity-40 transition cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <ClipboardPaste className="w-3.5 h-3.5" />
              <span>{isZh ? '粘贴到此处' : 'Paste Here'}</span>
            </span>
            <kbd className="text-[10px] font-mono opacity-60">Ctrl+V</kbd>
          </button>
          <button
            type="button"
            onClick={() => run(onSelectAll)}
            className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[var(--ov-surface)] transition cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <CheckSquare className="w-3.5 h-3.5" />
              <span>{isZh ? '全选所有图元' : 'Select All'}</span>
            </span>
            <kbd className="text-[10px] font-mono opacity-60">Ctrl+A</kbd>
          </button>
          <button
            type="button"
            onClick={() => run(onFitView)}
            className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[var(--ov-surface)] transition cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <Focus className="w-3.5 h-3.5" />
              <span>{isZh ? '居中适应全图' : 'Fit to Screen'}</span>
            </span>
            <kbd className="text-[10px] font-mono opacity-60">Shift+1</kbd>
          </button>
        </>
      )}
    </div>
  );
};

export interface ExcalidrawMinimapProps {
  isZh: boolean;
  elements: any[];
  zoom: number;
  pan: { x: number; y: number };
  viewportWidth: number;
  viewportHeight: number;
  onPanChange: (nextPan: { x: number; y: number }) => void;
  onZoomChange: (nextZoom: number) => void;
  onResetViewport: () => void;
}

export const ExcalidrawMinimap: React.FC<ExcalidrawMinimapProps> = ({
  isZh,
  elements,
  zoom,
  pan,
  viewportWidth,
  viewportHeight,
  onPanChange,
  onZoomChange,
  onResetViewport,
}) => {
  const [collapsed, setCollapsed] = React.useState(false);
  const visibleEls = elements.filter((el) => el && !el.isDeleted && !el.isHidden);

  // 计算小地图世界边界
  let minX = -200;
  let minY = -150;
  let maxX = 1000;
  let maxY = 750;

  visibleEls.forEach((el) => {
    const b = getElementBounds(el);
    minX = Math.min(minX, b.x - 100);
    minY = Math.min(minY, b.y - 100);
    maxX = Math.max(maxX, b.right + 100);
    maxY = Math.max(maxY, b.bottom + 100);
  });

  const worldW = Math.max(800, maxX - minX);
  const worldH = Math.max(500, maxY - minY);
  const mapW = 168;
  const mapH = 108;
  const scale = Math.min(mapW / worldW, mapH / worldH);

  // 当前视口在世界坐标系下的范围
  const viewWorldX = -pan.x / zoom;
  const viewWorldY = -pan.y / zoom;
  const viewWorldW = viewportWidth / zoom;
  const viewWorldH = viewportHeight / zoom;

  const handleMinimapClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    const targetWorldX = minX + clickX / scale;
    const targetWorldY = minY + clickY / scale;
    onPanChange({
      x: -(targetWorldX - viewWorldW / 2) * zoom,
      y: -(targetWorldY - viewWorldH / 2) * zoom,
    });
  };

  return (
    <div className="absolute bottom-3 right-3 z-20 flex flex-col items-end gap-1.5 select-none">
      {!collapsed && (
        <div
          style={{
            backgroundColor: 'var(--ov-surface)',
            borderColor: 'var(--ov-border)',
          }}
          className="rounded-lg border shadow-xl overflow-hidden p-1.5"
        >
          <svg
            width={mapW}
            height={mapH}
            onClick={handleMinimapClick}
            className="cursor-crosshair block rounded"
            style={{ backgroundColor: 'var(--ov-bg)' }}
          >
            {visibleEls.map((el) => {
              const b = getElementBounds(el);
              const rx = (b.x - minX) * scale;
              const ry = (b.y - minY) * scale;
              const rw = Math.max(2, b.width * scale);
              const rh = Math.max(2, b.height * scale);
              return (
                <rect
                  key={el.id}
                  x={rx}
                  y={ry}
                  width={rw}
                  height={rh}
                  rx={1}
                  fill={el.backgroundColor && el.backgroundColor !== 'transparent' ? el.backgroundColor : 'none'}
                  stroke={el.strokeColor || '#3b82f6'}
                  strokeWidth={1}
                  opacity={0.8}
                />
              );
            })}
            {/* 当前视口指示框 */}
            <rect
              x={(viewWorldX - minX) * scale}
              y={(viewWorldY - minY) * scale}
              width={Math.max(12, viewWorldW * scale)}
              height={Math.max(8, viewWorldH * scale)}
              fill="rgba(59, 130, 246, 0.14)"
              stroke="var(--ov-accent)"
              strokeWidth={1.5}
              rx={2}
            />
          </svg>
        </div>
      )}

      {/* 底部缩放与鹰眼开关控制条 */}
      <div
        style={{
          backgroundColor: 'var(--ov-surface)',
          borderColor: 'var(--ov-border)',
          color: 'var(--ov-text)',
        }}
        className="flex items-center gap-1 p-1 rounded-lg border shadow-lg text-xs"
      >
        <button
          type="button"
          onClick={() => onZoomChange(Math.max(0.2, Number((zoom - 0.15).toFixed(2))))}
          className="p-1 rounded hover:bg-[var(--ov-surface-header)] transition cursor-pointer"
          title={isZh ? '缩小 (Ctrl + -)' : 'Zoom Out'}
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={onResetViewport}
          className="px-1.5 font-mono tabular-nums text-[11px] hover:underline cursor-pointer"
          title={isZh ? '点击重置 100% 视口' : 'Reset 100%'}
        >
          {Math.round(zoom * 100)}%
        </button>
        <button
          type="button"
          onClick={() => onZoomChange(Math.min(4, Number((zoom + 0.15).toFixed(2))))}
          className="p-1 rounded hover:bg-[var(--ov-surface-header)] transition cursor-pointer"
          title={isZh ? '放大 (Ctrl + +)' : 'Zoom In'}
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={onResetViewport}
          className="p-1 rounded hover:bg-[var(--ov-surface-header)] transition cursor-pointer"
          title={isZh ? '居中适应全图 (Shift+1)' : 'Fit Content'}
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
        <div style={{ backgroundColor: 'var(--ov-border)' }} className="h-3.5 w-px mx-0.5" />
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          style={{
            color: !collapsed ? 'var(--ov-accent)' : 'var(--ov-text-secondary)',
          }}
          className="p-1 rounded hover:bg-[var(--ov-surface-header)] transition cursor-pointer"
          title={isZh ? '显示/折叠右下角鹰眼小地图' : 'Toggle Eagle-Eye Minimap'}
        >
          <MapIcon className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
