import React, { useState } from 'react';
import {
  Layers,
  Frame,
  Package,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  ArrowUp,
  ArrowDown,
  Trash2,
  Plus,
  Sparkles,
  Square,
  Diamond,
  Circle,
  MoveUpRight,
  Minus,
  Pencil,
  Type,
  Search,
  BookmarkPlus,
  Focus,
} from 'lucide-react';
import { EXCALIDRAW_STENCILS, ExcalidrawStencil } from './excalidrawTemplates';

export type LeftDockTabId = 'layers' | 'frames' | 'stencils';

export interface ExcalidrawLeftDockProps {
  isZh: boolean;
  elements: any[];
  selectedIds: Set<string>;
  onSelectElement: (id: string, multi: boolean) => void;
  onFocusElement: (el: any) => void;
  onToggleElementHidden: (id: string) => void;
  onToggleElementLocked: (id: string) => void;
  onMoveElementLayer: (id: string, dir: 'up' | 'down') => void;
  onDeleteElement: (id: string) => void;
  onRenameFrame: (id: string, newName: string) => void;
  onAutoCreateFrame: () => void;
  onInsertStencil: (stencil: ExcalidrawStencil) => void;
  customStencils: ExcalidrawStencil[];
  onSaveSelectedAsStencil: () => void;
  onOpenFullMaterialsModal?: () => void;
}

function getElementIcon(type: string) {
  switch (type) {
    case 'rectangle':
      return Square;
    case 'diamond':
      return Diamond;
    case 'ellipse':
      return Circle;
    case 'arrow':
      return MoveUpRight;
    case 'line':
      return Minus;
    case 'freedraw':
      return Pencil;
    case 'text':
      return Type;
    case 'frame':
      return Frame;
    default:
      return Square;
  }
}

export const ExcalidrawLeftDock: React.FC<ExcalidrawLeftDockProps> = ({
  isZh,
  elements,
  selectedIds,
  onSelectElement,
  onFocusElement,
  onToggleElementHidden,
  onToggleElementLocked,
  onMoveElementLayer,
  onDeleteElement,
  onRenameFrame,
  onAutoCreateFrame,
  onInsertStencil,
  customStencils,
  onSaveSelectedAsStencil,
  onOpenFullMaterialsModal,
}) => {
  const [activeTab, setActiveTab] = useState<LeftDockTabId>('layers');
  const [stencilQuery, setStencilQuery] = useState('');

  // 获取所有顶层可见图元（过滤已删除以及绑定在容器内的附属文字）
  const layerElements = elements
    .filter((el) => el && !el.isDeleted && !(el.type === 'text' && el.containerId))
    .slice()
    .reverse();

  // 建立容器 ID -> 内部绑定文字的映射，以便在图层树中展示有意义的节点名称
  const containerTextMap = new Map<string, string>();
  elements.forEach((el) => {
    if (el && !el.isDeleted && el.type === 'text' && el.containerId && el.text) {
      containerTextMap.set(el.containerId, String(el.text).replace(/\n/g, ' '));
    }
  });

  const frameElements = elements.filter((el) => el && !el.isDeleted && el.type === 'frame');

  const allStencils = [...customStencils, ...EXCALIDRAW_STENCILS].filter((s) => {
    if (!stencilQuery.trim()) return true;
    const q = stencilQuery.toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      s.nameEn.toLowerCase().includes(q) ||
      s.category.toLowerCase().includes(q)
    );
  });

  return (
    <div
      style={{
        backgroundColor: 'var(--ov-surface)',
        borderRightColor: 'var(--ov-border)',
        color: 'var(--ov-text)',
      }}
      className="w-60 flex-shrink-0 border-r flex flex-col h-full select-none z-10"
    >
      {/* 顶部三页签切换 (图层 / 画框 / 快捷物料) */}
      <div
        style={{
          backgroundColor: 'var(--ov-surface-header)',
          borderBottomColor: 'var(--ov-border)',
        }}
        className="flex items-center p-1 border-b gap-1"
      >
        <button
          type="button"
          onClick={() => setActiveTab('layers')}
          style={{
            backgroundColor: activeTab === 'layers' ? 'var(--ov-surface)' : 'transparent',
            color: activeTab === 'layers' ? 'var(--ov-text)' : 'var(--ov-text-secondary)',
            borderColor: activeTab === 'layers' ? 'var(--ov-border)' : 'transparent',
          }}
          className="flex-1 flex items-center justify-center gap-1 py-1 px-1.5 rounded border text-xs font-medium transition whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Layers className="w-3.5 h-3.5" />
          <span>{isZh ? '图层' : 'Layers'}</span>
          <span className="text-[10px] font-mono tabular-nums opacity-70">{layerElements.length}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('frames')}
          style={{
            backgroundColor: activeTab === 'frames' ? 'var(--ov-surface)' : 'transparent',
            color: activeTab === 'frames' ? 'var(--ov-text)' : 'var(--ov-text-secondary)',
            borderColor: activeTab === 'frames' ? 'var(--ov-border)' : 'transparent',
          }}
          className="flex-1 flex items-center justify-center gap-1 py-1 px-1.5 rounded border text-xs font-medium transition whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Frame className="w-3.5 h-3.5" />
          <span>{isZh ? '画框' : 'Frames'}</span>
          <span className="text-[10px] font-mono tabular-nums opacity-70">{frameElements.length}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('stencils')}
          style={{
            backgroundColor: activeTab === 'stencils' ? 'var(--ov-surface)' : 'transparent',
            color: activeTab === 'stencils' ? 'var(--ov-text)' : 'var(--ov-text-secondary)',
            borderColor: activeTab === 'stencils' ? 'var(--ov-border)' : 'transparent',
          }}
          className="flex-1 flex items-center justify-center gap-1 py-1 px-1.5 rounded border text-xs font-medium transition whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Package className="w-3.5 h-3.5" />
          <span>{isZh ? '物料' : 'Stencils'}</span>
        </button>
      </div>

      {/* 页签 1: 图层树管理 */}
      {activeTab === 'layers' && (
        <div className="flex-1 min-h-0 flex flex-col">
          <div
            style={{
              borderBottomColor: 'var(--ov-border)',
              color: 'var(--ov-text-secondary)',
            }}
            className="px-3 py-1.5 border-b text-[11px] flex items-center justify-between"
          >
            <span>{isZh ? '单击选中 · 双击居中聚焦' : 'Click to select · DblClick to focus'}</span>
            <span className="font-mono tabular-nums">{selectedIds.size} 选中</span>
          </div>

          <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
            {layerElements.length === 0 ? (
              <div className="py-10 px-3 text-center text-xs" style={{ color: 'var(--ov-text-muted)' }}>
                {isZh ? '画布暂无图元，使用顶部工具坞或快捷键 (R/O/D/A/T) 开始绘制' : 'No elements yet. Pick a tool above to draw.'}
              </div>
            ) : (
              layerElements.map((el) => {
                const Icon = getElementIcon(el.type);
                const isSelected = selectedIds.has(el.id);
                const boundLabel = containerTextMap.get(el.id);
                const displayLabel =
                  el.name ||
                  boundLabel ||
                  (el.type === 'text' ? String(el.text || '').replace(/\n/g, ' ') : '') ||
                  `${el.type} #${String(el.id).slice(-4)}`;

                return (
                  <div
                    key={el.id}
                    onClick={(e) => onSelectElement(el.id, e.shiftKey || e.metaKey || e.ctrlKey)}
                    onDoubleClick={() => onFocusElement(el)}
                    style={{
                      backgroundColor: isSelected
                        ? 'color-mix(in srgb, var(--ov-accent) 16%, transparent)'
                        : 'transparent',
                      borderColor: isSelected ? 'var(--ov-accent)' : 'transparent',
                      color: el.isHidden ? 'var(--ov-text-muted)' : 'var(--ov-text)',
                    }}
                    className="group flex items-center justify-between gap-1.5 px-2 py-1.5 rounded border text-xs cursor-pointer transition hover:bg-[var(--ov-surface-header)]"
                  >
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      <span
                        className="w-2.5 h-2.5 rounded-sm shrink-0 border"
                        style={{
                          backgroundColor:
                            el.backgroundColor && el.backgroundColor !== 'transparent'
                              ? el.backgroundColor
                              : 'transparent',
                          borderColor: el.strokeColor || 'var(--ov-text-secondary)',
                        }}
                      />
                      <Icon className="w-3.5 h-3.5 shrink-0 opacity-75" />
                      <span className={`truncate text-[11px] ${el.isHidden ? 'line-through opacity-50' : ''}`}>
                        {displayLabel}
                      </span>
                    </div>

                    <div
                      className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() => onMoveElementLayer(el.id, 'up')}
                        className="p-0.5 rounded hover:bg-[var(--ov-surface)]"
                        title={isZh ? '上移一层' : 'Bring Forward'}
                      >
                        <ArrowUp className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onMoveElementLayer(el.id, 'down')}
                        className="p-0.5 rounded hover:bg-[var(--ov-surface)]"
                        title={isZh ? '下移一层' : 'Send Backward'}
                      >
                        <ArrowDown className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onToggleElementHidden(el.id)}
                        className="p-0.5 rounded hover:bg-[var(--ov-surface)]"
                        title={el.isHidden ? (isZh ? '显示图元' : 'Show') : (isZh ? '隐藏图元' : 'Hide')}
                      >
                        {el.isHidden ? <EyeOff className="w-3 h-3 text-amber-400" /> : <Eye className="w-3 h-3" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => onToggleElementLocked(el.id)}
                        className="p-0.5 rounded hover:bg-[var(--ov-surface)]"
                        title={el.locked ? (isZh ? '解锁图元' : 'Unlock') : (isZh ? '锁定图元' : 'Lock')}
                      >
                        {el.locked ? <Lock className="w-3 h-3 text-amber-400" /> : <Unlock className="w-3 h-3" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteElement(el.id)}
                        className="p-0.5 rounded hover:text-red-400"
                        title={isZh ? '删除' : 'Delete'}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* 页签 2: Frame 演播画框大纲 */}
      {activeTab === 'frames' && (
        <div className="flex-1 min-h-0 flex flex-col">
          <div className="p-2 border-b flex items-center justify-between gap-1.5" style={{ borderColor: 'var(--ov-border)' }}>
            <button
              type="button"
              onClick={onAutoCreateFrame}
              style={{
                backgroundColor: 'var(--ov-surface-header)',
                borderColor: 'var(--ov-border)',
                color: 'var(--ov-text)',
              }}
              className="w-full flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded border text-xs font-medium hover:border-[var(--ov-accent)] transition cursor-pointer whitespace-nowrap shrink-0"
            >
              <Sparkles className="w-3.5 h-3.5" style={{ color: 'var(--ov-accent)' }} />
              <span>{isZh ? '一键智能生成总览画框' : 'Auto Wrap Frame'}</span>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
            {frameElements.length === 0 ? (
              <div className="py-8 px-3 text-center text-xs leading-relaxed" style={{ color: 'var(--ov-text-muted)' }}>
                {isZh
                  ? '暂无演示画框 (Frame)。可按快捷键 F 在画布框选区域创建，或点击上方按钮自动生成。'
                  : 'No Frames yet. Press F to draw a Frame or click Auto Wrap above.'}
              </div>
            ) : (
              frameElements.map((frame, index) => (
                <div
                  key={frame.id}
                  style={{
                    backgroundColor: 'var(--ov-surface-header)',
                    borderColor: selectedIds.has(frame.id) ? 'var(--ov-accent)' : 'var(--ov-border)',
                  }}
                  className="p-2 rounded-lg border flex flex-col gap-1.5"
                >
                  <div className="flex items-center justify-between gap-1.5">
                    <span
                      style={{ color: 'var(--ov-accent)' }}
                      className="text-[10px] font-mono tabular-nums font-semibold"
                    >
                      #{index + 1}
                    </span>
                    <input
                      type="text"
                      value={frame.name || `Frame ${index + 1}`}
                      onChange={(e) => onRenameFrame(frame.id, e.target.value)}
                      style={{
                        backgroundColor: 'var(--ov-bg)',
                        borderColor: 'var(--ov-border)',
                        color: 'var(--ov-text)',
                      }}
                      className="flex-1 min-w-0 px-1.5 py-0.5 text-xs rounded border outline-none focus:border-[var(--ov-accent)]"
                    />
                    <button
                      type="button"
                      onClick={() => onFocusElement(frame)}
                      style={{
                        backgroundColor: 'var(--ov-surface)',
                        borderColor: 'var(--ov-border)',
                      }}
                      className="p-1 rounded border hover:border-[var(--ov-accent)] transition"
                      title={isZh ? '运镜聚焦到此画框' : 'Focus Frame'}
                    >
                      <Focus className="w-3 h-3" />
                    </button>
                  </div>
                  <div
                    className="flex items-center justify-between text-[10px] font-mono tabular-nums"
                    style={{ color: 'var(--ov-text-secondary)' }}
                  >
                    <span>
                      {Math.round(frame.width || 0)} × {Math.round(frame.height || 0)}
                    </span>
                    <span>
                      ({Math.round(frame.x || 0)}, {Math.round(frame.y || 0)})
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* 页签 3: 快捷架构物料架 */}
      {activeTab === 'stencils' && (
        <div className="flex-1 min-h-0 flex flex-col">
          <div className="p-2 border-b space-y-1.5" style={{ borderColor: 'var(--ov-border)' }}>
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 opacity-50" />
              <input
                type="text"
                value={stencilQuery}
                onChange={(e) => setStencilQuery(e.target.value)}
                placeholder={isZh ? '搜索 K8s / 网关 / 数据库...' : 'Search stencils...'}
                style={{
                  backgroundColor: 'var(--ov-bg)',
                  borderColor: 'var(--ov-border)',
                  color: 'var(--ov-text)',
                }}
                className="w-full pl-7 pr-2 py-1 text-xs rounded border outline-none focus:border-[var(--ov-accent)]"
              />
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={onSaveSelectedAsStencil}
                style={{
                  backgroundColor: 'var(--ov-surface-header)',
                  borderColor: 'var(--ov-border)',
                  color: 'var(--ov-text)',
                }}
                className="flex-1 flex items-center justify-center gap-1 py-1 px-2 rounded border text-[11px] hover:border-[var(--ov-accent)] transition cursor-pointer whitespace-nowrap shrink-0"
                title={isZh ? '将画布当前选中的组合图元收藏为自定义物料' : 'Save selected elements as stencil'}
              >
                <BookmarkPlus className="w-3 h-3" style={{ color: 'var(--ov-accent)' }} />
                <span>{isZh ? '收藏选中图元' : 'Save Selected'}</span>
              </button>
              {onOpenFullMaterialsModal && (
                <button
                  type="button"
                  onClick={onOpenFullMaterialsModal}
                  style={{
                    backgroundColor: 'var(--ov-surface-header)',
                    borderColor: 'var(--ov-border)',
                    color: 'var(--ov-text-secondary)',
                  }}
                  className="py-1 px-2 rounded border text-[11px] hover:text-[var(--ov-text)] transition cursor-pointer whitespace-nowrap shrink-0"
                  title={isZh ? '打开完整素材库与外部导入抽屉' : 'Open Full Library Hub'}
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
            {allStencils.map((stencil) => (
              <button
                key={stencil.id}
                type="button"
                onClick={() => onInsertStencil(stencil)}
                style={{
                  backgroundColor: 'var(--ov-surface-header)',
                  borderColor: 'var(--ov-border)',
                  color: 'var(--ov-text)',
                }}
                className="w-full p-2 rounded-lg border text-left hover:border-[var(--ov-accent)] transition flex flex-col gap-1 cursor-pointer group"
              >
                <div className="flex items-center justify-between gap-1.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: stencil.color || 'var(--ov-accent)' }}
                    />
                    <span className="text-xs font-medium truncate">
                      {isZh ? stencil.name : stencil.nameEn}
                    </span>
                  </div>
                  <span
                    style={{ color: 'var(--ov-text-muted)' }}
                    className="text-[10px] font-mono tabular-nums shrink-0"
                  >
                    {stencil.elements.length} {isZh ? '图元' : 'els'}
                  </span>
                </div>
                <div className="text-[10px] truncate" style={{ color: 'var(--ov-text-secondary)' }}>
                  {stencil.description}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
