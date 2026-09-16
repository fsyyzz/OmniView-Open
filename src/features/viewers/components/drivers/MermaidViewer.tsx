/**
 * OmniView 独立 Mermaid 图表工作室 (.mmd / .mermaid)
 * 对齐 MindmapViewer：默认分屏源码编辑 + 实时全高交互矢量预览
 */
import React from 'react';
import { MermaidStudioCanvas } from './mermaid/MermaidStudioCanvas';
import { DiagramStudioShell, DiagramSnippet } from './DiagramStudioShell';
import { Locale } from '../../../../shared/lib/i18n';

interface MermaidViewerProps {
  content: string;
  fileName?: string;
  locale?: Locale;
  onContentChange?: (content: string) => void;
}

const MERMAID_SNIPPETS: DiagramSnippet[] = [
  {
    label: 'flowchart',
    code: '\nflowchart TD\n  A[开始] --> B{判断}\n  B -->|是| C[通过]\n  B -->|否| D[回退]\n',
    tooltip: '插入流程图模板',
  },
  {
    label: 'sequence',
    code: '\nsequenceDiagram\n  participant Client\n  participant Server\n  Client->>Server: 请求\n  Server-->>Client: 响应\n',
    tooltip: '插入时序图模板',
  },
  {
    label: 'class',
    code: '\nclassDiagram\n  class OmniView {\n    +render()\n  }\n  OmniView <|-- MermaidViewer\n',
    tooltip: '插入类图模板',
  },
  {
    label: 'state',
    code: '\nstateDiagram-v2\n  [*] --> Idle\n  Idle --> Rendering\n  Rendering --> [*]\n',
    tooltip: '插入状态图模板',
  },
];

const DEFAULT_MERMAID_TEMPLATE = `flowchart LR
  A[源码编辑] --> B[实时编译]
  B --> C[矢量预览]
  C --> D[导出 SVG]
`;

export const MermaidViewer: React.FC<MermaidViewerProps> = ({
  content,
  fileName = 'diagram.mmd',
  locale = 'zh-CN',
  onContentChange,
}) => {
  return (
    <DiagramStudioShell
      title="Mermaid 图表工作室"
      fileName={fileName}
      content={content}
      onContentChange={onContentChange}
      storageKeyPrefix="mermaid"
      languageLabel="Mermaid DSL"
      placeholder={'flowchart TD\n  A[开始] --> B[结束]'}
      accentClass="cyan"
      snippets={MERMAID_SNIPPETS}
      defaultTemplate={DEFAULT_MERMAID_TEMPLATE}
      renderPreview={code => (
        <MermaidStudioCanvas
          code={code}
          fileName={fileName}
          locale={locale}
          onCodeChange={onContentChange}
        />
      )}
    />
  );
};

