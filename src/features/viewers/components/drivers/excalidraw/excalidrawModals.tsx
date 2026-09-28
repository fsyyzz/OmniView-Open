import React from 'react';
import {
  X,
  LayoutTemplate,
  GitFork,
  AlertCircle,
  Layers,
  Globe,
  ExternalLink,
  Copy,
  Check,
  Search,
  Sparkles,
  BookmarkPlus,
  Trash2,
  Upload,
  FileCode,
  FileUp,
  Package,
  Download,
  Loader2,
} from 'lucide-react';
import {
  EXCALIDRAW_TEMPLATES,
  ExcalidrawTemplate,
  EXCALIDRAW_STENCILS,
  ExcalidrawStencil,
  OFFICIAL_COMMUNITY_CATEGORIES,
} from './excalidrawTemplates';

export interface ExcalidrawTemplatesModalProps {
  isZh: boolean;
  onClose: () => void;
  onApplyTemplate: (template: ExcalidrawTemplate) => void;
}

export const ExcalidrawTemplatesModal: React.FC<ExcalidrawTemplatesModalProps> = ({
  isZh,
  onClose,
  onApplyTemplate,
}) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 animate-in fade-in">
    <div className="w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
      <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
        <div className="flex items-center gap-2">
          <LayoutTemplate className="w-5 h-5 text-amber-400" />
          <h3 className="text-sm font-semibold text-slate-100">
            {isZh ? '选择 Excalidraw 预置模板' : 'Choose Starter Template'}
          </h3>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-5 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        {EXCALIDRAW_TEMPLATES.map((template) => (
          <div
            key={template.id}
            onClick={() => onApplyTemplate(template)}
            className="group relative p-4 rounded-lg bg-slate-950 border border-slate-800 hover:border-amber-500/60 hover:bg-slate-900/80 cursor-pointer transition flex flex-col justify-between gap-3 shadow-sm hover:shadow-md"
          >
            <div>
              <div className="flex items-center justify-between gap-2">
                <div className="font-semibold text-xs text-slate-100 group-hover:text-amber-300 transition">
                  {isZh ? template.name : template.nameEn}
                </div>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                  {template?.data?.elements?.length ?? 0} 图元
                </span>
              </div>
              <div className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                {isZh ? template.description : template.descriptionEn}
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-900 text-[10px] text-amber-400 font-medium">
              <span>{isZh ? '点击载入此模板' : 'Load Template'}</span>
              <span className="opacity-0 group-hover:opacity-100 transition-transform transform group-hover:translate-x-0.5">
                →
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="px-5 py-3 bg-slate-950 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
        <span>{isZh ? '⚠️ 载入模板将替换当前画面的内容' : '⚠️ Loading a template will overwrite current drawing'}</span>
        <button
          onClick={onClose}
          className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs transition"
        >
          {isZh ? '取消' : 'Cancel'}
        </button>
      </div>
    </div>
  </div>
);

export interface ExcalidrawMermaidModalProps {
  isZh: boolean;
  mermaidCode: string;
  onMermaidCodeChange: (code: string) => void;
  mermaidError: string | null;
  onClose: () => void;
  onImport: () => void;
}

export const ExcalidrawMermaidModal: React.FC<ExcalidrawMermaidModalProps> = ({
  isZh,
  mermaidCode,
  onMermaidCodeChange,
  mermaidError,
  onClose,
  onImport,
}) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-sm p-4 animate-in fade-in">
    <div className="w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
      <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
        <div className="flex items-center gap-2">
          <GitFork className="w-5 h-5 text-emerald-400" />
          <h3 className="text-sm font-semibold text-slate-100">
            {isZh ? 'Mermaid 代码转译为手绘白板' : 'Mermaid to Excalidraw'}
          </h3>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-5 flex flex-col gap-3 flex-1 overflow-y-auto">
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-400">
            {isZh ? '支持 Flowchart / Graph 语法与方向拓扑自动分级排布：' : 'Paste Mermaid flowchart syntax:'}
          </span>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-slate-400">常用示例:</span>
            <button
              onClick={() =>
                onMermaidCodeChange(
                  'flowchart TD\n  App[用户端 App] --> GW[API 网关]\n  GW --> Order[订单服务]\n  GW --> Pay[支付服务]\n  Order --> DB[(MySQL 集群)]\n  Pay --> Cache[Redis 缓存]'
                )
              }
              className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-emerald-300 text-[11px] transition"
            >
              微服务
            </button>
            <button
              onClick={() =>
                onMermaidCodeChange(
                  'flowchart LR\n  Start[提交PR] --> CI{自动化检查}\n  CI -->|通过| Review[人工代码审查]\n  CI -->|失败| Fix[修复报错]\n  Review --> Merge[合入主干]'
                )
              }
              className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-amber-300 text-[11px] transition"
            >
              审查流
            </button>
          </div>
        </div>

        <textarea
          value={mermaidCode}
          onChange={(e) => onMermaidCodeChange(e.target.value)}
          rows={8}
          className="w-full p-3 font-mono text-xs bg-slate-950 border border-slate-800 rounded-lg text-emerald-300 focus:outline-none focus:border-emerald-500 resize-none leading-relaxed"
          placeholder="flowchart TD\n  A --> B"
        />

        {mermaidError && (
          <div className="p-2.5 rounded bg-red-950/80 border border-red-800/80 text-xs text-red-200 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <span>{mermaidError}</span>
          </div>
        )}
      </div>

      <div className="px-5 py-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs">
        <span className="text-slate-400 text-[11px]">
          {isZh ? '转译将自动匹配手绘粗糙度、色彩与吸附连线' : 'Automatic hand-drawn styling and bindings'}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded transition"
          >
            {isZh ? '取消' : 'Cancel'}
          </button>
          <button
            onClick={onImport}
            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded transition shadow-sm flex items-center gap-1.5"
          >
            <GitFork className="w-3.5 h-3.5" />
            <span>{isZh ? '转译为手绘白板' : 'Convert to Canvas'}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
);

export type StencilsTabId = 'stencils' | 'official' | 'import';

export interface ExcalidrawStencilsDrawerProps {
  isZh: boolean;
  customStencils: ExcalidrawStencil[];
  onRemoveCustomStencil: (id: string) => void;
  onInsertStencil: (stencil: ExcalidrawStencil) => void;
  onAddStencilToExcalidrawLibrary: (stencil: ExcalidrawStencil) => void;
  stencilsTab: StencilsTabId;
  onStencilsTabChange: (tab: StencilsTabId) => void;
  stencilSearch: string;
  onStencilSearchChange: (value: string) => void;
  selectedStencilCategory: string;
  onSelectStencilCategory: (category: string) => void;
  officialLibraryUrl: string;
  copiedLibUrl: boolean;
  onCopyOfficialLibraryUrl: () => void;
  onInstallAllPresetToCanvas: () => void;
  onExportAllStencils: () => void;
  showSaveCustomInput: boolean;
  customStencilName: string;
  onCustomStencilNameChange: (value: string) => void;
  onSaveSelectedAsStencil: () => void;
  onConfirmSaveCustomStencil: () => void;
  onCancelSaveCustomStencil: () => void;
  fileInputRef: React.MutableRefObject<HTMLInputElement | null>;
  onImportLibFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
  importUrl: string;
  onImportUrlChange: (value: string) => void;
  isImportingUrl: boolean;
  importUrlError: string | null;
  onImportFromUrl: () => void;
  importJsonText: string;
  onImportJsonTextChange: (value: string) => void;
  importJsonError: string | null;
  onImportFromJsonText: () => void;
  onClose: () => void;
}

export const ExcalidrawStencilsDrawer: React.FC<ExcalidrawStencilsDrawerProps> = (props) => {
  const {
    isZh,
    customStencils,
    onRemoveCustomStencil,
    onInsertStencil,
    onAddStencilToExcalidrawLibrary,
    stencilsTab,
    onStencilsTabChange,
    stencilSearch,
    onStencilSearchChange,
    selectedStencilCategory,
    onSelectStencilCategory,
    officialLibraryUrl,
    copiedLibUrl,
    onCopyOfficialLibraryUrl,
    onInstallAllPresetToCanvas,
    onExportAllStencils,
    showSaveCustomInput,
    customStencilName,
    onCustomStencilNameChange,
    onSaveSelectedAsStencil,
    onConfirmSaveCustomStencil,
    onCancelSaveCustomStencil,
    fileInputRef,
    onImportLibFile,
    importUrl,
    onImportUrlChange,
    isImportingUrl,
    importUrlError,
    onImportFromUrl,
    importJsonText,
    onImportJsonTextChange,
    importJsonError,
    onImportFromJsonText,
    onClose,
  } = props;

  const isCustomStencil = (id: string) =>
    id.startsWith('custom-') || id.startsWith('imported-') || id.startsWith('url-') || id.startsWith('json-');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-3 sm:p-5 animate-in fade-in">
      <div className="w-full max-w-4xl bg-slate-900 border border-slate-700/80 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* 抽屉头部 */}
        <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-900/95">
          <div className="flex items-center gap-2.5">
            <Layers className="w-5 h-5 text-cyan-400" />
            <div>
              <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                <span>{isZh ? '素材与物料中心' : 'Materials & Stencils Hub'}</span>
                <span className="text-[11px] font-normal px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800/60">
                  {EXCALIDRAW_STENCILS.length + customStencils.length} 项资源
                </span>
              </h3>
            </div>
          </div>

          {/* 标签栏切换 */}
          <div className="flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-xs">
            <button
              onClick={() => onStencilsTabChange('stencils')}
              className={`px-3 py-1 rounded-md transition ${
                stencilsTab === 'stencils'
                  ? 'bg-cyan-600 text-white font-medium shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {isZh ? '🎨 物料画板' : '🎨 Stencils'}
            </button>
            <button
              onClick={() => onStencilsTabChange('official')}
              className={`px-3 py-1 rounded-md transition flex items-center gap-1 ${
                stencilsTab === 'official'
                  ? 'bg-cyan-600 text-white font-medium shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>{isZh ? '🌐 官方素材库' : '🌐 Official Lib'}</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            </button>
            <button
              onClick={() => onStencilsTabChange('import')}
              className={`px-3 py-1 rounded-md transition ${
                stencilsTab === 'import'
                  ? 'bg-cyan-600 text-white font-medium shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {isZh ? '📥 导入 / 导出' : '📥 Import'}
            </button>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 隐藏的本地文件输入 */}
        <input
          type="file"
          ref={fileInputRef}
          accept=".excalidrawlib,.json"
          onChange={onImportLibFile}
          className="hidden"
        />

        {/* 抽屉内容区 */}
        <div className="p-5 flex-1 overflow-y-auto flex flex-col gap-4">
          {/* TAB 1: 官方素材库社区链接与指引 */}
          {stencilsTab === 'official' && (
            <div className="flex flex-col gap-4 animate-in fade-in">
              {/* 官方素材库链接与快捷直达横幅 */}
              <div className="p-4 rounded-xl bg-gradient-to-br from-cyan-950/60 via-slate-900 to-slate-950 border border-cyan-800/50 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Globe className="w-4 h-4 text-cyan-400" />
                      <h4 className="text-sm font-semibold text-slate-100">
                        {isZh ? 'Excalidraw 官方社区素材库 (libraries.excalidraw.com)' : 'Official Excalidraw Libraries'}
                      </h4>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800/60 font-mono">
                        LIVE
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                      {isZh
                        ? '汇聚全球开发者分享的数万种高质量矢量素材包（AWS、GCP、Kubernetes、Cisco 网络、系统设计、移动端与 Web UI 原型、手绘便签等），均可一键载入 OmniView 白板。'
                        : 'Browse thousands of official and community-crafted assets (Cloud, K8s, System Architecture, UI Wireframing, and Sticky Notes).'}
                    </p>
                  </div>

                  {/* 打开官方素材库按钮 */}
                  <a
                    href={officialLibraryUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3.5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold shadow-md transition flex items-center gap-1.5 whitespace-nowrap shrink-0"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>{isZh ? '打开官方素材库 ↗' : 'Open Libraries ↗'}</span>
                  </a>
                </div>

                {/* 素材库直连地址代码卡片 */}
                <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 flex items-center justify-between gap-2">
                  <div className="font-mono text-[11px] text-cyan-300 truncate select-all">
                    {officialLibraryUrl}
                  </div>
                  <button
                    onClick={onCopyOfficialLibraryUrl}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs transition flex items-center gap-1 shrink-0 font-medium"
                    title={isZh ? '复制官方素材库完整链接' : 'Copy Library URL'}
                  >
                    {copiedLibUrl ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400">{isZh ? '已复制' : 'Copied'}</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-slate-400" />
                        <span>{isZh ? '复制链接' : 'Copy'}</span>
                      </>
                    )}
                  </button>
                </div>

                {/* 操作指南说明 */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-slate-300 pt-1">
                  <div className="p-2.5 rounded bg-slate-950/60 border border-slate-800/80">
                    <div className="font-semibold text-cyan-400 mb-0.5">1. 浏览与挑选</div>
                    <div className="text-[11px] text-slate-400 leading-normal">
                      {isZh ? '点击「打开官方素材库」在新标签页查阅分类与搜索素材' : 'Browse categories on the official library site'}
                    </div>
                  </div>
                  <div className="p-2.5 rounded bg-slate-950/60 border border-slate-800/80">
                    <div className="font-semibold text-cyan-400 mb-0.5">2. 一键添加 / 下载</div>
                    <div className="text-[11px] text-slate-400 leading-normal">
                      {isZh ? '点击「Add to Excalidraw」自动回写，或「Download」下载离线包' : 'Click "Add to Excalidraw" or download .excalidrawlib file'}
                    </div>
                  </div>
                  <div className="p-2.5 rounded bg-slate-950/60 border border-slate-800/80">
                    <div className="font-semibold text-cyan-400 mb-0.5">3. 拖入白板即用</div>
                    <div className="text-[11px] text-slate-400 leading-normal">
                      {isZh ? '离线 .excalidrawlib 文件可直接拖入画布或在「导入」面板载入' : 'Drag & drop offline file into canvas or use import tab'}
                    </div>
                  </div>
                </div>
              </div>

              {/* 官方社区精选领域分类 */}
              <div>
                <h5 className="text-xs font-semibold text-slate-300 mb-2.5 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>{isZh ? '官方素材精选分类导览' : 'Curated Library Categories'}</span>
                </h5>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {OFFICIAL_COMMUNITY_CATEGORIES.map((cat) => (
                    <div
                      key={cat.id}
                      className="p-3 rounded-lg bg-slate-950 border border-slate-800 hover:border-cyan-500/50 transition flex flex-col justify-between gap-2"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-base">{cat.icon}</span>
                          <div className="font-semibold text-xs text-slate-200">
                            {isZh ? cat.name : cat.nameEn}
                          </div>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                          {cat.description}
                        </div>
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t border-slate-900">
                        <div className="flex flex-wrap gap-1">
                          {cat.tags.slice(0, 3).map((t) => (
                            <span
                              key={t}
                              className="text-[9px] px-1 py-0.2 bg-slate-800 text-slate-400 rounded font-mono"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                        <a
                          href={officialLibraryUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] text-cyan-400 hover:text-cyan-300 flex items-center gap-0.5 font-medium"
                        >
                          <span>{isZh ? '查找' : 'Search'}</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: 内置物料与本地收藏 */}
          {stencilsTab === 'stencils' && (
            <div className="flex flex-col gap-4 animate-in fade-in">
              {/* 搜索与分类过滤器 */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                {/* 搜索输入 */}
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={stencilSearch}
                    onChange={(e) => onStencilSearchChange(e.target.value)}
                    placeholder={isZh ? '搜索物料名称、类别或描述...' : 'Search stencils...'}
                    className="w-full bg-slate-900 border border-slate-700 rounded-md pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                {/* 分类快捷标签 */}
                <div className="flex items-center gap-1 overflow-x-auto text-[11px]">
                  {[
                    { id: 'all', label: isZh ? '全部' : 'All' },
                    { id: 'compute', label: isZh ? '计算/容器' : 'Compute' },
                    { id: 'storage', label: isZh ? '存储/数据' : 'Storage' },
                    { id: 'network', label: isZh ? '网络/入口' : 'Network' },
                    { id: 'ai', label: isZh ? 'AI 智能体' : 'AI' },
                    { id: 'ui', label: isZh ? 'UI 原型' : 'UI' },
                    { id: 'chart', label: isZh ? '流程标记' : 'Notes' },
                    { id: 'custom', label: isZh ? `本地收藏 (${customStencils.length})` : 'Custom' },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => onSelectStencilCategory(tab.id)}
                      className={`px-2 py-1 rounded whitespace-nowrap transition ${
                        selectedStencilCategory === tab.id
                          ? 'bg-cyan-600 text-white font-medium'
                          : 'bg-slate-900 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 收藏选中图元区域 */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-slate-950 p-3 rounded-lg border border-slate-800">
                <div>
                  <div className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                    <BookmarkPlus className="w-3.5 h-3.5 text-blue-400" />
                    <span>{isZh ? '自定义物料收藏' : 'Save Selection as Stencil'}</span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    {isZh ? '在白板中框选任意图元组合，即可一键保存为可复用的专属物料' : 'Select elements on canvas and save as a reusable stencil'}
                  </div>
                </div>

                {showSaveCustomInput ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={customStencilName}
                      onChange={(e) => onCustomStencilNameChange(e.target.value)}
                      placeholder={isZh ? '物料名称...' : 'Name...'}
                      className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-blue-500 w-36"
                      autoFocus
                      onKeyDown={(e) => e.key === 'Enter' && onConfirmSaveCustomStencil()}
                    />
                    <button
                      onClick={onConfirmSaveCustomStencil}
                      className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-medium transition"
                    >
                      {isZh ? '保存' : 'Save'}
                    </button>
                    <button
                      onClick={onCancelSaveCustomStencil}
                      className="px-2 py-1 bg-slate-800 text-slate-400 hover:text-slate-200 rounded text-xs"
                    >
                      {isZh ? '取消' : 'Cancel'}
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={onSaveSelectedAsStencil}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-medium transition shadow-sm flex items-center gap-1.5 whitespace-nowrap self-start sm:self-auto"
                  >
                    <BookmarkPlus className="w-3.5 h-3.5" />
                    <span>{isZh ? '收藏选中图元' : 'Save Selection'}</span>
                  </button>
                )}
              </div>

              {/* 物料卡片网格 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {[...EXCALIDRAW_STENCILS, ...customStencils]
                  .filter((s) => {
                    const matchCategory =
                      selectedStencilCategory === 'all'
                        ? true
                        : selectedStencilCategory === 'custom'
                        ? isCustomStencil(s.id)
                        : s.category === selectedStencilCategory;
                    if (!matchCategory) return false;
                    if (!stencilSearch.trim()) return true;
                    const q = stencilSearch.toLowerCase();
                    return (
                      s.name.toLowerCase().includes(q) ||
                      s.nameEn.toLowerCase().includes(q) ||
                      (s.description && s.description.toLowerCase().includes(q))
                    );
                  })
                  .map((stencil) => (
                    <div
                      key={stencil.id}
                      className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 hover:border-cyan-500/60 transition flex flex-col justify-between gap-2.5 group"
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <div className="font-semibold text-xs text-slate-200 flex items-center gap-1.5 truncate">
                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: stencil.color }} />
                            <span className="truncate">{isZh ? stencil.name : stencil.nameEn}</span>
                          </div>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700 shrink-0">
                            {stencil.elements?.length || 0} 图元
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-1 leading-relaxed line-clamp-2">
                          {stencil.description}
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-900">
                        <span className="text-[10px] text-slate-400 font-mono uppercase">
                          {stencil.category}
                        </span>
                        <div className="flex items-center gap-1">
                          {/* 删除自定义物料 */}
                          {isCustomStencil(stencil.id) && (
                            <button
                              onClick={() => onRemoveCustomStencil(stencil.id)}
                              className="p-1 rounded text-red-400 hover:bg-red-500/10 transition"
                              title={isZh ? '删除此物料' : 'Delete'}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* 加入白板素材库 */}
                          <button
                            onClick={() => onAddStencilToExcalidrawLibrary(stencil)}
                            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition"
                            title={isZh ? '添加到白板自带素材抽屉' : 'Add to Canvas Library'}
                          >
                            {isZh ? '加入库' : 'To Lib'}
                          </button>

                          {/* 插入画布 */}
                          <button
                            onClick={() => onInsertStencil(stencil)}
                            className="px-2.5 py-1 rounded bg-cyan-600/20 hover:bg-cyan-600 text-cyan-300 hover:text-white border border-cyan-500/30 text-xs font-medium transition"
                          >
                            {isZh ? '插入画布' : 'Insert'}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* TAB 3: 导入与导出素材 */}
          {stencilsTab === 'import' && (
            <div className="flex flex-col gap-4 animate-in fade-in">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 本地文件拖拽与上传 */}
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="p-5 rounded-xl bg-slate-950 border-2 border-dashed border-slate-700 hover:border-cyan-500/80 transition flex flex-col items-center justify-center gap-2 cursor-pointer group text-center"
                >
                  <div className="p-3 rounded-full bg-cyan-950/60 text-cyan-400 group-hover:scale-110 transition">
                    <Upload className="w-6 h-6" />
                  </div>
                  <div className="font-semibold text-xs text-slate-200">
                    {isZh ? '上传本地素材库文件' : 'Upload Local Library File'}
                  </div>
                  <div className="text-[11px] text-slate-400 max-w-xs leading-normal">
                    {isZh
                      ? '点击选择或直接将 .excalidrawlib / .json 拖入白板，自动完成解包与注入'
                      : 'Click to select .excalidrawlib or .json file to import'}
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-cyan-300 border border-slate-700 mt-1">
                    .excalidrawlib / .json
                  </span>
                </div>

                {/* 一键注入全量内置物料 & 导出备份 */}
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between gap-3">
                  <div>
                    <div className="font-semibold text-xs text-slate-200 flex items-center gap-1.5">
                      <Package className="w-4 h-4 text-cyan-400" />
                      <span>{isZh ? '素材库快捷同步与备份' : 'Library Sync & Backup'}</span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                      {isZh
                        ? '一键将 OmniView 预置的 Kubernetes、微服务架构、UI 线框、AI 智能体等全套物料包注入白板侧边库；或将全体物料打包导出。'
                        : 'Sync all preset packs into canvas library, or export complete stencils as a backup file.'}
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-slate-900">
                    <button
                      onClick={onInstallAllPresetToCanvas}
                      className="flex-1 px-3 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-lg text-xs font-medium shadow-sm transition flex items-center justify-center gap-1.5"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{isZh ? '同步预置物料至白板' : 'Sync All to Canvas'}</span>
                    </button>

                    <button
                      onClick={onExportAllStencils}
                      className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition flex items-center justify-center gap-1.5 shrink-0"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>{isZh ? '导出 .excalidrawlib' : 'Export .excalidrawlib'}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* 网络链接 URL 导入 */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col gap-2.5">
                <div className="font-semibold text-xs text-slate-200 flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-purple-400" />
                  <span>{isZh ? '通过网络链接 URL 导入素材' : 'Import from Web URL'}</span>
                </div>
                <div className="text-[11px] text-slate-400 leading-normal">
                  {isZh
                    ? '输入任何托管在 GitHub、CDN 或公开服务器的 .excalidrawlib 或 JSON 直链'
                    : 'Enter any public URL for a .excalidrawlib or JSON package'}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="url"
                    value={importUrl}
                    onChange={(e) => onImportUrlChange(e.target.value)}
                    placeholder="https://.../my-library.excalidrawlib"
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-purple-500 font-mono"
                    onKeyDown={(e) => e.key === 'Enter' && onImportFromUrl()}
                  />
                  <button
                    onClick={onImportFromUrl}
                    disabled={isImportingUrl || !importUrl.trim()}
                    className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-lg text-xs font-medium transition flex items-center gap-1 shrink-0"
                  >
                    {isImportingUrl ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>{isZh ? '拉取中...' : 'Fetching...'}</span>
                      </>
                    ) : (
                      <>
                        <FileUp className="w-3.5 h-3.5" />
                        <span>{isZh ? '拉取并导入' : 'Fetch & Import'}</span>
                      </>
                    )}
                  </button>
                </div>
                {importUrlError && (
                  <div className="text-[11px] text-red-400 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>{importUrlError}</span>
                  </div>
                )}
              </div>

              {/* 粘贴 JSON 源码导入 */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col gap-2.5">
                <div className="font-semibold text-xs text-slate-200 flex items-center gap-1.5">
                  <FileCode className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{isZh ? '直接粘贴 JSON 源码导入' : 'Paste Raw JSON Content'}</span>
                </div>
                <textarea
                  value={importJsonText}
                  onChange={(e) => onImportJsonTextChange(e.target.value)}
                  placeholder='{ "type": "excalidrawlib", "version": 2, "libraryItems": [...] }'
                  rows={3}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs font-mono text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 resize-none"
                />
                <div className="flex items-center justify-between">
                  {importJsonError ? (
                    <div className="text-[11px] text-red-400 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>{importJsonError}</span>
                    </div>
                  ) : (
                    <span className="text-[11px] text-slate-500">
                      {isZh ? '支持 v1 数组与 v2 标准格式' : 'Supports v1 arrays and v2 standard schemas'}
                    </span>
                  )}
                  <button
                    onClick={onImportFromJsonText}
                    disabled={!importJsonText.trim()}
                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-xs font-medium transition shrink-0"
                  >
                    {isZh ? '解析并导入' : 'Parse & Import'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 抽屉底部 */}
        <div className="px-5 py-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <span className="truncate">
            {isZh
              ? '提示：在白板中选区图元可随时保存为物料，官方素材亦可直接拖入画布'
              : 'Tip: You can drag & drop .excalidrawlib files directly into canvas'}
          </span>
          <button
            onClick={onClose}
            className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded transition shrink-0"
          >
            {isZh ? '完成' : 'Done'}
          </button>
        </div>
      </div>
    </div>
  );
};
