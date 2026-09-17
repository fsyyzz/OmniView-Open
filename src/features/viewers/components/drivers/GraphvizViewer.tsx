/**
 * OmniView 独立 Graphviz / DOT 图表工作室 (.dot / .gv)
 * 对齐 MindmapViewer / MermaidViewer：默认分屏源码编辑 + 实时全高交互矢量预览 (居中 + 缩放平移 + 多引擎)
 */
import React from 'react';
import { GraphvizStudioCanvas } from './graphviz/GraphvizStudioCanvas';
import { DiagramStudioShell, DiagramSnippet } from './DiagramStudioShell';
import { Locale } from '../../../../shared/lib/i18n';

interface GraphvizViewerProps {
  content: string;
  fileName?: string;
  locale?: Locale;
  onContentChange?: (content: string) => void;
  onOpenInEditor?: () => void;
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
  onOpenInEditor,
}) => {
  return (
    <DiagramStudioShell
      title="Graphviz DOT 工作室"
      fileName={fileName}
      content={content}
      onContentChange={onContentChange}
      onOpenInEditor={onOpenInEditor}
      storageKeyPrefix="graphviz"
      languageLabel="DOT / Graphviz"
      placeholder={'digraph G {\n  A -> B;\n}'}
      accentClass="emerald"
      snippets={GRAPHVIZ_SNIPPETS}
      defaultTemplate={DEFAULT_GRAPHVIZ_TEMPLATE}
      renderPreview={code => (
        <GraphvizStudioCanvas
          code={code}
          fileName={fileName}
          locale={locale}
          onCodeChange={onContentChange}
        />
      )}
    />
  );
};

