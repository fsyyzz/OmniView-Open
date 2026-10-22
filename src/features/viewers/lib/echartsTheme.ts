/**
 * OmniView — Apache ECharts 主题令牌与配置解析器
 * 核心特性：
 * 1. 深度绑定 --ov-* 语义设计令牌与 VS Code 原生配色体系；
 * 2. 安全 JSON / YAML 配置解析（杜绝 eval 与代码注入）；
 * 3. 语法糖模板自动补全（支持精简数据一键转为标准图表）；
 * 4. 自动推断主图表类型（折线、柱状、饼图、仪表盘、雷达图等）与展示徽章。
 */
import { load as loadYaml } from 'js-yaml';

export interface EChartsThemeConfig {
  color: string[];
  backgroundColor: string;
  textStyle: { fontFamily: string; color: string };
  title: { textStyle: { color: string }; subtextStyle: { color: string } };
  legend: { textStyle: { color: string } };
  tooltip: {
    backgroundColor: string;
    borderColor: string;
    textStyle: { color: string };
  };
  axisPointer: { lineStyle: { color: string } };
  categoryAxis: {
    axisLine: { lineStyle: { color: string } };
    axisLabel: { color: string };
    splitLine: { show: boolean };
  };
  valueAxis: {
    axisLine: { lineStyle: { color: string } };
    axisLabel: { color: string };
    splitLine: { lineStyle: { color: string } };
  };
}

/**
 * 现代高辨识度图表配色调色板 (Dark & Light 通用自适应)
 */
const ECHARTS_PALETTE = [
  '#38bdf8', // 蔚蓝
  '#818cf8', // 靛青
  '#34d399', // 翡翠
  '#fbbf24', // 琥珀
  '#f472b6', // 樱花粉
  '#a78bfa', // 紫罗兰
  '#fb7185', // 珊瑚红
  '#2dd4bf', // 青翠
  '#60a5fa', // 天蓝
  '#c084fc', // 亮紫
];

/**
 * 获取与当前主题深度贴合的 ECharts 主题配置
 */
export function getOmniViewEchartsTheme(isDark = true): EChartsThemeConfig {
  let textColor = isDark ? '#e2e8f0' : '#1e293b';
  let subtextColor = isDark ? '#94a3b8' : '#64748b';
  let borderColor = isDark ? '#334155' : '#cbd5e1';
  let splitLineColor = isDark ? 'rgba(51, 65, 85, 0.45)' : 'rgba(226, 232, 240, 0.8)';
  let tooltipBg = isDark ? 'rgba(15, 23, 42, 0.92)' : 'rgba(255, 255, 255, 0.96)';

  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    const computed = window.getComputedStyle(document.documentElement);
    const ovText = computed.getPropertyValue('--ov-text').trim();
    const ovTextSecondary = computed.getPropertyValue('--ov-text-secondary').trim();
    const ovBorder = computed.getPropertyValue('--ov-border').trim();
    const ovBgElevated = computed.getPropertyValue('--ov-bg-elevated').trim();

    if (ovText) textColor = ovText;
    if (ovTextSecondary) subtextColor = ovTextSecondary;
    if (ovBorder) {
      borderColor = ovBorder;
      splitLineColor = ovBorder.includes('rgba') ? ovBorder : `${ovBorder}80`;
    }
    if (ovBgElevated) tooltipBg = ovBgElevated;
  }

  return {
    color: ECHARTS_PALETTE,
    backgroundColor: 'transparent',
    textStyle: {
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      color: textColor,
    },
    title: {
      textStyle: { color: textColor },
      subtextStyle: { color: subtextColor },
    },
    legend: {
      textStyle: { color: subtextColor },
    },
    tooltip: {
      backgroundColor: tooltipBg,
      borderColor: borderColor,
      textStyle: { color: textColor },
    },
    axisPointer: {
      lineStyle: { color: borderColor },
    },
    categoryAxis: {
      axisLine: { lineStyle: { color: borderColor } },
      axisLabel: { color: subtextColor },
      splitLine: { show: false },
    },
    valueAxis: {
      axisLine: { lineStyle: { color: borderColor } },
      axisLabel: { color: subtextColor },
      splitLine: { lineStyle: { color: splitLineColor } },
    },
  };
}

export interface ParsedEChartsResult {
  option: Record<string, any>;
  primaryType: string;
  typeLabel: string;
  error?: string;
}

/**
 * 安全解析 ECharts 选项字符串 (支持 JSON 与 YAML)
 * 同时提供语言后缀语法糖自动包装机制
 */
export function parseEChartsOption(raw: string, langSuffix?: string): ParsedEChartsResult {
  if (!raw || typeof raw !== 'string') {
    return {
      option: {},
      primaryType: 'unknown',
      typeLabel: '未知图表',
      error: '配置内容为空',
    };
  }

  const trimmed = raw.trim();
  let parsed: any = null;

  // 1. 尝试 JSON 解析
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    // 2. 尝试 YAML 解析
    try {
      parsed = loadYaml(trimmed);
    } catch (yamlErr: any) {
      return {
        option: {},
        primaryType: 'error',
        typeLabel: '解析错误',
        error: `ECharts 配置解析失败 (非有效 JSON/YAML): ${yamlErr?.message || '语法错误'}`,
      };
    }
  }

  if (!parsed || typeof parsed !== 'object') {
    return {
      option: {},
      primaryType: 'error',
      typeLabel: '配置无效',
      error: 'ECharts 配置必须是 JSON/YAML 对象或数组',
    };
  }

  // 3. 处理纯数组数据简写语法糖 (例如 ```echarts:bar [10, 20, 30])
  if (Array.isArray(parsed)) {
    const inferredType = (langSuffix || 'bar').toLowerCase();
    parsed = createTemplateOptionFromData(parsed, inferredType);
  } else if (typeof parsed === 'object') {
    // 3.1 对对象配置进行防御性自动补齐 (补全 series.type 与缺失的直角坐标轴)
    parsed = normalizeEChartsOption(parsed, langSuffix);
  }

  // 4. 解析主图表类型与标签
  const { primaryType, typeLabel } = detectChartType(parsed, langSuffix);

  return {
    option: parsed,
    primaryType,
    typeLabel,
  };
}

/**
 * 防御性配置规范化：自动补全缺失的坐标轴与系列类型，防止 ECharts axisBuilder 与 get 报错
 */
function normalizeEChartsOption(option: any, langSuffix?: string): Record<string, any> {
  if (!option || typeof option !== 'object') return option;

  const targetType = langSuffix ? langSuffix.toLowerCase() : undefined;

  // 1. 自动补全 series[i].type
  if (Array.isArray(option.series)) {
    option.series = option.series.map((item: any) => {
      if (typeof item === 'object' && item !== null) {
        if (!item.type && targetType) {
          return { ...item, type: targetType };
        }
      }
      return item;
    });
  } else if (option.series && typeof option.series === 'object') {
    if (!option.series.type && targetType) {
      option.series = { ...option.series, type: targetType };
    }
  }

  // 2. 检查笛卡尔直角坐标系完整性 (Cartesian2D: line, bar, scatter, etc.)
  const seriesList = Array.isArray(option.series) ? option.series : option.series ? [option.series] : [];
  const hasCartesianSeries = seriesList.some((s: any) => {
    const t = s?.type || targetType;
    return ['line', 'bar', 'scatter', 'effectScatter', 'candlestick', 'heatmap'].includes(t);
  });

  const hasXAxis = Boolean(option.xAxis);
  const hasYAxis = Boolean(option.yAxis);

  // 如果有直角坐标系需求或定义了单个轴，补齐对应的对偶轴
  if (hasXAxis && !hasYAxis) {
    option.yAxis = { type: 'value' };
  } else if (hasYAxis && !hasXAxis) {
    option.xAxis = { type: 'category' };
  } else if (hasCartesianSeries && !hasXAxis && !hasYAxis) {
    option.xAxis = { type: 'category' };
    option.yAxis = { type: 'value' };
  }

  // 3. 增强 Tooltip 默认体验
  if (!option.tooltip) {
    option.tooltip = {
      trigger: hasCartesianSeries ? 'axis' : 'item',
    };
  }

  return option;
}

/**
 * 依据配置与语言后缀推断主图表类型
 */
function detectChartType(option: any, langSuffix?: string): { primaryType: string; typeLabel: string } {
  const TYPE_MAP: Record<string, string> = {
    line: '📈 折线图',
    bar: '📊 柱状图',
    pie: '🥧 饼图',
    scatter: '🔀 散点图',
    radar: '🕸️ 雷达图',
    gauge: '🎯 仪表盘',
    candlestick: '📉 K线图',
    heatmap: '🔥 热力图',
    tree: '🌳 树图',
    treemap: '🗂️ 矩形树图',
    sunburst: '☀️ 旭日图',
    sankey: '🌊 桑基图',
    funnel: '⏳ 漏斗图',
    graph: '🔗 关系图',
    boxplot: '📦 箱线图',
    parallel: '📏 平行坐标',
    themeRiver: '🌊 主题河流图',
  };

  if (Array.isArray(option.series) && option.series.length > 0) {
    const types = Array.from(new Set(option.series.map((s: any) => s?.type).filter(Boolean))) as string[];
    if (types.length === 1) {
      const t = types[0].toLowerCase();
      return { primaryType: t, typeLabel: TYPE_MAP[t] || `${t.toUpperCase()} 图` };
    }
    if (types.length > 1) {
      return { primaryType: 'mixed', typeLabel: `🔀 复合混合图 (${types.join('+')})` };
    }
  } else if (option.series && typeof option.series === 'object') {
    const t = (option.series.type || '').toLowerCase();
    if (t) return { primaryType: t, typeLabel: TYPE_MAP[t] || `${t.toUpperCase()} 图` };
  }

  if (langSuffix) {
    const s = langSuffix.toLowerCase();
    if (TYPE_MAP[s]) return { primaryType: s, typeLabel: TYPE_MAP[s] };
  }

  return { primaryType: 'chart', typeLabel: '📊 ECharts 图表' };
}

/**
 * 根据纯数据数组智能组装基础图表选项
 */
function createTemplateOptionFromData(data: any[], type: string): Record<string, any> {
  const isCategory = ['line', 'bar', 'scatter'].includes(type);

  if (type === 'pie') {
    return {
      tooltip: { trigger: 'item' },
      series: [
        {
          type: 'pie',
          radius: '65%',
          data: data.map((v, i) => (typeof v === 'object' ? v : { name: `项 ${i + 1}`, value: v })),
        },
      ],
    };
  }

  if (isCategory) {
    return {
      tooltip: { trigger: 'axis' },
      xAxis: {
        type: 'category',
        data: data.map((_, i) => `${i + 1}`),
      },
      yAxis: { type: 'value' },
      series: [
        {
          type: type || 'bar',
          data,
          smooth: type === 'line',
        },
      ],
    };
  }

  return {
    tooltip: {},
    series: [{ type: type || 'bar', data }],
  };
}
