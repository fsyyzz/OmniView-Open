/**
 * 结构化数据跨格式互转工作台 (FormatConverterModal)
 * 支持 JSON ⇄ YAML ⇄ TOML ⇄ XML 实时安全无损互转、格式美化/压缩、复制与导出
 */
import React, { useState, useMemo } from 'react';
import {
  X,
  Copy,
  Check,
  Download,
  ArrowRightLeft,
  Sparkles,
  FileCode,
  CheckCircle2,
} from 'lucide-react';
import { convertStructuredData, StructuredFormat } from './structuredDataUtils';
import { Locale, t } from '../../../../../shared/lib/i18n';

interface FormatConverterModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: any;
  currentFormat: StructuredFormat;
  fileName?: string;
  locale?: Locale;
}

export const FormatConverterModal: React.FC<FormatConverterModalProps> = ({
  isOpen,
  onClose,
  data,
  currentFormat,
  fileName = 'config',
  locale = 'zh-CN',
}) => {
  const [targetFormat, setTargetFormat] = useState<StructuredFormat>(() => {
    return currentFormat === 'yaml' ? 'json' : 'yaml';
  });
  const [isPretty, setIsPretty] = useState(true);
  const [copied, setCopied] = useState(false);

  // 内存中实时序列化转换结果
  const convertedText = useMemo(() => {
    return convertStructuredData(data, targetFormat, { pretty: isPretty });
  }, [data, targetFormat, isPretty]);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(convertedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const baseName = fileName.replace(/\.[^/.]+$/, '');
    const extMap: Record<StructuredFormat, string> = {
      json: 'json',
      yaml: 'yaml',
      toml: 'toml',
      xml: 'xml',
    };
    const blob = new Blob([convertedText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${baseName}.${extMap[targetFormat]}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formats: Array<{ id: StructuredFormat; label: string; desc: string }> = [
    { id: 'json', label: 'JSON', desc: 'Web & API 标准数据交换格式' },
    { id: 'yaml', label: 'YAML', desc: 'Kubernetes / CI / 声明式配置' },
    { id: 'toml', label: 'TOML', desc: 'Rust / Python / 简洁工程配置' },
    { id: 'xml', label: 'XML', desc: '企业级与跨平台标记文档' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in select-none">
      <div
        style={{
          backgroundColor: 'var(--ov-surface)',
          borderColor: 'var(--ov-border)',
          color: 'var(--ov-text)',
        }}
        className="w-full max-w-2xl border rounded-xl shadow-2xl flex flex-col overflow-hidden max-h-[85vh]"
      >
        {/* 标题栏 */}
        <div
          style={{
            backgroundColor: 'var(--ov-surface-header)',
            borderBottomColor: 'var(--ov-border)',
          }}
          className="flex items-center justify-between px-5 py-3 border-b"
        >
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <ArrowRightLeft className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--ov-text)' }}>
                <span>跨格式无损互转工作台</span>
                <span
                  style={{
                    backgroundColor: 'var(--ov-surface)',
                    borderColor: 'var(--ov-border)',
                    color: 'var(--ov-accent)',
                  }}
                  className="text-[10px] px-1.5 py-0.2 rounded border font-mono"
                >
                  {currentFormat.toUpperCase()} ➔ {targetFormat.toUpperCase()}
                </span>
              </h3>
              <p className="text-[11px]" style={{ color: 'var(--ov-text-secondary)' }}>
                纯本地离线内存序列化，不产生任何外网传输，保障配置密钥绝对私密
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ color: 'var(--ov-text-secondary)' }}
            className="p-1 rounded-lg hover:text-[var(--ov-text)] transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 格式切换与操作选项 */}
        <div
          style={{
            backgroundColor: 'var(--ov-surface-header)',
            borderBottomColor: 'var(--ov-border)',
          }}
          className="px-5 py-3 border-b flex flex-wrap items-center justify-between gap-3"
        >
          {/* 目标格式按钮组 */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs mr-1" style={{ color: 'var(--ov-text-secondary)' }}>目标格式:</span>
            {formats.map((f) => (
              <button
                key={f.id}
                onClick={() => setTargetFormat(f.id)}
                style={{
                  backgroundColor: targetFormat === f.id ? 'var(--ov-accent, #6366f1)' : 'var(--ov-surface)',
                  color: targetFormat === f.id ? '#ffffff' : 'var(--ov-text-secondary)',
                  borderColor: 'var(--ov-border)',
                }}
                className="px-2.5 py-1 rounded-md text-xs font-mono font-medium transition cursor-pointer border"
                title={f.desc}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* 美化/紧凑开关 */}
          {targetFormat === 'json' && (
            <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: 'var(--ov-text)' }}>
              <input
                type="checkbox"
                checked={isPretty}
                onChange={(e) => setIsPretty(e.target.checked)}
                className="rounded border-[var(--ov-border)] text-indigo-600 focus:ring-0"
              />
              <span>格式化缩进 (Pretty)</span>
            </label>
          )}
        </div>

        {/* 转换结果预览视窗 */}
        <div
          style={{
            backgroundColor: 'var(--ov-bg)',
            color: 'var(--ov-text)',
          }}
          className="flex-1 min-h-[260px] max-h-[420px] overflow-auto p-4 font-mono text-xs select-text"
        >
          <pre className="whitespace-pre-wrap break-all leading-relaxed">{convertedText}</pre>
        </div>

        {/* 底部操作条 */}
        <div
          style={{
            backgroundColor: 'var(--ov-surface-header)',
            borderTopColor: 'var(--ov-border)',
          }}
          className="flex items-center justify-between px-5 py-3 border-t"
        >
          <div className="text-[11px] font-mono" style={{ color: 'var(--ov-text-muted)' }}>
            字符总数: {convertedText.length} | 行数: {convertedText.split('\n').length}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={handleCopy}
              style={{
                backgroundColor: 'var(--ov-surface)',
                borderColor: 'var(--ov-border)',
                color: 'var(--ov-text)',
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition cursor-pointer hover:border-[var(--ov-accent)]"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? '已复制到剪贴板' : '一键复制'}</span>
            </button>
            <button
              onClick={handleDownload}
              style={{
                backgroundColor: 'var(--ov-accent, #6366f1)',
                color: '#ffffff',
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer shadow-xs hover:opacity-90"
            >
              <Download className="w-3.5 h-3.5" />
              <span>下载转换文件</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
