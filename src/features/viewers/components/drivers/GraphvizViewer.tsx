/**
 * OmniView 独立 Graphviz / DOT 图表工作室 (.dot / .gv)
 * 对齐 MindmapViewer：默认分屏源码编辑 + 实时预览
 */
import React, { useState } from 'react';
import { GraphvizBlock } from './markdown/GraphvizBlock';
import { DiagramStudioShell, DiagramSnippet } from './DiagramStudioShell';
import { Locale } from '../../../../shared/lib/i18n';

interface GraphvizViewerProps {
  content: string;
  fileName?: string;
  locale?: Locale;
  onContentChange?: (content: string) => void;
}

const GRAPHVIZ_SNIPPETS: DiagramSnippet[] = [
  {
    label: 'digraph',
    code: '\ndigraph G {\n  rankdir=LR;\n  A -> B -> C;\n}\n',
    tooltip: '插入有向图骨架',
  },
  {
    label: 'subgraph',
    code: '\nsubgraph cluster_app {\n  label="Application";\n  style=filled;\n  color=lightgrey;\n  node [style=filled,color=white];\n  api; worker;\n}\n',
    tooltip: '插入子图集群',
  },
  {
    label: 'edge label',
    code: '\nClient -> Gateway [label="HTTPS"];\n',
    tooltip: '插入带标签边',
  },
  {
    label: 'node shape',
    code: '\nDatabase [shape=cylinder, label="PostgreSQL"];\n',
    tooltip: '插入圆柱形节点',
  },
];

const DEFAULT_GRAPHVIZ_TEMPLATE = `digraph OmniView {
  rankdir=LR;
  node [shape=box, style=rounded];

  Editor [label="源码编辑"];
  Render [label="DOT 编译"];
  Preview [label="矢量预览"];

  Editor -> Render -> Preview;
}
`;

export const GraphvizViewer: React.FC<GraphvizViewerProps> = ({
  content,
  fileName = 'diagram.dot',
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
      title="Graphviz DOT 工作室"
      fileName={fileName}
      content={content}
      onContentChange={onContentChange}
      storageKeyPrefix="graphviz"
      languageLabel="DOT / Graphviz"
      placeholder={'digraph G {\n  A -> B;\n}'}
      accentClass="emerald"
      snippets={GRAPHVIZ_SNIPPETS}
      defaultTemplate={DEFAULT_GRAPHVIZ_TEMPLATE}
      renderPreview={code => (
        <div className="flex-1 min-h-0 overflow-auto p-3">
          <GraphvizBlock
            key={`graphviz-preview-${previewTick}`}
            id="standalone-graphviz"
            code={code}
            engine="dot"
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
