import React, { useEffect, useRef } from 'react';
import type { PptxChartData } from '../../../lib/pptxEngine';

export interface PptxChartElementProps {
  chartData: PptxChartData;
  width: number;
  height: number;
  compact?: boolean;
}

const DEFAULT_PALETTE = ['#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#EC4899', '#06B6D4'];

export const PptxChartElement: React.FC<PptxChartElementProps> = ({
  chartData,
  width,
  height,
  compact = false,
}) => {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (compact) return;
    const host = hostRef.current;
    if (!host) return;

    let disposed = false;
    let chartInstance: { setOption: (opt: unknown) => void; resize: () => void; dispose: () => void } | null = null;

    const mountChart = async () => {
      try {
        const echarts = await import('echarts');
        if (disposed || !hostRef.current) return;

        const initW = Math.max(120, Math.round(width));
        const initH = Math.max(80, Math.round(height));
        chartInstance = echarts.init(hostRef.current, undefined, {
          renderer: 'svg',
          width: initW,
          height: initH,
        });

        const isPie = chartData.chartType === 'pie' || chartData.chartType === 'doughnut';
        const isHorizontalBar = chartData.chartType === 'bar';
        const isLineOrArea = chartData.chartType === 'line' || chartData.chartType === 'area';
        const isScatter = chartData.chartType === 'scatter';

        const palette = chartData.series.map(
          (s, idx) => s.color || DEFAULT_PALETTE[idx % DEFAULT_PALETTE.length]
        );

        let option: Record<string, unknown>;

        if (isPie) {
          const firstSeries = chartData.series[0];
          const pieData = chartData.categories.map((cat, idx) => ({
            name: cat,
            value: firstSeries?.values[idx] ?? 0,
          }));
          option = {
            color: DEFAULT_PALETTE,
            title: chartData.title
              ? {
                  text: chartData.title,
                  left: 'center',
                  top: 6,
                  textStyle: { fontSize: 13, fontWeight: 600, color: '#0F172A' },
                }
              : undefined,
            tooltip: { trigger: 'item' },
            legend: { bottom: 4, textStyle: { fontSize: 10, color: '#475569' } },
            series: [
              {
                name: firstSeries?.name || 'Data',
                type: 'pie',
                radius: chartData.chartType === 'doughnut' ? ['42%', '68%'] : '65%',
                center: ['50%', '52%'],
                data: pieData,
                label: { fontSize: 10, color: '#334155' },
              },
            ],
          };
        } else if (isScatter) {
          option = {
            color: palette,
            title: chartData.title
              ? {
                  text: chartData.title,
                  left: 'center',
                  top: 6,
                  textStyle: { fontSize: 13, fontWeight: 600, color: '#0F172A' },
                }
              : undefined,
            grid: { left: 42, right: 20, top: chartData.title ? 38 : 20, bottom: 32 },
            xAxis: { type: 'value', axisLabel: { fontSize: 10, color: '#64748B' } },
            yAxis: { type: 'value', axisLabel: { fontSize: 10, color: '#64748B' } },
            tooltip: { trigger: 'item' },
            series: chartData.series.map((s, idx) => ({
              name: s.name,
              type: 'scatter',
              data: s.values.map((v, i) => [i + 1, v]),
              itemStyle: { color: palette[idx] },
            })),
          };
        } else {
          const categoryAxis = {
            type: 'category',
            data: chartData.categories,
            axisLabel: { fontSize: 10, color: '#475569' },
            axisLine: { lineStyle: { color: '#CBD5E1' } },
          };
          const valueAxis = {
            type: 'value',
            axisLabel: { fontSize: 10, color: '#64748B' },
            splitLine: { lineStyle: { color: '#E2E8F0', type: 'dashed' } },
          };

          option = {
            color: palette,
            title: chartData.title
              ? {
                  text: chartData.title,
                  left: 'center',
                  top: 6,
                  textStyle: { fontSize: 13, fontWeight: 600, color: '#0F172A' },
                }
              : undefined,
            tooltip: { trigger: 'axis' },
            legend:
              chartData.series.length > 1
                ? { bottom: 4, textStyle: { fontSize: 10, color: '#475569' } }
                : undefined,
            grid: {
              left: 44,
              right: 18,
              top: chartData.title ? 40 : 20,
              bottom: chartData.series.length > 1 ? 36 : 26,
            },
            xAxis: isHorizontalBar ? valueAxis : categoryAxis,
            yAxis: isHorizontalBar ? categoryAxis : valueAxis,
            series: chartData.series.map((s, idx) => ({
              name: s.name,
              type: isLineOrArea ? 'line' : 'bar',
              data: s.values,
              smooth: chartData.chartType === 'area',
              areaStyle: chartData.chartType === 'area' ? { opacity: 0.25 } : undefined,
              itemStyle: { color: palette[idx], borderRadius: isLineOrArea ? 0 : [3, 3, 0, 0] },
              barMaxWidth: 28,
            })),
          };
        }

        chartInstance.setOption(option);
      } catch {
        // Fallback already handles compact or error states cleanly
      }
    };

    void mountChart();

    return () => {
      disposed = true;
      if (chartInstance) {
        try {
          chartInstance.dispose();
        } catch {
          // ignore
        }
      }
    };
  }, [chartData, compact, width, height]);

  if (compact) {
    const firstVals = chartData.series[0]?.values || [12, 24, 18];
    const maxVal = Math.max(1, ...firstVals);
    return (
      <div className="w-full h-full rounded border border-slate-200 bg-white/95 p-1 flex flex-col justify-between overflow-hidden">
        {chartData.title && (
          <div className="text-[8px] font-semibold text-slate-700 truncate text-center leading-none">
            {chartData.title}
          </div>
        )}
        <svg viewBox="0 0 100 50" className="w-full flex-1" preserveAspectRatio="none">
          {firstVals.slice(0, 6).map((v, i) => {
            const barW = Math.max(6, Math.floor(80 / Math.max(1, firstVals.length)));
            const barH = Math.max(4, Math.round((Math.max(0, v) / maxVal) * 40));
            const x = 10 + i * (barW + 4);
            const y = 46 - barH;
            return (
              <rect
                key={i}
                x={x}
                y={y}
                width={barW}
                height={barH}
                rx={1.5}
                fill={chartData.series[0]?.color || DEFAULT_PALETTE[i % DEFAULT_PALETTE.length]}
              />
            );
          })}
        </svg>
      </div>
    );
  }

  return (
    <div
      className="w-full h-full rounded-lg border border-slate-200 bg-white/95 overflow-hidden relative"
      aria-label={chartData.title || 'PPTX Chart'}
    >
      <div ref={hostRef} style={{ width: `${Math.max(120, width)}px`, height: `${Math.max(80, height)}px` }} />
    </div>
  );
};
