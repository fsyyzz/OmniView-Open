/**
 * OmniView 领域故事讲授法工作室 (.egn / .domainstory)
 * 纯本地优先、零网络依赖、MIT 协议兼容
 * 兼容 egon.io 标准 .egn (JSON) 与 Markdown story DSL 双向编辑
 */
import React, { useState } from 'react';
import { DomainStoryBlock } from './markdown/DomainStoryBlock.tsx';
import { DiagramStudioShell, DiagramSnippet } from './DiagramStudioShell.tsx';
import { Locale } from '../../../../shared/lib/i18n.ts';
import { LightboxModal, LightboxItem } from '../common/LightboxModal.tsx';

interface DomainStoryViewerProps {
  content: string;
  fileName?: string;
  locale?: Locale;
  isDarkTheme?: boolean;
  theme?: string;
  onContentChange?: (content: string) => void;
  onOpenInEditor?: () => void;
  onOpenSettings?: () => void;
  onOpenShortcuts?: () => void;
}

const DOMAIN_STORY_SNIPPETS: DiagramSnippet[] = [
  {
    label: '领域故事 (Domain Story)',
    code: `
mode: domain-story
title: 订单创建与履约流程
description: 买家、电商与仓储系统的协作

actors:
  - 客户 [person]
  - 电商中台 [system]
  - 仓储中心 [system]

groups:
  - 内部履约域: 电商中台, 仓储中心

activities:
  1. 客户 -> 提交购物车 -> 订购清单 [document] -> 电商中台
  2. 电商中台 -> 创建销售凭单 -> 电子订单 [document] -> 电商中台
  3. 电商中台 -> 下发分拣作业 -> 拣货任务 [package] -> 仓储中心
`,
    tooltip: '插入 DDD 领域故事 (Domain Story) 标准 DSL 模板',
  },
  {
    label: '事件风暴 (Event Storming)',
    code: `
mode: event-storming
title: 电商大促下单与履约事件风暴
context: 交易与履约中心 [core]
description: 围绕下单、风控、支付、锁库与出库的完整事件因果链

timeline:
  1. 买家 [actor] -> 提交结算单 [cmd] -> @订单聚合 [agg] -> 订单已创建 [evt]
     read: 订单确认页读视图 [readmodel]
     hotspot: 秒杀高并发下预占库存超卖风险？
  2. 订单已创建 [evt] -> 自动触发风控与支付策略 [policy] -> 发起渠道扣款 [cmd] -> $微信支付网关 [ext] -> 支付已成功 [evt]
  3. 支付已成功 [evt] -> 驱动履约配货策略 [policy] -> 下发分拣指令 [cmd] -> @履约单聚合 [agg] -> 仓库已接单出库 [evt]
     read: 物流轨迹实时看板 [readmodel]
`,
    tooltip: '插入 DDD 事件风暴时间轴便利贴 (Command / Aggregate / Event / Policy / Hotspot) 模板',
  },
  {
    label: '上下文映射 (Context Map)',
    code: `
mode: context-map
title: 智慧零售核心领域上下文映射 (Context Map)
description: 核心域、支撑域与通用域的上下游防腐层 (ACL) 与开放主机 (OHS/PL) 协同拓扑

contexts:
  - 交易订单上下文 [core] (team: 交易研发组, desc: 购物车结算、订单生命周期与状态机, aggregates: 订单聚合, 履约单聚合)
  - 营销促销上下文 [supporting] (team: 增长营销组, desc: 优惠券、满减算价与秒杀活动引擎, aggregates: 优惠券聚合, 算价规则)
  - 仓储物流上下文 [supporting] (team: 供应链研发组, desc: 分仓路由、WMS 波次拣货与运单跟踪, aggregates: 出库单聚合, 库存台账)
  - 统一支付网关 [generic] (team: 金融基础设施组, desc: 微信/支付宝/银联多渠道收单与清结算, aggregates: 支付流水聚合)

relationships:
  1. 营销促销上下文 [U: OHS, PL] -> 交易订单上下文 [D: ACL] : 优惠试算与锁定核销契约
  2. 交易订单上下文 [U] <-> 统一支付网关 [D: ACL] : 预支付指令与渠道回调防腐适配
  3. 交易订单上下文 [U: PL] ->> 仓储物流上下文 [D: Conformist] : OrderPaidEvent (异步领域事件)
`,
    tooltip: '插入 DDD 战略设计限界上下文映射图 (Core / Supporting / Generic + ACL / OHS / PL) 模板',
  },
  {
    label: '核心域象限图 (Core Domain)',
    code: `
mode: core-domain-chart
title: 新零售战略投资与子域分类矩阵 (Core Domain Chart)
description: 业务模型复杂度 vs 业务差异化 4 象限战略投资分析与技术演进

domains:
  - 智能动态推荐引擎 [core] (complexity: 88, diff: 94, invest: 战略自研/专利算法) -> 保持核心差异化壁垒
  - 实时订单结算履约 [core] (complexity: 78, diff: 82, invest: 精细自研/高可用架构)
  - 动态营销促活算价 [supporting] (complexity: 65, diff: 45, invest: 敏捷迭代/自建规则引擎)
  - 智能分仓路径调度 [supporting] (complexity: 72, diff: 38, invest: 半自研+专业运筹SDK)
  - 多渠道收单清结算 [generic] (complexity: 35, diff: 15, invest: 采购成熟SaaS/聚合支付)
  - 员工考勤与薪资结算 [generic] (complexity: 25, diff: 8, invest: 标准商业ERP软件)
`,
    tooltip: '插入 DDD 战略设计核心域四象限投资矩阵 (Core Domain Chart) 模板',
  },
  {
    label: '限界上下文画布 (Context Canvas)',
    code: `
mode: context-canvas
context: 订单履约上下文 (Order Fulfillment Context)
classification: core
team: 交易核心研发组
description: 负责全渠道订单从创建、风控支付、分仓分单、锁定发货至售后完结的全生命周期编排与状态一致性保障

inbound:
  commands:
    - SubmitOrderCommand (提交下单)
    - PayOrderCommand (支付订单)
    - CancelOrderCommand (取消订单)
    - RequestRefundCommand (发起售后退款)
  events:
    - PaymentSuccessEvent (支付渠道到账)
    - InventoryLockedEvent (分仓实物锁库)
    - WaybillDispatchedEvent (运单已揽件)
  queries:
    - GetOrderDetailQuery (查询订单全景详情)
    - GetFulfillmentTimelineQuery (订单履约轨迹时间轴)

decisions:
  - 严格幂等保障: 采用 CommandId 与分布式 Redis 租约锁，彻底避免重复扣款与重发
  - 状态机强约束: 订单生命周期仅允许单向确定性状态流转，取消/退款必须触发补偿 Saga
  - 最终一致性保障: 跨仓储与支付网关交互一律基于 Outbox 模式发布领域事件，杜绝分布式悬挂事务

language:
  - 订单聚合 (Order Aggregate) : 订单业务唯一凭证与聚合根，守护金额及项明细不变式
  - 履约单 (Fulfillment Order) : 面向仓库与配送承运商派发的实际发货实物包
  - 补偿流 (Compensating Saga) : 当支付失败或库存售罄时执行的反向回滚编排
  - 幂等键 (Idempotency Key) : 客户端唯一请求序列标识，用于去重防刷

outbound:
  events:
    - OrderCreatedEvent (订单已创建事件)
    - OrderPaidEvent (订单已支付事件)
    - OrderDeliveredEvent (订单已完成交付)
  dependencies:
    - 统一支付网关 (Generic) : ACL 防腐层 RPC 预支付收单与回调鉴权
    - 仓储配送上下文 (Supporting) : OHS/PL 异步投递分拣发货任务
`,
    tooltip: '插入 DDD 限界上下文战略架构画布 (Inbound / Strategic Heart / Outbound Bento Grid) 模板',
  },
  {
    label: '单行极简流',
    code: `
title: 会议室预约旅程
1. 员工 (person) -> 查询空闲时段 [data] -> 预约系统 (system)
2. 员工 -> 提交申请单 [document] -> 预约系统
3. 预约系统 -> 发送预订确认函 [email] -> 员工
`,
    tooltip: '插入单行极简流故事模板',
  },
  {
    label: 'egon.io JSON',
    code: JSON.stringify(
      {
        info: {
          name: '客户服务工单流转',
          description: '基于 egon.io JSON 格式',
          version: '1.0',
        },
        actors: [
          { id: 'a1', name: '客户', type: 'person', x: 140, y: 180 },
          { id: 'a2', name: '客服系统', type: 'system', x: 420, y: 180 },
          { id: 'a3', name: '二线专家', type: 'person', x: 700, y: 180 },
        ],
        workObjects: [
          { id: 'w1', name: '报修工单', type: 'document' },
          { id: 'w2', name: '诊断建议', type: 'data' },
        ],
        activities: [
          { id: 'act-1', number: 1, from: 'a1', to: 'a2', label: '发起报修', workObjectName: '报修工单' },
          { id: 'act-2', number: 2, from: 'a2', to: 'a3', label: '派发专家诊断', workObjectName: '报修工单' },
          { id: 'act-3', number: 3, from: 'a3', to: 'a1', label: '远程电话指导', workObjectName: '诊断建议' },
        ],
      },
      null,
      2
    ),
    tooltip: '插入官方 egon.io .dst JSON 结构模板',
  },
];

const DEFAULT_STORY_TEMPLATE = `title: 采购审批流程
description: 敏捷 DDD 领域故事示例

actors:
  - 员工 [person]
  - 审批中心 [system]
  - 财务系统 [system]

activities:
  1. 员工 -> 提交报销单 -> 差旅发票 [document] -> 审批中心
  2. 审批中心 -> 自动规则校验 -> 额度报告 [data] -> 审批中心
  3. 审批中心 -> 批准并下发付款 -> 转账凭据 [money] -> 财务系统
`;

export const DomainStoryViewer: React.FC<DomainStoryViewerProps> = ({
  content,
  fileName = 'story.dst',
  locale = 'zh-CN',
  isDarkTheme,
  theme,
  onContentChange,
  onOpenInEditor,
  onOpenSettings,
  onOpenShortcuts,
}) => {
  const [zoom, setZoom] = useState(1);
  const [isCopied, setIsCopied] = useState(false);
  const [lightboxItem, setLightboxItem] = useState<LightboxItem | null>(null);

  const effectiveIsDark =
    isDarkTheme !== undefined
      ? isDarkTheme
      : typeof document !== 'undefined'
      ? !document.documentElement.getAttribute('data-theme')?.includes('light') &&
        document.documentElement.getAttribute('data-theme') !== 'sepia' &&
        document.documentElement.getAttribute('data-theme') !== 'paper'
      : true;

  const handleCopyFromBlock = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 1600);
    } catch {
      /* ignore */
    }
  };

  return (
    <>
      <DiagramStudioShell
        title="DDD 领域驱动设计与领域故事工作室"
        fileName={fileName}
        content={content}
        onContentChange={onContentChange}
        onOpenInEditor={onOpenInEditor}
        onOpenSettings={onOpenSettings}
        onOpenShortcuts={onOpenShortcuts}
        storageKeyPrefix="domainstory"
        languageLabel="DDD 领域建模与设计 (.ddd)"
        placeholder={'title: 业务流转\n1. 买家 -> 下单 -> 商城'}
        accentClass="cyan"
        snippets={DOMAIN_STORY_SNIPPETS}
        defaultTemplate={DEFAULT_STORY_TEMPLATE}
        renderPreview={code => (
          <div className="flex-1 min-h-0 overflow-auto p-6 flex flex-col items-center">
            <div className="w-full max-w-7xl">
              <DomainStoryBlock
                id="standalone-domainstory"
                code={code}
                editedCode={code}
                onChangeEditedCode={() => undefined}
                isCopied={isCopied}
                viewMode="visual"
                zoom={zoom}
                onSetViewMode={() => undefined}
                onZoomChange={delta =>
                  setZoom(prev => Math.min(2.5, Math.max(0.4, Number((prev + delta).toFixed(2)))))
                }
                onResetZoom={() => setZoom(1)}
                onOpenLightbox={svg =>
                  setLightboxItem({
                    title: `Domain Story 全屏高清预览 (${fileName})`,
                    content: svg,
                    fileName: fileName.replace(/\.[^/.]+$/, ''),
                  })
                }
                onCopy={() => handleCopyFromBlock(code)}
                locale={locale}
                isDarkTheme={effectiveIsDark}
              />
            </div>
          </div>
        )}
      />
      <LightboxModal
        item={lightboxItem}
        onClose={() => setLightboxItem(null)}
        locale={locale}
      />
    </>
  );
};
