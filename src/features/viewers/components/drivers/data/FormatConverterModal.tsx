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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 animate-in fade-in select-none">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-750 rounded-xl shadow-2xl flex flex-col overflow-hidden max-h-[85vh]">
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <ArrowRightLeft className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                <span>跨格式无损互转工作台</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-950 text-indigo-300 border border-indigo-800 font-mono">
                  {currentFormat.toUpperCase()} ➔ {targetFormat.toUpperCase()}
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                纯本地离线内存序列化，不产生任何外网传输，保障配置密钥绝对私密
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 格式切换与操作选项 */}
        <div className="px-5 py-3 bg-slate-925 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
          {/* 目标格式按钮组 */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-400 mr-1">目标格式:</span>
            {formats.map((f) => (
              <button
                key={f.id}
                onClick={() => setTargetFormat(f.id)}
                className={`px-2.5 py-1 rounded-md text-xs font-mono font-medium transition cursor-pointer ${
                  targetFormat === f.id
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
                title={f.desc}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* 美化/紧凑开关 */}
          {targetFormat === 'json' && (
            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={isPretty}
                onChange={(e) => setIsPretty(e.target.checked)}
                className="rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-0"
              />
              <span>格式化缩进 (Pretty)</span>
            </label>
          )}
        </div>

        {/* 转换结果预览视窗 */}
        <div className="flex-1 min-h-[260px] max-h-[420px] overflow-auto p-4 bg-slate-950 font-mono text-xs text-slate-300 select-text">
          <pre className="whitespace-pre-wrap break-all leading-relaxed">{convertedText}</pre>
        </div>

        {/* 底部操作条 */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-slate-800 bg-slate-900/95">
          <div className="text-[11px] text-slate-500 font-mono">
            字符总数: {convertedText.length} | 行数: {convertedText.split('\n').length}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? '已复制到剪贴板' : '一键复制'}</span>
            </button>
            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition cursor-pointer shadow-xs"
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
