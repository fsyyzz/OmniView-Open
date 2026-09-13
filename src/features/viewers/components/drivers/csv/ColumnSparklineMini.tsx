/**
 * 表头数据画像微图 (Header Sparkline & Profiling Micro-Chart)
 * 渲染极其精细、GPU 加速的 SVG 趋势折线、直方图微图与分类分布条
 */
import React, { useMemo } from 'react';
import { ColumnProfile, generateSparklineSvgPath } from './csvProfiling';
import { BarChart3, Hash, AlignLeft, Calendar, CheckSquare, Info } from 'lucide-react';

interface ColumnSparklineMiniProps {
  profile: ColumnProfile;
  onClickInspect?: (profile: ColumnProfile) => void;
}

export const ColumnSparklineMini: React.FC<ColumnSparklineMiniProps> = ({
  profile,
  onClickInspect,
}) => {
  const { type, numericStats, categoricalStats, dateStats, nullCount, totalRows } = profile;

  // 生成 Sparkline SVG 路径
  const sparklineData = useMemo(() => {
    if (numericStats?.sparklinePoints && numericStats.sparklinePoints.length > 0) {
      return generateSparklineSvgPath(numericStats.sparklinePoints, 90, 24, 2);
    }
    if (dateStats?.sparklinePoints && dateStats.sparklinePoints.length > 0) {
      return generateSparklineSvgPath(dateStats.sparklinePoints, 90, 24, 2);
    }
    return null;
  }, [numericStats, dateStats]);

  // 类型图标与颜色配置
  const typeBadgeConfig = useMemo(() => {
    switch (type) {
      case 'number':
        return {
          icon: <Hash className="w-2.5 h-2.5" />,
          label: 'NUM',
          color: 'text-emerald-400 bg-emerald-950/80 border-emerald-700/60',
          chartColor: '#10b981',
          fillGradient: 'url(#sparkline-emerald-grad)',
        };
      case 'date':
        return {
          icon: <Calendar className="w-2.5 h-2.5" />,
          label: 'DATE',
          color: 'text-amber-400 bg-amber-950/80 border-amber-700/60',
          chartColor: '#f59e0b',
          fillGradient: 'url(#sparkline-amber-grad)',
        };
      case 'boolean':
        return {
          icon: <CheckSquare className="w-2.5 h-2.5" />,
          label: 'BOOL',
          color: 'text-purple-400 bg-purple-950/80 border-purple-700/60',
          chartColor: '#a855f7',
          fillGradient: 'url(#sparkline-purple-grad)',
        };
      default:
        return {
          icon: <AlignLeft className="w-2.5 h-2.5" />,
          label: 'STR',
          color: 'text-blue-400 bg-blue-950/80 border-blue-700/60',
          chartColor: '#38bdf8',
          fillGradient: 'url(#sparkline-blue-grad)',
        };
    }
  }, [type]);

  const nullPercentage = totalRows > 0 ? ((nullCount / totalRows) * 100).toFixed(0) : '0';

  return (
    <div
      onClick={e => {
        e.stopPropagation();
        onClickInspect?.(profile);
      }}
      className="mt-1.5 pt-1.5 border-t border-slate-800/80 flex flex-col gap-1 cursor-pointer group/spark hover:bg-slate-800/60 -mx-1 px-1.5 py-1 rounded transition select-none"
      title="点击查看此列深度数据画像 (Histogram / 极值 / 统计指标 / 分类透视)"
    >
      {/* Top row: Type badge + Compact metrics */}
      <div className="flex items-center justify-between gap-1 text-[10px] font-mono leading-none">
        <span
          className={`flex items-center gap-0.5 px-1 py-0.5 rounded border text-[9px] font-semibold tracking-wider ${typeBadgeConfig.color}`}
        >
          {typeBadgeConfig.icon}
          <span>{typeBadgeConfig.label}</span>
        </span>

        {type === 'number' && numericStats && (
          <span className="text-slate-400 truncate text-[10px]" title={`均值: ${numericStats.avg.toFixed(2)}, 极值: [${numericStats.min}, ${numericStats.max}]`}>
            μ={numericStats.avg >= 1000 ? numericStats.avg.toExponential(1) : numericStats.avg.toFixed(1)}
          </span>
        )}

        {(type === 'string' || type === 'boolean') && (
          <span className="text-slate-400 truncate text-[10px]" title={`唯一值数: ${profile.distinctCount}`}>
            基数:{profile.distinctCount}
          </span>
        )}

        {type === 'date' && dateStats && (
          <span className="text-slate-400 truncate text-[10px]" title={`时间跨度: ${dateStats.minDate} ~ ${dateStats.maxDate}`}>
            {dateStats.minDate.slice(0, 7)}
          </span>
        )}

        <Info className="w-2.5 h-2.5 text-slate-500 group-hover/spark:text-emerald-400 transition shrink-0 opacity-0 group-hover/spark:opacity-100" />
      </div>

      {/* Middle row: SVG Sparkline or Distribution Bar */}
      <div className="h-6 w-full flex items-center justify-center relative overflow-hidden rounded bg-slate-950/70 border border-slate-800/60 group-hover/spark:border-slate-700 transition">
        {type === 'number' && sparklineData && sparklineData.linePath ? (
          <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 90 24">
            <defs>
              <linearGradient id="sparkline-emerald-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.45" />
                <stop offset="100%" stopColor="#10b981" stopOpacity="0.02" />
              </linearGradient>
            </defs>
            {/* Area fill */}
            <path d={sparklineData.areaPath} fill={typeBadgeConfig.fillGradient} />
            {/* Trend line */}
            <path
              d={sparklineData.linePath}
              fill="none"
              stroke={typeBadgeConfig.chartColor}
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : type === 'date' && sparklineData && sparklineData.linePath ? (
          <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 90 24">
            <defs>
              <linearGradient id="sparkline-amber-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.45" />
                <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.02" />
              </linearGradient>
            </defs>
            <path d={sparklineData.areaPath} fill={typeBadgeConfig.fillGradient} />
            <path
              d={sparklineData.linePath}
              fill="none"
              stroke={typeBadgeConfig.chartColor}
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : (type === 'string' || type === 'boolean') && categoricalStats && categoricalStats.topValues.length > 0 ? (
          /* Multi-segment Categorical Stacked Distribution Bar */
          <div className="w-full h-full p-1 flex items-center gap-0.5">
            {categoricalStats.topValues.slice(0, 4).map((top, idx) => {
              const bgColors = [
                'bg-blue-500/80 hover:bg-blue-400',
                'bg-indigo-500/80 hover:bg-indigo-400',
                'bg-violet-500/80 hover:bg-violet-400',
                'bg-slate-600/80 hover:bg-slate-500',
              ];
              const clampedWidth = Math.max(8, top.percentage);
              return (
                <div
                  key={idx}
                  style={{ width: `${clampedWidth}%` }}
                  className={`h-3.5 rounded-sm ${bgColors[idx % bgColors.length]} transition relative flex items-center justify-center text-[8px] text-white/90 font-mono font-bold truncate`}
                  title={`${top.value || '(空)'}: ${top.count} (${top.percentage}%)`}
                >
                  {clampedWidth > 22 && <span className="px-0.5 truncate">{top.value}</span>}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-[10px] text-slate-600 flex items-center gap-1 font-mono">
            <BarChart3 className="w-3 h-3" />
            <span>无有效数据</span>
          </div>
        )}
      </div>

      {/* Bottom row: Completeness Gauge */}
      <div className="flex items-center justify-between text-[9px] font-mono text-slate-500">
        <span className="flex items-center gap-1">
          <span
            className={`inline-block w-1.5 h-1.5 rounded-full ${
              profile.nullCount === 0 ? 'bg-emerald-400' : 'bg-amber-400'
            }`}
          />
          <span>有效 {(profile.completenessRatio * 100).toFixed(0)}%</span>
        </span>
        {nullCount > 0 && <span className="text-amber-400/80">缺 {nullCount}</span>}
      </div>
    </div>
  );
};
