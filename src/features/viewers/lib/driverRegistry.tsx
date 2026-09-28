/**
 * OmniView 驱动注册中心与插件 SPI 契约 (Driver Registry & Plugin SPI)
 * 遵循 OCP (开闭原则) 与 Strategy (策略模式)
 */
import React, { useState, lazy } from 'react';
import type { FileItem, DriverId, ViewMode, ThemeId, ContentWidthMode, DensityMode } from '../../../shared/types';
import type { Locale } from '../../../shared/lib/i18n';
import { saveStoredSettings, loadStoredSettings } from '../../../shared/lib/settingsStorage';
import { Eye, Network } from 'lucide-react';

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
  onOpenSettings?: () => void;
  onOpenShortcuts?: () => void;
  onSelectFile?: (file: FileItem) => void;
  enableOkf?: boolean;
  onToggleOkf?: () => void;
  eagerMount?: boolean;
}

export interface ViewerRenderContext {
  file: FileItem;
  files: FileItem[];
  mode: ViewMode;
  isDarkTheme: boolean;
  theme: ThemeId;
  density: DensityMode;
  contentWidth: ContentWidthMode;
  zoom: number;
  locale: Locale;
  onContentChange: (content: string) => void;
  onRenderComplete?: () => void;
  onOpenSourceAtLine?: (line: number) => void;
  onOpenInEditor?: () => void;
  onOpenSettings?: () => void;
  onOpenShortcuts?: () => void;
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
  /** 插件自持的多模式渲染分发（OCP），返回 ReactNode，内部可合法使用 useState 等 Hook */
  renderMode?: (props: ViewerRenderContext) => React.ReactNode;
  supportsSplitView?: boolean;
  supportsSourceEdit?: boolean;
  isBinary?: boolean;
}

// Markdown 多模式专用异步驱动
const MarkdownViewer = lazy(() => import('../components/drivers/MarkdownViewer').then(m => ({ default: m.MarkdownViewer })));
const MarkmapViewer = lazy(() => import('../components/drivers/MarkmapViewer').then(m => ({ default: m.MarkmapViewer })));
const CodeViewer = lazy(() => import('../components/drivers/CodeViewer').then(m => ({ default: m.CodeViewer })));

// 惰性懒加载驱动组件映射缓存
const componentCache: Partial<Record<DriverId, React.LazyExoticComponent<React.ComponentType<any>>>> = {};

/**
 * Markdown 驱动多模式渲染分发 (mindmap / source / split / preview)
 * 内部合法使用 useState 保持 splitRightMode 等渲染上下文的跨渲染生命周期
 */
function renderMarkdownMode(ctx: ViewerRenderContext): React.ReactNode {
  const {
    file,
    files,
    mode,
    isDarkTheme,
    theme,
    density,
    contentWidth,
    zoom,
    locale,
    onContentChange,
    onRenderComplete,
    onOpenSourceAtLine,
    onOpenInEditor,
    onSelectFile,
    enableOkf,
    onToggleOkf,
    eagerMount,
  } = ctx;

  const [internalEnableOkf, setInternalEnableOkf] = useState<boolean>(() => {
    const s = loadStoredSettings();
    return s.enableOkfRendering ?? true;
  });
  const effectiveEnableOkf = enableOkf !== undefined ? enableOkf : internalEnableOkf;
  const handleToggleOkf = () => {
    if (onToggleOkf) {
      onToggleOkf();
    } else {
      const next = !effectiveEnableOkf;
      setInternalEnableOkf(next);
      saveStoredSettings({ enableOkfRendering: next });
    }
  };

  const [splitRightMode, setSplitRightMode] = useState<'preview' | 'mindmap'>(() => {
    const s = loadStoredSettings();
    return s.splitRightMode || 'preview';
  });

  const zoomStyle = zoom !== 1.0 ? { zoom } : undefined;

  if (mode === 'mindmap') {
    return (
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden" data-theme={theme} style={zoomStyle}>
        <MarkmapViewer
          content={file.content}
          fileName={file.name}
          isDarkTheme={isDarkTheme}
          theme={theme}
          density={density}
          locale={locale}
          onOpenSourceAtLine={onOpenSourceAtLine}
        />
      </div>
    );
  }

  if (mode === 'source') {
    return (
      <div className="flex-1 min-h-0 flex flex-col" style={zoomStyle}>
        <CodeViewer
          content={file.content}
          fileName={file.name}
          extension={file.extension}
          locale={locale}
          onContentChange={onContentChange}
          onOpenInEditor={onOpenInEditor}
        />
      </div>
    );
  }

  if (mode === 'split') {
    return (
      <div className="flex min-h-0 flex-1 overflow-hidden" data-theme={theme}>
        {/* Left: Source Code Editor */}
        <div className="flex min-h-0 w-1/2 flex-col border-r" style={{ ...zoomStyle, borderColor: 'var(--ov-border)' }}>
          <CodeViewer
            content={file.content}
            fileName={file.name}
            extension={file.extension}
            locale={locale}
            onContentChange={onContentChange}
            onOpenInEditor={onOpenInEditor}
          />
        </div>

        {/* Right: Toggleable Preview / Mindmap */}
        <div className="min-h-0 w-1/2 flex flex-col overflow-hidden relative" style={{ background: 'var(--ov-bg)' }}>
          {/* Floating switcher for split view right pane */}
          <div
            className="absolute top-2 right-4 z-20 flex items-center backdrop-blur rounded-md p-0.5 shadow-md border"
            style={{
              background: 'var(--ov-surface)',
              borderColor: 'var(--ov-border)',
            }}
          >
            <button
              onClick={() => {
                setSplitRightMode('preview');
                saveStoredSettings({ splitRightMode: 'preview' });
              }}
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition cursor-pointer ${
                splitRightMode === 'preview'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'hover:bg-[var(--ov-surface-hover)]'
              }`}
              style={{
                color: splitRightMode === 'preview' ? '#ffffff' : 'var(--ov-text-secondary)',
              }}
              title="富文本渲染预览"
              aria-label="富文本渲染预览"
            >
              <Eye className="w-3 h-3 shrink-0" />
              <span className="hidden sm:inline">预览</span>
            </button>
            <button
              onClick={() => {
                setSplitRightMode('mindmap');
                saveStoredSettings({ splitRightMode: 'mindmap' });
              }}
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition ${
                splitRightMode === 'mindmap'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="全景思维导图 (Markmap)"
              aria-label="全景思维导图"
            >
              <Network className="w-3 h-3 shrink-0" />
              <span className="hidden sm:inline">思维导图</span>
            </button>
          </div>

          {splitRightMode === 'preview' ? (
            <div className="markdown-plugin-scroll ov-split-preview-scroll flex-1 overflow-y-auto" style={{ background: 'var(--ov-bg)' }}>
              <div style={zoomStyle}>
                <MarkdownViewer
                  content={file.content}
                  files={files}
                  isDarkTheme={isDarkTheme}
                  density={density}
                  contentWidth={contentWidth}
                  locale={locale}
                  onContentChange={onContentChange}
                  onRenderComplete={onRenderComplete}
                  onOpenSourceAtLine={onOpenSourceAtLine}
                  onSelectFile={onSelectFile}
                  enableOkf={effectiveEnableOkf}
                  onToggleOkf={handleToggleOkf}
                  eagerMount={eagerMount}
                />
              </div>
            </div>
          ) : (
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden" style={zoomStyle}>
              <MarkmapViewer
                content={file.content}
                fileName={file.name}
                isDarkTheme={isDarkTheme}
                theme={theme}
                density={density}
                locale={locale}
                onOpenSourceAtLine={onOpenSourceAtLine}
              />
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full flex-1 min-h-0" data-theme={theme} style={{ background: 'var(--ov-bg)' }}>
      <div style={zoomStyle}>
        <MarkdownViewer
          content={file.content}
          files={files}
          isDarkTheme={isDarkTheme}
          density={density}
          contentWidth={contentWidth}
          locale={locale}
          onContentChange={onContentChange}
          onRenderComplete={onRenderComplete}
          onOpenSourceAtLine={onOpenSourceAtLine}
          onSelectFile={onSelectFile}
          enableOkf={effectiveEnableOkf}
          onToggleOkf={handleToggleOkf}
          eagerMount={eagerMount}
        />
      </div>
    </div>
  );
}


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
    renderMode: renderMarkdownMode,
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
    supportsSplitView: false,
    supportsSourceEdit: false,
    isBinary: true,
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
    supportsSplitView: false,
    supportsSourceEdit: false,
    isBinary: true,
  },
  {
    id: 'docx',
    name: 'Word 文档查看器',
    extensions: ['docx'],
    getComponent: createLazyDriver('docx', () => import('../components/drivers/DocxViewer'), 'DocxViewer'),
    supportsSplitView: false,
    supportsSourceEdit: false,
    isBinary: true,
  },
  {
    id: 'pptx',
    name: 'PowerPoint 演示文稿',
    extensions: ['pptx'],
    getComponent: createLazyDriver('pptx', () => import('../components/drivers/PptxViewer'), 'PptxViewer'),
    supportsSplitView: false,
    supportsSourceEdit: false,
    isBinary: true,
  },
  {
    id: 'xlsx',
    name: 'Excel 电子表格工作簿',
    extensions: ['xlsx', 'xls', 'xlsm', 'xltx'],
    getComponent: createLazyDriver('xlsx', () => import('../components/drivers/XlsxViewer'), 'XlsxViewer'),
    supportsSplitView: false,
    supportsSourceEdit: false,
    isBinary: true,
  },
  {
    id: 'image',
    name: '现代图像工作台与像素检视器',
    extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'ico', 'avif', 'tiff'],
    getComponent: createLazyDriver('image', () => import('../components/drivers/ImageViewer'), 'ImageViewer'),
    supportsSplitView: false,
    supportsSourceEdit: false,
    isBinary: true,
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
    id: 'html',
    name: 'HTML5 网页与沙箱工作台',
    extensions: ['html', 'htm'],
    getComponent: createLazyDriver('html', () => import('../components/drivers/HtmlViewer'), 'HtmlViewer'),
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

/**
 * 判断指定文件驱动是否支持分屏协同模式
 */
export function driverSupportsSplitView(file?: Partial<FileItem> | null): boolean {
  if (!file) return false;
  const plugin = resolveDriverPluginForFile(file);
  return Boolean(plugin.supportsSplitView);
}

/**
 * 判断指定文件驱动是否支持源码编辑
 */
export function driverSupportsSourceEdit(file?: Partial<FileItem> | null): boolean {
  if (!file) return false;
  const plugin = resolveDriverPluginForFile(file);
  // 二进制格式或明确声明不支持源码编辑
  if (plugin.isBinary || plugin.supportsSourceEdit === false) {
    return false;
  }
  return true;
}

/**
 * 判断指定驱动是否为二进制驱动
 */
export function isBinaryDriver(driverId: DriverId): boolean {
  const plugin = getDriverPluginById(driverId);
  return Boolean(plugin.isBinary);
}
