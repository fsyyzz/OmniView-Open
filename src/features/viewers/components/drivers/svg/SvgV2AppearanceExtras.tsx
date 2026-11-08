/**
 * OmniView SVG v2 — 高级外观与布尔扩展面板 (SVG-04 / SVG-05 / SVG-06 / SVG-07)
 *
 * 职责（遵守大组件拆分阈值，独立承载 P1/P2 新增检视器能力）：
 * - SVG-04: 可视化线性/径向渐变编辑器（纯色/线性/径向/无 四态切换、0-360° 角度、多色标增删、6 款内置渐变预设）
 * - SVG-05: 一键阴影与高斯模糊滤镜预设（无 / 柔和阴影 / 深邃投影 / 霓虹发光 / 高斯模糊 + dx/dy/stdDeviation 微调）
 * - SVG-06: 画布吸管取色器 (`EyeDropper API`) + 文档已用色板自动聚合 (`extractDocumentColorPalette`)
 * - SVG-07: 路径布尔运算（联集 Union / 差集 Subtract / 交集 Intersect / 异或 Exclude）
 */
import React, { useMemo, useState } from 'react';
import {
  Pipette,
  Sparkles,
  Plus,
  Trash2,
  Combine,
  Minus as Subtract,
  CircleDot as Intersect,
  Layers as Exclude,
  Palette,
  SunMedium,
} from 'lucide-react';
import {
  GRADIENT_PRESETS,
  FILTER_PRESET_DEFAULTS,
  RAW_DEFS_METADATA_KEY,
  extractDocumentColorPalette,
  parseGradientFromDefs,
  parseFilterFromDefs,
  type BooleanOpKind,
  type CommandId,
  type CommandParams,
  type Document,
  type FilterPresetId,
  type GradientStop,
  type NodeId,
} from './core';

export interface SvgV2AppearanceExtrasProps {
  readonly document: Document;
  readonly selection: { primaryId: NodeId | null; nodeIds: ReadonlyArray<NodeId> };
  readonly execute: (id: CommandId, params: CommandParams) => void;
  readonly onFeedback?: (msg: string) => void;
}

export const SvgV2AppearanceExtras: React.FC<SvgV2AppearanceExtrasProps> = ({
  document: doc,
  selection,
  execute,
  onFeedback,
}) => {
  const ids = selection.nodeIds;
  const primary = selection.primaryId ? doc.nodes.get(selection.primaryId) : doc.nodes.get(ids[0]!);
  const rawDefs = doc.metadata[RAW_DEFS_METADATA_KEY] ?? '';

  // 识别当前填充是否为渐变
  const fillItem =
    primary && (primary.kind === 'Path' || primary.kind === 'Text')
      ? primary.appearance.items.find((it) => it.kind === 'fill')
      : null;

  const currentGradConfig = useMemo(() => {
    if (fillItem && fillItem.kind === 'fill' && fillItem.fill.type === 'gradient') {
      return parseGradientFromDefs(rawDefs, fillItem.fill.id);
    }
    return null;
  }, [fillItem, rawDefs]);

  const [paintTarget, setPaintTarget] = useState<'fill' | 'stroke'>('fill');
  const [gradKind, setGradKind] = useState<'linear' | 'radial'>(currentGradConfig?.kind ?? 'linear');
  const [gradAngle, setGradAngle] = useState<number>(currentGradConfig?.angleDeg ?? 135);
  const [gradStops, setGradStops] = useState<GradientStop[]>(
    currentGradConfig?.stops
      ? [...currentGradConfig.stops]
      : [
          { offset: 0, color: '#3b82f6', opacity: 1 },
          { offset: 100, color: '#8b5cf6', opacity: 1 },
        ],
  );

  // 识别当前滤镜
  const currentFilterId = useMemo(() => {
    if (!primary?.filter) return null;
    const m = primary.filter.match(/url\(#([^)]+)\)/);
    return m ? m[1] ?? null : null;
  }, [primary?.filter]);

  const parsedFilter = useMemo(() => {
    if (!currentFilterId) return null;
    return parseFilterFromDefs(rawDefs, currentFilterId);
  }, [rawDefs, currentFilterId]);

  const [filterPreset, setFilterPreset] = useState<FilterPresetId>(parsedFilter?.preset ?? 'none');
  const [filterDx, setFilterDx] = useState<number>(parsedFilter?.dx ?? 0);
  const [filterDy, setFilterDy] = useState<number>(parsedFilter?.dy ?? 4);
  const [filterBlur, setFilterBlur] = useState<number>(parsedFilter?.stdDeviation ?? 6);
  const [filterColor, setFilterColor] = useState<string>(parsedFilter?.color ?? '#0f172a');
  const [filterOpacity, setFilterOpacity] = useState<number>(parsedFilter?.opacity ?? 0.28);

  // 文档已用色板自动提取 (SVG-06)
  const docPalette = useMemo(() => extractDocumentColorPalette(doc), [doc]);

  const applyGradient = (
    nextKind: 'linear' | 'radial',
    nextAngle: number,
    nextStops: ReadonlyArray<GradientStop>,
  ) => {
    if (ids.length === 0) return;
    execute('paint.setGradient', {
      ids: [...ids],
      target: paintTarget,
      config: {
        kind: nextKind,
        angleDeg: nextAngle,
        stops: nextStops,
      },
    });
  };

  const handleEyedropperPick = async () => {
    const win = window as unknown as { EyeDropper?: new () => { open: () => Promise<{ sRGBHex: string }> } };
    if (typeof win.EyeDropper !== 'function') {
      onFeedback?.('当前宿主环境不支持原生 EyeDropper，请直接点击下方「文档已用色板」取色');
      return;
    }
    try {
      const dropper = new win.EyeDropper();
      const res = await dropper.open();
      if (res?.sRGBHex && ids.length > 0) {
        execute('paint.setColor', {
          ids: [...ids],
          target: paintTarget,
          color: res.sRGBHex,
          opacity: 1,
        });
        onFeedback?.(`吸管已拾取 ${res.sRGBHex} 并应用到${paintTarget === 'fill' ? '填充' : '描边'}`);
      }
    } catch {
      /* user cancelled eyedropper */
    }
  };

  const applyFilter = (
    preset: FilterPresetId,
    dx = filterDx,
    dy = filterDy,
    stdDeviation = filterBlur,
    color = filterColor,
    opacity = filterOpacity,
  ) => {
    if (ids.length === 0) return;
    execute('paint.setFilter', {
      ids: [...ids],
      config: {
        preset,
        dx,
        dy,
        stdDeviation,
        color,
        opacity,
      },
    });
  };

  const canBooleanOp =
    ids.length >= 2 && ids.filter((id) => doc.nodes.get(id)?.kind === 'Path').length >= 2;

  const handleBooleanOp = (op: BooleanOpKind, label: string) => {
    if (!canBooleanOp) return;
    execute('path.booleanOp', { ids: [...ids], op });
    onFeedback?.(`已执行路径${label}`);
  };

  const FILTER_BUTTONS: ReadonlyArray<{ id: FilterPresetId; label: string }> = [
    { id: 'none', label: '无滤镜' },
    { id: 'drop-shadow-sm', label: '柔和阴影' },
    { id: 'drop-shadow-lg', label: '深邃投影' },
    { id: 'glow', label: '霓虹发光' },
    { id: 'blur', label: '高斯模糊' },
  ];

  return (
    <div className="space-y-2 mb-2" data-testid="svg-appearance-extras">
      {/* 1. SVG-07 路径布尔运算（当选中 >= 2 个 Path 图元时高亮可用） */}
      {ids.length >= 2 && (
        <div className="rounded border border-[var(--ov-border)] bg-[var(--ov-bg)]/40 p-2 text-xs space-y-1.5">
          <div className="flex items-center justify-between text-[var(--ov-fg-muted)]">
            <span className="flex items-center gap-1 font-semibold text-[var(--ov-fg)]">
              <Combine size={12} className="text-[var(--ov-accent)]" />
              <span>路径布尔运算 (Boolean Ops)</span>
            </span>
            <span className="text-[10px] font-mono text-[var(--ov-accent)]">已选 {ids.length} 项</span>
          </div>
          <div className="grid grid-cols-4 gap-1">
            {(
              [
                { op: 'union', label: '联集', desc: '合并为一个闭合复合轮廓 (Union)', icon: <Combine size={12} /> },
                { op: 'subtract', label: '差集', desc: '底层图形减去顶层图形 (Subtract)', icon: <Subtract size={12} /> },
                { op: 'intersect', label: '交集', desc: '仅保留重叠相交区域 (Intersect)', icon: <Intersect size={12} /> },
                { op: 'exclude', label: '异或', desc: '挖空重叠部分 (Exclude / Even-Odd)', icon: <Exclude size={12} /> },
              ] as const
            ).map((item) => (
              <button
                key={item.op}
                type="button"
                disabled={!canBooleanOp}
                title={item.desc}
                className="
                  flex items-center justify-center gap-1 rounded border border-[var(--ov-border)]
                  bg-[var(--ov-surface)] py-1 text-[10px] text-[var(--ov-fg)]
                  hover:border-[var(--ov-accent)] hover:bg-[var(--ov-hover)]
                  disabled:opacity-40 transition-colors
                "
                onClick={() => handleBooleanOp(item.op, item.label)}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 2. SVG-06 画布吸管取色器 + 文档已用色板 */}
      <div className="rounded border border-[var(--ov-border)] bg-[var(--ov-bg)]/40 p-2 text-xs space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1 font-semibold text-[var(--ov-fg)]">
            <Palette size={12} className="text-[var(--ov-accent)]" />
            <span>吸管与文档色板</span>
          </span>
          <div className="flex items-center gap-0.5 rounded border border-[var(--ov-border)] bg-[var(--ov-surface)] p-0.5 text-[10px]">
            <button
              type="button"
              className={`rounded px-1.5 py-0.2 transition-colors ${
                paintTarget === 'fill'
                  ? 'bg-[var(--ov-accent)] text-white font-medium'
                  : 'text-[var(--ov-fg-muted)] hover:text-[var(--ov-fg)]'
              }`}
              onClick={() => setPaintTarget('fill')}
            >
              作用于填充
            </button>
            <button
              type="button"
              className={`rounded px-1.5 py-0.2 transition-colors ${
                paintTarget === 'stroke'
                  ? 'bg-[var(--ov-accent)] text-white font-medium'
                  : 'text-[var(--ov-fg-muted)] hover:text-[var(--ov-fg)]'
              }`}
              onClick={() => setPaintTarget('stroke')}
            >
              作用于描边
            </button>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            title="调用屏幕吸管取色器 (EyeDropper API) 拾取任意像素颜色"
            className="
              flex items-center gap-1 rounded border border-[var(--ov-border)]
              bg-[var(--ov-surface)] px-2 py-1 text-[11px] text-[var(--ov-fg)]
              hover:border-[var(--ov-accent)] hover:bg-[var(--ov-hover)] transition-colors shrink-0
            "
            onClick={handleEyedropperPick}
          >
            <Pipette size={12} className="text-[var(--ov-accent)]" />
            <span>屏幕吸管</span>
          </button>

          <div className="flex flex-1 flex-wrap items-center gap-1">
            {docPalette.length > 0 ? (
              docPalette.slice(0, 12).map((hex) => (
                <button
                  key={hex}
                  type="button"
                  title={`点击应用文档已用色 ${hex} 到${paintTarget === 'fill' ? '填充' : '描边'}`}
                  className="h-5 w-5 rounded border border-black/15 transition-transform hover:scale-110"
                  style={{ backgroundColor: hex }}
                  onClick={() => {
                    execute('paint.setColor', {
                      ids: [...ids],
                      target: paintTarget,
                      color: hex,
                      opacity: 1,
                    });
                    onFeedback?.(`已应用文档颜色 ${hex}`);
                  }}
                />
              ))
            ) : (
              <span className="text-[10px] text-[var(--ov-fg-muted)]">画布暂无已用纯色</span>
            )}
          </div>
        </div>
      </div>

      {/* 3. SVG-04 可视化线性/径向渐变编辑器 */}
      <div className="rounded border border-[var(--ov-border)] bg-[var(--ov-bg)]/40 p-2 text-xs space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1 font-semibold text-[var(--ov-fg)]">
            <Sparkles size={12} className="text-[var(--ov-accent)]" />
            <span>渐变编辑器 (Gradient)</span>
          </span>
          <div className="flex items-center gap-1">
            {(['linear', 'radial'] as const).map((k) => (
              <button
                key={k}
                type="button"
                className={`rounded border px-1.5 py-0.5 text-[10px] transition-colors ${
                  gradKind === k
                    ? 'border-[var(--ov-accent)] bg-[var(--ov-accent-soft)] text-[var(--ov-accent)] font-medium'
                    : 'border-[var(--ov-border)] bg-[var(--ov-surface)] text-[var(--ov-fg-muted)] hover:bg-[var(--ov-hover)]'
                }`}
                onClick={() => {
                  setGradKind(k);
                  applyGradient(k, gradAngle, gradStops);
                }}
              >
                {k === 'linear' ? '线性渐变' : '径向渐变'}
              </button>
            ))}
          </div>
        </div>

        {/* 6 款精选渐变色卡一键应用 */}
        <div className="grid grid-cols-6 gap-1">
          {GRADIENT_PRESETS.map((preset) => {
            const cssBg = `linear-gradient(${preset.angleDeg}deg, ${preset.stops
              .map((s) => `${s.color} ${Math.round(s.offset)}%`)
              .join(', ')})`;
            return (
              <button
                key={preset.name}
                type="button"
                title={`一键应用渐变预设：${preset.name}`}
                className="h-5 w-full rounded border border-black/15 transition-transform hover:scale-105"
                style={{ backgroundImage: cssBg }}
                onClick={() => {
                  const nextStops = preset.stops.map((s) => ({ ...s }));
                  setGradKind(preset.kind);
                  setGradAngle(preset.angleDeg);
                  setGradStops(nextStops);
                  applyGradient(preset.kind, preset.angleDeg, nextStops);
                  onFeedback?.(`已应用「${preset.name}」渐变`);
                }}
              />
            );
          })}
        </div>

        {/* 线性角度控制 */}
        {gradKind === 'linear' && (
          <div className="flex items-center justify-between gap-2 pt-0.5">
            <span className="text-[11px] text-[var(--ov-fg-muted)]">渐变角度</span>
            <input
              type="range"
              min={0}
              max={360}
              step={15}
              value={gradAngle}
              className="flex-1 cursor-pointer"
              onChange={(e) => {
                const nextAngle = Number(e.target.value);
                setGradAngle(nextAngle);
                applyGradient(gradKind, nextAngle, gradStops);
              }}
            />
            <span className="w-10 text-right font-mono text-[10px] text-[var(--ov-fg)]">{gradAngle}°</span>
          </div>
        )}

        {/* 色标列表 (Stops) */}
        <div className="space-y-1 pt-0.5">
          <div className="flex items-center justify-between text-[10px] text-[var(--ov-fg-muted)]">
            <span>渐变色标 ({gradStops.length})</span>
            <button
              type="button"
              className="flex items-center gap-0.5 text-[var(--ov-accent)] hover:underline"
              onClick={() => {
                const next: GradientStop[] = [
                  ...gradStops,
                  { offset: 50, color: '#10b981', opacity: 1 },
                ].sort((a, b) => a.offset - b.offset);
                setGradStops(next);
                applyGradient(gradKind, gradAngle, next);
              }}
            >
              <Plus size={10} /> 添加色标
            </button>
          </div>
          {gradStops.map((stop, idx) => (
            <div key={idx} className="flex items-center gap-1.5">
              <input
                type="color"
                value={stop.color}
                className="h-5 w-7 cursor-pointer rounded border border-[var(--ov-border)]"
                onChange={(e) => {
                  const next = gradStops.map((s, i) => (i === idx ? { ...s, color: e.target.value } : s));
                  setGradStops(next);
                  applyGradient(gradKind, gradAngle, next);
                }}
              />
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={Math.round(stop.offset)}
                className="flex-1 cursor-pointer"
                onChange={(e) => {
                  const nextOffset = Number(e.target.value);
                  const next = gradStops.map((s, i) => (i === idx ? { ...s, offset: nextOffset } : s));
                  setGradStops(next);
                  applyGradient(gradKind, gradAngle, next);
                }}
              />
              <span className="w-8 text-right font-mono text-[10px] text-[var(--ov-fg-muted)]">
                {Math.round(stop.offset)}%
              </span>
              {gradStops.length > 2 && (
                <button
                  type="button"
                  title="移除该色标"
                  className="text-[var(--ov-fg-muted)] hover:text-rose-500"
                  onClick={() => {
                    const next = gradStops.filter((_, i) => i !== idx);
                    setGradStops(next);
                    applyGradient(gradKind, gradAngle, next);
                  }}
                >
                  <Trash2 size={11} />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 4. SVG-05 一键阴影与高斯模糊滤镜预设 (<filter>) */}
      <div className="rounded border border-[var(--ov-border)] bg-[var(--ov-bg)]/40 p-2 text-xs space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1 font-semibold text-[var(--ov-fg)]">
            <SunMedium size={12} className="text-[var(--ov-accent)]" />
            <span>阴影与模糊滤镜 (&lt;filter&gt;)</span>
          </span>
          {currentFilterId && (
            <span className="font-mono text-[10px] text-emerald-500">#{currentFilterId}</span>
          )}
        </div>

        <div className="grid grid-cols-5 gap-1">
          {FILTER_BUTTONS.map((btn) => {
            const presetKey = btn.id;
            const isActive =
              (presetKey === 'none' && !currentFilterId) ||
              (presetKey !== 'none' && filterPreset === presetKey && Boolean(currentFilterId));
            return (
              <button
                key={presetKey}
                type="button"
                title={`一键应用滤镜预设：${btn.label}`}
                className={`rounded border py-1 text-[10px] transition-colors ${
                  isActive
                    ? 'border-[var(--ov-accent)] bg-[var(--ov-accent-soft)] text-[var(--ov-accent)] font-medium'
                    : 'border-[var(--ov-border)] bg-[var(--ov-surface)] text-[var(--ov-fg)] hover:bg-[var(--ov-hover)]'
                }`}
                onClick={() => {
                  setFilterPreset(presetKey);
                  if (presetKey === 'none') {
                    applyFilter('none', 0, 0, 0, '#0f172a', 0);
                    onFeedback?.('已移除图元滤镜');
                  } else {
                    const cfg = FILTER_PRESET_DEFAULTS[presetKey];
                    setFilterDx(cfg.dx);
                    setFilterDy(cfg.dy);
                    setFilterBlur(cfg.stdDeviation);
                    setFilterColor(cfg.color);
                    setFilterOpacity(cfg.opacity);
                    applyFilter(presetKey, cfg.dx, cfg.dy, cfg.stdDeviation, cfg.color, cfg.opacity);
                    onFeedback?.(`已应用滤镜：${btn.label}`);
                  }
                }}
              >
                {btn.label}
              </button>
            );
          })}
        </div>

        {filterPreset !== 'none' && (
          <div className="space-y-1 pt-1 border-t border-[var(--ov-border)]/50">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] text-[var(--ov-fg-muted)]">模糊半径</span>
              <input
                type="range"
                min={0}
                max={24}
                step={1}
                value={filterBlur}
                className="flex-1 cursor-pointer"
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setFilterBlur(v);
                  applyFilter(filterPreset, filterDx, filterDy, v, filterColor, filterOpacity);
                }}
              />
              <span className="w-8 text-right font-mono text-[10px]">{filterBlur}px</span>
            </div>

            {filterPreset !== 'blur' && (
              <>
                <div className="grid grid-cols-2 gap-1.5">
                  <label className="flex items-center justify-between text-[10px] text-[var(--ov-fg-muted)]">
                    <span>偏移 X</span>
                    <input
                      type="number"
                      min={-40}
                      max={40}
                      value={filterDx}
                      className="w-12 rounded border border-[var(--ov-border)] bg-[var(--ov-bg)] px-1 py-0.5 text-right font-mono text-[10px] text-[var(--ov-fg)]"
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        setFilterDx(v);
                        applyFilter(filterPreset, v, filterDy, filterBlur, filterColor, filterOpacity);
                      }}
                    />
                  </label>
                  <label className="flex items-center justify-between text-[10px] text-[var(--ov-fg-muted)]">
                    <span>偏移 Y</span>
                    <input
                      type="number"
                      min={-40}
                      max={40}
                      value={filterDy}
                      className="w-12 rounded border border-[var(--ov-border)] bg-[var(--ov-bg)] px-1 py-0.5 text-right font-mono text-[10px] text-[var(--ov-fg)]"
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        setFilterDy(v);
                        applyFilter(filterPreset, filterDx, v, filterBlur, filterColor, filterOpacity);
                      }}
                    />
                  </label>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] text-[var(--ov-fg-muted)]">阴影颜色与浓度</span>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="color"
                      value={filterColor}
                      className="h-5 w-7 cursor-pointer rounded border border-[var(--ov-border)]"
                      onChange={(e) => {
                        const c = e.target.value;
                        setFilterColor(c);
                        applyFilter(filterPreset, filterDx, filterDy, filterBlur, c, filterOpacity);
                      }}
                    />
                    <input
                      type="range"
                      min={0.05}
                      max={1}
                      step={0.05}
                      value={filterOpacity}
                      className="w-20 cursor-pointer"
                      onChange={(e) => {
                        const op = Number(e.target.value);
                        setFilterOpacity(op);
                        applyFilter(filterPreset, filterDx, filterDy, filterBlur, filterColor, op);
                      }}
                    />
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
