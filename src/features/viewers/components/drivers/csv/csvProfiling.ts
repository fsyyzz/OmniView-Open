/**
 * CSV / TSV 列级数据画像 (Data Profiling) 与 Sparkline 微图生成引擎
 * 提供自动类型推断、多维统计量计算（极值/均值/中位数/分位数/标准差）、直方图分箱与 SVG Sparkline 路径生成
 */

export type ColumnDataType = 'number' | 'string' | 'boolean' | 'date';

export interface HistogramBin {
  binStart: number;
  binEnd: number;
  label: string;
  count: number;
  percentage: number;
}

export interface CategoricalTopValue {
  value: string;
  count: number;
  percentage: number;
}

export interface NumericProfileStats {
  min: number;
  max: number;
  sum: number;
  avg: number;
  median: number;
  p25: number;
  p75: number;
  stdDev: number;
  sparklinePoints: number[];
  histogram: HistogramBin[];
}

export interface CategoricalProfileStats {
  topValues: CategoricalTopValue[];
  distinctCount: number;
}

export interface DateProfileStats {
  minDate: string;
  maxDate: string;
  sparklinePoints: number[];
}

export interface ColumnProfile {
  colIndex: number;
  header: string;
  type: ColumnDataType;
  totalRows: number;
  validCount: number;
  nullCount: number;
  completenessRatio: number; // 0 ~ 1
  distinctCount: number;
  uniquenessRatio: number; // 0 ~ 1
  numericStats?: NumericProfileStats;
  categoricalStats?: CategoricalProfileStats;
  dateStats?: DateProfileStats;
}

/**
 * 尝试解析单元格为数值（支持百分比、千分位逗号、货币符号、正负号）
 */
export function tryParseNumber(val: string): number | null {
  if (val === null || val === undefined) return null;
  const trimmed = val.trim();
  if (!trimmed) return null;

  // 避免纯布尔或日期被识别为数值
  if (/^(true|false|yes|no)$/i.test(trimmed)) return null;

  // 清洗常见货币符号与千分位逗号: $1,234.56, €50, ¥99.9, 85.5%
  let cleaned = trimmed
    .replace(/^[$€¥£¥₹₽₩]/, '')
    .replace(/[,，]/g, '')
    .trim();

  let isPercentage = false;
  if (cleaned.endsWith('%')) {
    isPercentage = true;
    cleaned = cleaned.slice(0, -1).trim();
  }

  // 严格匹配数值正则（含科学计数法）
  if (!/^-?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(cleaned)) {
    return null;
  }

  const num = Number(cleaned);
  if (isNaN(num) || !isFinite(num)) return null;

  return isPercentage ? num / 100 : num;
}

/**
 * 尝试解析单元格为布尔值
 */
export function tryParseBoolean(val: string): boolean | null {
  if (val === null || val === undefined) return null;
  const trimmed = val.trim().toLowerCase();
  if (trimmed === 'true' || trimmed === 'yes' || trimmed === '1') return true;
  if (trimmed === 'false' || trimmed === 'no' || trimmed === '0') return false;
  return null;
}

/**
 * 尝试解析单元格为日期
 */
export function tryParseDate(val: string): Date | null {
  if (val === null || val === undefined) return null;
  const trimmed = val.trim();
  if (!trimmed || trimmed.length < 8) return null;

  // 匹配常见日期格式: YYYY-MM-DD, YYYY/MM/DD, YYYY-MM-DDTHH:mm:ss
  if (
    /^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}(?:[ T]\d{1,2}:\d{2}(?::\d{2})?(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?$/.test(
      trimmed
    )
  ) {
    const timestamp = Date.parse(trimmed);
    if (!isNaN(timestamp)) {
      return new Date(timestamp);
    }
  }
  return null;
}

/**
 * 自动推断单列数据类型
 */
export function inferColumnType(values: string[]): ColumnDataType {
  const nonEmpties = values.map(v => (v ?? '').trim()).filter(Boolean);
  if (nonEmpties.length === 0) return 'string';

  let numCount = 0;
  let boolCount = 0;
  let dateCount = 0;

  for (const v of nonEmpties) {
    if (tryParseNumber(v) !== null) numCount++;
    if (tryParseBoolean(v) !== null) boolCount++;
    if (tryParseDate(v) !== null) dateCount++;
  }

  const threshold = nonEmpties.length * 0.75; // 75% 以上匹配即判定为主类型

  if (numCount >= threshold) return 'number';
  if (boolCount === nonEmpties.length && (nonEmpties.includes('true') || nonEmpties.includes('false'))) {
    return 'boolean';
  }
  if (dateCount >= threshold) return 'date';

  return 'string';
}

/**
 * 计算数列中位数与分位数 (Percentiles)
 */
export function calculatePercentile(sortedNumbers: number[], p: number): number {
  if (sortedNumbers.length === 0) return 0;
  if (sortedNumbers.length === 1) return sortedNumbers[0];

  const index = (sortedNumbers.length - 1) * p;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;

  if (lower === upper) return sortedNumbers[lower];
  return sortedNumbers[lower] * (1 - weight) + sortedNumbers[upper] * weight;
}

/**
 * 构建直方图分箱 (Histogram Bins)
 */
export function buildHistogramBins(numbers: number[], binCount: number = 8): HistogramBin[] {
  if (numbers.length === 0) return [];
  const min = Math.min(...numbers);
  const max = Math.max(...numbers);

  if (min === max) {
    return [
      {
        binStart: min,
        binEnd: max,
        label: `${min}`,
        count: numbers.length,
        percentage: 100,
      },
    ];
  }

  const binWidth = (max - min) / binCount;
  const bins: HistogramBin[] = [];

  for (let i = 0; i < binCount; i++) {
    const binStart = min + i * binWidth;
    const binEnd = min + (i + 1) * binWidth;
    bins.push({
      binStart,
      binEnd,
      label: `${binStart.toFixed(1)}~${binEnd.toFixed(1)}`,
      count: 0,
      percentage: 0,
    });
  }

  for (const num of numbers) {
    let binIdx = Math.floor((num - min) / binWidth);
    if (binIdx >= binCount) binIdx = binCount - 1;
    if (binIdx < 0) binIdx = 0;
    bins[binIdx].count++;
  }

  for (const b of bins) {
    b.percentage = Number(((b.count / numbers.length) * 100).toFixed(1));
  }

  return bins;
}

/**
 * 针对单列生成完整的数据画像 (Data Profile)
 */
export function profileColumn(header: string, values: string[], colIndex: number): ColumnProfile {
  const totalRows = values.length;
  const trimmedValues = values.map(v => (v ?? '').trim());
  const validValues = trimmedValues.filter(Boolean);
  const validCount = validValues.length;
  const nullCount = totalRows - validCount;
  const completenessRatio = totalRows > 0 ? validCount / totalRows : 1;

  const distinctSet = new Set(validValues);
  const distinctCount = distinctSet.size;
  const uniquenessRatio = validCount > 0 ? distinctCount / validCount : 0;

  const type = inferColumnType(values);

  const profile: ColumnProfile = {
    colIndex,
    header: header || `Col_${colIndex + 1}`,
    type,
    totalRows,
    validCount,
    nullCount,
    completenessRatio,
    distinctCount,
    uniquenessRatio,
  };

  if (type === 'number') {
    const parsedNums: number[] = [];
    for (const v of trimmedValues) {
      if (!v) continue;
      const parsed = tryParseNumber(v);
      if (parsed !== null) parsedNums.push(parsed);
    }

    if (parsedNums.length > 0) {
      const sorted = [...parsedNums].sort((a, b) => a - b);
      const min = sorted[0];
      const max = sorted[sorted.length - 1];
      const sum = parsedNums.reduce((acc, curr) => acc + curr, 0);
      const avg = sum / parsedNums.length;
      const median = calculatePercentile(sorted, 0.5);
      const p25 = calculatePercentile(sorted, 0.25);
      const p75 = calculatePercentile(sorted, 0.75);

      // 计算标准差 (StdDev)
      const variance = parsedNums.reduce((acc, curr) => acc + Math.pow(curr - avg, 2), 0) / parsedNums.length;
      const stdDev = Math.sqrt(variance);

      // 提取 Sparkline 采样点序列（按数据原本的时序/行序，最多采样 40 点）
      let sparklinePoints: number[] = [];
      if (parsedNums.length <= 40) {
        sparklinePoints = parsedNums;
      } else {
        const step = parsedNums.length / 40;
        for (let i = 0; i < 40; i++) {
          const idx = Math.min(parsedNums.length - 1, Math.floor(i * step));
          sparklinePoints.push(parsedNums[idx]);
        }
      }

      const histogram = buildHistogramBins(parsedNums, 8);

      profile.numericStats = {
        min,
        max,
        sum,
        avg,
        median,
        p25,
        p75,
        stdDev,
        sparklinePoints,
        histogram,
      };
    }
  } else if (type === 'date') {
    const parsedTimestamps: { raw: string; ts: number }[] = [];
    for (const v of validValues) {
      const d = tryParseDate(v);
      if (d) {
        parsedTimestamps.push({ raw: v, ts: d.getTime() });
      }
    }

    if (parsedTimestamps.length > 0) {
      parsedTimestamps.sort((a, b) => a.ts - b.ts);
      profile.dateStats = {
        minDate: parsedTimestamps[0].raw,
        maxDate: parsedTimestamps[parsedTimestamps.length - 1].raw,
        sparklinePoints: parsedTimestamps.map(t => t.ts),
      };
    }
  } else {
    // Categorical / String / Boolean
    const freqMap: Record<string, number> = {};
    for (const v of validValues) {
      freqMap[v] = (freqMap[v] || 0) + 1;
    }

    const sortedEntries = Object.entries(freqMap).sort((a, b) => b[1] - a[1]);
    const topValues: CategoricalTopValue[] = sortedEntries.slice(0, 5).map(([value, count]) => ({
      value,
      count,
      percentage: validCount > 0 ? Number(((count / validCount) * 100).toFixed(1)) : 0,
    }));

    profile.categoricalStats = {
      topValues,
      distinctCount,
    };
  }

  return profile;
}

/**
 * 批量为所有列生成数据画像
 */
export function profileAllColumns(headers: string[], rows: string[][]): ColumnProfile[] {
  return headers.map((header, colIdx) => {
    const columnValues = rows.map(r => r[colIdx] ?? '');
    return profileColumn(header, columnValues, colIdx);
  });
}

/**
 * 生成 SVG Sparkline 折线与渐变填充路径 (Line & Area Paths)
 */
export function generateSparklineSvgPath(
  points: number[],
  width: number = 80,
  height: number = 22,
  padding: number = 2
): { linePath: string; areaPath: string; min: number; max: number } {
  if (!points || points.length === 0) {
    return { linePath: '', areaPath: '', min: 0, max: 0 };
  }

  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min;

  const usableWidth = Math.max(1, width - padding * 2);
  const usableHeight = Math.max(1, height - padding * 2);

  const coords = points.map((p, i) => {
    const x = padding + (points.length === 1 ? usableWidth / 2 : (i / (points.length - 1)) * usableWidth);
    const normalizedY = range === 0 ? 0.5 : (p - min) / range;
    const y = height - padding - normalizedY * usableHeight;
    return { x, y };
  });

  // 构造光滑折线指令
  const linePath = coords.reduce((acc, curr, idx) => {
    return idx === 0 ? `M ${curr.x.toFixed(1)} ${curr.y.toFixed(1)}` : `${acc} L ${curr.x.toFixed(1)} ${curr.y.toFixed(1)}`;
  }, '');

  // 构造封闭面积指令
  const first = coords[0];
  const last = coords[coords.length - 1];
  const areaPath = `${linePath} L ${last.x.toFixed(1)} ${(height - padding).toFixed(1)} L ${first.x.toFixed(1)} ${(height - padding).toFixed(1)} Z`;

  return { linePath, areaPath, min, max };
}
