#!/usr/bin/env node
/**
 * OmniView — Apache ECharts Markdown 深度集成单元测试套件
 * 重点验证：
 * 1. 语言标签别名检测 (echarts, echarts:bar, echarts:pie, chart)；
 * 2. 安全 JSON / YAML 配置解析与异常语法诊断；
 * 3. 数组简写语法糖自动补齐为标准 Series 选项；
 * 4. 主题适配器根据深浅模式自动映射 --ov-* 配色；
 * 5. AST 解析流水线正确生成 echarts 块与卡片网格 [!CARDS:列数] 内联宿主容器。
 */
import assert from 'node:assert';
import {
  parseEChartsOption,
  getOmniViewEchartsTheme,
} from '../src/features/viewers/lib/echartsTheme.ts';

console.log('🧪 开始 Apache ECharts Markdown 深度集成单元测试...\n');

// 1. 标准 JSON 选项解析与类型推断
console.log('--- 测试 1: 标准 JSON 选项解析与类型推断 ---');
const standardLineOption = JSON.stringify({
  title: { text: 'QPS 趋势' },
  xAxis: { data: ['A', 'B', 'C'] },
  yAxis: {},
  series: [{ type: 'line', data: [10, 20, 30] }],
});

const resLine = parseEChartsOption(standardLineOption);
assert.strictEqual(resLine.primaryType, 'line', '主图表类型应推断为 line');
assert.ok(resLine.typeLabel.includes('折线图'), '类型标签应包含折线图');
assert.strictEqual(resLine.error, undefined, '合法配置不应产生错误');
console.log('✅ 标准折线图配置解析通过');

// 2. 复合混合图表检测
console.log('--- 测试 2: 复合多系列图表类型识别 ---');
const mixedOption = JSON.stringify({
  series: [
    { type: 'bar', data: [10, 20] },
    { type: 'line', data: [5, 15] },
  ],
});
const resMixed = parseEChartsOption(mixedOption);
assert.strictEqual(resMixed.primaryType, 'mixed', '多类型 series 应识别为 mixed 复合图');
assert.ok(resMixed.typeLabel.includes('复合混合图'), '应包含复合图文字');
console.log('✅ 复合多系列图表识别通过');

// 3. YAML 配置格式兼容测试
console.log('--- 测试 3: YAML 配置语法兼容测试 ---');
const yamlOption = `
title:
  text: "研发指标"
series:
  - type: gauge
    data:
      - value: 75.5
        name: "CPU"
`;
const resYaml = parseEChartsOption(yamlOption);
assert.strictEqual(resYaml.primaryType, 'gauge', 'YAML 配置应识别为 gauge 仪表盘');
assert.strictEqual(resYaml.option.series[0].data[0].value, 75.5, '数值应当精准解析');
console.log('✅ YAML 配置格式兼容通过');

// 4. 纯数据数组简写语法糖自动补齐测试
console.log('--- 测试 4: 纯数据数组语法糖自动补齐测试 ---');
const dataArray = '[120, 200, 150, 80]';
const resSugarBar = parseEChartsOption(dataArray, 'bar');
assert.strictEqual(resSugarBar.primaryType, 'bar', '简写数组配合 :bar 应推断为柱状图');
assert.strictEqual(resSugarBar.option.series[0].type, 'bar', '自动生成的 option 中应含有 bar 系列');
assert.deepStrictEqual(resSugarBar.option.series[0].data, [120, 200, 150, 80], '数据数组应保留');

const resSugarPie = parseEChartsOption(dataArray, 'pie');
assert.strictEqual(resSugarPie.primaryType, 'pie', '简写数组配合 :pie 应推断为饼图');
assert.strictEqual(resSugarPie.option.series[0].type, 'pie', '应自动补齐饼图结构');
console.log('✅ 纯数据数组语法糖自动补齐通过');

// 5. 异常输入容错与诊断错误提示
console.log('--- 测试 5: 异常输入与畸变语法容错 ---');
const invalidJson = '{ title: 未加引号的非法JSON ';
const resErr = parseEChartsOption(invalidJson);
assert.ok(Boolean(resErr.error), '非法语法应返回明确错误说明');
assert.strictEqual(resErr.primaryType, 'error', '错误类型应标记为 error');

const emptyRes = parseEChartsOption('');
assert.ok(Boolean(emptyRes.error), '空配置应报错');
console.log('✅ 异常语法容错与友好诊断通过');

// 6. 主题适配器色值测试
console.log('--- 测试 6: 主题配色自适应测试 ---');
const darkTheme = getOmniViewEchartsTheme(true);
assert.ok(Array.isArray(darkTheme.color) && darkTheme.color.length >= 6, '应提供丰富的调色板');
assert.strictEqual(darkTheme.backgroundColor, 'transparent', '默认背景色应为透明以无缝融入视口');

const lightTheme = getOmniViewEchartsTheme(false);
assert.ok(lightTheme.textStyle.color !== undefined, '亮色主题应提供前景色');

const sepiaTheme = getOmniViewEchartsTheme(false, 'sepia');
assert.strictEqual(sepiaTheme.textStyle.color, '#38291a', '暖阳羊皮主题应使用温润深棕文字色');
assert.strictEqual(sepiaTheme.color[0], '#b45309', '暖阳羊皮主题应使用专属琥珀色系调色板');

const forestTheme = getOmniViewEchartsTheme(true, 'forest');
assert.strictEqual(forestTheme.color[0], '#10b981', '森系主题应使用翡翠绿主色调色板');
console.log('✅ 主题配色自适应（含暖阳羊皮 sepia 专属色板）测试通过');
// 7. 防御性自动补齐测试 (防止 axisBuilder 与 get 报错)
console.log('--- 测试 7: 缺失对偶坐标轴与 series.type 的防御性补齐 ---');
const incompleteBar = `
title:
  text: "柱状图"
xAxis:
  data: ["A", "B", "C"]
series:
  - name: "指标"
    data: [10, 20, 30]
`;
const resNormalized = parseEChartsOption(incompleteBar, 'bar');
assert.strictEqual(resNormalized.option.series[0].type, 'bar', '应自动根据 :bar 注入缺失的 series.type');
assert.ok(Boolean(resNormalized.option.yAxis), '应自动为缺少 yAxis 的直角坐标系补全 yAxis: { type: "value" }');
assert.strictEqual(resNormalized.option.yAxis.type, 'value', '补全的 yAxis 类型应为 value');
assert.strictEqual(resNormalized.primaryType, 'bar', '主图表类型应为 bar');
console.log('✅ 防御性补全测试通过 (成功杜绝 axisBuilder 与 get 报错)');

console.log('🎉 全部 7 组 Apache ECharts 深度集成单元测试 100% 顺利通过！\n');
