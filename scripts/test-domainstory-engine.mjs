#!/usr/bin/env node
/**
 * 领域故事讲授法 (Domain Storytelling / egon.io) 核心引擎全功能测试
 */
import assert from 'node:assert';
import {
  parseDomainStory,
  computeAutoLayout,
  renderDomainStoryToSvg,
  extractDomainStorySteps,
  exportPolyglotSvg,
  extractModelFromPolyglotSvg,
  exportEgnJson,
} from '../src/features/viewers/lib/domainStoryEngine.ts';

console.log('🧪 开始 Domain Storytelling (egon.io) 核心引擎单元测试...\n');

// -------------------------------------------------------------
// 测试 1: egon.io 标准 .egn (JSON) 文件解析与模型映射
// -------------------------------------------------------------
console.log('--- 测试 1: egon.io 标准 .egn (JSON) 文件解析 ---');
const sampleEgnJson = JSON.stringify({
  info: {
    name: '电商下单履约故事',
    description: '标准 egon.io 格式履约流程',
    version: 'v1.0',
  },
  actors: [
    { id: 'a1', name: '买家', type: 'person', x: 100, y: 150 },
    { id: 'a2', name: '订单系统', type: 'system', x: 400, y: 150 },
    { id: 'a3', name: '仓储物流', type: 'system', x: 700, y: 150 },
  ],
  workObjects: [
    { id: 'w1', name: '购物车清单', type: 'document' },
    { id: 'w2', name: '出库单', type: 'document' },
  ],
  activities: [
    { id: 'act-1', number: 1, from: 'a1', to: 'a2', label: '结算提交', workObjectName: '购物车清单' },
    { id: 'act-2', number: 2, from: 'a2', to: 'a3', label: '派发拣货任务', workObjectName: '出库单' },
  ],
  groups: [
    { id: 'g1', name: '中台核心域', actors: ['a2', 'a3'] },
  ],
});

const modelFromJson = parseDomainStory(sampleEgnJson);
assert.strictEqual(modelFromJson.info?.name, '电商下单履约故事');
assert.strictEqual(modelFromJson.actors.length, 3);
assert.strictEqual(modelFromJson.activities.length, 2);
assert.strictEqual(modelFromJson.groups?.length, 1);
assert.strictEqual(modelFromJson.actors[0].name, '买家');
assert.strictEqual(modelFromJson.actors[0].x, 100);
console.log('✅ 标准 .egn JSON 解析与结构映射测试通过');

// -------------------------------------------------------------
// 测试 2: Markdown DSL 文本解析 (声明式与单行流)
// -------------------------------------------------------------
console.log('\n--- 测试 2: Markdown DSL 文本解析 ---');
const sampleDsl = `
title: 采购审批报销流程
description: 财务与员工协同

actors:
  - 员工 [person]
  - 审批中台 [system]
  - 财务系统 [system]

groups:
  - 结算边界: 审批中台, 财务系统

activities:
  1. 员工 -> 提交申请单 -> 差旅报销单 [document] -> 审批中台
  2. 审批中台 -> 自动化额度校验 -> 审核回执 [document] -> 审批中台
  3. 审批中台 -> 流转付款指令 -> 支付单据 [money] -> 财务系统
`;

const modelFromDsl = parseDomainStory(sampleDsl);
assert.strictEqual(modelFromDsl.info?.name, '采购审批报销流程');
assert.strictEqual(modelFromDsl.actors.length, 3);
assert.strictEqual(modelFromDsl.activities.length, 3);
assert.strictEqual(modelFromDsl.activities[0].number, 1);
assert.strictEqual(modelFromDsl.activities[0].label, '提交申请单');
assert.strictEqual(modelFromDsl.activities[0].workObjectName, '差旅报销单');
assert.strictEqual(modelFromDsl.groups?.length, 1);
assert.strictEqual(modelFromDsl.groups?.[0].name, '结算边界');
console.log('✅ Markdown 声明式 DSL 语法解析通过');

// 测试单行极简流
const sampleCompactDsl = `
1. 顾客 (person) -> 下单付款 (订购单) -> 收银机 (system)
2. 收银机 -> 打印小票 (收据) -> 顾客
`;
const compactModel = parseDomainStory(sampleCompactDsl);
assert.strictEqual(compactModel.actors.length, 2);
assert.strictEqual(compactModel.activities.length, 2);
assert.strictEqual(compactModel.activities[0].number, 1);
assert.strictEqual(compactModel.activities[1].number, 2);
console.log('✅ Markdown 单行极简流 DSL 语法解析通过');

// -------------------------------------------------------------
// 测试 3: 自动布局与边界坐标计算
// -------------------------------------------------------------
console.log('\n--- 测试 3: 自动布局与坐标分配 ---');
const unpositionedModel = computeAutoLayout(compactModel);
assert(typeof unpositionedModel.actors[0].x === 'number', '应计算 x 坐标');
assert(typeof unpositionedModel.actors[0].y === 'number', '应计算 y 坐标');
assert(unpositionedModel.actors[0].x !== unpositionedModel.actors[1].x, '节点 x 坐标不应重叠');
console.log('✅ 自动拓扑布局与坐标分配验证通过');

// -------------------------------------------------------------
// 测试 4: 矢量 SVG 渲染生成与步进态注入
// -------------------------------------------------------------
console.log('\n--- 测试 4: 矢量 SVG 渲染与步进高亮 ---');
const fullSvg = renderDomainStoryToSvg(modelFromDsl, { isDark: true });
assert(fullSvg.includes('<svg'), '应输出有效 SVG 标签');
assert(fullSvg.includes('采购审批报销流程'), '应包含标题');
assert(fullSvg.includes('员工'), '应包含 Actor 名称');
assert(fullSvg.includes('差旅报销单'), '应包含 WorkObject 名称');
assert(fullSvg.includes('结算边界'), '应包含 Group 边界');

// 步进渲染态测试 (currentStep: 0)
const stepSvg = renderDomainStoryToSvg(modelFromDsl, { currentStep: 0, isDark: true });
assert(stepSvg.includes('ds-arrow-active'), '高亮激活步应包含激活箭头 marker');
assert(stepSvg.includes('filter="url(#ds-glow)"'), '高亮激活步应注入辉光滤镜');
console.log('✅ 矢量 SVG 渲染与步骤高亮测试全部通过');

// -------------------------------------------------------------
// 测试 5: DiagramStep 步进提取与 DiagramStepPlayer 契约对齐
// -------------------------------------------------------------
console.log('\n--- 测试 5: DiagramStep 步进提取 ---');
const steps = extractDomainStorySteps(modelFromDsl);
assert.strictEqual(steps.length, 3);
assert.strictEqual(steps[0].index, 0);
assert.strictEqual(steps[0].from, '员工');
assert.strictEqual(steps[0].to, '审批中台');
assert(steps[0].label.includes('提交申请单'), '应包含动作标签');
assert(steps[0].description?.includes('差旅报销单'), '应包含描述性业务叙述');
console.log('✅ DiagramStep 步骤提取与步进播放器契约通过');

// -------------------------------------------------------------
// 测试 6: Polyglot SVG 导出与反向抽取
// -------------------------------------------------------------
console.log('\n--- 测试 6: Polyglot SVG 隐写与双向还原 ---');
const polyglotSvg = exportPolyglotSvg(modelFromDsl);
assert(polyglotSvg.includes('<metadata id="egn-metadata">'), '应注入 egn-metadata 标签');
assert(polyglotSvg.includes('id="domain-story-json"'), '应包含内嵌 JSON 数据');

// 反向抽取
const restoredModel = extractModelFromPolyglotSvg(polyglotSvg);
assert(restoredModel !== null, '应成功从 Polyglot SVG 抽取模型');
assert.strictEqual(restoredModel?.info?.name, '采购审批报销流程');
assert.strictEqual(restoredModel?.actors.length, 3);
assert.strictEqual(restoredModel?.activities.length, 3);
console.log('✅ Polyglot SVG 导出与反向无损提取验证通过');

// -------------------------------------------------------------
// 测试 7: 导出标准 .egn JSON
// -------------------------------------------------------------
console.log('\n--- 测试 7: 导出标准 .egn JSON ---');
const exportedJson = exportEgnJson(modelFromDsl);
const reParsed = JSON.parse(exportedJson);
assert.strictEqual(reParsed.info.name, '采购审批报销流程');
assert.strictEqual(reParsed.actors.length, 3);
assert.strictEqual(reParsed.activities.length, 3);
console.log('✅ 导出标准 .egn JSON 契约验证通过');

console.log('\n🎉 全部 7 组 Domain Storytelling 单元测试用例 100% 全部通过！');
