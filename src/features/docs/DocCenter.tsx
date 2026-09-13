/**
 * OmniViewer 研发规范与工程技术设计中心 (DocCenter)
 * 采用 MarkdownViewer 驱动渲染全规格文档，原生支持 Mermaid 流程图/时序图/状态图、SVG 矢量图元与代码高亮
 */
import React, { useState, useMemo } from 'react';
import { PROJECT_DOCS } from '../../shared/docs/projectDocs';
import { SoftwareDoc } from '../../shared/types';
import { MarkdownViewer } from '../viewers/components/drivers/MarkdownViewer';
import {
  BookOpen,
  Copy,
  Check,
  Download,
  Layers,
  ShieldCheck,
  Terminal,
  FileText,
  Search,
  Sparkles,
  ExternalLink,
  ChevronRight,
  ListTree,
} from 'lucide-react';

interface DocCenterProps {
  onClose?: () => void;
  onOpenInWorkbench?: (title: string, content: string) => void;
}

export const DocCenter: React.FC<DocCenterProps> = ({ onOpenInWorkbench }) => {
  const [selectedDocId, setSelectedDocId] = useState<string>(PROJECT_DOCS[0].id);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [copied, setCopied] = useState(false);

  // 依据搜索关键词与分类过滤文档列表
  const filteredDocs = useMemo(() => {
    return PROJECT_DOCS.filter(doc => {
      const matchCategory = selectedCategory === 'ALL' || doc.category === selectedCategory;
      const query = searchQuery.trim().toLowerCase();
      const matchSearch =
        !query ||
        doc.title.toLowerCase().includes(query) ||
        doc.summary.toLowerCase().includes(query) ||
        doc.tags.some(tag => tag.toLowerCase().includes(query));
      return matchCategory && matchSearch;
    });
  }, [searchQuery, selectedCategory]);

  const currentDoc: SoftwareDoc =
    PROJECT_DOCS.find(d => d.id === selectedDocId) || filteredDocs[0] || PROJECT_DOCS[0];

  // 提取当前文档的标题大纲 (H2 / H3)
  const headings = useMemo(() => {
    const lines = currentDoc.content.split('\n');
    const list: Array<{ text: string; level: number; id: string }> = [];
    lines.forEach(line => {
      const h2Match = line.match(/^##\s+(.+)$/);
      const h3Match = line.match(/^###\s+(.+)$/);
      if (h2Match) {
        list.push({ text: h2Match[1].trim(), level: 2, id: h2Match[1].trim() });
      } else if (h3Match) {
        list.push({ text: h3Match[1].trim(), level: 3, id: h3Match[1].trim() });
      }
    });
    return list;
  }, [currentDoc.content]);

  const handleCopy = () => {
    navigator.clipboard.writeText(currentDoc.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([currentDoc.content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentDoc.id}-specification.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case 'PRD':
        return <FileText className="w-4 h-4 text-blue-400" />;
      case 'Architecture':
        return <Layers className="w-4 h-4 text-purple-400" />;
      case 'Scaffold':
        return <Terminal className="w-4 h-4 text-emerald-400" />;
      case 'Security':
        return <ShieldCheck className="w-4 h-4 text-amber-400" />;
      default:
        return <BookOpen className="w-4 h-4 text-cyan-400" />;
    }
  };

  return (
    <div id="doc-center-root" className="h-full flex flex-col bg-slate-950 text-slate-100 selection:bg-blue-600 selection:text-white">
      {/* 顶部状态与操作栏 */}
      <div className="flex items-center justify-between px-6 py-3 bg-slate-900/90 border-b border-slate-800 shrink-0 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shadow-sm">
            <BookOpen className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-slate-100">OmniViewer 研发规范与工程技术中心</h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-blue-950/70 border border-blue-800/60 text-blue-300">
                Mermaid &amp; SVG 动态图表已就绪
              </span>
            </div>
            <p className="text-[11px] text-slate-400">涵盖产品需求规范 (PRD)、微内核技术架构、生产级 VS Code 扩展脚手架与安全防御审计</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onOpenInWorkbench && (
            <button
              onClick={() => onOpenInWorkbench(currentDoc.title, currentDoc.content)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-750 text-cyan-300 hover:text-cyan-200 text-xs rounded-lg border border-slate-700 transition"
              title="将当前文档载入工作台编辑器进行实时编辑与双模调试"
              aria-label="在工作台编辑"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">在工作台编辑</span>
            </button>
          )}

          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs rounded-lg border border-slate-700 transition"
            title={copied ? '已复制 Markdown' : '复制全文'}
            aria-label={copied ? '已复制 Markdown' : '复制全文'}
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{copied ? '已复制 Markdown' : '复制全文'}</span>
          </button>

          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-lg shadow-sm transition"
            title="导出 .md 文件"
            aria-label="导出 .md 文件"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">导出 .md 文件</span>
          </button>
        </div>
      </div>

      {/* 主体区：左侧文档树与检索 + 中间 MarkdownViewer + 右侧大纲导航 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 左侧文档导航面板 */}
        <div className="w-80 border-r border-slate-800 bg-slate-900/50 flex flex-col shrink-0">
          {/* 搜索框 */}
          <div className="p-3 border-b border-slate-800">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="检索规范文档或关键词..."
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-500 transition"
              />
            </div>

            {/* 分类快捷筛选 */}
            <div className="flex items-center gap-1 mt-2.5 overflow-x-auto pb-1 text-[11px]">
              {['ALL', 'PRD', 'Architecture', 'Scaffold', 'Security'].map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-2 py-0.5 rounded text-[10px] whitespace-nowrap transition ${
                    selectedCategory === cat
                      ? 'bg-blue-600 text-white font-medium'
                      : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {cat === 'ALL'
                    ? '全部'
                    : cat === 'PRD'
                    ? 'PRD'
                    : cat === 'Architecture'
                    ? '架构'
                    : cat === 'Scaffold'
                    ? '脚手架'
                    : '安全'}
                </button>
              ))}
            </div>
          </div>

          {/* 文档卡片列表 */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {filteredDocs.map(doc => {
              const isSelected = selectedDocId === doc.id;
              return (
                <button
                  key={doc.id}
                  onClick={() => setSelectedDocId(doc.id)}
                  className={`w-full text-left p-3 rounded-xl border transition-all ${
                    isSelected
                      ? 'bg-blue-950/60 border-blue-500/60 shadow-lg ring-1 ring-blue-500/30'
                      : 'bg-slate-900/40 border-slate-800/80 hover:border-slate-700 hover:bg-slate-800/40'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      {getCategoryIcon(doc.category)}
                      <span className={`text-xs font-semibold ${isSelected ? 'text-blue-300' : 'text-slate-200'}`}>
                        {doc.title}
                      </span>
                    </div>
                    {isSelected && <ChevronRight className="w-3.5 h-3.5 text-blue-400" />}
                  </div>

                  <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed mb-2.5">
                    {doc.summary}
                  </p>

                  <div className="flex flex-wrap gap-1">
                    {doc.tags.map(tag => (
                      <span
                        key={tag}
                        className="px-1.5 py-0.5 rounded bg-slate-800/80 text-[10px] text-slate-400 border border-slate-700/50"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </button>
              );
            })}

            {filteredDocs.length === 0 && (
              <div className="text-center py-8 text-slate-500 text-xs">
                没有找到匹配的规范文档
              </div>
            )}
          </div>

          {/* 底部规范保障标签 */}
          <div className="p-3 border-t border-slate-800 bg-slate-900/40 text-[11px] text-slate-400 flex items-center justify-between">
            <span className="flex items-center gap-1 text-slate-300 font-mono">
              <Sparkles className="w-3 h-3 text-amber-400" />
              <span>标准: VS Code v1.85+</span>
            </span>
            <span className="text-emerald-400">100% 离线沙箱</span>
          </div>
        </div>

        {/* 中间核心内容阅读区 (采用全功能 MarkdownViewer 驱动) */}
        <div className="flex-1 overflow-y-auto p-6 lg:p-8 bg-slate-950/70">
          <div className="max-w-4xl mx-auto bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 lg:p-10 shadow-2xl">
            <MarkdownViewer
              content={currentDoc.content}
              isDarkTheme={true}
              density="comfortable"
              contentWidth="full"
            />
          </div>
        </div>

        {/* 右侧大纲快速导航面板 */}
        {(headings?.length ?? 0) > 0 && (
          <div className="hidden 2xl:flex w-64 border-l border-slate-800 bg-slate-900/30 p-4 flex-col shrink-0 overflow-hidden">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-300 pb-3 border-b border-slate-800 shrink-0">
              <ListTree className="w-3.5 h-3.5 text-blue-400" />
              <span>本篇目录大纲</span>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden my-3 space-y-1 text-xs pr-1">
              {headings.map((h, i) => (
                <div
                  key={i}
                  className={`py-1 rounded text-slate-400 hover:text-slate-200 transition truncate cursor-default ${
                    h.level === 3 ? 'pl-4 text-[11px] text-slate-500' : 'font-medium'
                  }`}
                  title={h.text}
                >
                  {h.text}
                </div>
              ))}
            </div>

            <div className="shrink-0 pt-4 border-t border-slate-800/80 text-[10px] text-slate-500 leading-relaxed">
              * 图表支持在视图内点击放大（全屏灯箱）与一键导出独立 SVG 矢量图。
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
