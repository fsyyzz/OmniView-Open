/**
 * 列级数据画像深度透视浮层 (Column Profile Deep-Dive Modal / HUD)
 * 包含交互式直方图 (Histogram)、极值/四分位数/标准差统计面板、分类频次排行条与快捷列操作
 */
import React, { useState } from 'react';
import { ColumnProfile } from './csvProfiling';
import {
  X,
  Hash,
  AlignLeft,
  Calendar,
  CheckSquare,
  BarChart2,
  TrendingUp,
  Layers,
  Copy,
  Check,
  ArrowUp,
  ArrowDown,
  Filter,
  Download,
  Percent,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { Locale, t } from '../../../../../shared/lib/i18n';

interface ColumnProfileModalProps {
  profile: ColumnProfile;
  locale?: Locale;
  onClose: () => void;
  onSortAsc?: (colIdx: number) => void;
  onSortDesc?: (colIdx: number) => void;
  onFilterValue?: (val: string) => void;
}

export const ColumnProfileModal: React.FC<ColumnProfileModalProps> = ({
  profile,
  locale = 'zh-CN',
  onClose,
  onSortAsc,
  onSortDesc,
  onFilterValue,
}) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [hoveredBin, setHoveredBin] = useState<number | null>(null);

  const {
    header,
    colIndex,
    type,
    totalRows,
    validCount,
    nullCount,
    completenessRatio,
    distinctCount,
    uniquenessRatio,
    numericStats,
    categoricalStats,
    dateStats,
  } = profile;

  const handleCopyText = async (text: string, key: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1800);
  };

  const handleExportProfileJson = () => {
    const jsonStr = JSON.stringify(profile, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `column_profile_${header.replace(/[^a-zA-Z0-9_-]/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          backgroundColor: 'var(--ov-surface)',
          borderColor: 'var(--ov-border)',
          color: 'var(--ov-text)',
        }}
        className="w-full max-w-2xl border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-scale-in"
      >
        {/* Modal Header */}
        <div
          style={{
            backgroundColor: 'var(--ov-surface-header)',
            borderBottomColor: 'var(--ov-border)',
          }}
          className="flex items-center justify-between px-5 py-4 border-b"
        >
          <div className="flex items-center gap-3">
            <div
              style={{
                backgroundColor: 'var(--ov-surface)',
                borderColor: 'var(--ov-border)',
              }}
              className="p-2 border rounded-xl text-emerald-400"
            >
              <BarChart2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 style={{ color: 'var(--ov-text)' }} className="text-base font-bold font-sans">{header}</h3>
                <span
                  style={{
                    backgroundColor: 'var(--ov-surface)',
                    borderColor: 'var(--ov-border)',
                    color: 'var(--ov-text-secondary)',
                  }}
                  className="px-2 py-0.5 rounded text-[10px] font-mono font-bold border uppercase"
                >
                  第 {colIndex + 1} 列 · {type}
                </span>
              </div>
              <p style={{ color: 'var(--ov-text-muted)' }} className="text-xs mt-0.5">
                数据概览 · {totalRows} 行 · 完整率 {(completenessRatio * 100).toFixed(1)}% · 唯一值 {distinctCount}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportProfileJson}
              style={{
                backgroundColor: 'var(--ov-surface)',
                borderColor: 'var(--ov-border)',
                color: 'var(--ov-text)',
              }}
              className="p-1.5 rounded-lg border transition flex items-center gap-1 text-xs px-2.5 hover:border-[var(--ov-accent)]"
              title="导出当前列数据画像为 JSON"
            >
              <Download className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden sm:inline">导出画像</span>
            </button>
            <button
              onClick={onClose}
              style={{ color: 'var(--ov-text-muted)' }}
              className="p-1.5 hover:text-[var(--ov-text)] rounded-lg transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 custom-scrollbar">
          {/* Top Quick Actions Bar */}
          <div
            style={{
              backgroundColor: 'var(--ov-surface-header)',
              borderColor: 'var(--ov-border)',
            }}
            className="flex flex-wrap items-center gap-2 p-2.5 rounded-xl border text-xs"
          >
            <span style={{ color: 'var(--ov-text-muted)' }} className="font-medium text-[11px] px-1">快捷列操作:</span>
            {onSortAsc && (
              <button
                onClick={() => {
                  onSortAsc(colIndex);
                  onClose();
                }}
                style={{
                  backgroundColor: 'var(--ov-surface)',
                  borderColor: 'var(--ov-border)',
                  color: 'var(--ov-text)',
                }}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg transition border hover:border-emerald-500 hover:text-emerald-400"
              >
                <ArrowUp className="w-3 h-3 text-emerald-400" />
                <span>按该列升序 (ASC)</span>
              </button>
            )}
            {onSortDesc && (
              <button
                onClick={() => {
                  onSortDesc(colIndex);
                  onClose();
                }}
                style={{
                  backgroundColor: 'var(--ov-surface)',
                  borderColor: 'var(--ov-border)',
                  color: 'var(--ov-text)',
                }}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg transition border hover:border-emerald-500 hover:text-emerald-400"
              >
                <ArrowDown className="w-3 h-3 text-emerald-400" />
                <span>按该列降序 (DESC)</span>
              </button>
            )}
            <button
              onClick={() => handleCopyText(JSON.stringify(profile, null, 2), 'profile_json')}
              style={{
                backgroundColor: 'var(--ov-surface)',
                borderColor: 'var(--ov-border)',
                color: 'var(--ov-text)',
              }}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg transition border ml-auto hover:border-amber-500 hover:text-amber-400"
            >
              {copiedKey === 'profile_json' ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3 text-amber-400" />}
              <span>{copiedKey === 'profile_json' ? '画像 JSON 已复制' : '复制统计量'}</span>
            </button>
          </div>

          {/* Metric KPI Cards Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div
              style={{
                backgroundColor: 'var(--ov-surface-header)',
                borderColor: 'var(--ov-border)',
              }}
              className="border p-3 rounded-xl"
            >
              <div style={{ color: 'var(--ov-text-muted)' }} className="text-[11px] flex items-center justify-between">
                <span>有效样本数</span>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <div className="text-lg font-bold text-emerald-400 font-mono mt-1">
                {validCount} <span style={{ color: 'var(--ov-text-muted)' }} className="text-xs font-normal">/ {totalRows}</span>
              </div>
              <div style={{ color: 'var(--ov-text-muted)' }} className="text-[10px] font-mono mt-0.5">
                完整率 {(completenessRatio * 100).toFixed(1)}%
              </div>
            </div>

            <div
              style={{
                backgroundColor: 'var(--ov-surface-header)',
                borderColor: 'var(--ov-border)',
              }}
              className="border p-3 rounded-xl"
            >
              <div style={{ color: 'var(--ov-text-muted)' }} className="text-[11px] flex items-center justify-between">
                <span>缺失值 / 空值</span>
                <AlertCircle className={`w-3.5 h-3.5 ${nullCount > 0 ? 'text-amber-400' : 'opacity-40'}`} />
              </div>
              <div className={`text-lg font-bold font-mono mt-1 ${nullCount > 0 ? 'text-amber-400' : ''}`} style={nullCount === 0 ? { color: 'var(--ov-text)' } : undefined}>
                {nullCount} <span style={{ color: 'var(--ov-text-muted)' }} className="text-xs font-normal">({((nullCount / (totalRows || 1)) * 100).toFixed(1)}%)</span>
              </div>
              <div style={{ color: 'var(--ov-text-muted)' }} className="text-[10px] font-mono mt-0.5">
                {nullCount === 0 ? '完美无缺失' : '需注意空单元格'}
              </div>
            </div>

            <div
              style={{
                backgroundColor: 'var(--ov-surface-header)',
                borderColor: 'var(--ov-border)',
              }}
              className="border p-3 rounded-xl"
            >
              <div style={{ color: 'var(--ov-text-muted)' }} className="text-[11px] flex items-center justify-between">
                <span>基数 / 唯一值</span>
                <Layers className="w-3.5 h-3.5 text-blue-400" />
              </div>
              <div className="text-lg font-bold text-blue-400 font-mono mt-1">
                {distinctCount}
              </div>
              <div style={{ color: 'var(--ov-text-muted)' }} className="text-[10px] font-mono mt-0.5">
                唯一值比率 {(uniquenessRatio * 100).toFixed(1)}%
              </div>
            </div>

            <div
              style={{
                backgroundColor: 'var(--ov-surface-header)',
                borderColor: 'var(--ov-border)',
              }}
              className="border p-3 rounded-xl"
            >
              <div style={{ color: 'var(--ov-text-muted)' }} className="text-[11px] flex items-center justify-between">
                <span>推断数据类型</span>
                <Hash className="w-3.5 h-3.5 text-purple-400" />
              </div>
              <div className="text-lg font-bold text-purple-400 font-mono uppercase mt-1">
                {type}
              </div>
              <div style={{ color: 'var(--ov-text-muted)' }} className="text-[10px] font-mono mt-0.5">
                RFC 4180 严格格式
              </div>
            </div>
          </div>

          {/* Section for Numeric Columns: Histogram & Statistics */}
          {type === 'number' && numericStats && (
            <div className="space-y-4">
              {/* Histogram Distribution Chart */}
              <div
                style={{
                  backgroundColor: 'var(--ov-surface-header)',
                  borderColor: 'var(--ov-border)',
                }}
                className="border p-4 rounded-xl space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BarChart2 className="w-4 h-4 text-emerald-400" />
                    <span style={{ color: 'var(--ov-text)' }} className="text-xs font-semibold">数据分布直方图 (Histogram)</span>
                  </div>
                  {hoveredBin !== null && numericStats.histogram[hoveredBin] && (
                    <span className="text-xs font-mono text-emerald-400">
                      区间 [{numericStats.histogram[hoveredBin].binStart.toFixed(1)} ~ {numericStats.histogram[hoveredBin].binEnd.toFixed(1)}]: {numericStats.histogram[hoveredBin].count} 个 ({numericStats.histogram[hoveredBin].percentage}%)
                    </span>
                  )}
                </div>

                <div
                  style={{
                    backgroundColor: 'var(--ov-surface)',
                    borderColor: 'var(--ov-border)',
                  }}
                  className="h-32 flex items-end gap-1.5 pt-4 pb-1 px-2 rounded-lg border"
                >
                  {numericStats.histogram.map((bin, idx) => {
                    const maxPct = Math.max(...numericStats.histogram.map(b => b.percentage), 1);
                    const heightPct = Math.max(4, (bin.percentage / maxPct) * 100);
                    const isHovered = hoveredBin === idx;

                    return (
                      <div
                        key={idx}
                        onMouseEnter={() => setHoveredBin(idx)}
                        onMouseLeave={() => setHoveredBin(null)}
                        className="flex-1 h-full flex flex-col justify-end items-center group relative cursor-pointer"
                      >
                        <div
                          style={{ height: `${heightPct}%` }}
                          className={`w-full rounded-t transition-all ${
                            isHovered
                              ? 'bg-emerald-400 shadow-lg shadow-emerald-500/40'
                              : 'bg-emerald-600/80 hover:bg-emerald-500'
                          }`}
                        />
                        <span style={{ color: 'var(--ov-text-muted)' }} className="text-[9px] font-mono mt-1 truncate w-full text-center">
                          {bin.binStart.toFixed(0)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Statistical Percentiles & Metrics Table */}
              <div
                style={{
                  backgroundColor: 'var(--ov-surface-header)',
                  borderColor: 'var(--ov-border)',
                }}
                className="border p-4 rounded-xl space-y-2"
              >
                <div style={{ borderColor: 'var(--ov-border)' }} className="flex items-center gap-2 text-xs font-semibold border-b pb-2">
                  <TrendingUp className="w-4 h-4 text-cyan-400" />
                  <span style={{ color: 'var(--ov-text)' }}>多维描述性统计指标 (Descriptive Statistics)</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 text-xs font-mono">
                  <div
                    style={{
                      backgroundColor: 'var(--ov-surface)',
                      borderColor: 'var(--ov-border)',
                    }}
                    className="p-2 rounded-lg border"
                  >
                    <span style={{ color: 'var(--ov-text-muted)' }} className="block text-[10px]">最小值 (Min)</span>
                    <span style={{ color: 'var(--ov-text)' }} className="font-bold text-sm">{numericStats.min}</span>
                  </div>
                  <div
                    style={{
                      backgroundColor: 'var(--ov-surface)',
                      borderColor: 'var(--ov-border)',
                    }}
                    className="p-2 rounded-lg border"
                  >
                    <span style={{ color: 'var(--ov-text-muted)' }} className="block text-[10px]">最大值 (Max)</span>
                    <span style={{ color: 'var(--ov-text)' }} className="font-bold text-sm">{numericStats.max}</span>
                  </div>
                  <div
                    style={{
                      backgroundColor: 'var(--ov-surface)',
                      borderColor: 'var(--ov-border)',
                    }}
                    className="p-2 rounded-lg border"
                  >
                    <span style={{ color: 'var(--ov-text-muted)' }} className="block text-[10px]">算术平均数 (Mean / Avg)</span>
                    <span className="text-emerald-400 font-bold text-sm">{numericStats.avg.toFixed(2)}</span>
                  </div>
                  <div
                    style={{
                      backgroundColor: 'var(--ov-surface)',
                      borderColor: 'var(--ov-border)',
                    }}
                    className="p-2 rounded-lg border"
                  >
                    <span style={{ color: 'var(--ov-text-muted)' }} className="block text-[10px]">中位数 (Median / P50)</span>
                    <span className="text-emerald-400 font-bold text-sm">{numericStats.median.toFixed(2)}</span>
                  </div>
                  <div
                    style={{
                      backgroundColor: 'var(--ov-surface)',
                      borderColor: 'var(--ov-border)',
                    }}
                    className="p-2 rounded-lg border"
                  >
                    <span style={{ color: 'var(--ov-text-muted)' }} className="block text-[10px]">下四分位数 (Q1 / P25)</span>
                    <span className="text-cyan-400 font-bold text-sm">{numericStats.p25.toFixed(2)}</span>
                  </div>
                  <div
                    style={{
                      backgroundColor: 'var(--ov-surface)',
                      borderColor: 'var(--ov-border)',
                    }}
                    className="p-2 rounded-lg border"
                  >
                    <span style={{ color: 'var(--ov-text-muted)' }} className="block text-[10px]">上四分位数 (Q3 / P75)</span>
                    <span className="text-cyan-400 font-bold text-sm">{numericStats.p75.toFixed(2)}</span>
                  </div>
                  <div
                    style={{
                      backgroundColor: 'var(--ov-surface)',
                      borderColor: 'var(--ov-border)',
                    }}
                    className="p-2 rounded-lg border"
                  >
                    <span style={{ color: 'var(--ov-text-muted)' }} className="block text-[10px]">标准差 (StdDev)</span>
                    <span className="text-purple-400 font-bold text-sm">{numericStats.stdDev.toFixed(2)}</span>
                  </div>
                  <div
                    style={{
                      backgroundColor: 'var(--ov-surface)',
                      borderColor: 'var(--ov-border)',
                    }}
                    className="p-2 rounded-lg border"
                  >
                    <span style={{ color: 'var(--ov-text-muted)' }} className="block text-[10px]">求和 (Sum)</span>
                    <span className="text-amber-400 font-bold text-sm">
                      {numericStats.sum >= 1e6 ? numericStats.sum.toExponential(2) : numericStats.sum.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Section for Categorical / String Columns: Top Frequency Values */}
          {(type === 'string' || type === 'boolean') && categoricalStats && (
            <div
              style={{
                backgroundColor: 'var(--ov-surface-header)',
                borderColor: 'var(--ov-border)',
              }}
              className="border p-4 rounded-xl space-y-3"
            >
              <div style={{ borderColor: 'var(--ov-border)' }} className="flex items-center justify-between border-b pb-2">
                <div className="flex items-center gap-2 text-xs font-semibold">
                  <AlignLeft className="w-4 h-4 text-blue-400" />
                  <span style={{ color: 'var(--ov-text)' }}>高频值排行与分布占比 (Top Frequency Values)</span>
                </div>
                <span style={{ color: 'var(--ov-text-muted)' }} className="text-[11px] font-mono">Top {categoricalStats.topValues.length} 项</span>
              </div>

              <div className="space-y-2.5 pt-1">
                {categoricalStats.topValues.map((top, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <div className="flex items-center gap-2 truncate">
                        <span
                          style={{
                            backgroundColor: 'var(--ov-surface)',
                            borderColor: 'var(--ov-border)',
                            color: 'var(--ov-text-muted)',
                          }}
                          className="w-4 h-4 rounded-full border text-[10px] flex items-center justify-center font-bold shrink-0"
                        >
                          {idx + 1}
                        </span>
                        <span style={{ color: 'var(--ov-text)' }} className="font-medium truncate" title={top.value}>
                          {top.value || <em style={{ color: 'var(--ov-text-muted)' }} className="font-normal">(空值)</em>}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span style={{ color: 'var(--ov-text-muted)' }}>{top.count} 次</span>
                        <span className="text-emerald-400 font-bold w-12 text-right">{top.percentage}%</span>
                        {onFilterValue && top.value && (
                          <button
                            onClick={() => {
                              onFilterValue(top.value);
                              onClose();
                            }}
                            style={{ color: 'var(--ov-text-muted)' }}
                            className="p-1 hover:text-blue-400 rounded transition"
                            title={`快速筛选包含 "${top.value}" 的行`}
                          >
                            <Filter className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                    {/* Progress Bar */}
                    <div
                      style={{ backgroundColor: 'var(--ov-surface)' }}
                      className="h-2 w-full rounded-full overflow-hidden"
                    >
                      <div
                        style={{ width: `${top.percentage}%` }}
                        className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full transition-all duration-500"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section for Date Columns */}
          {type === 'date' && dateStats && (
            <div
              style={{
                backgroundColor: 'var(--ov-surface-header)',
                borderColor: 'var(--ov-border)',
              }}
              className="border p-4 rounded-xl space-y-3"
            >
              <div style={{ borderColor: 'var(--ov-border)' }} className="flex items-center gap-2 text-xs font-semibold border-b pb-2">
                <Calendar className="w-4 h-4 text-amber-400" />
                <span style={{ color: 'var(--ov-text)' }}>时间序列区间与分布 (Date Temporal Range)</span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs font-mono pt-1">
                <div
                  style={{
                    backgroundColor: 'var(--ov-surface)',
                    borderColor: 'var(--ov-border)',
                  }}
                  className="p-3 rounded-xl border"
                >
                  <span style={{ color: 'var(--ov-text-muted)' }} className="block text-[10px]">起始日期 (Min Date)</span>
                  <span className="text-amber-400 font-bold text-sm">{dateStats.minDate}</span>
                </div>
                <div
                  style={{
                    backgroundColor: 'var(--ov-surface)',
                    borderColor: 'var(--ov-border)',
                  }}
                  className="p-3 rounded-xl border"
                >
                  <span style={{ color: 'var(--ov-text-muted)' }} className="block text-[10px]">截止日期 (Max Date)</span>
                  <span className="text-amber-400 font-bold text-sm">{dateStats.maxDate}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div
          style={{
            backgroundColor: 'var(--ov-surface-header)',
            borderTopColor: 'var(--ov-border)',
          }}
          className="flex items-center justify-between px-5 py-3 border-t text-xs"
        >
          <span style={{ color: 'var(--ov-text-muted)' }} className="font-mono text-[11px]">OmniView High-Performance Data Profiler</span>
          <button
            onClick={onClose}
            style={{
              backgroundColor: 'var(--ov-surface)',
              borderColor: 'var(--ov-border)',
              color: 'var(--ov-text)',
            }}
            className="px-4 py-1.5 border rounded-lg transition font-medium text-xs hover:border-[var(--ov-accent)]"
          >
            完成
          </button>
        </div>
      </div>
    </div>
  );
};
