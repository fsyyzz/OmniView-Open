/**
 * PlantUML 企业级架构模板库弹窗 (PlantUmlTemplateModal)
 */
import React, { useState, useMemo } from 'react';
import { BookOpen, Search } from 'lucide-react';
import { PLANTUML_TEMPLATES, PlantUmlTemplate } from './plantUmlData';

export interface PlantUmlTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyTemplate: (code: string) => void;
}

export const PlantUmlTemplateModal: React.FC<PlantUmlTemplateModalProps> = ({
  isOpen,
  onClose,
  onApplyTemplate,
}) => {
  const [templateCategory, setTemplateCategory] = useState<string>('all');
  const [templateSearch, setTemplateSearch] = useState<string>('');
  const [selectedTemplate, setSelectedTemplate] = useState<PlantUmlTemplate>(PLANTUML_TEMPLATES[0]);

  const filteredTemplates = useMemo(() => {
    return PLANTUML_TEMPLATES.filter(tmpl => {
      const matchCat = templateCategory === 'all' || tmpl.category === templateCategory;
      const matchSearch =
        !templateSearch ||
        tmpl.name.toLowerCase().includes(templateSearch.toLowerCase()) ||
        tmpl.description.toLowerCase().includes(templateSearch.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [templateCategory, templateSearch]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
      <div
        style={{
          backgroundColor: 'var(--ov-surface)',
          borderColor: 'var(--ov-border)',
          color: 'var(--ov-text)',
          boxShadow: 'var(--ov-shadow)',
        }}
        className="border rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden"
        role="dialog"
        aria-label="PlantUML 企业级架构模板库"
      >
        {/* Modal Header */}
        <div
          style={{ borderBottomColor: 'var(--ov-border)', backgroundColor: 'var(--ov-surface-header)' }}
          className="flex items-center justify-between px-6 py-4 border-b"
        >
          <div className="flex items-center gap-2.5">
            <BookOpen className="w-5 h-5 text-[var(--ov-accent)]" />
            <div>
              <h3 style={{ color: 'var(--ov-text)' }} className="text-sm font-semibold">PlantUML 企业级架构模板库</h3>
              <p style={{ color: 'var(--ov-text-muted)' }} className="text-xs">选择经典架构与图表样板，一键加载至工作台开始设计</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ color: 'var(--ov-text-muted)' }}
            className="hover:text-[var(--ov-text)] p-1 rounded-lg transition text-sm"
            aria-label="关闭模板库"
          >
            ✕
          </button>
        </div>

        {/* Filter & Search Bar */}
        <div
          style={{
            borderBottomColor: 'var(--ov-border)',
            backgroundColor: 'var(--ov-bg)',
          }}
          className="px-6 py-3 border-b flex items-center justify-between gap-3 flex-wrap"
        >
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
            {[
              { id: 'all', label: '全部' },
              { id: 'architecture', label: '系统架构' },
              { id: 'sequence', label: '时序通信' },
              { id: 'state', label: '系统状态' },
              { id: 'gantt', label: '研发甘特图' },
              { id: 'mindmap', label: '思维导图' },
              { id: 'database', label: '数据建模' },
            ].map(cat => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setTemplateCategory(cat.id)}
                style={
                  templateCategory === cat.id
                    ? { backgroundColor: 'var(--ov-accent)', color: '#ffffff' }
                    : { backgroundColor: 'var(--ov-surface)', borderColor: 'var(--ov-border)', color: 'var(--ov-text-secondary)' }
                }
                className="px-3 py-1 rounded-full text-xs transition border"
              >
                {cat.label}
              </button>
            ))}
          </div>

          <div className="relative w-48">
            <Search style={{ color: 'var(--ov-text-muted)' }} className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={templateSearch}
              onChange={e => setTemplateSearch(e.target.value)}
              placeholder="搜索模板..."
              style={{
                backgroundColor: 'var(--ov-surface)',
                borderColor: 'var(--ov-border)',
                color: 'var(--ov-text)',
              }}
              className="w-full pl-8 pr-2.5 py-1 border rounded-lg text-xs outline-none focus:border-[var(--ov-accent)]"
            />
          </div>
        </div>

        {/* Modal Body: Left Template List, Right Preview */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Template List */}
          <div
            style={{ borderRightColor: 'var(--ov-border)' }}
            className="w-2/5 border-r overflow-y-auto p-4 space-y-2"
          >
            {filteredTemplates.map(tmpl => {
              const isSelected = selectedTemplate.id === tmpl.id;
              return (
                <button
                  key={tmpl.id}
                  type="button"
                  onClick={() => setSelectedTemplate(tmpl)}
                  style={
                    isSelected
                      ? { backgroundColor: 'var(--ov-accent-bg, rgba(99,102,241,0.15))', borderColor: 'var(--ov-accent)' }
                      : { backgroundColor: 'var(--ov-bg)', borderColor: 'var(--ov-border)' }
                  }
                  className="w-full text-left p-3 rounded-xl border transition"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span style={{ color: isSelected ? 'var(--ov-accent)' : 'var(--ov-text)' }} className="font-medium text-xs">{tmpl.name}</span>
                    <span
                      style={{ backgroundColor: 'var(--ov-surface)', borderColor: 'var(--ov-border)', color: 'var(--ov-text-muted)' }}
                      className="text-[10px] px-2 py-0.5 rounded-full font-mono border"
                    >
                      {tmpl.categoryLabel}
                    </span>
                  </div>
                  <p style={{ color: 'var(--ov-text-muted)' }} className="text-[11px] line-clamp-2 leading-relaxed">{tmpl.description}</p>
                </button>
              );
            })}
          </div>

          {/* Right Preview */}
          <div
            style={{ backgroundColor: 'var(--ov-code-bg, var(--ov-bg))' }}
            className="w-3/5 flex flex-col"
          >
            <div
              style={{ borderBottomColor: 'var(--ov-border)', backgroundColor: 'var(--ov-surface-header)' }}
              className="p-4 border-b flex items-center justify-between"
            >
              <div>
                <h4 style={{ color: 'var(--ov-text)' }} className="text-xs font-semibold">{selectedTemplate.name}</h4>
                <span style={{ color: 'var(--ov-text-muted)' }} className="text-[11px]">{selectedTemplate.description}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  onApplyTemplate(selectedTemplate.code);
                  onClose();
                }}
                style={{ backgroundColor: 'var(--ov-accent)', color: '#ffffff' }}
                className="px-4 py-1.5 rounded-lg text-xs font-medium transition hover:opacity-90 shadow-xs"
              >
                载入此模板
              </button>
            </div>
            <div
              style={{ color: 'var(--ov-text-secondary)' }}
              className="flex-1 overflow-auto p-4 font-mono text-xs"
            >
              <pre className="whitespace-pre-wrap leading-relaxed">{selectedTemplate.code}</pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
