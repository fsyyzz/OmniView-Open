/**
 * Markdown 表格轻量级数据可视化组件 (TableChart)
 * 原生 SVG 绘制高响应柱状图与折线图，支持维度与指标动态切换、悬浮数值感知与极值标记
 */
import React, { useState, useMemo } from 'react';
import { BarChart3, LineChart as LineChartIcon } from 'lucide-react';
import { parseNumericValue } from './tableUtils';
import { Locale, t } from '../../../../../shared/lib/i18n';

export interface TableChartProps {
  headers: string[];
  rows: string[][];
  defaultLabelCol: number;
  defaultValueCols: number[];
  isDarkTheme?: boolean;
  locale?: Locale;
}

const PALETTE = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ec4899', // pink
  '#8b5cf6', // purple
  '#06b6d4', // cyan
];

export const TableChart: React.FC<TableChartProps> = ({
  headers,
  rows,
  defaultLabelCol,
  defaultValueCols,
  isDarkTheme = true,
  locale = 'zh-CN',
}) => {
  const [chartType, setChartType] = useState<'bar' | 'line'>('bar');
  const [selectedLabelCol, setSelectedLabelCol] = useState(defaultLabelCol);
  const [selectedValueCol, setSelectedValueCol] = useState(defaultValueCols[0] ?? 1);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // 解析并提取有效数据点
  const chartData = useMemo(() => {
    return rows
      .map((row, idx) => {
        const rawLabel = (row[selectedLabelCol] || `Row ${idx + 1}`)
          .replace(/[*_`~]/g, '')
          .trim();
        const rawVal = row[selectedValueCol] || '';
        const num = parseNumericValue(rawVal);
        return {
          id: idx,
          label: rawLabel || `#${idx + 1}`,
          value: num !== null ? num : 0,
          rawVal,
        };
      })
      .slice(0, 40); // 最多展示前 40 组，保持视觉清晰
  }, [rows, selectedLabelCol, selectedValueCol]);

  // 计算最大值、最小值与跨度
  const { minVal, maxVal } = useMemo(() => {
    if (chartData.length === 0) return { minVal: 0, maxVal: 100 };
    let min = 0;
    let max = -Infinity;
    for (const d of chartData) {
      if (d.value < min) min = d.value;
      if (d.value > max) max = d.value;
    }
    if (max === -Infinity) max = 100;
    if (max === min) max = min + 10;
    // 留出 10% 顶部间隙
    return { minVal: min, maxVal: max * 1.1 };
  }, [chartData]);

  // SVG 坐标系统
  const width = 760;
  const height = 280;
  const padding = { top: 30, right: 30, bottom: 45, left: 60 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;

  const getY = (val: number) => {
    const range = maxVal - minVal || 1;
    const ratio = (val - minVal) / range;
    return padding.top + innerHeight - ratio * innerHeight;
  };

  const getX = (idx: number) => {
    if (chartData.length <= 1) return padding.left + innerWidth / 2;
    const step = innerWidth / (chartData.length - 1);
    return padding.left + idx * step;
  };

  const barWidth = useMemo(() => {
    if (chartData.length === 0) return 20;
    const totalSlot = innerWidth / chartData.length;
    return Math.max(Math.min(totalSlot * 0.65, 36), 6);
  }, [chartData.length, innerWidth]);

  // 折线图路径生成
  const linePoints = useMemo(() => {
    return chartData.map((d, idx) => `${getX(idx)},${getY(d.value)}`).join(' ');
  }, [chartData, getX, getY]);

  const activeColor = PALETTE[selectedValueCol % PALETTE.length];

  return (
    <div
      className={`p-4 rounded-lg border my-2 transition-all ${
        isDarkTheme ? 'bg-slate-900/70 border-slate-700/80 text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-800'
      }`}
    >
      {/* 顶部控制栏：切换维度、指标与图表类型 */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-700/40 text-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">{t('tableChartXAxis', locale)}:</span>
            <select
              value={selectedLabelCol}
              onChange={e => setSelectedLabelCol(Number(e.target.value))}
              aria-label={t('tableChartXAxis', locale)}
              className="bg-slate-800/80 border border-slate-600/70 rounded px-2 py-1 text-slate-200 focus:outline-none focus:border-blue-500"
            >
              {headers.map((h, i) => (
                <option key={i} value={i}>
                  {h || `Col ${i + 1}`}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">{t('tableChartYAxis', locale)}:</span>
            <select
              value={selectedValueCol}
              onChange={e => setSelectedValueCol(Number(e.target.value))}
              aria-label={t('tableChartYAxis', locale)}
              className="bg-slate-800/80 border border-slate-600/70 rounded px-2 py-1 text-slate-200 focus:outline-none focus:border-blue-500"
            >
              {headers.map((h, i) => (
                <option key={i} value={i}>
                  {h || `Col ${i + 1}`}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 图表形态切换 */}
        <div className="flex items-center bg-slate-800/70 p-0.5 rounded border border-slate-700/80">
          <button
            type="button"
            onClick={() => setChartType('bar')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs transition-all ${
              chartType === 'bar' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
            title={t('tableChartBar', locale)}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>{t('tableChartBar', locale)}</span>
          </button>
          <button
            type="button"
            onClick={() => setChartType('line')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs transition-all ${
              chartType === 'line' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
            title={t('tableChartLine', locale)}
          >
            <LineChartIcon className="w-3.5 h-3.5" />
            <span>{t('tableChartLine', locale)}</span>
          </button>
        </div>
      </div>

      {/* 图表主视口 (SVG 响应式渲染) */}
      <div className="w-full overflow-x-auto relative">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto max-h-[340px] select-none"
          style={{ minWidth: '460px' }}
        >
          {/* 网格水平参考线 */}
          {[0, 0.25, 0.5, 0.75, 1].map(ratio => {
            const y = padding.top + innerHeight * (1 - ratio);
            const val = (minVal + (maxVal - minVal) * ratio).toFixed(
              maxVal > 100 ? 0 : 1
            );
            return (
              <g key={ratio}>
                <line
                  x1={padding.left}
                  y1={y}
                  x2={width - padding.right}
                  y2={y}
                  stroke={isDarkTheme ? 'rgba(148, 163, 184, 0.15)' : 'rgba(148, 163, 184, 0.25)'}
                  strokeDasharray="4 4"
                />
                <text
                  x={padding.left - 8}
                  y={y + 4}
                  textAnchor="end"
                  fontSize="10"
                  fill={isDarkTheme ? '#94a3b8' : '#64748b'}
                  fontFamily="sans-serif"
                >
                  {val}
                </text>
              </g>
            );
          })}

          {/* 柱状图模式 */}
          {chartType === 'bar' &&
            chartData.map((d, idx) => {
              const slotX = padding.left + (idx + 0.5) * (innerWidth / chartData.length);
              const x = slotX - barWidth / 2;
              const y = getY(Math.max(d.value, 0));
              const zeroY = getY(0);
              const barH = Math.max(Math.abs(zeroY - y), 2);
              const isHovered = hoveredIndex === idx;

              return (
                <g
                  key={d.id}
                  className="cursor-pointer transition-all"
                  onMouseEnter={() => setHoveredIndex(idx)}
                  onMouseLeave={() => setHoveredIndex(null)}
                >
                  <rect
                    x={x}
                    y={Math.min(y, zeroY)}
                    width={barWidth}
                    height={barH}
                    rx="3"
                    fill={activeColor}
                    fillOpacity={isHovered ? 1 : 0.8}
                    stroke={isHovered ? '#ffffff' : 'transparent'}
                    strokeWidth="1.5"
                  />
                  {/* 柱顶数值显示 */}
                  {(isHovered || chartData.length <= 12) && (
                    <text
                      x={slotX}
                      y={Math.min(y, zeroY) - 5}
                      textAnchor="middle"
                      fontSize="10"
                      fontWeight="bold"
                      fill={isDarkTheme ? '#f1f5f9' : '#0f172a'}
                    >
                      {d.value}
                    </text>
                  )}
                  {/* X 轴标签 */}
                  <text
                    x={slotX}
                    y={height - 12}
                    textAnchor="middle"
                    fontSize="10"
                    fill={isHovered ? (isDarkTheme ? '#ffffff' : '#0f172a') : (isDarkTheme ? '#94a3b8' : '#64748b')}
                  >
                    {d.label.length > 8 ? `${d.label.slice(0, 7)}…` : d.label}
                  </text>
                </g>
              );
            })}

          {/* 折线图模式 */}
          {chartType === 'line' && (
            <g>
              {/* 面积半透明底色 */}
              <polygon
                points={`${padding.left},${getY(0)} ${linePoints} ${getX(chartData.length - 1)},${getY(0)}`}
                fill={activeColor}
                fillOpacity="0.15"
              />
              {/* 核心折线 */}
              <polyline
                fill="none"
                stroke={activeColor}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={linePoints}
              />
              {/* 数据节点圆点 */}
              {chartData.map((d, idx) => {
                const cx = getX(idx);
                const cy = getY(d.value);
                const isHovered = hoveredIndex === idx;

                return (
                  <g
                    key={d.id}
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredIndex(idx)}
                    onMouseLeave={() => setHoveredIndex(null)}
                  >
                    <circle
                      cx={cx}
                      cy={cy}
                      r={isHovered ? 6 : 4}
                      fill={activeColor}
                      stroke={isDarkTheme ? '#0f172a' : '#ffffff'}
                      strokeWidth="2"
                    />
                    {isHovered && (
                      <text
                        x={cx}
                        y={cy - 10}
                        textAnchor="middle"
                        fontSize="11"
                        fontWeight="bold"
                        fill={isDarkTheme ? '#f8fafc' : '#0f172a'}
                      >
                        {d.value}
                      </text>
                    )}
                    {/* X 轴标签 */}
                    <text
                      x={cx}
                      y={height - 12}
                      textAnchor="middle"
                      fontSize="10"
                      fill={isHovered ? (isDarkTheme ? '#ffffff' : '#0f172a') : (isDarkTheme ? '#94a3b8' : '#64748b')}
                    >
                      {d.label.length > 8 ? `${d.label.slice(0, 7)}…` : d.label}
                    </text>
                  </g>
                );
              })}
            </g>
          )}
        </svg>

        {/* 悬停浮层气泡 */}
        {hoveredIndex !== null && chartData[hoveredIndex] && (
          <div
            className="absolute pointer-events-none px-2.5 py-1.5 rounded bg-slate-950/95 border border-slate-700 text-xs text-white shadow-xl z-20 backdrop-blur-sm"
            style={{
              left: `${Math.min(Math.max((hoveredIndex / chartData.length) * 100, 10), 85)}%`,
              top: '12px',
              transform: 'translateX(-50%)',
            }}
          >
            <div className="font-medium text-slate-300">{chartData[hoveredIndex].label}</div>
            <div className="text-blue-400 font-mono font-bold mt-0.5">
              {headers[selectedValueCol] || 'Value'}: {chartData[hoveredIndex].rawVal || chartData[hoveredIndex].value}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
