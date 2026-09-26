/**
 * OmniView 驱动注册中心与插件 SPI 契约 (Driver Registry & Plugin SPI)
 * 遵循 OCP (开闭原则) 与 Strategy (策略模式)
 */
import React, { lazy } from 'react';
import type { FileItem, DriverId, ViewMode, ThemeId, ContentWidthMode, DensityMode } from '../../../shared/types';
import type { Locale } from '../../../shared/lib/i18n';

export interface DriverProps {
  file?: FileItem;
  files?: FileItem[];
  content?: string;
  fileName?: string;
  extension?: string;
  fileSize?: number;
  binaryUrl?: string;
  isDarkTheme?: boolean;
  mode?: ViewMode;
  theme?: ThemeId;
  density?: DensityMode;
  contentWidth?: ContentWidthMode;
  zoom?: number;
  locale?: Locale;
  onContentChange?: (content: string) => void;
  onRenderComplete?: () => void;
  onOpenSourceAtLine?: (line: number) => void;
  onOpenInEditor?: () => void;
  onSelectFile?: (file: FileItem) => void;
  enableOkf?: boolean;
  onToggleOkf?: () => void;
  eagerMount?: boolean;
}

export interface DriverPlugin {
  id: DriverId;
  name: string;
  extensions: string[];
  matchFile?: (file: Partial<FileItem>) => boolean;
  getComponent: () => React.LazyExoticComponent<React.ComponentType<any>>;
  supportsSplitView?: boolean;
}

// 惰性懒加载驱动组件映射缓存
const componentCache: Partial<Record<DriverId, React.LazyExoticComponent<React.ComponentType<any>>>> = {};

function createLazyDriver(id: DriverId, importer: () => Promise<{ [key: string]: any }>, exportName: string) {
  return () => {
    if (!componentCache[id]) {
      componentCache[id] = lazy(() => importer().then(m => ({ default: m[exportName] })));
    }
    return componentCache[id]!;
  };
}

/**
 * 驱动注册表清单
 */
const DRIVER_PLUGINS: DriverPlugin[] = [
  {
    id: 'markdown',
    name: 'Markdown 排版引擎',
    extensions: ['md', 'markdown', 'okf'],
    getComponent: createLazyDriver('markdown', () => import('../components/drivers/MarkdownViewer'), 'MarkdownViewer'),
    supportsSplitView: true,
  },
  {
    id: 'mindmap',
    name: '思维导图 (Mindmap)',
    extensions: ['mm', 'markmap', 'mindmap', 'km'],
    getComponent: createLazyDriver('mindmap', () => import('../components/drivers/MindmapViewer'), 'MindmapViewer'),
  },
  {
    id: 'plantuml',
    name: 'PlantUML 建模图',
    extensions: ['puml', 'plantuml', 'iuml'],
    getComponent: createLazyDriver('plantuml', () => import('../components/drivers/PlantUmlViewer'), 'PlantUmlViewer'),
  },
  {
    id: 'mermaid',
    name: 'Mermaid 图表',
    extensions: ['mmd', 'mermaid'],
    getComponent: createLazyDriver('mermaid', () => import('../components/drivers/MermaidViewer'), 'MermaidViewer'),
  },
  {
    id: 'graphviz',
    name: 'Graphviz DOT 拓扑图',
    extensions: ['dot', 'gv', 'graphviz'],
    getComponent: createLazyDriver('graphviz', () => import('../components/drivers/GraphvizViewer'), 'GraphvizViewer'),
  },
  {
    id: 'svg',
    name: 'SVG 矢量图形',
    extensions: ['svg'],
    getComponent: createLazyDriver('svg', () => import('../components/drivers/SvgViewer'), 'SvgViewer'),
  },
  {
    id: 'pdf',
    name: 'PDF 文档阅读器',
    extensions: ['pdf'],
    getComponent: createLazyDriver('pdf', () => import('../components/drivers/PdfViewer'), 'PdfViewer'),
  },
  {
    id: 'csv',
    name: 'CSV/TSV 数据表格',
    extensions: ['csv', 'tsv'],
    getComponent: createLazyDriver('csv', () => import('../components/drivers/CsvViewer'), 'CsvViewer'),
  },
  {
    id: 'notebook',
    name: 'Jupyter Notebook',
    extensions: ['ipynb'],
    getComponent: createLazyDriver('notebook', () => import('../components/drivers/NotebookViewer'), 'NotebookViewer'),
  },
  {
    id: 'typst',
    name: 'Typst 现代排版引擎',
    extensions: ['typ', 'typst'],
    getComponent: createLazyDriver('typst', () => import('../components/drivers/TypstViewer'), 'TypstViewer'),
  },
  {
    id: 'excalidraw',
    name: 'Excalidraw 白板',
    extensions: ['excalidraw'],
    matchFile: (file) =>
      Boolean(
        file.name &&
          (file.name.toLowerCase().endsWith('.excalidraw.json') ||
            file.name.toLowerCase().endsWith('.excalidraw.svg'))
      ),
    getComponent: createLazyDriver('excalidraw', () => import('../components/drivers/ExcalidrawViewer'), 'ExcalidrawViewer'),
  },
  {
    id: 'domainstory',
    name: 'Domain Storytelling',
    extensions: ['dst', 'domainstory', 'egn'],
    matchFile: (file) =>
      Boolean(
        file.name &&
          (file.name.toLowerCase().endsWith('.dst.json') ||
            file.name.toLowerCase().endsWith('.story.json'))
      ),
    getComponent: createLazyDriver('domainstory', () => import('../components/drivers/DomainStoryViewer'), 'DomainStoryViewer'),
  },
  {
    id: 'epub',
    name: 'EPUB 电子书阅读器',
    extensions: ['epub'],
    getComponent: createLazyDriver('epub', () => import('../components/drivers/EpubViewer'), 'EpubViewer'),
  },
  {
    id: 'docx',
    name: 'Word 文档查看器',
    extensions: ['docx'],
    getComponent: createLazyDriver('docx', () => import('../components/drivers/DocxViewer'), 'DocxViewer'),
  },
  {
    id: 'pptx',
    name: 'PowerPoint 演示文稿',
    extensions: ['pptx'],
    getComponent: createLazyDriver('pptx', () => import('../components/drivers/PptxViewer'), 'PptxViewer'),
  },
  {
    id: 'xlsx',
    name: 'Excel 电子表格工作簿',
    extensions: ['xlsx', 'xls', 'xlsm', 'xltx'],
    getComponent: createLazyDriver('xlsx', () => import('../components/drivers/XlsxViewer'), 'XlsxViewer'),
  },
  {
    id: 'image',
    name: '现代图像工作台与像素检视器',
    extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'ico', 'avif', 'tiff'],
    getComponent: createLazyDriver('image', () => import('../components/drivers/ImageViewer'), 'ImageViewer'),
  },
  {
    id: 'dockerfile',
    name: 'Dockerfile 构建流水线与指令透视',
    extensions: ['dockerfile'],
    matchFile: (file) => {
      const lowerName = (file.name || '').toLowerCase();
      if (lowerName === 'dockerfile' || lowerName.startsWith('dockerfile.') || lowerName.endsWith('.dockerfile')) {
        return true;
      }
      if (file.content && /^\s*FROM\s+[\w\-./:]+/im.test(file.content.slice(0, 1000))) {
        return true;
      }
      return false;
    },
    getComponent: createLazyDriver('dockerfile', () => import('../components/drivers/DockerfileViewer'), 'DockerfileViewer'),
    supportsSplitView: true,
  },
  {
    id: 'compose',
    name: 'Docker Compose 微服务拓扑工作台',
    extensions: ['compose'],
    matchFile: (file) => {
      const lowerName = (file.name || '').toLowerCase();
      const isYaml = lowerName.endsWith('.yml') || lowerName.endsWith('.yaml');
      if (
        lowerName === 'docker-compose.yml' ||
        lowerName === 'docker-compose.yaml' ||
        lowerName.startsWith('docker-compose.') ||
        lowerName.includes('compose.yml') ||
        lowerName.includes('compose.yaml')
      ) {
        return true;
      }
      if (isYaml && file.content) {
        return (
          /^\s*services:\s*$/m.test(file.content) ||
          (/^\s*version:\s*['"]?[23]/m.test(file.content) && /services:/m.test(file.content))
        );
      }
      return false;
    },
    getComponent: createLazyDriver('compose', () => import('../components/drivers/ComposeViewer'), 'ComposeViewer'),
    supportsSplitView: true,
  },
  {
    id: 'k8s',
    name: 'Kubernetes 清单引力拓扑工作台',
    extensions: ['k8s'],
    matchFile: (file) => {
      const lowerName = (file.name || '').toLowerCase();
      const isYaml = lowerName.endsWith('.yml') || lowerName.endsWith('.yaml') || lowerName.endsWith('.k8s.yaml');
      if (
        lowerName.includes('k8s') ||
        lowerName.includes('kube') ||
        lowerName.includes('deployment') ||
        lowerName.includes('ingress') ||
        lowerName.includes('service')
      ) {
        if (isYaml && file.content && /^\s*apiVersion:\s*/m.test(file.content) && /^\s*kind:\s*/m.test(file.content)) {
          return true;
        }
      }
      if (isYaml && file.content && /^\s*apiVersion:\s*([a-zA-Z0-9.\-_/]+)/m.test(file.content)) {
        return /^\s*kind:\s*(Pod|Deployment|Service|Ingress|ConfigMap|Secret|StatefulSet|DaemonSet|Job|CronJob|Namespace|PersistentVolume|PersistentVolumeClaim|HorizontalPodAutoscaler|Gateway|VirtualService|CustomResourceDefinition)\b/m.test(file.content);
      }
      return false;
    },
    getComponent: createLazyDriver('k8s', () => import('../components/drivers/K8sViewer'), 'K8sViewer'),
    supportsSplitView: true,
  },
  {
    id: 'code',
    name: '通用代码/文本查看器',
    extensions: [],
    getComponent: createLazyDriver('code', () => import('../components/drivers/CodeViewer'), 'CodeViewer'),
  },
];


/**
 * 获取所有已注册的驱动插件
 */
export function getAllDriverPlugins(): DriverPlugin[] {
  return DRIVER_PLUGINS;
}

/**
 * 根据 DriverId 检索驱动插件
 */
export function getDriverPluginById(id: DriverId): DriverPlugin {
  const found = DRIVER_PLUGINS.find((p) => p.id === id);
  return found || DRIVER_PLUGINS[DRIVER_PLUGINS.length - 1]; // fallback to code
}

/**
 * 根据文件属性匹配目标驱动
 */
export function resolveDriverPluginForFile(file?: Partial<FileItem> | null): DriverPlugin {
  if (!file) return DRIVER_PLUGINS[0]; // fallback to markdown

  const extension = (file.extension || file.name?.split('.').pop() || '').toLowerCase();

  // 1. 优先执行自定义匹配断言（如 .excalidraw.json, .story.json 等复合后缀）
  for (const plugin of DRIVER_PLUGINS) {
    if (plugin.matchFile && plugin.matchFile(file)) {
      return plugin;
    }
  }

  // 2. 根据标准扩展名清单匹配
  for (const plugin of DRIVER_PLUGINS) {
    if (plugin.extensions.includes(extension)) {
      return plugin;
    }
  }

  // 3. 兜底通用代码查看器
  return getDriverPluginById('code');
}

/**
 * 获取文件的驱动 ID
 */
export function getDriverIdForFile(file?: Partial<FileItem> | null): DriverId {
  return resolveDriverPluginForFile(file).id;
}
