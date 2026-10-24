import React from 'react';
import {
  AlignStartVertical,
  AlignCenterVertical,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignCenterHorizontal,
  AlignEndHorizontal,
  AlignHorizontalDistributeCenter,
  AlignVerticalDistributeCenter,
  ArrowUpToLine,
  ArrowUp,
  ArrowDown,
  ArrowDownToLine,
  Group,
  Ungroup,
  CopyPlus,
  Trash2,
  Lock,
  Unlock,
  AlignLeft,
  AlignCenter,
  AlignRight,
  BookmarkPlus,
} from 'lucide-react';
import {
  ExcalidrawDefaultStyle,
  PC_STROKE_PALETTE,
  PC_FILL_PALETTE,
  AlignmentAction,
  LayerOrderAction,
  getElementBounds,
} from './excalidrawStudioEngine';

export interface ExcalidrawRightInspectorProps {
  isZh: boolean;
  selectedElements: any[];
  defaultStyle: ExcalidrawDefaultStyle;
  onUpdateDefaultStyle: (patch: Partial<ExcalidrawDefaultStyle>) => void;
  onUpdateSelectedProps: (patch: Record<string, any>) => void;
  onUpdateSelectedGeometry: (geom: Partial<{ x: number; y: number; width: number; height: number; angleDeg: number }>) => void;
  onAlign: (action: AlignmentAction) => void;
  onLayerOrder: (action: LayerOrderAction) => void;
  onGroup: () => void;
  onUngroup: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onSaveAsStencil: () => void;
  canvasBgColor: string;
  onCanvasBgColorChange: (color: string) => void;
}

export const ExcalidrawRightInspector: React.FC<ExcalidrawRightInspectorProps> = ({
  isZh,
  selectedElements,
  defaultStyle,
  onUpdateDefaultStyle,
  onUpdateSelectedProps,
  onUpdateSelectedGeometry,
  onAlign,
  onLayerOrder,
  onGroup,
  onUngroup,
  onDuplicate,
  onDelete,
  onSaveAsStencil,
  canvasBgColor,
  onCanvasBgColorChange,
}) => {
  const hasSelection = selectedElements.length > 0;
  const primary = selectedElements[0] || null;
  const primaryBounds = primary ? getElementBounds(primary) : null;

  const currentStroke = hasSelection ? (primary.strokeColor || defaultStyle.strokeColor) : defaultStyle.strokeColor;
  const currentFill = hasSelection ? (primary.backgroundColor || 'transparent') : defaultStyle.backgroundColor;
  const currentFillStyle = hasSelection ? (primary.fillStyle || 'hachure') : defaultStyle.fillStyle;
  const currentStrokeWidth = hasSelection ? (primary.strokeWidth ?? 2) : defaultStyle.strokeWidth;
  const currentStrokeStyle = hasSelection ? (primary.strokeStyle || 'solid') : defaultStyle.strokeStyle;
  const currentRoughness = hasSelection ? (primary.roughness ?? 1) : defaultStyle.roughness;
  const currentRoundness = hasSelection ? Boolean(primary.roundness) : defaultStyle.roundness;
  const currentOpacity = hasSelection ? (primary.opacity ?? 100) : defaultStyle.opacity;
  const currentFontSize = hasSelection ? (primary.fontSize || 16) : defaultStyle.fontSize;
  const currentTextAlign = hasSelection ? (primary.textAlign || 'center') : defaultStyle.textAlign;
  const isLocked = hasSelection && selectedElements.every((el) => Boolean(el.locked));
  const hasGroup = hasSelection && selectedElements.some((el) => Array.isArray(el.groupIds) && el.groupIds.length > 0);

  const applyStylePatch = (patch: Record<string, any>) => {
    if (hasSelection) {
      onUpdateSelectedProps(patch);
    }
    onUpdateDefaultStyle(patch as Partial<ExcalidrawDefaultStyle>);
  };

  return (
    <div
      style={{
        backgroundColor: 'var(--ov-surface)',
        borderLeftColor: 'var(--ov-border)',
        color: 'var(--ov-text)',
      }}
      className="w-64 flex-shrink-0 border-l flex flex-col h-full select-none overflow-y-auto z-10"
    >
      {/* 标题栏 */}
      <div
        style={{
          backgroundColor: 'var(--ov-surface-header)',
          borderBottomColor: 'var(--ov-border)',
        }}
        className="px-3 py-2 border-b flex items-center justify-between"
      >
        <span className="text-xs font-semibold">
          {hasSelection
            ? isZh
              ? `已选中 (${selectedElements.length})`
              : `Selected (${selectedElements.length})`
            : isZh
            ? '画笔默认样式与画布'
            : 'Default Brush & Canvas'}
        </span>
        {hasSelection && primary && (
          <span
            style={{ color: 'var(--ov-accent)' }}
            className="text-[10px] font-mono uppercase tracking-wider"
          >
            {primary.type}
          </span>
        )}
      </div>

      <div className="p-3 space-y-4 text-xs">
        {/* 1. 多选对齐与等距分布 (仅选中 >= 2 个图元时启用) */}
        {selectedElements.length >= 2 && (
          <div className="space-y-1.5">
            <div style={{ color: 'var(--ov-text-secondary)' }} className="text-[11px] font-medium">
              {isZh ? '多选对齐与等距分布' : 'Align & Distribute'}
            </div>
            <div className="grid grid-cols-4 gap-1">
              {[
                { id: 'align-left' as const, icon: AlignStartVertical, title: isZh ? '左对齐' : 'Align Left' },
                { id: 'align-center' as const, icon: AlignCenterVertical, title: isZh ? '水平居中' : 'Align Center' },
                { id: 'align-right' as const, icon: AlignEndVertical, title: isZh ? '右对齐' : 'Align Right' },
                { id: 'distribute-horizontal' as const, icon: AlignHorizontalDistributeCenter, title: isZh ? '水平等距分布' : 'Distribute Horizontally' },
                { id: 'align-top' as const, icon: AlignStartHorizontal, title: isZh ? '顶对齐' : 'Align Top' },
                { id: 'align-middle' as const, icon: AlignCenterHorizontal, title: isZh ? '垂直居中' : 'Align Middle' },
                { id: 'align-bottom' as const, icon: AlignEndHorizontal, title: isZh ? '底对齐' : 'Align Bottom' },
                { id: 'distribute-vertical' as const, icon: AlignVerticalDistributeCenter, title: isZh ? '垂直等距分布' : 'Distribute Vertically' },
              ].map((btn) => {
                const Icon = btn.icon;
                return (
                  <button
                    key={btn.id}
                    type="button"
                    onClick={() => onAlign(btn.id)}
                    style={{
                      backgroundColor: 'var(--ov-surface-header)',
                      borderColor: 'var(--ov-border)',
                    }}
                    className="p-1.5 rounded border flex items-center justify-center hover:border-[var(--ov-accent)] transition cursor-pointer"
                    title={btn.title}
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* 2. 几何坐标与尺寸面板 (X / Y / W / H / Angle) */}
        {hasSelection && primaryBounds && (
          <div className="space-y-1.5">
            <div style={{ color: 'var(--ov-text-secondary)' }} className="text-[11px] font-medium">
              {isZh ? '几何坐标与尺寸' : 'Geometry & Size'}
            </div>
            <div className="grid grid-cols-2 gap-1.5 font-mono tabular-nums">
              <label
                style={{
                  backgroundColor: 'var(--ov-bg)',
                  borderColor: 'var(--ov-border)',
                }}
                className="flex items-center justify-between px-2 py-1 rounded border"
              >
                <span style={{ color: 'var(--ov-text-secondary)' }} className="text-[10px]">X</span>
                <input
                  type="number"
                  value={Math.round(primaryBounds.x)}
                  onChange={(e) => onUpdateSelectedGeometry({ x: Number(e.target.value) })}
                  style={{ color: 'var(--ov-text)' }}
                  className="w-16 text-right bg-transparent outline-none text-xs font-mono tabular-nums"
                />
              </label>
              <label
                style={{
                  backgroundColor: 'var(--ov-bg)',
                  borderColor: 'var(--ov-border)',
                }}
                className="flex items-center justify-between px-2 py-1 rounded border"
              >
                <span style={{ color: 'var(--ov-text-secondary)' }} className="text-[10px]">Y</span>
                <input
                  type="number"
                  value={Math.round(primaryBounds.y)}
                  onChange={(e) => onUpdateSelectedGeometry({ y: Number(e.target.value) })}
                  style={{ color: 'var(--ov-text)' }}
                  className="w-16 text-right bg-transparent outline-none text-xs font-mono tabular-nums"
                />
              </label>
              <label
                style={{
                  backgroundColor: 'var(--ov-bg)',
                  borderColor: 'var(--ov-border)',
                }}
                className="flex items-center justify-between px-2 py-1 rounded border"
              >
                <span style={{ color: 'var(--ov-text-secondary)' }} className="text-[10px]">W</span>
                <input
                  type="number"
                  min={8}
                  value={Math.round(primaryBounds.width)}
                  onChange={(e) => onUpdateSelectedGeometry({ width: Math.max(8, Number(e.target.value)) })}
                  style={{ color: 'var(--ov-text)' }}
                  className="w-16 text-right bg-transparent outline-none text-xs font-mono tabular-nums"
                />
              </label>
              <label
                style={{
                  backgroundColor: 'var(--ov-bg)',
                  borderColor: 'var(--ov-border)',
                }}
                className="flex items-center justify-between px-2 py-1 rounded border"
              >
                <span style={{ color: 'var(--ov-text-secondary)' }} className="text-[10px]">H</span>
                <input
                  type="number"
                  min={8}
                  value={Math.round(primaryBounds.height)}
                  onChange={(e) => onUpdateSelectedGeometry({ height: Math.max(8, Number(e.target.value)) })}
                  style={{ color: 'var(--ov-text)' }}
                  className="w-16 text-right bg-transparent outline-none text-xs font-mono tabular-nums"
                />
              </label>
            </div>
          </div>
        )}

        {/* 3. 描边颜色 (Stroke Color) */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span style={{ color: 'var(--ov-text-secondary)' }} className="text-[11px] font-medium">
              {isZh ? '描边颜色' : 'Stroke Color'}
            </span>
            <span className="text-[10px] font-mono tabular-nums" style={{ color: 'var(--ov-text-muted)' }}>
              {currentStroke}
            </span>
          </div>
          <div className="flex items-center flex-wrap gap-1.5">
            {PC_STROKE_PALETTE.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => applyStylePatch({ strokeColor: color })}
                style={{
                  backgroundColor: color,
                  borderColor: currentStroke === color ? 'var(--ov-accent)' : 'var(--ov-border)',
                  transform: currentStroke === color ? 'scale(1.12)' : 'scale(1)',
                }}
                className="w-5 h-5 rounded border-2 transition cursor-pointer"
                title={color}
              />
            ))}
            <input
              type="color"
              value={currentStroke.startsWith('#') ? currentStroke : '#3b82f6'}
              onChange={(e) => applyStylePatch({ strokeColor: e.target.value })}
              className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent p-0"
              title={isZh ? '自定义描边色' : 'Custom Stroke Color'}
            />
          </div>
        </div>

        {/* 4. 背景填充色 (Background Color) */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span style={{ color: 'var(--ov-text-secondary)' }} className="text-[11px] font-medium">
              {isZh ? '背景填充' : 'Background Fill'}
            </span>
            <span className="text-[10px] font-mono tabular-nums" style={{ color: 'var(--ov-text-muted)' }}>
              {currentFill}
            </span>
          </div>
          <div className="flex items-center flex-wrap gap-1.5">
            {PC_FILL_PALETTE.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => applyStylePatch({ backgroundColor: color })}
                style={{
                  backgroundColor: color === 'transparent' ? 'var(--ov-bg)' : color,
                  borderColor: currentFill === color ? 'var(--ov-accent)' : 'var(--ov-border)',
                  transform: currentFill === color ? 'scale(1.12)' : 'scale(1)',
                }}
                className="w-5 h-5 rounded border-2 transition cursor-pointer relative overflow-hidden"
                title={color === 'transparent' ? (isZh ? '无背景 (透明)' : 'Transparent') : color}
              >
                {color === 'transparent' && (
                  <span className="absolute inset-0 flex items-center justify-center text-[9px] text-red-400 font-bold">
                    /
                  </span>
                )}
              </button>
            ))}
            <input
              type="color"
              value={currentFill.startsWith('#') ? currentFill : '#dbeafe'}
              onChange={(e) => applyStylePatch({ backgroundColor: e.target.value })}
              className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent p-0"
              title={isZh ? '自定义填充色' : 'Custom Fill Color'}
            />
          </div>
        </div>

        {/* 5. 填充纹理风格 (Hachure / Cross-Hatch / Solid) */}
        <div className="space-y-1.5">
          <div style={{ color: 'var(--ov-text-secondary)' }} className="text-[11px] font-medium">
            {isZh ? '手绘填充纹理' : 'Fill Style'}
          </div>
          <div className="grid grid-cols-3 gap-1">
            {[
              { id: 'hachure', labelZh: '斜线手绘', labelEn: 'Hachure' },
              { id: 'cross-hatch', labelZh: '交叉网线', labelEn: 'Cross' },
              { id: 'solid', labelZh: '实心纯色', labelEn: 'Solid' },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => applyStylePatch({ fillStyle: item.id })}
                style={{
                  backgroundColor:
                    currentFillStyle === item.id
                      ? 'color-mix(in srgb, var(--ov-accent) 18%, transparent)'
                      : 'var(--ov-surface-header)',
                  borderColor: currentFillStyle === item.id ? 'var(--ov-accent)' : 'var(--ov-border)',
                  color: currentFillStyle === item.id ? 'var(--ov-accent)' : 'var(--ov-text)',
                }}
                className="py-1 px-1.5 rounded border text-[11px] transition cursor-pointer whitespace-nowrap shrink-0"
              >
                {isZh ? item.labelZh : item.labelEn}
              </button>
            ))}
          </div>
        </div>

        {/* 6. 描边粗细与线条样式 */}
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <div style={{ color: 'var(--ov-text-secondary)' }} className="text-[11px] font-medium">
              {isZh ? '线条粗细' : 'Stroke Width'}
            </div>
            <div className="grid grid-cols-3 gap-1 font-mono tabular-nums">
              {[1, 2, 4].map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => applyStylePatch({ strokeWidth: w })}
                  style={{
                    backgroundColor:
                      currentStrokeWidth === w
                        ? 'color-mix(in srgb, var(--ov-accent) 18%, transparent)'
                        : 'var(--ov-surface-header)',
                    borderColor: currentStrokeWidth === w ? 'var(--ov-accent)' : 'var(--ov-border)',
                    color: currentStrokeWidth === w ? 'var(--ov-accent)' : 'var(--ov-text)',
                  }}
                  className="py-1 rounded border text-[11px] transition cursor-pointer"
                >
                  {w}px
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <div style={{ color: 'var(--ov-text-secondary)' }} className="text-[11px] font-medium">
              {isZh ? '边框虚实' : 'Stroke Style'}
            </div>
            <div className="grid grid-cols-3 gap-1">
              {[
                { id: 'solid', label: '───' },
                { id: 'dashed', label: '- -' },
                { id: 'dotted', label: '···' },
              ].map((st) => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => applyStylePatch({ strokeStyle: st.id })}
                  style={{
                    backgroundColor:
                      currentStrokeStyle === st.id
                        ? 'color-mix(in srgb, var(--ov-accent) 18%, transparent)'
                        : 'var(--ov-surface-header)',
                    borderColor: currentStrokeStyle === st.id ? 'var(--ov-accent)' : 'var(--ov-border)',
                    color: currentStrokeStyle === st.id ? 'var(--ov-accent)' : 'var(--ov-text)',
                  }}
                  className="py-1 rounded border text-[10px] font-mono transition cursor-pointer"
                >
                  {st.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 7. 手绘粗糙度 (Roughness 0 / 1 / 2) 与圆角开关 */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span style={{ color: 'var(--ov-text-secondary)' }} className="text-[11px] font-medium">
              {isZh ? '手绘糙度 (Roughness)' : 'Hand-Drawn Roughness'}
            </span>
            <button
              type="button"
              onClick={() => applyStylePatch({ roundness: currentRoundness ? null : { type: 3 } })}
              style={{
                color: currentRoundness ? 'var(--ov-accent)' : 'var(--ov-text-secondary)',
              }}
              className="text-[11px] hover:underline cursor-pointer"
            >
              {currentRoundness ? (isZh ? '✓ 圆角边框' : '✓ Rounded') : (isZh ? '直角边框' : 'Sharp Edge')}
            </button>
          </div>
          <div className="grid grid-cols-3 gap-1">
            {[
              { val: 0, labelZh: '精准几何', labelEn: 'Architect' },
              { val: 1, labelZh: '经典手绘', labelEn: 'Artist' },
              { val: 2, labelZh: '狂野涂鸦', labelEn: 'Cartoonist' },
            ].map((r) => (
              <button
                key={r.val}
                type="button"
                onClick={() => applyStylePatch({ roughness: r.val })}
                style={{
                  backgroundColor:
                    currentRoughness === r.val
                      ? 'color-mix(in srgb, var(--ov-accent) 18%, transparent)'
                      : 'var(--ov-surface-header)',
                  borderColor: currentRoughness === r.val ? 'var(--ov-accent)' : 'var(--ov-border)',
                  color: currentRoughness === r.val ? 'var(--ov-accent)' : 'var(--ov-text)',
                }}
                className="py-1 px-1.5 rounded border text-[11px] transition cursor-pointer whitespace-nowrap shrink-0"
              >
                {isZh ? r.labelZh : r.labelEn}
              </button>
            ))}
          </div>
        </div>

        {/* 8. 文字字号与对齐方式 */}
        <div className="space-y-1.5">
          <div style={{ color: 'var(--ov-text-secondary)' }} className="text-[11px] font-medium">
            {isZh ? '文本字号与对齐' : 'Typography & Align'}
          </div>
          <div className="flex items-center gap-1.5">
            <div className="grid grid-cols-4 gap-1 flex-1 font-mono tabular-nums">
              {[
                { size: 14, label: 'S' },
                { size: 16, label: 'M' },
                { size: 20, label: 'L' },
                { size: 28, label: 'XL' },
              ].map((f) => (
                <button
                  key={f.size}
                  type="button"
                  onClick={() => applyStylePatch({ fontSize: f.size })}
                  style={{
                    backgroundColor:
                      currentFontSize === f.size
                        ? 'color-mix(in srgb, var(--ov-accent) 18%, transparent)'
                        : 'var(--ov-surface-header)',
                    borderColor: currentFontSize === f.size ? 'var(--ov-accent)' : 'var(--ov-border)',
                    color: currentFontSize === f.size ? 'var(--ov-accent)' : 'var(--ov-text)',
                  }}
                  className="py-1 rounded border text-[11px] transition cursor-pointer"
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-0.5">
              {[
                { align: 'left' as const, icon: AlignLeft },
                { align: 'center' as const, icon: AlignCenter },
                { align: 'right' as const, icon: AlignRight },
              ].map((a) => {
                const Icon = a.icon;
                return (
                  <button
                    key={a.align}
                    type="button"
                    onClick={() => applyStylePatch({ textAlign: a.align })}
                    style={{
                      backgroundColor:
                        currentTextAlign === a.align
                          ? 'color-mix(in srgb, var(--ov-accent) 18%, transparent)'
                          : 'var(--ov-surface-header)',
                      borderColor: currentTextAlign === a.align ? 'var(--ov-accent)' : 'var(--ov-border)',
                    }}
                    className="p-1.5 rounded border transition cursor-pointer"
                  >
                    <Icon className="w-3 h-3" />
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* 9. 透明度控制 */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span style={{ color: 'var(--ov-text-secondary)' }} className="text-[11px] font-medium">
              {isZh ? '不透明度 (Opacity)' : 'Opacity'}
            </span>
            <span className="font-mono tabular-nums text-[11px]">{currentOpacity}%</span>
          </div>
          <input
            type="range"
            min={15}
            max={100}
            step={5}
            value={currentOpacity}
            onChange={(e) => applyStylePatch({ opacity: Number(e.target.value) })}
            className="w-full accent-[var(--ov-accent)] cursor-pointer"
          />
        </div>

        {/* 10. 选中图元的图层顺序与动作面板 */}
        {hasSelection ? (
          <div className="pt-2 border-t space-y-2.5" style={{ borderColor: 'var(--ov-border)' }}>
            <div className="space-y-1">
              <div style={{ color: 'var(--ov-text-secondary)' }} className="text-[11px] font-medium">
                {isZh ? '图层叠放次序 (Z-Order)' : 'Layer Order'}
              </div>
              <div className="grid grid-cols-4 gap-1">
                {[
                  { id: 'front' as const, icon: ArrowUpToLine, label: isZh ? '置顶' : 'Front' },
                  { id: 'forward' as const, icon: ArrowUp, label: isZh ? '上移' : 'Up' },
                  { id: 'backward' as const, icon: ArrowDown, label: isZh ? '下移' : 'Down' },
                  { id: 'back' as const, icon: ArrowDownToLine, label: isZh ? '置底' : 'Back' },
                ].map((l) => {
                  const Icon = l.icon;
                  return (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => onLayerOrder(l.id)}
                      style={{
                        backgroundColor: 'var(--ov-surface-header)',
                        borderColor: 'var(--ov-border)',
                      }}
                      className="flex flex-col items-center gap-0.5 py-1.5 rounded border hover:border-[var(--ov-accent)] transition cursor-pointer"
                      title={l.label}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span className="text-[10px] whitespace-nowrap">{l.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1">
              <div style={{ color: 'var(--ov-text-secondary)' }} className="text-[11px] font-medium">
                {isZh ? '快捷操作与资产沉淀' : 'Actions'}
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {selectedElements.length >= 2 && (
                  <button
                    type="button"
                    onClick={onGroup}
                    style={{
                      backgroundColor: 'var(--ov-surface-header)',
                      borderColor: 'var(--ov-border)',
                    }}
                    className="flex items-center justify-center gap-1 py-1.5 px-2 rounded border hover:border-[var(--ov-accent)] transition cursor-pointer whitespace-nowrap"
                  >
                    <Group className="w-3.5 h-3.5" />
                    <span>{isZh ? '编组 (Ctrl+G)' : 'Group'}</span>
                  </button>
                )}
                {hasGroup && (
                  <button
                    type="button"
                    onClick={onUngroup}
                    style={{
                      backgroundColor: 'var(--ov-surface-header)',
                      borderColor: 'var(--ov-border)',
                    }}
                    className="flex items-center justify-center gap-1 py-1.5 px-2 rounded border hover:border-[var(--ov-accent)] transition cursor-pointer whitespace-nowrap"
                  >
                    <Ungroup className="w-3.5 h-3.5" />
                    <span>{isZh ? '解组' : 'Ungroup'}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={onDuplicate}
                  style={{
                    backgroundColor: 'var(--ov-surface-header)',
                    borderColor: 'var(--ov-border)',
                  }}
                  className="flex items-center justify-center gap-1 py-1.5 px-2 rounded border hover:border-[var(--ov-accent)] transition cursor-pointer whitespace-nowrap"
                >
                  <CopyPlus className="w-3.5 h-3.5" />
                  <span>{isZh ? '克隆 (Ctrl+D)' : 'Clone'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => onUpdateSelectedProps({ locked: !isLocked })}
                  style={{
                    backgroundColor: 'var(--ov-surface-header)',
                    borderColor: 'var(--ov-border)',
                  }}
                  className="flex items-center justify-center gap-1 py-1.5 px-2 rounded border hover:border-[var(--ov-accent)] transition cursor-pointer whitespace-nowrap"
                >
                  {isLocked ? <Unlock className="w-3.5 h-3.5 text-amber-400" /> : <Lock className="w-3.5 h-3.5" />}
                  <span>{isLocked ? (isZh ? '解锁' : 'Unlock') : (isZh ? '锁定' : 'Lock')}</span>
                </button>
                <button
                  type="button"
                  onClick={onSaveAsStencil}
                  style={{
                    backgroundColor: 'var(--ov-surface-header)',
                    borderColor: 'var(--ov-border)',
                  }}
                  className="flex items-center justify-center gap-1 py-1.5 px-2 rounded border hover:border-[var(--ov-accent)] transition cursor-pointer whitespace-nowrap"
                >
                  <BookmarkPlus className="w-3.5 h-3.5" style={{ color: 'var(--ov-accent)' }} />
                  <span>{isZh ? '存为物料' : 'To Stencil'}</span>
                </button>
                <button
                  type="button"
                  onClick={onDelete}
                  style={{
                    backgroundColor: 'var(--ov-surface-header)',
                    borderColor: 'var(--ov-border)',
                  }}
                  className="flex items-center justify-center gap-1 py-1.5 px-2 rounded border text-red-400 hover:border-red-500 transition cursor-pointer whitespace-nowrap"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{isZh ? '删除 (Del)' : 'Delete'}</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* 未选中任何图元时：展示画布底色设置与 PC 操作提示 */
          <div className="pt-2 border-t space-y-2.5" style={{ borderColor: 'var(--ov-border)' }}>
            <div className="space-y-1.5">
              <div style={{ color: 'var(--ov-text-secondary)' }} className="text-[11px] font-medium">
                {isZh ? '画布背景底色' : 'Canvas Background'}
              </div>
              <div className="flex items-center gap-1.5">
                {['#ffffff', '#f8fafc', '#fefce8', '#121212', '#0f172a', '#1e1b4b'].map((bg) => (
                  <button
                    key={bg}
                    type="button"
                    onClick={() => onCanvasBgColorChange(bg)}
                    style={{
                      backgroundColor: bg,
                      borderColor: canvasBgColor === bg ? 'var(--ov-accent)' : 'var(--ov-border)',
                    }}
                    className="w-6 h-6 rounded border-2 transition cursor-pointer"
                    title={bg}
                  />
                ))}
              </div>
            </div>

            <div
              style={{
                backgroundColor: 'var(--ov-surface-header)',
                borderColor: 'var(--ov-border)',
                color: 'var(--ov-text-secondary)',
              }}
              className="p-2.5 rounded-lg border text-[11px] leading-relaxed space-y-1"
            >
              <div className="font-medium" style={{ color: 'var(--ov-text)' }}>
                {isZh ? 'PC 桌面高效操作提示' : 'PC Studio Tips'}
              </div>
              <div>• {isZh ? '双击任意形状可直接内联输入居中文字' : 'Double-click any shape to edit centered label'}</div>
              <div>• {isZh ? '使用箭头 (A) 靠近节点边缘可自动磁吸绑定' : 'Drag Arrow (A) near shape ports to bind'}</div>
              <div>• {isZh ? '按住 Space 键或鼠标中键可随时拖拽漫游画布' : 'Hold Space or Middle-Click to pan canvas'}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
