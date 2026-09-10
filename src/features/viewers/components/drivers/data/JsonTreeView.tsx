/**
 * 结构化数据交互式树状检视器 (JsonTreeView)
 * 支持节点展开/折叠、类型着色、JSONPath 提取与复制、敏感信息遮罩与结构化检索
 */
import React, { useState, useMemo, useCallback } from 'react';
import {
  ChevronRight,
  ChevronDown,
  Copy,
  Check,
  Search,
  ChevronsUpDown,
  ChevronsDownUp,
  Hash,
  Eye,
  EyeOff,
} from 'lucide-react';
import { isSensitiveKey, maskSensitiveValue } from './structuredDataUtils';
import { Locale, t } from '../../../../../shared/lib/i18n';

interface JsonTreeViewProps {
  data: any;
  maskSecrets?: boolean;
  searchQuery?: string;
  locale?: Locale;
}

interface TreeNodeProps {
  keyName?: string;
  value: any;
  path: string;
  depth: number;
  maskSecrets: boolean;
  searchQuery: string;
  onCopyPath: (path: string) => void;
  expandedKeys: Set<string>;
  onToggleKey: (path: string) => void;
}

const TreeNode: React.FC<TreeNodeProps> = ({
  keyName,
  value,
  path,
  depth,
  maskSecrets,
  searchQuery,
  onCopyPath,
  expandedKeys,
  onToggleKey,
}) => {
  const isObject = value !== null && typeof value === 'object';
  const isArray = Array.isArray(value);
  const isExpanded = expandedKeys.has(path);
  const [isHoveredSecret, setIsHoveredSecret] = useState(false);

  const isSecret = keyName ? isSensitiveKey(keyName) : false;

  // 搜索匹配判断
  const isMatch = useMemo(() => {
    if (!searchQuery) return false;
    const q = searchQuery.toLowerCase();
    if (keyName && keyName.toLowerCase().includes(q)) return true;
    if (!isObject && String(value).toLowerCase().includes(q)) return true;
    return false;
  }, [keyName, value, isObject, searchQuery]);

  // 类型标签与值渲染
  const renderValue = () => {
    if (value === null) {
      return <span className="text-slate-500 italic">null</span>;
    }
    if (value === undefined) {
      return <span className="text-slate-500 italic">undefined</span>;
    }
    if (typeof value === 'boolean') {
      return <span className="text-amber-400 font-semibold">{value ? 'true' : 'false'}</span>;
    }
    if (typeof value === 'number') {
      return <span className="text-sky-400 font-mono">{value}</span>;
    }
    if (typeof value === 'string') {
      if (maskSecrets && isSecret && !isHoveredSecret) {
        return (
          <span
            className="inline-flex items-center gap-1 text-rose-400 bg-rose-950/40 px-1.5 py-0.5 rounded cursor-pointer transition hover:bg-rose-900/60"
            title="已受脱敏保护，悬浮临时查看"
            onMouseEnter={() => setIsHoveredSecret(true)}
          >
            <span>{maskSensitiveValue(value)}</span>
            <Eye className="w-3 h-3 text-rose-400/80 shrink-0" />
          </span>
        );
      }
      return (
        <span
          className="text-emerald-300 break-all"
          onMouseLeave={() => setIsHoveredSecret(false)}
        >
          &quot;{value}&quot;
          {isSecret && maskSecrets && isHoveredSecret && (
            <span className="ml-1 text-[10px] text-rose-300 bg-rose-950/60 px-1 py-0.2 rounded border border-rose-800/60">
              [临时明文]
            </span>
          )}
        </span>
      );
    }
    return <span className="text-slate-300">{String(value)}</span>;
  };

  const childEntries = useMemo(() => {
    if (!isObject) return [];
    if (isArray) {
      return value.map((item: any, idx: number) => ({
        keyName: `[${idx}]`,
        subValue: item,
        subPath: `${path}[${idx}]`,
      }));
    }
    return Object.entries(value).map(([k, v]) => ({
      keyName: k,
      subValue: v,
      subPath: path ? `${path}.${k}` : `$.${k}`,
    }));
  }, [value, isObject, isArray, path]);

  return (
    <div className="font-mono text-[12px] leading-relaxed select-text">
      <div
        className={`group flex items-center gap-1.5 py-0.5 px-2 rounded-sm transition cursor-pointer hover:bg-slate-800/60 ${
          isMatch ? 'bg-amber-950/50 text-amber-200 border-l-2 border-amber-500 pl-1.5' : ''
        }`}
        style={{ paddingLeft: `${Math.max(depth * 16, 6)}px` }}
        onClick={(e) => {
          e.stopPropagation();
          if (isObject) {
            onToggleKey(path);
          } else {
            onCopyPath(path);
          }
        }}
      >
        {/* 折叠/展开箭头 */}
        {isObject ? (
          <span className="w-4 h-4 flex items-center justify-center text-slate-400 group-hover:text-slate-200 shrink-0">
            {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </span>
        ) : (
          <span className="w-4 h-4 shrink-0 flex items-center justify-center">
            <span className="w-1 h-1 rounded-full bg-slate-600" />
          </span>
        )}

        {/* 键名 */}
        {keyName && (
          <span className="text-slate-300 font-medium shrink-0 flex items-center gap-1">
            <span className={isArray ? 'text-indigo-300' : 'text-slate-200'}>{keyName}</span>
            <span className="text-slate-500 font-normal">:</span>
          </span>
        )}

        {/* 对象/数组摘要 或 标量值 */}
        {isObject ? (
          <span className="flex items-center gap-1 text-slate-400 text-[11px]">
            <span>{isArray ? '[' : '{'}</span>
            <span className="text-slate-500">
              {isArray ? `${value.length} 项` : `${Object.keys(value).length} 键`}
            </span>
            <span>{isArray ? ']' : '}'}</span>
          </span>
        ) : (
          renderValue()
        )}

        {/* JSONPath 复制快捷悬浮按钮 */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onCopyPath(path);
          }}
          className="ml-auto opacity-0 group-hover:opacity-100 flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 text-[10px] transition shrink-0"
          title={`复制 JSONPath: ${path}`}
        >
          <Copy className="w-2.5 h-2.5" />
          <span className="hidden sm:inline">Path</span>
        </button>
      </div>

      {/* 展开的子级节点 */}
      {isObject && isExpanded && (
        <div>
          {childEntries.map((child: any) => (
            <TreeNode
              key={child.subPath}
              keyName={child.keyName}
              value={child.subValue}
              path={child.subPath}
              depth={depth + 1}
              maskSecrets={maskSecrets}
              searchQuery={searchQuery}
              onCopyPath={onCopyPath}
              expandedKeys={expandedKeys}
              onToggleKey={onToggleKey}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const JsonTreeView: React.FC<JsonTreeViewProps> = ({
  data,
  maskSecrets = false,
  searchQuery = '',
  locale = 'zh-CN',
}) => {
  const [copiedPath, setCopiedPath] = useState<string | null>(null);

  // 初始化展开前 2 层
  const initialExpandedKeys = useMemo(() => {
    const keys = new Set<string>();
    keys.add('$');

    function collectKeys(node: any, curPath: string, depth: number) {
      if (depth > 2 || !node || typeof node !== 'object') return;
      keys.add(curPath);
      if (Array.isArray(node)) {
        node.slice(0, 10).forEach((item, idx) => {
          collectKeys(item, `${curPath}[${idx}]`, depth + 1);
        });
      } else {
        Object.entries(node).forEach(([k, v]) => {
          collectKeys(v, `${curPath}.${k}`, depth + 1);
        });
      }
    }

    collectKeys(data, '$', 1);
    return keys;
  }, [data]);

  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(initialExpandedKeys);

  const handleToggleKey = useCallback((path: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  const handleExpandAll = useCallback(() => {
    const all = new Set<string>();
    function collectAll(node: any, p: string, depth: number) {
      if (depth > 8 || !node || typeof node !== 'object') return;
      all.add(p);
      if (Array.isArray(node)) {
        node.forEach((item, idx) => collectAll(item, `${p}[${idx}]`, depth + 1));
      } else {
        Object.entries(node).forEach(([k, v]) => collectAll(v, `${p}.${k}`, depth + 1));
      }
    }
    collectAll(data, '$', 1);
    setExpandedKeys(all);
  }, [data]);

  const handleCollapseAll = useCallback(() => {
    setExpandedKeys(new Set(['$']));
  }, []);

  const handleCopyPath = useCallback((path: string) => {
    navigator.clipboard.writeText(path);
    setCopiedPath(path);
    setTimeout(() => setCopiedPath(null), 2000);
  }, []);

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-slate-950 overflow-hidden relative">
      {/* 顶部树控制条 */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900/90 border-b border-slate-800 text-xs shrink-0 select-none">
        <div className="flex items-center gap-2">
          <button
            onClick={handleExpandAll}
            className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] transition"
            title="全部展开"
          >
            <ChevronsUpDown className="w-3 h-3" />
            <span>全部展开</span>
          </button>
          <button
            onClick={handleCollapseAll}
            className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] transition"
            title="全部折叠"
          >
            <ChevronsDownUp className="w-3 h-3" />
            <span>全部折叠</span>
          </button>
        </div>

        {/* 最近复制的 JSONPath 提示 */}
        {copiedPath && (
          <div className="flex items-center gap-1 text-[11px] text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/80 animate-in fade-in">
            <Check className="w-3 h-3" />
            <span>已复制: {copiedPath}</span>
          </div>
        )}
      </div>

      {/* 树状内容区 */}
      <div className="flex-1 overflow-auto p-3 space-y-0.5">
        <TreeNode
          value={data}
          path="$"
          depth={0}
          maskSecrets={maskSecrets}
          searchQuery={searchQuery}
          onCopyPath={handleCopyPath}
          expandedKeys={expandedKeys}
          onToggleKey={handleToggleKey}
        />
      </div>
    </div>
  );
};
