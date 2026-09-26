/**
 * OmniView 领域故事讲授法工作室 (.egn / .domainstory)
 * 纯本地优先、零网络依赖、MIT 协议兼容
 * 兼容 egon.io 标准 .egn (JSON) 与 Markdown story DSL 双向编辑
 */
import React, { useState } from 'react';
import { DomainStoryBlock } from './markdown/DomainStoryBlock.tsx';
import { DiagramStudioShell, DiagramSnippet } from './DiagramStudioShell.tsx';
import { Locale } from '../../../../shared/lib/i18n.ts';

interface DomainStoryViewerProps {
  content: string;
  fileName?: string;
  locale?: Locale;
  onContentChange?: (content: string) => void;
  onOpenInEditor?: () => void;
}

const DOMAIN_STORY_SNIPPETS: DiagramSnippet[] = [
  {
    label: 'DSL 声明式',
    code: `
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
    tooltip: '插入 DDD 领域故事标准 DSL 模板',
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
  onContentChange,
  onOpenInEditor,
}) => {
  const [zoom, setZoom] = useState(1);
  const [isCopied, setIsCopied] = useState(false);

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
    <DiagramStudioShell
      title="Domain Storytelling 领域故事讲授工作室"
      fileName={fileName}
      content={content}
      onContentChange={onContentChange}
      onOpenInEditor={onOpenInEditor}
      storageKeyPrefix="domainstory"
      languageLabel="Domain Story (.dst / .domainstory)"
      placeholder={'title: 业务流转\n1. 买家 -> 下单 -> 商城'}
      accentClass="cyan"
      snippets={DOMAIN_STORY_SNIPPETS}
      defaultTemplate={DEFAULT_STORY_TEMPLATE}
      renderPreview={code => (
        <div className="flex-1 min-h-0 overflow-auto p-4 flex flex-col items-center">
          <div className="w-full max-w-5xl">
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
              onOpenLightbox={() => undefined}
              onCopy={() => handleCopyFromBlock(code)}
              locale={locale}
            />
          </div>
        </div>
      )}
    />
  );
};
