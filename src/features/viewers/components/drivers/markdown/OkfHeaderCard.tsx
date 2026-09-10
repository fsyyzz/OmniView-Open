/**
 * Google Open Knowledge Format (OKF v0.1) 概念元数据卡片组件
 * 展示实体类型徽标、标题、描述、Tags 胶囊栏、关联系统资源与元数据抽屉
 */
import React, { useState } from 'react';
import {
  Database,
  Tag,
  Clock,
  ExternalLink,
  Code2,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  Layers,
  Activity,
  FileText,
  Sparkles,
  User,
  EyeOff,
} from 'lucide-react';
import { OkfMetadata } from '../../../lib/okfParser';

export interface OkfHeaderCardProps {
  metadata: OkfMetadata;
  rawYaml?: string;
  isDarkTheme?: boolean;
  onClose?: () => void;
}

// 实体类型与其专属视觉配色映射
function getTypeTheme(typeStr?: string) {
  const t = (typeStr || '').toLowerCase();
  if (t.includes('table')) {
    return {
      icon: Database,
      badgeBg: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
      label: typeStr || 'Table',
      dotColor: 'bg-emerald-400',
    };
  }
  if (t.includes('dataset')) {
    return {
      icon: Layers,
      badgeBg: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
      label: typeStr || 'Dataset',
      dotColor: 'bg-blue-400',
    };
  }
  if (t.includes('metric') || t.includes('kpi')) {
    return {
      icon: Activity,
      badgeBg: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
      label: typeStr || 'Metric',
      dotColor: 'bg-purple-400',
    };
  }
  return {
    icon: FileText,
    badgeBg: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
    label: typeStr || 'Concept',
    dotColor: 'bg-cyan-400',
  };
}

// 标签色彩循环调色板
const TAG_COLORS = [
  'bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border-blue-500/25',
  'bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 border-indigo-500/25',
  'bg-violet-500/10 text-violet-400 hover:bg-violet-500/20 border-violet-500/25',
  'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border-emerald-500/25',
  'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border-amber-500/25',
  'bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border-rose-500/25',
  'bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 border-cyan-500/25',
];

export const OkfHeaderCard: React.FC<OkfHeaderCardProps> = ({
  metadata,
  rawYaml,
  isDarkTheme = true,
  onClose,
}) => {
  const [showRawYaml, setShowRawYaml] = useState(false);
  const [copied, setCopied] = useState(false);

  const typeConfig = getTypeTheme(metadata.type);
  const IconComponent = typeConfig.icon;

  const handleCopyYaml = () => {
    if (!rawYaml) return;
    navigator.clipboard.writeText(rawYaml);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // 格式化时间戳
  const formattedTime = metadata.timestamp
    ? (() => {
        try {
          const d = new Date(metadata.timestamp);
          return isNaN(d.getTime()) ? metadata.timestamp : d.toLocaleString();
        } catch {
          return metadata.timestamp;
        }
      })()
    : null;

  // 提取非标准核心字段的其他属性展示
  const coreFields = new Set(['type', 'title', 'description', 'resource', 'tags', 'timestamp']);
  const customEntries = Object.entries(metadata).filter(([k]) => !coreFields.has(k));

  return (
    <div
      className={`mb-6 rounded-xl border transition-all duration-200 shadow-sm ${
        isDarkTheme
          ? 'bg-slate-900/80 border-slate-800/90 text-slate-200'
          : 'bg-white/95 border-slate-200 text-slate-800'
      } backdrop-blur-md overflow-hidden`}
    >
      {/* 顶部标题与实体类型栏 */}
      <div
        className={`px-4 py-3 flex flex-wrap items-center justify-between gap-3 border-b ${
          isDarkTheme ? 'border-slate-800 bg-slate-950/40' : 'border-slate-100 bg-slate-50/80'
        }`}
      >
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* 实体类型 Badge */}
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border ${typeConfig.badgeBg}`}
          >
            <IconComponent size={13} className="shrink-0" />
            <span>{typeConfig.label}</span>
          </span>

          {/* OKF 协议规范标识 */}
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-medium ${
              isDarkTheme
                ? 'bg-slate-800/80 text-slate-400 border border-slate-700/60'
                : 'bg-slate-100 text-slate-600 border border-slate-200'
            }`}
            title="Google Open Knowledge Format (OKF v0.1)"
          >
            <Sparkles size={11} className="text-amber-400 shrink-0" />
            <span>OKF v0.1</span>
          </span>
        </div>

        {/* 右侧快捷工具栏 */}
        <div className="flex items-center gap-1.5 text-xs">
          {rawYaml && (
            <button
              onClick={() => setShowRawYaml(!showRawYaml)}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
                showRawYaml
                  ? isDarkTheme
                    ? 'bg-blue-600 text-white'
                    : 'bg-blue-500 text-white'
                  : isDarkTheme
                  ? 'hover:bg-slate-800 text-slate-400 hover:text-slate-200'
                  : 'hover:bg-slate-200 text-slate-600 hover:text-slate-900'
              }`}
              title="切换显示原始 YAML Frontmatter"
            >
              <Code2 size={13} />
              <span>YAML</span>
              {showRawYaml ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </button>
          )}

          {rawYaml && (
            <button
              onClick={handleCopyYaml}
              className={`p-1 rounded transition-colors ${
                isDarkTheme
                  ? 'hover:bg-slate-800 text-slate-400 hover:text-slate-200'
                  : 'hover:bg-slate-200 text-slate-600 hover:text-slate-900'
              }`}
              title="复制 YAML Frontmatter"
            >
              {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
            </button>
          )}

          {onClose && (
            <button
              onClick={onClose}
              className={`p-1 rounded transition-colors ${
                isDarkTheme
                  ? 'hover:bg-slate-800 text-slate-400 hover:text-rose-400'
                  : 'hover:bg-slate-200 text-slate-500 hover:text-rose-600'
              }`}
              title="关闭/折叠 OKF 概念卡片"
            >
              <EyeOff size={13} />
            </button>
          )}
        </div>
      </div>

      {/* 主信息区 */}
      <div className="p-4 space-y-3">
        {metadata.title && (
          <h2 className="text-lg font-bold tracking-tight text-slate-100 m-0">
            {metadata.title}
          </h2>
        )}

        {metadata.description && (
          <p className={`text-sm leading-relaxed m-0 ${isDarkTheme ? 'text-slate-300' : 'text-slate-600'}`}>
            {metadata.description}
          </p>
        )}

        {/* 标签栏 (Tags 胶囊) */}
        {metadata.tags && metadata.tags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <Tag size={13} className="text-slate-400 shrink-0 mr-1" />
            {metadata.tags.map((tag, idx) => {
              const colorClass = TAG_COLORS[idx % TAG_COLORS.length];
              return (
                <span
                  key={tag}
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border transition-all cursor-default ${colorClass}`}
                >
                  #{tag}
                </span>
              );
            })}
          </div>
        )}

        {/* 关联资源与附加元数据行 */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-2 text-xs border-t border-slate-800/60">
          {metadata.resource && (
            <a
              href={metadata.resource}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300 hover:underline font-medium transition-colors"
              title={metadata.resource}
            >
              <ExternalLink size={12} className="shrink-0" />
              <span className="truncate max-w-[280px]">
                {metadata.resource.replace(/^https?:\/\//, '')}
              </span>
            </a>
          )}

          {formattedTime && (
            <span className="inline-flex items-center gap-1 text-slate-400">
              <Clock size={12} className="shrink-0" />
              <span>{formattedTime}</span>
            </span>
          )}

          {customEntries.map(([key, val]) => (
            <span
              key={key}
              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] ${
                isDarkTheme ? 'bg-slate-800/60 text-slate-300' : 'bg-slate-100 text-slate-700'
              }`}
            >
              {key === 'owner' && <User size={11} className="text-slate-400 shrink-0" />}
              <span className="text-slate-400 font-medium">{key}:</span>
              <span className="font-mono">{typeof val === 'object' ? JSON.stringify(val) : String(val)}</span>
            </span>
          ))}
        </div>
      </div>

      {/* 可展开的原生 YAML 抽屉 */}
      {showRawYaml && rawYaml && (
        <div
          className={`border-t px-4 py-3 text-xs font-mono overflow-x-auto ${
            isDarkTheme ? 'bg-slate-950/70 border-slate-800 text-slate-300' : 'bg-slate-100/80 border-slate-200 text-slate-800'
          }`}
        >
          <div className="text-[11px] font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
            Raw Frontmatter (YAML)
          </div>
          <pre className="m-0 p-0 bg-transparent border-0 text-inherit leading-relaxed whitespace-pre-wrap">
            {rawYaml}
          </pre>
        </div>
      )}
    </div>
  );
};
