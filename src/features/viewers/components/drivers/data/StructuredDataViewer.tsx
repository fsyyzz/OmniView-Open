/**
 * 结构化数据全景可视化工作台 (StructuredDataViewer)
 * 深度集成五大视角：结构折叠树、全景思维导图投影、同构数组表格下钻、微服务依赖拓扑与代码模式
 * 并标配敏感密钥脱敏防护 (Secret Masking) 与跨格式离线无损互转工作台 (Format Converter)
 */
import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  Network,
  Table as TableIcon,
  Code,
  FolderTree,
  GitBranch,
  Shield,
  ShieldAlert,
  ArrowRightLeft,
  Copy,
  Check,
  Search,
  Download,
  AlertTriangle,
  Info,
  Layers,
  FileCode,
} from 'lucide-react';
import {
  parseStructuredData,
  detectArrayOfObjects,
  objectToMarkmapMarkdown,
  detectDockerComposeTopology,
  StructuredFormat,
} from './structuredDataUtils';
import { JsonTreeView } from './JsonTreeView';
import { FormatConverterModal } from './FormatConverterModal';
import { MarkmapViewer } from '../MarkmapViewer';
import { TableBlock, TableHeaderItem, TableRowItem } from '../markdown/TableBlock';
import { tableToMarkdown } from '../markdown/tableUtils';
import { Locale, t } from '../../../../../shared/lib/i18n';
import { ThemeId, DensityMode } from '../../../../../shared/types';
import Prism from 'prismjs';
import mermaid from 'mermaid';

interface StructuredDataViewerProps {
  content: string;
  extension?: string;
  fileName?: string;
  locale?: Locale;
  theme?: ThemeId;
  isDarkTheme?: boolean;
  density?: DensityMode;
  onContentChange?: (newContent: string) => void;
}

type DataViewMode = 'tree' | 'mindmap' | 'table' | 'topology' | 'code';

export const StructuredDataViewer: React.FC<StructuredDataViewerProps> = ({
  content,
  extension = 'json',
  fileName = 'data.json',
  locale = 'zh-CN',
  theme = 'dark',
  isDarkTheme = true,
  density = 'standard',
  onContentChange,
}) => {
  const [viewMode, setViewMode] = useState<DataViewMode>('tree');
  const [maskSecrets, setMaskSecrets] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isConverterOpen, setIsConverterOpen] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [topologySvg, setTopologySvg] = useState<string | null>(null);

  // 解析结构化数据
  const parseResult = useMemo(() => {
    return parseStructuredData(content, extension);
  }, [content, extension]);

  const parsedData = parseResult.data;

  // 1. 同构数组探测 (Table 视图)
  const arrayDetection = useMemo(() => {
    if (!parseResult.success || !parsedData) {
      return { detected: false, path: '', headers: [], rows: [] };
    }
    return detectArrayOfObjects(parsedData);
  }, [parseResult, parsedData]);

  // 将探测到的同构数组转换为 TableBlock 格式
  const tableData = useMemo(() => {
    if (!arrayDetection.detected) return null;
    const header: TableHeaderItem[] = arrayDetection.headers.map((h) => ({
      text: h,
    }));
    const rows: TableRowItem[] = arrayDetection.rows.map((row) => ({
      cells: arrayDetection.headers.map((h) => {
        const val = row[h];
        let cellText = '';
        if (val !== undefined && val !== null) {
          cellText = typeof val === 'object' ? JSON.stringify(val) : String(val);
        }
        return { text: cellText };
      }),
    }));
    return { header, rows };
  }, [arrayDetection]);

  const tableRawMarkdown = useMemo(() => {
    if (!tableData) return '';
    return tableToMarkdown(
      tableData.header.map((h) => h.text),
      tableData.rows.map((r) => r.cells.map((c) => c.text))
    );
  }, [tableData]);

  // 2. 思维导图 Markmap 投影 Markdown 文本
  const markmapMarkdown = useMemo(() => {
    if (!parseResult.success || !parsedData) return `# ${fileName}\n- *(解析错误)*`;
    return objectToMarkmapMarkdown(parsedData, fileName);
  }, [parseResult, parsedData, fileName]);

  // 3. Docker / 微服务架构拓扑探测
  const topologyMermaid = useMemo(() => {
    if (!parseResult.success || !parsedData) return null;
    return detectDockerComposeTopology(parsedData);
  }, [parseResult, parsedData]);

  // 异步渲染拓扑 SVG
  useEffect(() => {
    if (topologyMermaid && viewMode === 'topology') {
      let isMounted = true;
      const renderTopology = async () => {
        try {
          mermaid.initialize({
            startOnLoad: false,
            theme: isDarkTheme ? 'dark' : 'default',
            securityLevel: 'loose',
          });
          const id = `topology-${Math.random().toString(36).slice(2, 9)}`;
          const { svg } = await mermaid.render(id, topologyMermaid);
          if (isMounted) {
            setTopologySvg(svg);
          }
        } catch (err) {
          console.warn('Topology render warning:', err);
        }
      };
      renderTopology();
      return () => {
        isMounted = false;
      };
    }
  }, [topologyMermaid, viewMode, isDarkTheme]);

  const handleCopySource = useCallback(() => {
    navigator.clipboard.writeText(content);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  }, [content]);

  // 语法高亮
  const highlightedCode = useMemo(() => {
    try {
      const ext = extension.toLowerCase();
      let lang = 'json';
      if (['yaml', 'yml'].includes(ext)) lang = 'yaml';
      else if (ext === 'xml') lang = 'markup';
      else if (ext === 'toml') lang = 'markdown'; // prism fallback

      const grammar = Prism.languages[lang] || Prism.languages.json || Prism.languages.text;
      if (grammar) {
        return Prism.highlight(content, grammar, lang);
      }
    } catch {
      // ignore
    }
    return null;
  }, [content, extension]);

  return (
    <div className="h-full w-full flex flex-col bg-slate-950 font-sans text-xs text-slate-300 select-text overflow-hidden">
      {/* 顶部主工作台控制工具栏 */}
      <div className="flex flex-wrap items-center justify-between px-3 py-1.5 bg-slate-900 border-b border-slate-800 text-xs shrink-0 select-none gap-2">
        {/* 左侧：文件基本元信息与视图模式切换器 */}
        <div className="flex items-center gap-2 overflow-x-auto">
          <div className="flex items-center gap-1.5 mr-1 shrink-0">
            <FileCode className="w-3.5 h-3.5 text-indigo-400" />
            <span className="font-semibold text-slate-200 truncate max-w-[150px]">{fileName}</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-950 text-indigo-300 font-mono uppercase">
              {extension}
            </span>
          </div>

          <div className="h-4 w-px bg-slate-800 shrink-0" />

          {/* 核心多态视图切换选项卡 */}
          <div className="flex items-center bg-slate-950/80 p-0.5 rounded-lg border border-slate-800 shrink-0">
            <button
              onClick={() => setViewMode('tree')}
              className={`flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-md text-[11px] font-medium transition cursor-pointer ${
                viewMode === 'tree'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850'
              }`}
              title="交互式可折叠结构树"
              aria-label="结构树 (Tree)"
            >
              <FolderTree className="w-3 h-3" />
              <span className="hidden sm:inline">结构树 (Tree)</span>
            </button>

            <button
              onClick={() => setViewMode('mindmap')}
              className={`flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-md text-[11px] font-medium transition cursor-pointer ${
                viewMode === 'mindmap'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850'
              }`}
              title="无损投影为交互式全景思维导图"
              aria-label="思维导图 (Mindmap)"
            >
              <Network className="w-3 h-3 text-sky-400" />
              <span className="hidden sm:inline">思维导图 (Mindmap)</span>
            </button>

            {/* 同构数组下钻视图 (若检测到数组) */}
            {arrayDetection.detected && (
              <button
                onClick={() => setViewMode('table')}
                className={`flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-md text-[11px] font-medium transition cursor-pointer ${
                  viewMode === 'table'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850'
                }`}
                title={`检测到数组结构 (${arrayDetection.rows.length} 项)，一键切换数据表格与图表`}
                aria-label={`数据表格 (${arrayDetection.rows.length})`}
              >
                <TableIcon className="w-3 h-3 text-emerald-400" />
                <span className="hidden sm:inline">数据表格 ({arrayDetection.rows.length})</span>
              </button>
            )}

            {/* Docker 服务拓扑图 (若检测到声明式拓扑) */}
            {topologyMermaid && (
              <button
                onClick={() => setViewMode('topology')}
                className={`flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-md text-[11px] font-medium transition cursor-pointer ${
                  viewMode === 'topology'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850'
                }`}
                title="检测到声明式微服务配置，自动生成依赖与网络架构拓扑图"
                aria-label="服务拓扑 (Topology)"
              >
                <GitBranch className="w-3 h-3 text-purple-400" />
                <span className="hidden sm:inline">服务拓扑 (Topology)</span>
              </button>
            )}

            <button
              onClick={() => setViewMode('code')}
              className={`flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-md text-[11px] font-medium transition cursor-pointer ${
                viewMode === 'code'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850'
              }`}
              title="原始文本高亮与编辑"
              aria-label="代码文本 (Code)"
            >
              <Code className="w-3 h-3" />
              <span className="hidden sm:inline">代码文本 (Code)</span>
            </button>
          </div>
        </div>

        {/* 右侧功能动作区：脱敏开关、跨格式互转、搜索框与源码复制 */}
        <div className="flex items-center gap-2 shrink-0">
          {/* 结构感知检索框 (仅树模式展示) */}
          {viewMode === 'tree' && (
            <div className="relative flex items-center">
              <Search className="w-3 h-3 text-slate-500 absolute left-2 pointer-events-none" />
              <input
                type="text"
                placeholder="搜索 Key 或 Value..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-36 sm:w-44 pl-6 pr-2 py-0.8 bg-slate-950 border border-slate-800 rounded-md text-[11px] text-slate-200 placeholder-slate-500 focus:outline-hidden focus:border-indigo-500 transition"
              />
            </div>
          )}

          {/* 敏感信息脱敏防护开关 (Secret Masking) */}
          <button
            onClick={() => setMaskSecrets(!maskSecrets)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition cursor-pointer border ${
              maskSecrets
                ? 'bg-rose-950/50 text-rose-300 border-rose-800/70 hover:bg-rose-900/60'
                : 'bg-slate-800/80 text-slate-400 border-slate-700/60 hover:text-slate-200 hover:bg-slate-800'
            }`}
            title={maskSecrets ? '敏感密钥保护中 (已遮罩密码/Token)，点击解除' : '已显示明文，点击开启敏感信息遮罩'}
            aria-label={maskSecrets ? '脱敏防护' : '明文模式'}
          >
            {maskSecrets ? <Shield className="w-3 h-3 text-rose-400" /> : <ShieldAlert className="w-3 h-3 text-slate-400" />}
            <span className="hidden sm:inline">{maskSecrets ? '脱敏防护' : '明文模式'}</span>
          </button>

          {/* 跨格式无损互转工作台入口 */}
          {parseResult.success && (
            <button
              onClick={() => setIsConverterOpen(true)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-indigo-950/60 hover:bg-indigo-900/70 text-indigo-300 border border-indigo-800/60 text-[11px] font-medium transition cursor-pointer"
              title="JSON ⇄ YAML ⇄ TOML ⇄ XML 实时本地转换"
              aria-label="格式互转"
            >
              <ArrowRightLeft className="w-3 h-3 text-indigo-400" />
              <span className="hidden sm:inline">格式互转</span>
            </button>
          )}

          {/* 一键复制源码 */}
          <button
            onClick={handleCopySource}
            className="flex items-center gap-1 px-2 py-1 rounded-md bg-slate-800 hover:bg-slate-750 text-slate-300 text-[11px] transition cursor-pointer"
            title="复制原始源码"
          >
            {isCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            <span className="hidden sm:inline">{isCopied ? '已复制' : '复制'}</span>
          </button>
        </div>
      </div>

      {/* 语法解析异常提示横幅 (若解析失败) */}
      {!parseResult.success && (
        <div className="flex items-center justify-between px-4 py-2 bg-amber-950/60 border-b border-amber-800/80 text-amber-200 text-xs shrink-0">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>结构化语法解析异常: {parseResult.error}，已自动切入代码源码模式。</span>
          </div>
          <button
            onClick={() => setViewMode('code')}
            className="px-2 py-0.5 rounded bg-amber-900/60 hover:bg-amber-800 text-amber-100 font-medium transition"
          >
            查看源码
          </button>
        </div>
      )}

      {/* 主视窗多态渲染区域 */}
      <div className="flex-1 min-h-0 relative overflow-hidden flex flex-col">
        {/* 1. 结构折叠树 (Tree) */}
        {viewMode === 'tree' && parseResult.success && (
          <JsonTreeView
            data={parsedData}
            maskSecrets={maskSecrets}
            searchQuery={searchQuery}
            locale={locale}
          />
        )}

        {/* 2. 全景思维导图投影 (Mindmap) */}
        {viewMode === 'mindmap' && (
          <div className="h-full w-full relative">
            <MarkmapViewer
              content={markmapMarkdown}
              fileName={`${fileName}.markmap`}
              isDarkTheme={isDarkTheme}
              theme={theme}
              density={density}
              locale={locale}
            />
          </div>
        )}

        {/* 3. 数据表格下钻 (Table) */}
        {viewMode === 'table' && tableData && (
          <div className="h-full w-full overflow-auto p-4 bg-slate-950">
            <div className="mb-3 flex items-center justify-between bg-slate-900/80 px-3 py-2 rounded-lg border border-slate-800">
              <div className="flex items-center gap-2">
                <TableIcon className="w-4 h-4 text-emerald-400" />
                <span className="font-semibold text-slate-200">
                  同构数组智能投影 ({arrayDetection.path})
                </span>
                <span className="text-[11px] text-slate-500">
                  共 {arrayDetection.rows.length} 项数据，已激活多态列排序、全文检索与微图表转换
                </span>
              </div>
            </div>
            <TableBlock
              id={`structured-table-${fileName}`}
              header={tableData.header}
              rows={tableData.rows}
              rawMarkdown={tableRawMarkdown}
              locale={locale}
            />
          </div>
        )}

        {/* 4. 微服务架构拓扑 (Topology) */}
        {viewMode === 'topology' && (
          <div className="h-full w-full flex flex-col items-center justify-center p-6 bg-slate-950 overflow-auto">
            <div className="mb-4 text-center">
              <h4 className="text-sm font-semibold text-slate-200 flex items-center justify-center gap-1.5">
                <GitBranch className="w-4 h-4 text-purple-400" />
                <span>微服务与容器网络拓扑全景图</span>
              </h4>
              <p className="text-xs text-slate-400 mt-1">
                根据声明式服务的 <code>depends_on</code>、<code>ports</code> 与关联链路自动推导生成
              </p>
            </div>
            {topologySvg ? (
              <div
                className="max-w-4xl w-full p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex justify-center shadow-xl"
                dangerouslySetInnerHTML={{ __html: topologySvg }}
              />
            ) : (
              <div className="text-slate-500 flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                <span>正在编译渲染拓扑关系...</span>
              </div>
            )}
          </div>
        )}

        {/* 5. 源码文本模式 (Code) */}
        {(viewMode === 'code' || !parseResult.success) && (
          <div className="h-full w-full flex flex-col bg-slate-950 font-mono text-xs text-slate-300">
            <div className="flex-1 overflow-auto p-4 select-text">
              {highlightedCode ? (
                <pre
                  className="whitespace-pre-wrap break-all leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: highlightedCode }}
                />
              ) : (
                <pre className="whitespace-pre-wrap break-all leading-relaxed">{content}</pre>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 跨格式无损互转工作台弹层 */}
      {parseResult.success && (
        <FormatConverterModal
          isOpen={isConverterOpen}
          onClose={() => setIsConverterOpen(false)}
          data={parsedData}
          currentFormat={parseResult.format}
          fileName={fileName}
          locale={locale}
        />
      )}
    </div>
  );
};
