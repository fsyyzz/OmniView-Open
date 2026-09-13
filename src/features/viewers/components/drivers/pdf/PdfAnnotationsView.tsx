/**
 * OmniView PDF 标注与高亮批注侧栏面板
 * 支持查看批注、便签编辑、页面跳转、删除及 Markdown 批注导出
 */
import React, { useState } from 'react';
import { Highlighter, Trash2, ArrowUpRight, FileDown, MessageSquare, Plus } from 'lucide-react';

export interface PdfAnnotation {
  id: string;
  pageNumber: number;
  text: string;
  color: 'yellow' | 'green' | 'pink';
  note?: string;
  createdAt: number;
}

interface PdfAnnotationsViewProps {
  annotations: PdfAnnotation[];
  currentPage: number;
  onSelectPage: (pageNum: number) => void;
  onDeleteAnnotation: (id: string) => void;
  onUpdateAnnotationNote: (id: string, note: string) => void;
  onClearAll: () => void;
  fileName: string;
}

const colorMap = {
  yellow: {
    bg: 'bg-amber-500/20',
    border: 'border-amber-500/50',
    dot: 'bg-amber-400',
    text: 'text-amber-300',
  },
  green: {
    bg: 'bg-emerald-500/20',
    border: 'border-emerald-500/50',
    dot: 'bg-emerald-400',
    text: 'text-emerald-300',
  },
  pink: {
    bg: 'bg-rose-500/20',
    border: 'border-rose-500/50',
    dot: 'bg-rose-400',
    text: 'text-rose-300',
  },
};

export const PdfAnnotationsView: React.FC<PdfAnnotationsViewProps> = ({
  annotations,
  currentPage,
  onSelectPage,
  onDeleteAnnotation,
  onUpdateAnnotationNote,
  onClearAll,
  fileName,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState('');

  const handleStartEdit = (ann: PdfAnnotation) => {
    setEditingId(ann.id);
    setNoteDraft(ann.note || '');
  };

  const handleSaveEdit = (id: string) => {
    onUpdateAnnotationNote(id, noteDraft.trim());
    setEditingId(null);
  };

  const handleExportMarkdown = () => {
    if (annotations.length === 0) return;
    const lines = [
      `# PDF 批注报告: ${fileName}`,
      `> 导出时间: ${new Date().toLocaleString('zh-CN')} | 共 ${annotations.length} 条批注`,
      '',
    ];

    annotations.forEach((ann, idx) => {
      lines.push(`### ${idx + 1}. 第 ${ann.pageNumber} 页批注 (${ann.color})`);
      lines.push(`> "${ann.text}"`);
      if (ann.note) {
        lines.push(`**便签笔记**: ${ann.note}`);
      }
      lines.push('');
    });

    const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileName.replace(/\.pdf$/i, '')}-annotations.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (annotations.length === 0) {
    return (
      <div className="p-4 text-center text-slate-500 text-xs flex flex-col items-center gap-2.5">
        <div className="w-10 h-10 rounded-full bg-slate-800/80 flex items-center justify-center text-slate-400">
          <Highlighter className="w-5 h-5 stroke-[1.5]" />
        </div>
        <div className="space-y-1">
          <div className="text-slate-300 font-medium">暂无高亮批注</div>
          <div className="text-[11px] text-slate-500 max-w-[180px] leading-relaxed">
            在 PDF 页面上鼠标划词选中文本，即可添加彩色高亮与个人笔记
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 p-1 text-xs select-none">
      {/* 顶部操作条 */}
      <div className="flex items-center justify-between px-1 py-1 text-[11px] text-slate-400 border-b border-slate-800 pb-2 mb-1">
        <span>共 {annotations.length} 条批注</span>
        <div className="flex items-center gap-1">
          <button
            onClick={handleExportMarkdown}
            className="flex items-center gap-1 px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded transition"
            title="导出批注为 Markdown 文档"
          >
            <FileDown className="w-3 h-3 text-cyan-400" />
            <span className="hidden sm:inline">导出</span>
          </button>
          <button
            onClick={onClearAll}
            className="p-1 hover:bg-rose-950/40 text-slate-500 hover:text-rose-400 rounded transition"
            title="清空所有批注"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* 批注卡片列表 */}
      <div className="flex flex-col gap-2">
        {annotations.map((ann) => {
          const cfg = colorMap[ann.color] || colorMap.yellow;
          const isCurrent = currentPage === ann.pageNumber;

          return (
            <div
              key={ann.id}
              className={`p-2 rounded-lg border transition ${cfg.bg} ${cfg.border} ${
                isCurrent ? 'ring-1 ring-blue-400 shadow-md' : ''
              }`}
            >
              {/* 头部元信息 */}
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                  <button
                    onClick={() => onSelectPage(ann.pageNumber)}
                    className="font-mono text-[10px] text-slate-300 hover:text-blue-300 flex items-center gap-0.5 font-bold"
                    title="点击直达该页"
                  >
                    <span>P.{ann.pageNumber}</span>
                    <ArrowUpRight className="w-3 h-3" />
                  </button>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleStartEdit(ann)}
                    className="p-0.5 text-slate-400 hover:text-slate-200 rounded"
                    title="编辑便签笔记"
                  >
                    <MessageSquare className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => onDeleteAnnotation(ann.id)}
                    className="p-0.5 text-slate-400 hover:text-rose-400 rounded"
                    title="删除此条批注"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* 选中文本摘录 */}
              <div className="text-[11px] text-slate-200 font-serif italic line-clamp-3 bg-black/20 p-1.5 rounded border border-white/5">
                "{ann.text}"
              </div>

              {/* 便签笔记展示或编辑 */}
              {editingId === ann.id ? (
                <div className="mt-2 space-y-1.5">
                  <textarea
                    value={noteDraft}
                    onChange={(e) => setNoteDraft(e.target.value)}
                    placeholder="输入笔记或要点心得..."
                    rows={2}
                    className="w-full bg-slate-900 border border-slate-700 rounded p-1 text-[11px] text-slate-100 focus:outline-none focus:border-blue-500 resize-none"
                  />
                  <div className="flex justify-end gap-1">
                    <button
                      onClick={() => setEditingId(null)}
                      className="px-2 py-0.5 text-[10px] text-slate-400 hover:text-slate-200 rounded"
                    >
                      取消
                    </button>
                    <button
                      onClick={() => handleSaveEdit(ann.id)}
                      className="px-2 py-0.5 text-[10px] bg-blue-600 hover:bg-blue-500 text-white rounded font-medium"
                    >
                      保存
                    </button>
                  </div>
                </div>
              ) : ann.note ? (
                <div className="mt-1.5 text-[11px] text-slate-300 flex items-start gap-1">
                  <span className="text-slate-500 shrink-0">↳</span>
                  <span className="break-all">{ann.note}</span>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
};
