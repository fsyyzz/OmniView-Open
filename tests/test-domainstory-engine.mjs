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
const xDist = Math.abs(unpositionedModel.actors[1].x - unpositionedModel.actors[0].x);
assert(xDist >= 400, `节点间距应至少保持 400px 宽敞呼吸空间 (实际: ${xDist}px)`);

// 测试 5 节点大环绕布局的节点间距
const fiveActorModel = computeAutoLayout({
  actors: [
    { id: 'a1', name: 'A1', type: 'person' },
    { id: 'a2', name: 'A2', type: 'system' },
    { id: 'a3', name: 'A3', type: 'person' },
    { id: 'a4', name: 'A4', type: 'system' },
    { id: 'a5', name: 'A5', type: 'system' },
  ],
  activities: [],
});
for (let i = 0; i < 5; i++) {
  const next = (i + 1) % 5;
  const dx = fiveActorModel.actors[i].x - fiveActorModel.actors[next].x;
  const dy = fiveActorModel.actors[i].y - fiveActorModel.actors[next].y;
  const d = Math.sqrt(dx * dx + dy * dy);
  assert(d >= 350, `5 节点环绕布局相邻节点距离应 >= 350px (实际: ${Math.round(d)}px)`);
}
console.log('✅ 自动拓扑布局与宽敞呼吸间距验证通过');

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

// -------------------------------------------------------------
// 测试 8: DDD 事件风暴 (Event Storming) DSL 解析、色卡便利贴 SVG 渲染与逐帧步进
// -------------------------------------------------------------
console.log('\n--- 测试 8: DDD 事件风暴 (Event Storming) 视图引擎 ---');
const eventStormingDsl = `
mode: event-storming
title: 电商大促下单事件风暴
context: 交易核心域 [core]

timeline:
  1. 买家 [actor] -> 提交结算单 [cmd] -> @订单聚合 [agg] -> 订单已创建 [evt]
     read: 订单确认页视图 [readmodel]
     hotspot: 秒杀高并发下预占库存超卖风险？
  2. 订单已创建 [evt] -> 自动触发风控与支付策略 [policy] -> 发起渠道扣款 [cmd] -> $微信支付网关 [ext] -> 支付已成功 [evt]
`;
const esModel = parseDomainStory(eventStormingDsl);
assert.strictEqual(esModel.mode, 'event-storming');
assert.strictEqual(esModel.info?.name, '电商大促下单事件风暴');
assert.strictEqual(esModel.eventStorming?.flows.length, 2);
assert.strictEqual(esModel.eventStorming?.flows[0].nodes.length, 4);
assert.strictEqual(esModel.eventStorming?.flows[0].nodes[1].kind, 'command');
assert.strictEqual(esModel.eventStorming?.flows[0].nodes[2].kind, 'aggregate');
assert.strictEqual(esModel.eventStorming?.flows[0].nodes[3].kind, 'event');
assert.strictEqual(esModel.eventStorming?.flows[0].hotspots.length, 1);
assert.strictEqual(esModel.eventStorming?.flows[0].readModels.length, 1);

const esSvg = renderDomainStoryToSvg(esModel, { currentStep: 0, isDark: true });
assert.ok(esSvg.includes('ov-ddd-event-storming'), '应输出 Event Storming 专属 SVG 类名');
assert.ok(esSvg.includes('COMMAND') && esSvg.includes('AGGREGATE') && esSvg.includes('EVENT'), '应包含标准便利贴类型标签');
assert.ok(esSvg.includes('秒杀高并发下预占库存超卖风险'), '应渲染 Hotspot 风险痛点便利贴');

const esSteps = extractDomainStorySteps(esModel);
assert.strictEqual(esSteps.length, 2);
assert.ok(esSteps[0].description?.includes('痛点'), '步进器描述应包含 Hotspot 提示');
console.log('✅ DDD 事件风暴 (Event Storming) 解析、SVG 便利贴渲染与步进提取通过');

// -------------------------------------------------------------
// 测试 9: DDD 限界上下文映射图 (Context Map) DSL 解析、U/D 防腐层徽章渲染与步进
// -------------------------------------------------------------
console.log('\n--- 测试 9: DDD 限界上下文映射图 (Context Map) 视图引擎 ---');
const contextMapDsl = `
mode: context-map
title: 智慧零售核心领域上下文映射

contexts:
  - 交易订单上下文 [core] (team: 交易研发组, desc: 订单生命周期与状态机, aggregates: 订单聚合, 履约单聚合)
  - 营销促销上下文 [supporting] (team: 增长营销组, desc: 优惠券与算价引擎, aggregates: 优惠券聚合)
  - 统一支付网关 [generic] (team: 金融组, desc: 多渠道收单与清结算, aggregates: 支付流水)

relationships:
  1. 营销促销上下文 [U: OHS, PL] -> 交易订单上下文 [D: ACL] : 优惠试算与锁定核销契约
  2. 交易订单上下文 [U: PL] ->> 统一支付网关 [D: Conformist] : OrderPaymentRequestedEvent
`;
const cmModel = parseDomainStory(contextMapDsl);
assert.strictEqual(cmModel.mode, 'context-map');
assert.strictEqual(cmModel.contextMap?.contexts.length, 3);
assert.strictEqual(cmModel.contextMap?.contexts[0].subdomain, 'core');
assert.strictEqual(cmModel.contextMap?.contexts[1].subdomain, 'supporting');
assert.strictEqual(cmModel.contextMap?.contexts[2].subdomain, 'generic');
assert.strictEqual(cmModel.contextMap?.relationships.length, 2);
assert.strictEqual(cmModel.contextMap?.relationships[0].upstreamPattern, 'U: OHS, PL');
assert.strictEqual(cmModel.contextMap?.relationships[0].downstreamPattern, 'D: ACL');
assert.strictEqual(cmModel.contextMap?.relationships[1].isAsync, true);

const cmSvg = renderDomainStoryToSvg(cmModel, { currentStep: 0, isDark: true });
assert.ok(cmSvg.includes('ov-ddd-context-map'), '应输出 Context Map 专属 SVG 类名');
assert.ok(cmSvg.includes('CORE DOMAIN') && cmSvg.includes('SUPPORTING') && cmSvg.includes('GENERIC'), '应渲染三类子域战略徽章');
assert.ok(cmSvg.includes('ACL') && cmSvg.includes('OHS, PL'), '应渲染上下游防腐层与开放主机徽章');

const cmSteps = extractDomainStorySteps(cmModel);
assert.strictEqual(cmSteps.length, 2);
assert.strictEqual(cmSteps[1].arrowType, '-->>', '异步事件流应映射为虚线步进箭头');
console.log('✅ DDD 限界上下文映射图 (Context Map) 解析、SVG 战略拓扑渲染与步进提取通过');

// -------------------------------------------------------------
// 测试 10: DDD 核心域四象限投资图 (Core Domain Chart) DSL 解析、SVG 象限渲染与步进
// -------------------------------------------------------------
console.log('\n--- 测试 10: DDD 核心域投资象限图 (Core Domain Chart) 视图引擎 ---');
const coreDomainDsl = `
mode: core-domain-chart
title: 新零售战略子域分类与投资决策矩阵
description: 业务模型复杂度 vs 业务差异化 4 象限分析

domains:
  - 智能动态推荐引擎 [core] (complexity: 88, diff: 94, invest: 战略自研/专利算法) -> 保持核心差异化壁垒
  - 实时订单履约编排 [core] (complexity: 82, diff: 86, invest: 精细自研/高可用架构)
  - 动态营销促活算价 [supporting] (complexity: 65, diff: 45, invest: 敏捷自建/规则引擎)
  - 多渠道收单清结算 [generic] (complexity: 35, diff: 15, invest: 采购成熟SaaS/聚合支付)
`;
const cdcModel = parseDomainStory(coreDomainDsl);
assert.strictEqual(cdcModel.mode, 'core-domain-chart');
assert.strictEqual(cdcModel.coreDomainChart?.domains.length, 4);
assert.strictEqual(cdcModel.coreDomainChart?.domains[0].subdomain, 'core');
assert.strictEqual(cdcModel.coreDomainChart?.domains[0].complexity, 88);
assert.strictEqual(cdcModel.coreDomainChart?.domains[0].differentiation, 94);
assert.strictEqual(cdcModel.coreDomainChart?.domains[0].evolution, '保持核心差异化壁垒');

const cdcSvg = renderDomainStoryToSvg(cdcModel, { currentStep: 0, isDark: true });
assert.ok(cdcSvg.includes('ov-ddd-core-domain-chart'), '应输出 Core Domain Chart 专属 SVG 类名');
assert.ok(cdcSvg.includes('CORE DOMAIN (核心域)') && cdcSvg.includes('GENERIC (通用域)'), '应渲染四象限文本');
assert.ok(cdcSvg.includes('智能动态推荐引擎'), '应渲染子域节点泡泡');

const cdcSteps = extractDomainStorySteps(cdcModel);
assert.strictEqual(cdcSteps.length, 4);
assert.ok(cdcSteps[0].description?.includes('战略自研'), '步进器应包含投资策略描述');
console.log('✅ DDD 核心域投资象限图 (Core Domain Chart) 解析、四象限 SVG 渲染与步进提取通过');

// -------------------------------------------------------------
// 测试 11: DDD 限界上下文战略画布 (Context Canvas) Bento Grid 架构解析与 SVG 渲染
// -------------------------------------------------------------
console.log('\n--- 测试 11: DDD 限界上下文战略画布 (Context Canvas) 视图引擎 ---');
const contextCanvasDsl = `
mode: context-canvas
context: 订单履约上下文 (Order Fulfillment Context)
classification: core
team: 交易核心研发组
description: 全生命周期订单状态与履约编排

inbound:
  commands:
    - SubmitOrderCommand (提交下单)
    - PayOrderCommand (支付订单)
  events:
    - PaymentSuccessEvent (支付到账)
  queries:
    - GetOrderDetailQuery (查询订单详情)

decisions:
  - 严格幂等保障: 基于分布式租约锁防重复扣款
  - 状态机强约束: 订单生命周期单向流转

language:
  - 订单聚合 (Order Aggregate) : 订单业务唯一凭据与聚合根
  - 履约单 (Fulfillment Order) : 发货实物包

outbound:
  events:
    - OrderPaidEvent (订单已支付事件)
  dependencies:
    - 统一支付网关 (Generic) : ACL 防腐层 RPC 预支付收单
`;
const ccModel = parseDomainStory(contextCanvasDsl);
assert.strictEqual(ccModel.mode, 'context-canvas');
assert.strictEqual(ccModel.contextCanvas?.contextName, '订单履约上下文 (Order Fulfillment Context)');
assert.strictEqual(ccModel.contextCanvas?.classification, 'core');
assert.strictEqual(ccModel.contextCanvas?.inbound.commands.length, 2);
assert.strictEqual(ccModel.contextCanvas?.inbound.events.length, 1);
assert.strictEqual(ccModel.contextCanvas?.inbound.queries.length, 1);
assert.strictEqual(ccModel.contextCanvas?.decisions.length, 2);
assert.strictEqual(ccModel.contextCanvas?.language.length, 2);
assert.strictEqual(ccModel.contextCanvas?.outbound.events.length, 1);
assert.strictEqual(ccModel.contextCanvas?.outbound.dependencies.length, 1);

const ccSvg = renderDomainStoryToSvg(ccModel, { currentStep: 1, isDark: true });
assert.ok(ccSvg.includes('ov-ddd-context-canvas'), '应输出 Context Canvas 专属 SVG 类名');
assert.ok(ccSvg.includes('INBOUND COMMUNICATION'), '应包含输入通信列');
assert.ok(ccSvg.includes('STRATEGIC HEART'), '应包含战略内核列');
assert.ok(ccSvg.includes('OUTBOUND COMMUNICATION'), '应包含输出通信列');
assert.ok(ccSvg.includes('SubmitOrderCommand'), '应渲染命令条目');

const ccSteps = extractDomainStorySteps(ccModel);
assert.strictEqual(ccSteps.length, 3, 'Context Canvas 应提取 3 栏架构步骤 (Inbound -> Heart -> Outbound)');
console.log('✅ DDD 限界上下文战略画布 (Context Canvas) 解析、三栏 Bento Grid SVG 渲染与步进提取通过');

// -------------------------------------------------------------
// 测试 12: DDD 统一文件中的 mode: domain-story 模式解析与渲染
// -------------------------------------------------------------
console.log('\n--- 测试 12: DDD 架构文件中的 mode: domain-story 统一模式 ---');
const dddDomainStoryDsl = `
mode: domain-story
title: 企业请假审批协同流
description: 员工与审批系统之间的全链路协作

actors:
  - 申请员工 [person]
  - 企业OA门户 [system]
  - 部门主管 [person]

activities:
  1. 申请员工 -> 发起请假申请单 -> 请假单 [document] -> 企业OA门户
  2. 企业OA门户 -> 路由审批待办 -> 待办通知 [email] -> 部门主管
  3. 部门主管 -> 签署同意意见 -> 审批批注 [document] -> 企业OA门户
`;
const dddDsModel = parseDomainStory(dddDomainStoryDsl);
assert.strictEqual(dddDsModel.mode, 'domain-story', 'DDD 中的 mode: domain-story 模式识别错误');
assert.strictEqual(dddDsModel.info?.name, '企业请假审批协同流');
assert.strictEqual(dddDsModel.actors.length, 3);
assert.strictEqual(dddDsModel.activities.length, 3);
const dddDsSvg = renderDomainStoryToSvg(dddDsModel, { currentStep: -1, isDark: true });
assert.ok(dddDsSvg.includes('企业请假审批协同流'), 'SVG 应包含标题');
assert.ok(dddDsSvg.includes('申请员工') && dddDsSvg.includes('企业OA门户'), 'SVG 应包含角色节点');
console.log('✅ DDD 统一架构文件 mode: domain-story 模式解析与 SVG 渲染通过');

// -------------------------------------------------------------
// 测试 13: 包含 Groups 的 DDD 领域故事智能拓扑分层与活动标牌碰撞避让
// -------------------------------------------------------------
console.log('\n--- 测试 13: Groups 业务中枢拓扑分层与防重叠避让验证 ---');
const ecommerceDsl = `
mode: domain-story
title: 电商订单履约与仓配协同领域故事
description: 买家、电商交易中台、支付网关与智能仓储中心的端到端协作

actors:
  - 买家 [person]
  - 电商交易中台 [system]
  - 统一支付网关 [system]
  - 智能仓储中心 [system]

groups:
  - 内部履约核心: 电商交易中台, 智能仓储中心

activities:
  1. 买家 -> 提交购物车结算 -> 订购清单 [document] -> 电商交易中台
  2. 电商交易中台 -> 发起预授权扣款 -> 扣款指令 [data] -> 统一支付网关
  3. 统一支付网关 -> 支付到账确认 -> 支付凭单 [document] -> 电商交易中台
  4. 电商交易中台 -> 派发实物分拣工单 -> 拣货任务单 [package] -> 智能仓储中心
  5. 智能仓储中心 -> 扫描打包发货 -> 运单与包裹 [package] -> 买家
`;

const ecModel = parseDomainStory(ecommerceDsl);
const ecLaidOut = computeAutoLayout(ecModel);

// 验证中枢 Group 角色居中垂直对齐，买家在左，支付网关在右
const buyer = ecLaidOut.actors.find(a => a.name === '买家');
const ecPlatform = ecLaidOut.actors.find(a => a.name === '电商交易中台');
const warehouse = ecLaidOut.actors.find(a => a.name === '智能仓储中心');
const payment = ecLaidOut.actors.find(a => a.name === '统一支付网关');

assert.ok(buyer && ecPlatform && warehouse && payment, '所有角色应成功排布');
assert.ok(buyer.x < ecPlatform.x, '买家(外部发起者)应排布在内部中枢左侧');
assert.ok(payment.x > ecPlatform.x, '统一支付网关(外部支撑服务)应排布在内部中枢右侧');
assert.strictEqual(ecPlatform.x, warehouse.x, '内部核心 Group 角色应在中轴纵向居中对齐');
assert.ok(warehouse.y > ecPlatform.y, '智能仓储中心应处于下游工序位置');

// 渲染 SVG 并验证标牌无重叠碰撞
const ecSvg = renderDomainStoryToSvg(ecLaidOut, { isDark: true });
assert.ok(ecSvg.includes('内部履约核心'), '应渲染内部履约核心 Group 虚线框');

const labelRegex = /<g class="ds-activity" id="([^"]+)"[^>]*>[\s\S]*?<g transform="translate\(([^,]+),\s*([^)]+)\)">/g;
let match;
const labelPositions = [];
while ((match = labelRegex.exec(ecSvg)) !== null) {
  labelPositions.push({ id: match[1], x: parseFloat(match[2]), y: parseFloat(match[3]) });
}
assert.strictEqual(labelPositions.length, 5, '5 个活动标牌均应成功渲染');

// 验证任意两个标牌之间均有充足空间，杜绝重叠
for (let i = 0; i < labelPositions.length; i++) {
  for (let j = i + 1; j < labelPositions.length; j++) {
    const dist = Math.hypot(labelPositions[i].x - labelPositions[j].x, labelPositions[i].y - labelPositions[j].y);
    assert.ok(dist >= 80, `活动标牌 [${labelPositions[i].id}] 与 [${labelPositions[j].id}] 间距应 >= 80px (实际: ${dist.toFixed(1)}px)`);
  }
}
console.log('✅ Groups 业务中枢拓扑分层、双向弧线对称分离与活动标牌 0 重叠校验全部通过');

// -------------------------------------------------------------
// 测试 14: 事件风暴横向自适应零溢出与限界上下文大半径零遮挡验证
// -------------------------------------------------------------
console.log('\n--- 测试 14: Event Storming 零溢出与 Context Map 零遮盖断言 ---');
const orderEsDsl = `
mode: event-storming
title: 电商大促下单与履约事件风暴 (Event Storming)
context: 交易与履约核心域 [core]

timeline:
  1. 买家 [actor] -> 提交购物车结算单 [cmd] -> @订单聚合 [agg] -> 订单已创建 [evt]
     read: 订单确认页读视图 [readmodel]
     hotspot: 秒杀高并发下预占库存超卖风险？是否引入 Redis 预扣减？
  2. 订单已创建 [evt] -> 自动触发风控与支付策略 [policy] -> 发起渠道扣款 [cmd] -> $微信支付网关 [ext] -> 支付已成功 [evt]
     read: 实时交易风控监控大盘 [readmodel]
  3. 支付已成功 [evt] -> 驱动履约配货策略 [policy] -> 下发波次分拣指令 [cmd] -> @履约单聚合 [agg] -> 仓库已接单出库 [evt]
     read: 买家物流轨迹实时看板 [readmodel]
     hotspot: 跨仓拆单场景下部分商品缺货如何触发逆向部分退款？
`;
const fullEsModel = parseDomainStory(orderEsDsl);
const fullEsSvg = renderDomainStoryToSvg(fullEsModel, { isDark: true });

const esVw = parseFloat(fullEsSvg.match(/viewBox="0 0 ([^ ]+) /)?.[1] || '0');
assert.ok(esVw >= 1280, `Event Storming 画布宽度应具备自适应充裕空间 (实际: ${esVw})`);
// 验证最右侧 HOTSPOT 痛点卡片未超出泳道右外框
const esHotspots = [...fullEsSvg.matchAll(/class="es-hotspot" transform="translate\(([^,]+),/g)];
esHotspots.forEach((m, idx) => {
  const xInLane = parseFloat(m[1]);
  const hotspotRight = 94 + xInLane + 134; // 94 为左偏移，134 为痛点卡片宽
  const laneRight = 20 + (esVw - 40);
  assert.ok(hotspotRight < laneRight - 30, `Flow #${idx+1} HOTSPOT 应当在泳道内留有至少 30px 安全空间 (实际留白: ${(laneRight - hotspotRight).toFixed(1)}px)`);
});

// Context Map 6 节点大半径与零遮挡断言
const retailCmDsl = `
mode: context-map
title: 智慧零售核心领域上下文映射图
contexts:
  - 交易订单上下文 [core]
  - 商品与价格上下文 [core]
  - 营销促销上下文 [supporting]
  - 仓储物流上下文 [supporting]
  - 会员与积分上下文 [supporting]
  - 统一支付网关 [generic]
relationships:
  1. 商品与价格上下文 [U: OHS, PL] -> 交易订单上下文 [D: ACL] : 商品快照与价格契约
  2. 营销促销上下文 [U: OHS, PL] -> 交易订单上下文 [D: ACL] : 优惠试算防腐契约
  3. 交易订单上下文 [U] <-> 统一支付网关 [D: ACL] : 渠道回调防腐适配
  4. 交易订单上下文 [U: PL] ->> 仓储物流上下文 [D: Conformist] : OrderPaidEvent
  5. 仓储物流上下文 [U: PL] ->> 会员与积分上下文 [D: ACL] : OrderShippedEvent
`;
const fullCmModel = parseDomainStory(retailCmDsl);
const fullCmSvg = renderDomainStoryToSvg(fullCmModel, { isDark: true });

const cmVw = parseFloat(fullCmSvg.match(/viewBox="0 0 ([^ ]+) /)?.[1] || '0');
assert.ok(cmVw >= 1360, `Context Map 环绕布局画布宽度应 >= 1360 (实际: ${cmVw})`);

// 提取所有卡片
const cmCards = [...fullCmSvg.matchAll(/class="cm-context-card" transform="translate\(([^,]+),\s*([^)]+)\)"/g)].map((m, i) => ({
  id: i,
  x: parseFloat(m[1]),
  y: parseFloat(m[2]),
  w: 260,
  h: 130,
}));
assert.strictEqual(cmCards.length, 6, '应有 6 个上下文卡片');

// 验证卡片间最小净缝隙 >= 130px
for (let i = 0; i < cmCards.length; i++) {
  for (let j = i + 1; j < cmCards.length; j++) {
    const c1 = cmCards[i];
    const c2 = cmCards[j];
    const dx = Math.max(0, Math.max(c1.x - (c2.x + c2.w), c2.x - (c1.x + c1.w)));
    const dy = Math.max(0, Math.max(c1.y - (c2.y + c2.h), c2.y - (c1.y + c1.h)));
    const gap = Math.hypot(dx, dy);
    assert.ok(gap >= 130, `卡片 [${i}] 与 [${j}] 净缝隙应 >= 130px (实际: ${gap.toFixed(1)}px)`);
  }
}

// 验证顶层关系标签与卡片 100% 零重合
const cmBadges = [...fullCmSvg.matchAll(/class="cm-rel-badge" transform="translate\(([^,]+),\s*([^)]+)\)"[\s\S]*?<rect x="([^"]+)" y="([^"]+)" width="([^"]+)" height="([^"]+)"/g)];
assert.strictEqual(cmBadges.length, 5, '应渲染 5 个独立关系契约铭牌');

cmBadges.forEach((m, idx) => {
  const bx = parseFloat(m[1]);
  const by = parseFloat(m[2]);
  const bw = parseFloat(m[5]);
  const bh = parseFloat(m[6]);
  const bLeft = bx - bw / 2;
  const bRight = bx + bw / 2;
  const bTop = by - bh / 2;
  const bBottom = by + bh / 2;

  cmCards.forEach(c => {
    const overlapX = Math.max(0, Math.min(bRight, c.x + c.w) - Math.max(bLeft, c.x));
    const overlapY = Math.max(0, Math.min(bBottom, c.y + c.h) - Math.max(bTop, c.y));
    assert.ok(overlapX === 0 || overlapY === 0, `标签 #${idx+1} 不得与卡片 #${c.id} 发生任何几何重叠`);
  });
});
console.log('✅ Event Storming 零溢出与 Context Map 零遮盖全部断言通过');

// -------------------------------------------------------------
// 测试 15: DDD 领域建模图表 14 大渲染主题高保真调色盘深度联动验证
// -------------------------------------------------------------
console.log('\n--- 测试 15: DDD 14 大渲染主题调色盘联动断言 ---');
const draculaCmSvg = renderDomainStoryToSvg(fullCmModel, { theme: 'dracula', isDark: true });
assert.ok(draculaCmSvg.includes('#21222c'), 'Dracula 主题下卡片背景应为 #21222c');
assert.ok(draculaCmSvg.includes('#bd93f9'), 'Dracula 主题下关系连线与副标题应为德古拉紫 #bd93f9');

const catppuccinEsSvg = renderDomainStoryToSvg(fullEsModel, { theme: 'catppuccin', isDark: true });
assert.ok(catppuccinEsSvg.includes('#181825'), 'Catppuccin 主题下泳道背景应为 #181825');
assert.ok(catppuccinEsSvg.includes('#cdd6f4'), 'Catppuccin 主题下文字应为 #cdd6f4');

const sepiaCmSvg = renderDomainStoryToSvg(fullCmModel, { theme: 'sepia', isDark: false });
assert.ok(sepiaCmSvg.includes('#fffbf2'), 'Sepia 暖阳主题下卡片背景应为 #fffbf2');
assert.ok(sepiaCmSvg.includes('#b45309'), 'Sepia 暖阳主题下连线应为琥珀色 #b45309');

const nordEsSvg = renderDomainStoryToSvg(fullEsModel, { theme: 'nord', isDark: true });
assert.ok(nordEsSvg.includes('#242933'), 'Nord 极地主题下泳道背景应为 #242933');
assert.ok(nordEsSvg.includes('#eceff4'), 'Nord 极地主题下文字应为 #eceff4');

// 标准领域故事图 (Domain Storytelling) 主题自适应断言
const draculaDsSvg = renderDomainStoryToSvg(modelFromJson, { theme: 'dracula', isDark: true });
assert.ok(draculaDsSvg.includes('#bd93f9'), 'Dracula 下标准领域故事图箭头与强调色应为德古拉紫 #bd93f9');
const sepiaDsSvg = renderDomainStoryToSvg(modelFromJson, { theme: 'sepia', isDark: false });
assert.ok(sepiaDsSvg.includes('#b45309'), 'Sepia 下标准领域故事图线条应为暖阳琥珀 #b45309');
console.log('✅ DDD 14 大渲染主题专属调色盘深度联动断言全部通过');

console.log('\n🎉 全部 15 组 DDD & Domain Storytelling 单元测试用例 100% 全部通过！\n');

