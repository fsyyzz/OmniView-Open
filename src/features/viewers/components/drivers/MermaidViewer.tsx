/**
 * OmniView 独立 Mermaid 图表工作室 (.mmd / .mermaid)
 * 对齐 MindmapViewer：默认分屏源码编辑 + 实时预览
 */
import React, { useState } from 'react';
import { MermaidBlock } from './markdown/MermaidBlock';
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
  const [zoom, setZoom] = useState(1);
  const [isCopied, setIsCopied] = useState(false);
  const [previewTick, setPreviewTick] = useState(0);

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
        <div className="flex-1 min-h-0 overflow-auto p-3">
          <MermaidBlock
            key={`mermaid-preview-${previewTick}`}
            id="standalone-mermaid"
            code={code}
            editedCode={code}
            onChangeEditedCode={() => undefined}
            isCopied={isCopied}
            viewMode="visual"
            zoom={zoom}
            onSetViewMode={() => undefined}
            onZoomChange={delta =>
              setZoom(z => Math.min(3, Math.max(0.4, Number((z + delta).toFixed(2)))))
            }
            onResetZoom={() => setZoom(1)}
            onOpenLightbox={() => undefined}
            onReRender={() => setPreviewTick(n => n + 1)}
            onDownloadSvg={() => undefined}
            onCopy={() => void handleCopyFromBlock(code)}
            locale={locale}
          />
        </div>
      )}
    />
  );
};
