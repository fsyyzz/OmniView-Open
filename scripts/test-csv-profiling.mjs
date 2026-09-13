/**
 * CSV / TSV 列级数据画像与 Sparkline 微图算法单元测试
 */
import assert from 'node:assert';
import {
  tryParseNumber,
  tryParseBoolean,
  tryParseDate,
  inferColumnType,
  calculatePercentile,
  buildHistogramBins,
  profileColumn,
  profileAllColumns,
  generateSparklineSvgPath
} from '../src/features/viewers/components/drivers/csv/csvProfiling.ts';

console.log('🧪 开始 CSV/TSV 表头数据画像与 Sparkline 引擎单元测试...');

// 1. 类型解析与类型推断测试
console.log('--- 测试 1: 数值、布尔与日期格式解析与类型推断 ---');
assert.strictEqual(tryParseNumber('123'), 123);
assert.strictEqual(tryParseNumber('-45.67'), -45.67);
assert.strictEqual(tryParseNumber('$1,234.50'), 1234.5);
assert.strictEqual(tryParseNumber('85.5%'), 0.855);
assert.strictEqual(tryParseNumber('1.5e3'), 1500);
assert.strictEqual(tryParseNumber('abc'), null);
assert.strictEqual(tryParseNumber('true'), null);

assert.strictEqual(tryParseBoolean('TRUE'), true);
assert.strictEqual(tryParseBoolean('no'), false);
assert.strictEqual(tryParseBoolean('1'), true);
assert.strictEqual(tryParseBoolean('0'), false);
assert.strictEqual(tryParseBoolean('maybe'), null);

assert.ok(tryParseDate('2024-03-15') instanceof Date);
assert.ok(tryParseDate('2024/12/31 23:59:59') instanceof Date);
assert.strictEqual(tryParseDate('not-a-date'), null);

const numCol = ['10', '20.5', '30', '$40', '50.2'];
assert.strictEqual(inferColumnType(numCol), 'number');

const dateCol = ['2024-01-01', '2024-02-01', '2024-03-01'];
assert.strictEqual(inferColumnType(dateCol), 'date');

const boolCol = ['true', 'false', 'true', 'true'];
assert.strictEqual(inferColumnType(boolCol), 'boolean');

const strCol = ['Apple', 'Banana', 'Orange', '123'];
assert.strictEqual(inferColumnType(strCol), 'string');
console.log('✅ 基础类型解析与列类型推断测试通过');

// 2. 数值统计指标与四分位数计算
console.log('--- 测试 2: 数值统计量与分位数 (Min/Max/Avg/Median/Q1/Q3/StdDev) ---');
const numbers = [10, 20, 30, 40, 50];
assert.strictEqual(calculatePercentile(numbers, 0.5), 30);
assert.strictEqual(calculatePercentile(numbers, 0.25), 20);
assert.strictEqual(calculatePercentile(numbers, 0.75), 40);

const profileNum = profileColumn('Sales', ['100', '200', '300', '400', '500'], 0);
assert.strictEqual(profileNum.type, 'number');
assert.strictEqual(profileNum.totalRows, 5);
assert.strictEqual(profileNum.validCount, 5);
assert.strictEqual(profileNum.nullCount, 0);
assert.ok(profileNum.numericStats);
assert.strictEqual(profileNum.numericStats.min, 100);
assert.strictEqual(profileNum.numericStats.max, 500);
assert.strictEqual(profileNum.numericStats.avg, 300);
assert.strictEqual(profileNum.numericStats.median, 300);
assert.strictEqual(profileNum.numericStats.sum, 1500);
assert.ok(profileNum.numericStats.stdDev > 0);
console.log('✅ 数值统计量与分位数计算通过');

// 3. 直方图分箱计算
console.log('--- 测试 3: 直方图分箱 (Histogram Bins) ---');
const histBins = buildHistogramBins([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 5);
assert.strictEqual(histBins.length, 5);
const totalCount = histBins.reduce((acc, curr) => acc + curr.count, 0);
assert.strictEqual(totalCount, 10);
console.log('✅ 直方图分箱计算通过');

// 4. Sparkline SVG 路径生成
console.log('--- 测试 4: SVG Sparkline 路径生成 ---');
const svgPaths = generateSparklineSvgPath([10, 50, 20, 80, 40], 100, 30, 2);
assert.ok(svgPaths.linePath.startsWith('M '));
assert.ok(svgPaths.areaPath.endsWith(' Z'));
assert.strictEqual(svgPaths.min, 10);
assert.strictEqual(svgPaths.max, 80);
console.log('✅ SVG Sparkline 路径与面积闭合指令生成通过');

// 5. 分类特征 Top 频次与缺失值处理
console.log('--- 测试 5: 分类频次与缺失值处理 ---');
const catProfile = profileColumn('Category', ['Tech', 'Tech', 'Finance', '', 'Health', 'Tech'], 1);
assert.strictEqual(catProfile.type, 'string');
assert.strictEqual(catProfile.totalRows, 6);
assert.strictEqual(catProfile.validCount, 5);
assert.strictEqual(catProfile.nullCount, 1);
assert.strictEqual(catProfile.distinctCount, 3);
assert.ok(catProfile.categoricalStats);
assert.strictEqual(catProfile.categoricalStats.topValues[0].value, 'Tech');
assert.strictEqual(catProfile.categoricalStats.topValues[0].count, 3);
assert.strictEqual(catProfile.categoricalStats.topValues[0].percentage, 60);
console.log('✅ 分类特征 Top 频次与缺失值处理通过');

// 6. 批量列画像 (profileAllColumns)
console.log('--- 测试 6: 批量全表列画像生成 ---');
const headers = ['ID', 'Name', 'Age', 'Score'];
const rows = [
  ['1', 'Alice', '25', '95.5'],
  ['2', 'Bob', '30', '88.0'],
  ['3', 'Charlie', '28', '92.0'],
];
const allProfiles = profileAllColumns(headers, rows);
assert.strictEqual(allProfiles.length, 4);
assert.strictEqual(allProfiles[0].type, 'number');
assert.strictEqual(allProfiles[1].type, 'string');
assert.strictEqual(allProfiles[2].type, 'number');
assert.strictEqual(allProfiles[3].type, 'number');
console.log('✅ 批量全表列画像生成通过');

console.log('🎉 全部 6 组 CSV/TSV 表头数据画像与 Sparkline 引擎测试用例 100% 通过！');
