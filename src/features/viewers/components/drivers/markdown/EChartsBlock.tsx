/**
 * OmniView — 现代化 Apache ECharts 动态矢量渲染块 (EChartsBlock)
 * 核心特性：
 * 1. 动态异步分块载入 (Dynamic Code-Splitting)，首屏零额外体积；
 * 2. 默认启用矢量 SVG 渲染模式 (renderer: 'svg')，4K Retina 极清缩放不失真；
 * 3. 响应式 ResizeObserver 容器监听，自适应并排分屏与 >[!CARDS:列数] 多列仪表盘；
 * 4. 深度契合 --ov-* 语义设计令牌，主题暗黑/明亮无缝融合；
 * 5. 全屏居中灯箱 (Lightbox) 放大与矢量 SVG / PNG 高清导出；
 * 6. 生命周期严格管控，卸载自动 dispose 杜绝内存泄漏。
 */
import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import {
  Maximize2,
  Download,
  Copy,
  Check,
  RefreshCw,
  AlertTriangle,
  Code2,
} from 'lucide-react';
import { ThemeId } from '../../../../../shared/types';
import {
  getOmniViewEchartsTheme,
  parseEChartsOption,
  type ParsedEChartsResult,
} from '../../../lib/echartsTheme';

export interface EChartsBlockProps {
  id: string;
  raw: string;
  langSuffix?: string;
  isDarkTheme?: boolean;
  theme?: ThemeId;
  onOpenLightbox?: (item: {
    type: string;
    title: string;
    content: string;
    svgContent?: string;
    raw?: string;
  }) => void;
  /** 卡片网格微布局紧凑模式 */
  isCompactCard?: boolean;
}

export const EChartsBlock: React.FC<EChartsBlockProps> = ({
  id,
  raw,
  langSuffix,
  isDarkTheme = true,
  theme,
  onOpenLightbox,
  isCompactCard = false,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartInstanceRef = useRef<any>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [isSourceVisible, setIsSourceVisible] = useState(false);

  // 1. 解析选项与推断类型
  const parsedResult: ParsedEChartsResult = useMemo(() => {
    return parseEChartsOption(raw, langSuffix);
  }, [raw, langSuffix]);

  // 2. 初始化与重绘 ECharts
  useEffect(() => {
    let isCancelled = false;

    if (parsedResult.error) {
      setIsLoading(false);
      return;
    }

    const initChart = async () => {
      try {
        setIsLoading(true);
        // 按需动态载入 ECharts 核心库
        const echarts = await import('echarts');
        if (isCancelled || !containerRef.current) return;

        // 销毁旧实例以防复用泄露
        if (chartInstanceRef.current) {
          chartInstanceRef.current.dispose();
          chartInstanceRef.current = null;
        }

        // 获取当前主题令牌配置
        const themeConfig = getOmniViewEchartsTheme(isDarkTheme, theme);

        // 注册 OmniView 动态主题 (唯一主题键名确保动态切换实时生效)
        const effectiveThemeKey = theme || (isDarkTheme ? 'dark' : 'light');
        const themeName = `ov-echarts-${effectiveThemeKey}-${Date.now()}`;
        echarts.registerTheme(themeName, themeConfig);

        // 优先采用 SVG 渲染器保证绝对矢量高清
        const chart = echarts.init(containerRef.current, themeName, {
          renderer: 'svg',
          useDirtyRect: true,
        });
        chartInstanceRef.current = chart;

        // 应用配置
        chart.setOption(parsedResult.option, true);
        setIsLoading(false);
      } catch (err: any) {
        if (!isCancelled) {
          console.warn('[OmniView ECharts] 渲染异常:', err);
          setLoadError(err?.message || '图表初始化失败');
          setIsLoading(false);
        }
      }
    };

    initChart();

    return () => {
      isCancelled = true;
      if (chartInstanceRef.current) {
        chartInstanceRef.current.dispose();
        chartInstanceRef.current = null;
      }
    };
  }, [parsedResult, isDarkTheme, theme]);

  // 3. 响应式容器尺寸监听 (ResizeObserver)，关键适配 >[!CARDS:列数] 拖拽缩放
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let resizeTimer: number | null = null;
    const observer = new ResizeObserver(() => {
      if (chartInstanceRef.current) {
        if (resizeTimer !== null) {
          window.cancelAnimationFrame(resizeTimer);
        }
        resizeTimer = window.requestAnimationFrame(() => {
          chartInstanceRef.current?.resize({
            animation: { duration: 200, easing: 'cubicOut' },
          });
        });
      }
    });

    observer.observe(el);

    return () => {
      observer.disconnect();
      if (resizeTimer !== null) {
        window.cancelAnimationFrame(resizeTimer);
      }
    };
  }, []);

  // 复制原始代码
  const handleCopyCode = useCallback(() => {
    navigator.clipboard.writeText(raw).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    });
  }, [raw]);

  // 导出高清 SVG / PNG
  const handleExport = useCallback((format: 'svg' | 'png') => {
    if (!chartInstanceRef.current) return;
    try {
      if (format === 'svg') {
        const svgEl = containerRef.current?.querySelector('svg');
        if (svgEl) {
          const svgData = new XMLSerializer().serializeToString(svgEl);
          const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `echarts-export-${Date.now()}.svg`;
          a.click();
          URL.revokeObjectURL(url);
          return;
        }
      }

      // PNG 导出 fallback
      const dataUrl = chartInstanceRef.current.getDataURL({
        type: 'png',
        pixelRatio: 2,
        backgroundColor: isDarkTheme ? '#0f172a' : '#ffffff',
      });
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `echarts-export-${Date.now()}.png`;
      a.click();
    } catch (err) {
      console.warn('[OmniView ECharts] 导出失败:', err);
    }
  }, [isDarkTheme]);

  // 全屏灯箱放大
  const handleOpenLightbox = useCallback(() => {
    if (!onOpenLightbox) return;
    const svgEl = containerRef.current?.querySelector('svg');
    const svgContent = svgEl ? new XMLSerializer().serializeToString(svgEl) : undefined;

    onOpenLightbox({
      type: 'echarts',
      title: parsedResult.typeLabel || 'ECharts 矢量全景',
      content: raw,
      svgContent,
      raw,
    });
  }, [onOpenLightbox, parsedResult, raw]);

  // 语法错误呈现卡片
  if (parsedResult.error || loadError) {
    const errorText = parsedResult.error || loadError;
    return (
      <div className="my-3 rounded-lg border border-rose-500/30 bg-rose-500/5 p-4 text-sm text-rose-300">
        <div className="flex items-center gap-2 font-medium text-rose-400 mb-2">
          <AlertTriangle className="h-4 w-4" />
          <span>ECharts 语法或配置解析异常</span>
        </div>
        <p className="font-mono text-xs opacity-90 mb-3">{errorText}</p>
        <div className="rounded bg-black/20 p-2 font-mono text-xs text-slate-400 overflow-x-auto">
          <pre>{raw}</pre>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`markdown-diagram markdown-diagram-echarts group relative my-3 rounded-xl border transition-all ${
        isCompactCard ? 'my-1 rounded-lg !border-transparent !bg-transparent !shadow-none' : ''
      }`}
      style={{
        backgroundColor: isCompactCard ? 'transparent' : 'var(--ov-surface)',
        borderColor: isCompactCard ? 'transparent' : 'var(--ov-border)',
        boxShadow: isCompactCard ? 'none' : 'var(--ov-shadow)',
      }}
    >
      {/* 顶部微型悬浮操作栏 */}
      <div
        className="flex items-center justify-between border-b px-3 py-1.5 text-xs rounded-t-xl transition-colors"
        style={{
          backgroundColor: isCompactCard ? 'transparent' : 'var(--ov-surface-header)',
          borderColor: 'var(--ov-border)',
          color: 'var(--ov-text-secondary)',
        }}
      >
        <span className="flex items-center gap-1.5 font-medium" style={{ color: 'var(--ov-accent)' }}>
          <span className="inline-block h-2 w-2 rounded-full animate-pulse" style={{ backgroundColor: 'var(--ov-accent)' }} />
          {parsedResult.typeLabel}
        </span>

        <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={() => setIsSourceVisible((prev) => !prev)}
            title="查看/隐藏 JSON 配置"
            className="rounded p-1 transition cursor-pointer hover:bg-[var(--ov-surface-hover)]"
            style={{
              color: isSourceVisible ? 'var(--ov-accent)' : 'var(--ov-text-secondary)',
              backgroundColor: isSourceVisible ? 'var(--ov-accent-subtle, rgba(125,125,125,0.15))' : 'transparent',
            }}
          >
            <Code2 className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            onClick={handleCopyCode}
            title="复制配置"
            className="rounded p-1 transition cursor-pointer hover:bg-[var(--ov-surface-hover)]"
            style={{ color: 'var(--ov-text-secondary)' }}
          >
            {isCopied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
          </button>

          <button
            type="button"
            onClick={() => handleExport('svg')}
            title="导出为矢量 SVG"
            className="rounded p-1 transition cursor-pointer hover:bg-[var(--ov-surface-hover)]"
            style={{ color: 'var(--ov-text-secondary)' }}
          >
            <Download className="h-3.5 w-3.5" />
          </button>

          {onOpenLightbox && (
            <button
              type="button"
              onClick={handleOpenLightbox}
              title="全屏居中放大灯箱"
              className="rounded p-1 transition cursor-pointer hover:bg-[var(--ov-surface-hover)]"
              style={{ color: 'var(--ov-text-secondary)' }}
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* 源码配置折叠面板 */}
      {isSourceVisible && (
        <div
          className="border-b p-3 font-mono text-xs max-h-56 overflow-y-auto"
          style={{
            backgroundColor: 'var(--ov-code-bg)',
            borderColor: 'var(--ov-border)',
            color: 'var(--ov-code-color, var(--ov-text))',
          }}
        >
          <pre className="!m-0 !p-0 !bg-transparent">{raw}</pre>
        </div>
      )}

      {/* 图表真实渲染画布容器 */}
      <div className="relative p-2" onDoubleClick={handleOpenLightbox}>
        {isLoading && (
          <div
            className="absolute inset-0 z-10 flex items-center justify-center backdrop-blur-xs rounded-b-xl"
            style={{ backgroundColor: 'color-mix(in srgb, var(--ov-bg) 60%, transparent)' }}
          >
            <RefreshCw className="h-5 w-5 animate-spin opacity-80" style={{ color: 'var(--ov-accent)' }} />
          </div>
        )}
        <div
          ref={containerRef}
          className="w-full"
          style={{
            height: isCompactCard ? '240px' : '360px',
            minHeight: isCompactCard ? '200px' : '280px',
          }}
        />
      </div>
    </div>
  );
};
