import React, { useState } from 'react';
import {
  MousePointer2,
  Hand,
  Square,
  Diamond,
  Circle,
  MoveUpRight,
  Minus,
  Pencil,
  Type,
  Frame,
  Eraser,
  Undo2,
  Redo2,
  Lock,
  Magnet,
  PanelLeft,
  PanelRight,
  Keyboard,
  AlignStartVertical,
  AlignCenterVertical,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignCenterHorizontal,
  AlignEndHorizontal,
  Trash2,
  CopyPlus,
} from 'lucide-react';
import { ExcalidrawToolId, AlignmentAction } from './excalidrawStudioEngine';

export interface ExcalidrawTopToolDockProps {
  isZh: boolean;
  activeTool: ExcalidrawToolId;
  onSelectTool: (tool: ExcalidrawToolId) => void;
  keepToolActive: boolean;
  onToggleKeepToolActive: () => void;
  smartSnapEnabled: boolean;
  onToggleSmartSnap: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  selectedCount: number;
  onAlign: (action: AlignmentAction) => void;
  onDuplicateSelected: () => void;
  onDeleteSelected: () => void;
  showLeftDock: boolean;
  onToggleLeftDock: () => void;
  showRightInspector: boolean;
  onToggleRightInspector: () => void;
}

const TOOL_ITEMS: Array<{
  id: ExcalidrawToolId;
  keyHint: string;
  numHint: string;
  labelZh: string;
  labelEn: string;
  icon: React.FC<{ className?: string }>;
}> = [
  { id: 'select', keyHint: 'V', numHint: '1', labelZh: '选择 / 移动', labelEn: 'Select / Move', icon: MousePointer2 },
  { id: 'hand', keyHint: 'H', numHint: 'Space', labelZh: '抓手漫游', labelEn: 'Pan Canvas', icon: Hand },
  { id: 'rectangle', keyHint: 'R', numHint: '2', labelZh: '手绘矩形', labelEn: 'Rectangle', icon: Square },
  { id: 'diamond', keyHint: 'D', numHint: '3', labelZh: '手绘菱形', labelEn: 'Diamond', icon: Diamond },
  { id: 'ellipse', keyHint: 'O', numHint: '4', labelZh: '手绘椭圆', labelEn: 'Ellipse', icon: Circle },
  { id: 'arrow', keyHint: 'A', numHint: '5', labelZh: '磁吸连线箭头', labelEn: 'Bound Arrow', icon: MoveUpRight },
  { id: 'line', keyHint: 'L', numHint: '6', labelZh: '手绘直线', labelEn: 'Line', icon: Minus },
  { id: 'freedraw', keyHint: 'P', numHint: '7', labelZh: '自由画笔', labelEn: 'Freedraw Pen', icon: Pencil },
  { id: 'text', keyHint: 'T', numHint: '8', labelZh: '文本标注', labelEn: 'Text Label', icon: Type },
  { id: 'frame', keyHint: 'F', numHint: '9', labelZh: '演示画框 Frame', labelEn: 'Presentation Frame', icon: Frame },
  { id: 'eraser', keyHint: 'E', numHint: '0', labelZh: '橡皮擦除', labelEn: 'Eraser', icon: Eraser },
];

export const ExcalidrawTopToolDock: React.FC<ExcalidrawTopToolDockProps> = ({
  isZh,
  activeTool,
  onSelectTool,
  keepToolActive,
  onToggleKeepToolActive,
  smartSnapEnabled,
  onToggleSmartSnap,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  selectedCount,
  onAlign,
  onDuplicateSelected,
  onDeleteSelected,
  showLeftDock,
  onToggleLeftDock,
  showRightInspector,
  onToggleRightInspector,
}) => {
  const [showShortcutsPopover, setShowShortcutsPopover] = useState(false);

  return (
    <div
      style={{
        backgroundColor: 'var(--ov-surface)',
        borderBottomColor: 'var(--ov-border)',
        color: 'var(--ov-text)',
      }}
      className="flex-shrink-0 h-10 px-2.5 border-b flex items-center justify-between gap-2 select-none z-20 relative"
    >
      {/* 左侧：侧边栏开关 + 撤销重做 + 连续绘制锁 */}
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          onClick={onToggleLeftDock}
          style={{
            backgroundColor: showLeftDock ? 'color-mix(in srgb, var(--ov-accent) 18%, transparent)' : 'var(--ov-surface-header)',
            borderColor: showLeftDock ? 'var(--ov-accent)' : 'var(--ov-border)',
            color: showLeftDock ? 'var(--ov-accent)' : 'var(--ov-text-secondary)',
          }}
          className="flex items-center gap-1 px-2 py-1 rounded border text-xs transition whitespace-nowrap shrink-0"
          title={isZh ? '显示/隐藏左侧图层与架构物料坞' : 'Toggle Left Layers & Stencils Dock'}
        >
          <PanelLeft className="w-3.5 h-3.5" />
          <span className="hidden xl:inline">{isZh ? '图层/物料' : 'Layers'}</span>
        </button>

        <div style={{ backgroundColor: 'var(--ov-border)' }} className="h-4 w-px mx-0.5" />

        <div className="flex items-center gap-0.5">
          <button
            type="button"
            disabled={!canUndo}
            onClick={onUndo}
            style={{
              backgroundColor: 'var(--ov-surface-header)',
              borderColor: 'var(--ov-border)',
              color: canUndo ? 'var(--ov-text)' : 'var(--ov-text-muted)',
            }}
            className="p-1.5 rounded border transition disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
            title={isZh ? '撤销上一步 (Ctrl+Z)' : 'Undo (Ctrl+Z)'}
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            disabled={!canRedo}
            onClick={onRedo}
            style={{
              backgroundColor: 'var(--ov-surface-header)',
              borderColor: 'var(--ov-border)',
              color: canRedo ? 'var(--ov-text)' : 'var(--ov-text-muted)',
            }}
            className="p-1.5 rounded border transition disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
            title={isZh ? '重做下一步 (Ctrl+Y / Ctrl+Shift+Z)' : 'Redo (Ctrl+Y)'}
          >
            <Redo2 className="w-3.5 h-3.5" />
          </button>
        </div>

        <button
          type="button"
          onClick={onToggleKeepToolActive}
          style={{
            backgroundColor: keepToolActive ? 'color-mix(in srgb, var(--ov-accent) 18%, transparent)' : 'var(--ov-surface-header)',
            borderColor: keepToolActive ? 'var(--ov-accent)' : 'var(--ov-border)',
            color: keepToolActive ? 'var(--ov-accent)' : 'var(--ov-text-secondary)',
          }}
          className="flex items-center gap-1 px-2 py-1 rounded border text-[11px] transition whitespace-nowrap shrink-0"
          title={isZh ? '锁定当前绘图工具连续绘制 (快捷键 Q)' : 'Keep selected drawing tool active after drawing (Q)'}
        >
          <Lock className="w-3 h-3" />
          <span className="hidden lg:inline">{isZh ? '连续绘制' : 'Keep Tool'}</span>
        </button>
      </div>

      {/* 中央：PC 端单键工具坞 (11 种核心白板工具) */}
      <div
        style={{
          backgroundColor: 'var(--ov-surface-header)',
          borderColor: 'var(--ov-border)',
        }}
        className="flex items-center gap-0.5 p-0.5 rounded-lg border overflow-x-auto max-w-full"
      >
        {TOOL_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeTool === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTool(item.id)}
              style={{
                backgroundColor: isActive ? 'var(--ov-accent)' : 'transparent',
                color: isActive ? 'var(--ov-text-on-accent, #ffffff)' : 'var(--ov-text-secondary)',
              }}
              className="relative flex items-center gap-1 px-2 py-1 rounded-md text-xs transition hover:text-[var(--ov-text)] whitespace-nowrap shrink-0 cursor-pointer group"
              title={`${isZh ? item.labelZh : item.labelEn} (${item.keyHint} / ${item.numHint})`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span className="hidden 2xl:inline text-[11px] font-medium">
                {isZh ? item.labelZh.split(' ')[0] : item.labelEn.split(' ')[0]}
              </span>
              <span
                style={{
                  opacity: isActive ? 0.92 : 0.6,
                }}
                className="text-[9px] font-mono tabular-nums leading-none"
              >
                {item.keyHint}
              </span>
            </button>
          );
        })}
      </div>

      {/* 右侧：智能对齐快捷条 + 磁吸开关 + 快捷键指南 + 右侧属性栏开关 */}
      <div className="flex items-center gap-1.5 shrink-0">
        {selectedCount >= 2 && (
          <div
            style={{
              backgroundColor: 'var(--ov-surface-header)',
              borderColor: 'var(--ov-border)',
            }}
            className="hidden md:flex items-center gap-0.5 px-1 py-0.5 rounded border"
          >
            <button
              type="button"
              onClick={() => onAlign('align-left')}
              className="p-1 rounded hover:bg-[var(--ov-surface)] transition"
              title={isZh ? '左对齐选中图元' : 'Align Left'}
            >
              <AlignStartVertical className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onAlign('align-center')}
              className="p-1 rounded hover:bg-[var(--ov-surface)] transition"
              title={isZh ? '水平居中对齐' : 'Align Horizontal Center'}
            >
              <AlignCenterVertical className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onAlign('align-right')}
              className="p-1 rounded hover:bg-[var(--ov-surface)] transition"
              title={isZh ? '右对齐选中图元' : 'Align Right'}
            >
              <AlignEndVertical className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onAlign('align-top')}
              className="p-1 rounded hover:bg-[var(--ov-surface)] transition"
              title={isZh ? '顶对齐选中图元' : 'Align Top'}
            >
              <AlignStartHorizontal className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onAlign('align-middle')}
              className="p-1 rounded hover:bg-[var(--ov-surface)] transition"
              title={isZh ? '垂直居中对齐' : 'Align Vertical Middle'}
            >
              <AlignCenterHorizontal className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onAlign('align-bottom')}
              className="p-1 rounded hover:bg-[var(--ov-surface)] transition"
              title={isZh ? '底对齐选中图元' : 'Align Bottom'}
            >
              <AlignEndHorizontal className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {selectedCount >= 1 && (
          <div className="hidden sm:flex items-center gap-1">
            <button
              type="button"
              onClick={onDuplicateSelected}
              style={{
                backgroundColor: 'var(--ov-surface-header)',
                borderColor: 'var(--ov-border)',
                color: 'var(--ov-text-secondary)',
              }}
              className="p-1.5 rounded border hover:text-[var(--ov-text)] transition"
              title={isZh ? '克隆选中图元 (Ctrl+D)' : 'Duplicate Selected (Ctrl+D)'}
            >
              <CopyPlus className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={onDeleteSelected}
              style={{
                backgroundColor: 'var(--ov-surface-header)',
                borderColor: 'var(--ov-border)',
                color: 'var(--ov-text-secondary)',
              }}
              className="p-1.5 rounded border hover:text-red-400 transition"
              title={isZh ? '删除选中图元 (Delete / Backspace)' : 'Delete Selected (Del)'}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={onToggleSmartSnap}
          style={{
            backgroundColor: smartSnapEnabled ? 'color-mix(in srgb, var(--ov-accent) 18%, transparent)' : 'var(--ov-surface-header)',
            borderColor: smartSnapEnabled ? 'var(--ov-accent)' : 'var(--ov-border)',
            color: smartSnapEnabled ? 'var(--ov-accent)' : 'var(--ov-text-secondary)',
          }}
          className="flex items-center gap-1 px-2 py-1 rounded border text-[11px] transition whitespace-nowrap shrink-0"
          title={isZh ? '开启/关闭智能对齐参考线与磁吸锚点' : 'Toggle Smart Alignment Guides & Port Snapping'}
        >
          <Magnet className="w-3.5 h-3.5" />
          <span className="hidden lg:inline">{isZh ? '智能磁吸' : 'Snap'}</span>
        </button>

        {/* PC 键鼠快捷键速查气泡 */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowShortcutsPopover((v) => !v)}
            style={{
              backgroundColor: showShortcutsPopover ? 'var(--ov-accent)' : 'var(--ov-surface-header)',
              borderColor: 'var(--ov-border)',
              color: showShortcutsPopover ? 'var(--ov-text-on-accent, #ffffff)' : 'var(--ov-text-secondary)',
            }}
            className="p-1.5 rounded border transition hover:text-[var(--ov-text)]"
            title={isZh ? 'PC 端快捷键速查表 (?)' : 'PC Keyboard Shortcuts (?)'}
          >
            <Keyboard className="w-3.5 h-3.5" />
          </button>

          {showShortcutsPopover && (
            <div
              style={{
                backgroundColor: 'var(--ov-surface-header)',
                borderColor: 'var(--ov-border)',
                color: 'var(--ov-text)',
              }}
              className="absolute right-0 top-9 w-80 p-3 rounded-lg border shadow-2xl z-50 text-xs"
            >
              <div className="flex items-center justify-between pb-2 mb-2 border-b" style={{ borderColor: 'var(--ov-border)' }}>
                <span className="font-semibold">{isZh ? 'PC 画板效率快捷键' : 'PC Studio Shortcuts'}</span>
                <button
                  type="button"
                  onClick={() => setShowShortcutsPopover(false)}
                  style={{ color: 'var(--ov-text-secondary)' }}
                  className="text-[11px] hover:underline"
                >
                  {isZh ? '关闭' : 'Close'}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-y-1.5 gap-x-3 text-[11px]" style={{ color: 'var(--ov-text-secondary)' }}>
                <div className="flex justify-between"><span>{isZh ? '选择 / 移动' : 'Select'}</span><kbd className="font-mono text-[var(--ov-accent)]">V / 1</kbd></div>
                <div className="flex justify-between"><span>{isZh ? '临时抓手' : 'Pan Hold'}</span><kbd className="font-mono text-[var(--ov-accent)]">Space+拖拽</kbd></div>
                <div className="flex justify-between"><span>{isZh ? '矩形 / 菱形' : 'Rect / Diamond'}</span><kbd className="font-mono text-[var(--ov-accent)]">R / D</kbd></div>
                <div className="flex justify-between"><span>{isZh ? '椭圆 / 箭头' : 'Ellipse / Arrow'}</span><kbd className="font-mono text-[var(--ov-accent)]">O / A</kbd></div>
                <div className="flex justify-between"><span>{isZh ? '线条 / 画笔' : 'Line / Pen'}</span><kbd className="font-mono text-[var(--ov-accent)]">L / P</kbd></div>
                <div className="flex justify-between"><span>{isZh ? '文字 / 画框' : 'Text / Frame'}</span><kbd className="font-mono text-[var(--ov-accent)]">T / F</kbd></div>
                <div className="flex justify-between"><span>{isZh ? '原地内联改字' : 'Inline Text'}</span><kbd className="font-mono text-[var(--ov-accent)]">双击图元</kbd></div>
                <div className="flex justify-between"><span>{isZh ? '克隆图元' : 'Duplicate'}</span><kbd className="font-mono text-[var(--ov-accent)]">Ctrl+D</kbd></div>
                <div className="flex justify-between"><span>{isZh ? '编组 / 解组' : 'Group / Ungroup'}</span><kbd className="font-mono text-[var(--ov-accent)]">Ctrl+G</kbd></div>
                <div className="flex justify-between"><span>{isZh ? '撤销 / 重做' : 'Undo / Redo'}</span><kbd className="font-mono text-[var(--ov-accent)]">Ctrl+Z / Y</kbd></div>
                <div className="flex justify-between"><span>{isZh ? '焦点缩放' : 'Focal Zoom'}</span><kbd className="font-mono text-[var(--ov-accent)]">Ctrl+滚轮</kbd></div>
                <div className="flex justify-between"><span>{isZh ? '微调位置' : 'Nudge 1px/10px'}</span><kbd className="font-mono text-[var(--ov-accent)]">方向键/Shift</kbd></div>
              </div>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onToggleRightInspector}
          style={{
            backgroundColor: showRightInspector ? 'color-mix(in srgb, var(--ov-accent) 18%, transparent)' : 'var(--ov-surface-header)',
            borderColor: showRightInspector ? 'var(--ov-accent)' : 'var(--ov-border)',
            color: showRightInspector ? 'var(--ov-accent)' : 'var(--ov-text-secondary)',
          }}
          className="flex items-center gap-1 px-2 py-1 rounded border text-xs transition whitespace-nowrap shrink-0"
          title={isZh ? '显示/隐藏右侧属性与排版检查器' : 'Toggle Right Property Inspector'}
        >
          <PanelRight className="w-3.5 h-3.5" />
          <span className="hidden xl:inline">{isZh ? '属性检查器' : 'Inspector'}</span>
        </button>
      </div>
    </div>
  );
};
