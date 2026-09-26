/**
 * OmniView Kubernetes 复合清单引力拓扑工作台 (K8s Viewer)
 * 支持 4 层引力网络拓扑图、多文档资源全景概览看板、断链/缺少探针静态体检与源码分屏协同
 * 深度遵循 --ov-* 语义设计令牌，像素级融入 VS Code 深浅系统主题
 */
import React, { useMemo, useState, useEffect } from 'react';
import {
  Boxes,
  Layers,
  Network,
  Cpu,
  ShieldAlert,
  AlertTriangle,
  Info,
  CheckCircle2,
  Search,
  ArrowRight,
  ExternalLink,
  Server,
  FolderLock,
  HardDrive,
  GitBranch,
  Eye,
  Split,
  Code2,
} from 'lucide-react';
import type { ThemeId, ViewMode, FileItem } from '../../../../shared/types';
import type { Locale } from '../../../../shared/lib/i18n';
import {
  parseK8sManifest,
  type K8sCategory,
} from '../../lib/parsers/k8sParser';
import { useContainerWidth } from '../../hooks/useContainerWidth';
import { CodeViewer } from './CodeViewer';

type SubViewMode = 'topology' | 'resources' | 'diagnostics';

export interface K8sViewerProps {
  file?: Partial<FileItem>;
  content?: string;
  fileName?: string;
  extension?: string;
  mode?: ViewMode;
  theme?: ThemeId;
  isDarkTheme?: boolean;
  locale?: Locale;
  onContentChange?: (newContent: string) => void;
  onOpenSourceAtLine?: (line: number) => void;
  onOpenInEditor?: () => void;
}

const CATEGORY_META: Record<
  K8sCategory,
  { label: string; color: string; bg: string; icon: React.FC<{ size?: number; className?: string }> }
> = {
  network: { label: '网络入口与路由', color: 'text-sky-500 dark:text-sky-400', bg: 'bg-sky-500/10 border-sky-500/30', icon: Network },
  workload: { label: '计算工作负载', color: 'text-indigo-500 dark:text-indigo-400', bg: 'bg-indigo-500/10 border-indigo-500/30', icon: Cpu },
  config: { label: '配置与保密字典', color: 'text-amber-500 dark:text-amber-400', bg: 'bg-amber-500/10 border-amber-500/30', icon: FolderLock },
  storage: { label: '持久化存储', color: 'text-emerald-500 dark:text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30', icon: HardDrive },
  rbac: { label: '权限与安全', color: 'text-purple-500 dark:text-purple-400', bg: 'bg-purple-500/10 border-purple-500/30', icon: Server },
  other: { label: '其他扩展资源', color: 'text-slate-500 dark:text-slate-400', bg: 'bg-slate-500/10 border-slate-500/30', icon: Boxes },
};

export const K8sViewer: React.FC<K8sViewerProps> = ({
  file,
  content,
  fileName,
  extension,
  mode = 'preview',
  theme,
  locale = 'zh-CN',
  onContentChange,
  onOpenSourceAtLine,
}) => {
  const [currentMode, setCurrentMode] = useState<ViewMode>(mode);
  const [subView, setSubView] = useState<SubViewMode>('topology');
  const [searchFilter, setSearchFilter] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<K8sCategory | 'all'>('all');
  const [selectedResourceId, setSelectedResourceId] = useState<string | null>(null);

  useEffect(() => {
    setCurrentMode(mode);
  }, [mode]);

  const effectiveContent = file?.content ?? content ?? '';
  const effectiveFileName = file?.name ?? fileName ?? 'k8s-manifest.yaml';
  const effectiveExtension = file?.extension ?? extension ?? 'yaml';

  const parsed = useMemo(() => parseK8sManifest(effectiveContent), [effectiveContent]);

  const filteredResources = useMemo(() => {
    return parsed.resources.filter((res) => {
      if (selectedCategory !== 'all' && res.category !== selectedCategory) return false;
      if (!searchFilter.trim()) return true;
      const q = searchFilter.toLowerCase();
      return (
        res.name.toLowerCase().includes(q) ||
        res.kind.toLowerCase().includes(q) ||
        (res.namespace && res.namespace.toLowerCase().includes(q))
      );
    });
  }, [parsed.resources, selectedCategory, searchFilter]);

  // 计算拓扑图中四层引力泳道
  const topologyLanes = useMemo(() => {
    const lane1 = parsed.resources.filter((r) => r.kind === 'Ingress' || r.kind === 'Gateway');
    const lane2 = parsed.resources.filter((r) => r.kind === 'Service');
    const lane3 = parsed.resources.filter(
      (r) =>
        r.category === 'workload' ||
        ['Deployment', 'StatefulSet', 'DaemonSet', 'Pod', 'Job', 'CronJob'].includes(r.kind)
    );
    const lane4 = parsed.resources.filter(
      (r) => r.category === 'config' || r.category === 'storage' || r.category === 'rbac'
    );
    const other = parsed.resources.filter(
      (r) => !lane1.includes(r) && !lane2.includes(r) && !lane3.includes(r) && !lane4.includes(r)
    );

    return {
      ingress: lane1,
      service: lane2,
      workload: lane3,
      configStorage: [...lane4, ...other],
    };
  }, [parsed.resources]);

  const [toolbarRef, toolbarWidth] = useContainerWidth<HTMLDivElement>(600);

  // 容器响应式断点定义 (阶梯自适应收敛策略，杜绝文字与图标折行/截断)
  const isWide = toolbarWidth >= 680;
  const showSubViewActiveText = toolbarWidth >= 420;
  const showSubViewAllText = isWide;
  const showModeActiveText = toolbarWidth >= 460;
  const showModeAllText = isWide;
  const showResourceBadge = toolbarWidth >= 440;
  const showDiagAlert = toolbarWidth >= 620 && parsed.diagnostics.length > 0;

  // 纯源码编辑模式
  if (currentMode === 'source') {
    return (
      <div className="h-full w-full flex flex-col overflow-hidden" style={{ background: 'var(--ov-bg)' }}>
        {/* 顶部自适应切换条 */}
        <div
          ref={toolbarRef}
          className="h-10 px-3 border-b flex items-center justify-between shrink-0 text-xs select-none whitespace-nowrap flex-nowrap min-w-0"
          style={{
            background: 'var(--ov-surface-header)',
            borderColor: 'var(--ov-border)',
            color: 'var(--ov-text)',
          }}
        >
          <div className="flex items-center gap-2 font-mono min-w-0 mr-2 overflow-hidden shrink">
            <span className="font-semibold truncate max-w-[120px] sm:max-w-[200px]" title={effectiveFileName}>
              {effectiveFileName}
            </span>
            <span
              className="text-[10px] uppercase px-1.5 py-0.5 rounded border shrink-0"
              style={{
                background: 'var(--ov-code-bg)',
                borderColor: 'var(--ov-border)',
                color: 'var(--ov-text-secondary)',
              }}
            >
              Kubernetes Source
            </span>
          </div>

          <div
            className="flex items-center p-0.5 rounded-lg border shadow-xs shrink-0"
            style={{
              background: 'var(--ov-surface)',
              borderColor: 'var(--ov-border)',
            }}
          >
            <button
              type="button"
              onClick={() => setCurrentMode('preview')}
              className="flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium transition cursor-pointer hover:bg-[var(--ov-surface-hover)] shrink-0"
              style={{ color: 'var(--ov-text-secondary)' }}
              title="图形化渲染视图"
              aria-label="渲染视图"
            >
              <Eye size={13} className="shrink-0" />
              {showModeAllText && <span>渲染视图</span>}
            </button>
            <button
              type="button"
              onClick={() => setCurrentMode('split')}
              className="flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium transition cursor-pointer hover:bg-[var(--ov-surface-hover)] shrink-0"
              style={{ color: 'var(--ov-text-secondary)' }}
              title="并排分屏协同"
              aria-label="并排分屏"
            >
              <Split size={13} className="shrink-0" />
              {showModeAllText && <span>并排分屏</span>}
            </button>
            <button
              type="button"
              onClick={() => setCurrentMode('source')}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold shadow-xs bg-[var(--ov-accent)] text-white shrink-0"
              title="纯源码编辑模式"
              aria-label="源码模式"
            >
              <Code2 size={13} className="shrink-0" />
              {(showModeAllText || showModeActiveText) && <span>源码模式</span>}
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-hidden">
          <CodeViewer
            content={effectiveContent}
            extension={effectiveExtension}
            fileName={effectiveFileName}
            locale={locale}
            theme={theme}
            onContentChange={onContentChange}
          />
        </div>
      </div>
    );
  }

  const renderVisualContent = () => (
    <div
      className="flex-1 flex flex-col h-full overflow-hidden select-none transition-colors"
      style={{
        background: 'var(--ov-bg)',
        color: 'var(--ov-text)',
      }}
    >
      {/* 顶部工具栏 (依托容器宽度动态自适应文字与图标，杜绝挤爆折行) */}
      <div
        ref={toolbarRef}
        className="h-10 px-3 border-b flex items-center justify-between shrink-0 text-xs transition-colors select-none whitespace-nowrap flex-nowrap min-w-0"
        style={{
          background: 'var(--ov-surface-header)',
          borderColor: 'var(--ov-border)',
          color: 'var(--ov-text)',
        }}
      >
        <div className="flex items-center gap-1.5 min-w-0 mr-2 overflow-hidden shrink">
          <div
            className="w-6 h-6 rounded flex items-center justify-center shrink-0 border"
            style={{
              background: 'var(--ov-surface-hover)',
              borderColor: 'var(--ov-border)',
              color: 'var(--ov-accent)',
            }}
          >
            <Boxes size={14} className="shrink-0" />
          </div>
          <span className="font-semibold tracking-wide truncate max-w-[110px] sm:max-w-[180px]" title="Kubernetes 清单引力拓扑">
            K8s 清单拓扑
          </span>
          {showResourceBadge && (
            <span
              className="px-1.5 py-0.5 rounded text-[10px] font-mono shrink-0 border"
              style={{
                background: 'var(--ov-code-bg)',
                borderColor: 'var(--ov-border)',
                color: 'var(--ov-accent)',
              }}
            >
              {parsed.resources.length} 资源
            </span>
          )}
          {showDiagAlert && (
            <button
              type="button"
              onClick={() => setSubView('diagnostics')}
              className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border transition cursor-pointer shrink-0"
              style={{
                background: 'rgba(245, 158, 11, 0.1)',
                borderColor: 'rgba(245, 158, 11, 0.3)',
                color: '#f59e0b',
              }}
              title="查看最佳实践体检"
            >
              <AlertTriangle size={11} className="shrink-0" />
              <span>{parsed.diagnostics.length} 诊断</span>
            </button>
          )}
        </div>

        {/* 视口与模式切换器 */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* 子视图切换 */}
          <div
            className="flex items-center p-0.5 rounded-lg border shadow-xs shrink-0"
            style={{
              background: 'var(--ov-surface)',
              borderColor: 'var(--ov-border)',
            }}
          >
            <button
              type="button"
              onClick={() => setSubView('topology')}
              className="flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium transition cursor-pointer shrink-0"
              style={{
                background: subView === 'topology' ? 'var(--ov-accent)' : 'transparent',
                color: subView === 'topology' ? '#ffffff' : 'var(--ov-text-secondary)',
              }}
              title="4层引力拓扑图"
              aria-label="引力拓扑"
            >
              <GitBranch size={13} className="shrink-0" />
              {(showSubViewAllText || (showSubViewActiveText && subView === 'topology')) && <span>引力拓扑</span>}
            </button>
            <button
              type="button"
              onClick={() => setSubView('resources')}
              className="flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium transition cursor-pointer shrink-0"
              style={{
                background: subView === 'resources' ? 'var(--ov-accent)' : 'transparent',
                color: subView === 'resources' ? '#ffffff' : 'var(--ov-text-secondary)',
              }}
              title={`多文档资源看板 (${parsed.resources.length})`}
              aria-label="资源看板"
            >
              <Layers size={13} className="shrink-0" />
              {(showSubViewAllText || (showSubViewActiveText && subView === 'resources')) && (
                <span>{showSubViewAllText ? `资源看板 (${parsed.resources.length})` : `看板 (${parsed.resources.length})`}</span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setSubView('diagnostics')}
              className="flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium transition cursor-pointer shrink-0"
              style={{
                background: subView === 'diagnostics' ? 'var(--ov-accent)' : 'transparent',
                color: subView === 'diagnostics' ? '#ffffff' : 'var(--ov-text-secondary)',
              }}
              title="最佳实践体检报告"
              aria-label="体检报告"
            >
              <ShieldAlert size={13} className="shrink-0" />
              {(showSubViewAllText || (showSubViewActiveText && subView === 'diagnostics')) && (
                <span>{showSubViewAllText ? '体检报告' : '体检'}</span>
              )}
            </button>
          </div>

          {/* 模式切换器 */}
          <div
            className="flex items-center p-0.5 rounded-lg border shadow-xs shrink-0"
            style={{
              background: 'var(--ov-surface)',
              borderColor: 'var(--ov-border)',
            }}
          >
            <button
              type="button"
              onClick={() => setCurrentMode('preview')}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition cursor-pointer shrink-0"
              style={{
                background: currentMode === 'preview' ? 'var(--ov-accent)' : 'transparent',
                color: currentMode === 'preview' ? '#ffffff' : 'var(--ov-text-secondary)',
              }}
              title="图形化渲染视图"
              aria-label="渲染视图"
            >
              <Eye size={13} className="shrink-0" />
              {(showModeAllText || (showModeActiveText && currentMode === 'preview')) && <span>渲染</span>}
            </button>
            <button
              type="button"
              onClick={() => setCurrentMode('split')}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition cursor-pointer shrink-0"
              style={{
                background: currentMode === 'split' ? 'var(--ov-accent)' : 'transparent',
                color: currentMode === 'split' ? '#ffffff' : 'var(--ov-text-secondary)',
              }}
              title="并排分屏协同"
              aria-label="并排分屏"
            >
              <Split size={13} className="shrink-0" />
              {(showModeAllText || (showModeActiveText && currentMode === 'split')) && <span>分屏</span>}
            </button>
            <button
              type="button"
              onClick={() => setCurrentMode('source')}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition cursor-pointer hover:bg-[var(--ov-surface-hover)] shrink-0"
              style={{ color: 'var(--ov-text-secondary)' }}
              title="纯源码编辑模式"
              aria-label="源码模式"
            >
              <Code2 size={13} className="shrink-0" />
              {showModeAllText && <span>源码</span>}
            </button>
          </div>
        </div>
      </div>

      {/* 视图主体 */}
      <div className="flex-1 overflow-auto p-4">
        {/* 1. 四层引力拓扑图 */}
        {subView === 'topology' && (
          <div className="h-full flex flex-col gap-4">
            <div
              className="flex items-center justify-between text-xs px-1"
              style={{ color: 'var(--ov-text-secondary)' }}
            >
              <div className="flex items-center gap-2 flex-wrap">
                <span>引力分层流向：</span>
                <span className="font-mono text-sky-500 dark:text-sky-400">Ingress / 网关</span>
                <ArrowRight size={12} />
                <span className="font-mono text-cyan-500 dark:text-cyan-400">Service 路由</span>
                <ArrowRight size={12} />
                <span className="font-mono text-indigo-500 dark:text-indigo-400">Workload 负载</span>
                <ArrowRight size={12} />
                <span className="font-mono text-amber-500 dark:text-amber-400">Config / Storage</span>
              </div>
              <span className="font-mono text-[11px]" style={{ color: 'var(--ov-text-muted)' }}>
                共 {parsed.topology.edges.length} 条引力依赖连线
              </span>
            </div>

            {/* 四列引力泳道 */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 flex-1 items-start min-h-[460px]">
              {/* 泳道 1: 入口与路由 */}
              <div
                className="flex flex-col gap-3 p-3 rounded-xl border min-h-[300px]"
                style={{
                  background: 'var(--ov-surface)',
                  borderColor: 'rgba(14, 165, 233, 0.25)',
                }}
              >
                <div
                  className="flex items-center justify-between border-b pb-2"
                  style={{ borderColor: 'rgba(14, 165, 233, 0.2)' }}
                >
                  <div className="flex items-center gap-2 font-semibold text-xs text-sky-500 dark:text-sky-400">
                    <Network size={14} />
                    <span>网络入口 (Ingress)</span>
                  </div>
                  <span
                    className="text-[10px] font-mono px-1.5 py-0.5 rounded border"
                    style={{
                      background: 'rgba(14, 165, 233, 0.1)',
                      borderColor: 'rgba(14, 165, 233, 0.3)',
                      color: 'rgb(14, 165, 233)',
                    }}
                  >
                    {topologyLanes.ingress.length}
                  </span>
                </div>
                {topologyLanes.ingress.length === 0 ? (
                  <div className="text-center py-8 text-xs italic" style={{ color: 'var(--ov-text-muted)' }}>
                    无 Ingress / 网关定义
                  </div>
                ) : (
                  topologyLanes.ingress.map((res) => (
                    <div
                      key={res.id}
                      onClick={() => {
                        setSelectedResourceId(res.id);
                        setSubView('resources');
                      }}
                      className="p-3 rounded-lg border cursor-pointer transition shadow-xs hover:border-sky-400"
                      style={{
                        background: 'var(--ov-code-bg)',
                        borderColor: 'rgba(14, 165, 233, 0.3)',
                      }}
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-sky-600 dark:text-sky-300">{res.name}</span>
                        <span className="text-[10px] font-mono" style={{ color: 'var(--ov-text-muted)' }}>
                          {res.kind}
                        </span>
                      </div>
                      <div className="mt-1 text-[11px] truncate" style={{ color: 'var(--ov-text-secondary)' }}>
                        {res.summary}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* 泳道 2: Service 服务发现 */}
              <div
                className="flex flex-col gap-3 p-3 rounded-xl border min-h-[300px]"
                style={{
                  background: 'var(--ov-surface)',
                  borderColor: 'rgba(6, 182, 212, 0.25)',
                }}
              >
                <div
                  className="flex items-center justify-between border-b pb-2"
                  style={{ borderColor: 'rgba(6, 182, 212, 0.2)' }}
                >
                  <div className="flex items-center gap-2 font-semibold text-xs text-cyan-500 dark:text-cyan-400">
                    <Server size={14} />
                    <span>服务发现 (Service)</span>
                  </div>
                  <span
                    className="text-[10px] font-mono px-1.5 py-0.5 rounded border"
                    style={{
                      background: 'rgba(6, 182, 212, 0.1)',
                      borderColor: 'rgba(6, 182, 212, 0.3)',
                      color: 'rgb(6, 182, 212)',
                    }}
                  >
                    {topologyLanes.service.length}
                  </span>
                </div>
                {topologyLanes.service.length === 0 ? (
                  <div className="text-center py-8 text-xs italic" style={{ color: 'var(--ov-text-muted)' }}>
                    无 Service 资源
                  </div>
                ) : (
                  topologyLanes.service.map((res) => (
                    <div
                      key={res.id}
                      onClick={() => {
                        setSelectedResourceId(res.id);
                        setSubView('resources');
                      }}
                      className="p-3 rounded-lg border cursor-pointer transition shadow-xs hover:border-cyan-400"
                      style={{
                        background: 'var(--ov-code-bg)',
                        borderColor: 'rgba(6, 182, 212, 0.3)',
                      }}
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-cyan-600 dark:text-cyan-300">{res.name}</span>
                        <span className="text-[10px] font-mono" style={{ color: 'var(--ov-text-muted)' }}>
                          {res.kind}
                        </span>
                      </div>
                      <div className="mt-1 text-[11px] truncate" style={{ color: 'var(--ov-text-secondary)' }}>
                        {res.summary}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* 泳道 3: Workload 工作负载 */}
              <div
                className="flex flex-col gap-3 p-3 rounded-xl border min-h-[300px]"
                style={{
                  background: 'var(--ov-surface)',
                  borderColor: 'rgba(99, 102, 241, 0.25)',
                }}
              >
                <div
                  className="flex items-center justify-between border-b pb-2"
                  style={{ borderColor: 'rgba(99, 102, 241, 0.2)' }}
                >
                  <div className="flex items-center gap-2 font-semibold text-xs text-indigo-500 dark:text-indigo-400">
                    <Cpu size={14} />
                    <span>计算负载 (Workload)</span>
                  </div>
                  <span
                    className="text-[10px] font-mono px-1.5 py-0.5 rounded border"
                    style={{
                      background: 'rgba(99, 102, 241, 0.1)',
                      borderColor: 'rgba(99, 102, 241, 0.3)',
                      color: 'rgb(99, 102, 241)',
                    }}
                  >
                    {topologyLanes.workload.length}
                  </span>
                </div>
                {topologyLanes.workload.length === 0 ? (
                  <div className="text-center py-8 text-xs italic" style={{ color: 'var(--ov-text-muted)' }}>
                    无计算负载资源
                  </div>
                ) : (
                  topologyLanes.workload.map((res) => (
                    <div
                      key={res.id}
                      onClick={() => {
                        setSelectedResourceId(res.id);
                        setSubView('resources');
                      }}
                      className="p-3 rounded-lg border cursor-pointer transition shadow-xs hover:border-indigo-400"
                      style={{
                        background: 'var(--ov-code-bg)',
                        borderColor: 'rgba(99, 102, 241, 0.3)',
                      }}
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-indigo-600 dark:text-indigo-300">{res.name}</span>
                        <span className="text-[10px] font-mono" style={{ color: 'var(--ov-text-muted)' }}>
                          {res.kind}
                        </span>
                      </div>
                      <div className="mt-1 text-[11px] truncate" style={{ color: 'var(--ov-text-secondary)' }}>
                        {res.summary}
                      </div>
                      {res.containers && res.containers.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {res.containers.map((c, i) => (
                            <span
                              key={i}
                              className="px-1.5 py-0.5 rounded text-[10px] font-mono border truncate max-w-[150px]"
                              style={{
                                background: 'var(--ov-surface)',
                                borderColor: 'var(--ov-border)',
                                color: 'var(--ov-text-secondary)',
                              }}
                            >
                              {c.name}: {c.image.split(':')[0]}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* 泳道 4: 配置与存储 */}
              <div
                className="flex flex-col gap-3 p-3 rounded-xl border min-h-[300px]"
                style={{
                  background: 'var(--ov-surface)',
                  borderColor: 'rgba(245, 158, 11, 0.25)',
                }}
              >
                <div
                  className="flex items-center justify-between border-b pb-2"
                  style={{ borderColor: 'rgba(245, 158, 11, 0.2)' }}
                >
                  <div className="flex items-center gap-2 font-semibold text-xs text-amber-500 dark:text-amber-400">
                    <FolderLock size={14} />
                    <span>配置与存储</span>
                  </div>
                  <span
                    className="text-[10px] font-mono px-1.5 py-0.5 rounded border"
                    style={{
                      background: 'rgba(245, 158, 11, 0.1)',
                      borderColor: 'rgba(245, 158, 11, 0.3)',
                      color: '#f59e0b',
                    }}
                  >
                    {topologyLanes.configStorage.length}
                  </span>
                </div>
                {topologyLanes.configStorage.length === 0 ? (
                  <div className="text-center py-8 text-xs italic" style={{ color: 'var(--ov-text-muted)' }}>
                    无配置或存储卷
                  </div>
                ) : (
                  topologyLanes.configStorage.map((res) => (
                    <div
                      key={res.id}
                      onClick={() => {
                        setSelectedResourceId(res.id);
                        setSubView('resources');
                      }}
                      className="p-3 rounded-lg border cursor-pointer transition shadow-xs hover:border-amber-400"
                      style={{
                        background: 'var(--ov-code-bg)',
                        borderColor: 'rgba(245, 158, 11, 0.3)',
                      }}
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-amber-600 dark:text-amber-300">{res.name}</span>
                        <span className="text-[10px] font-mono" style={{ color: 'var(--ov-text-muted)' }}>
                          {res.kind}
                        </span>
                      </div>
                      <div className="mt-1 text-[11px] truncate" style={{ color: 'var(--ov-text-secondary)' }}>
                        {res.summary}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* 2. 资源全景概览看板 */}
        {subView === 'resources' && (
          <div className="flex flex-col gap-4">
            {/* 过滤器与检索栏 */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                  style={{ color: 'var(--ov-text-muted)' }}
                />
                <input
                  type="text"
                  placeholder="搜索资源名称、Kind 或命名空间..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 rounded-lg border text-xs focus:outline-hidden"
                  style={{
                    background: 'var(--ov-surface)',
                    borderColor: 'var(--ov-border)',
                    color: 'var(--ov-text)',
                  }}
                />
              </div>

              {/* 分类快捷筛选 */}
              <div className="flex items-center gap-1 text-xs flex-wrap">
                <button
                  type="button"
                  onClick={() => setSelectedCategory('all')}
                  className="px-2.5 py-1 rounded-md text-xs font-medium transition cursor-pointer"
                  style={{
                    background: selectedCategory === 'all' ? 'var(--ov-accent)' : 'var(--ov-surface)',
                    color: selectedCategory === 'all' ? '#ffffff' : 'var(--ov-text-secondary)',
                    border: '1px solid var(--ov-border)',
                  }}
                >
                  全部 ({parsed.resources.length})
                </button>
                {(['workload', 'network', 'config', 'storage'] as K8sCategory[]).map((cat) => {
                  const meta = CATEGORY_META[cat];
                  const count = parsed.categoriesCount[cat] || 0;
                  const isActive = selectedCategory === cat;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSelectedCategory(cat)}
                      className="px-2 py-1 rounded-md text-xs font-medium transition cursor-pointer"
                      style={{
                        background: isActive ? 'var(--ov-accent)' : 'var(--ov-surface)',
                        color: isActive ? '#ffffff' : 'var(--ov-text-secondary)',
                        border: '1px solid var(--ov-border)',
                      }}
                    >
                      {meta.label.split('与')[0]} ({count})
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 资源列表卡片网格 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredResources.map((res) => {
                const meta = CATEGORY_META[res.category];
                const IconComponent = meta.icon;
                const isSelected = res.id === selectedResourceId;
                return (
                  <div
                    key={res.id}
                    onClick={() => setSelectedResourceId(isSelected ? null : res.id)}
                    className="p-4 rounded-xl border transition cursor-pointer flex flex-col justify-between shadow-xs"
                    style={{
                      background: isSelected ? 'var(--ov-surface-hover)' : 'var(--ov-surface)',
                      borderColor: isSelected ? 'var(--ov-accent)' : 'var(--ov-border)',
                      boxShadow: isSelected ? '0 0 0 1px var(--ov-accent)' : undefined,
                    }}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`p-1.5 rounded-md ${meta.bg} ${meta.color}`}>
                            <IconComponent size={14} />
                          </div>
                          <div>
                            <span className="font-semibold text-xs block" style={{ color: 'var(--ov-text)' }}>
                              {res.name}
                            </span>
                            <span className="text-[10px] font-mono" style={{ color: 'var(--ov-text-muted)' }}>
                              {res.kind} · {res.apiVersion}
                            </span>
                          </div>
                        </div>
                        {res.namespace && (
                          <span
                            className="px-2 py-0.5 rounded text-[10px] font-mono border"
                            style={{
                              background: 'var(--ov-code-bg)',
                              borderColor: 'var(--ov-border)',
                              color: 'var(--ov-text-secondary)',
                            }}
                          >
                            ns: {res.namespace}
                          </span>
                        )}
                      </div>

                      <p className="mt-2.5 text-xs" style={{ color: 'var(--ov-text-secondary)' }}>
                        {res.summary}
                      </p>

                      {/* 容器规格预览 */}
                      {res.containers && res.containers.length > 0 && (
                        <div
                          className="mt-3 pt-2.5 border-t flex flex-col gap-1.5 text-[11px]"
                          style={{ borderColor: 'var(--ov-border)' }}
                        >
                          {res.containers.map((c, i) => (
                            <div key={i} className="flex items-center justify-between" style={{ color: 'var(--ov-text-secondary)' }}>
                              <span className="font-mono" style={{ color: 'var(--ov-accent)' }}>
                                {c.name}
                              </span>
                              <span className="font-mono text-[10px] truncate max-w-[160px]" style={{ color: 'var(--ov-text-muted)' }}>
                                {c.image}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div
                      className="mt-3 pt-2 border-t flex items-center justify-between text-[11px]"
                      style={{ borderColor: 'var(--ov-border)', color: 'var(--ov-text-muted)' }}
                    >
                      <span>序号 #{res.index + 1}</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onOpenSourceAtLine) {
                            onOpenSourceAtLine(1);
                          }
                        }}
                        className="flex items-center gap-1 transition cursor-pointer"
                        style={{ color: 'var(--ov-accent)' }}
                      >
                        <ExternalLink size={11} />
                        <span>查看源码</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 3. 静态体检报告 */}
        {subView === 'diagnostics' && (
          <div className="max-w-4xl mx-auto flex flex-col gap-4">
            <div
              className="p-4 rounded-xl border flex items-center justify-between"
              style={{
                background: 'var(--ov-surface)',
                borderColor: 'var(--ov-border)',
              }}
            >
              <div>
                <h3 className="text-sm font-semibold" style={{ color: 'var(--ov-text)' }}>
                  Kubernetes 最佳实践体检中心
                </h3>
                <p className="text-xs mt-1" style={{ color: 'var(--ov-text-muted)' }}>
                  基于云原生标准对清单进行静态分析，涵盖存活探针、资源 Limit、断链 Service 路由等。
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className="px-3 py-1 rounded-full text-xs font-mono font-medium border"
                  style={{
                    background: 'rgba(245, 158, 11, 0.1)',
                    borderColor: 'rgba(245, 158, 11, 0.3)',
                    color: '#f59e0b',
                  }}
                >
                  {parsed.diagnostics.length} 项关注点
                </span>
              </div>
            </div>

            {parsed.diagnostics.length === 0 ? (
              <div className="text-center py-16 flex flex-col items-center gap-3">
                <div
                  className="w-12 h-12 rounded-full border flex items-center justify-center"
                  style={{
                    background: 'rgba(16, 185, 129, 0.1)',
                    borderColor: 'rgba(16, 185, 129, 0.3)',
                    color: '#10b981',
                  }}
                >
                  <CheckCircle2 size={24} />
                </div>
                <span className="text-sm font-medium" style={{ color: 'var(--ov-text)' }}>
                  配置健康度满分！
                </span>
                <span className="text-xs" style={{ color: 'var(--ov-text-muted)' }}>
                  未检测到断链服务、缺失资源限额或未配置探针的情况。
                </span>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {parsed.diagnostics.map((diag, index) => (
                  <div
                    key={index}
                    className={`p-3.5 rounded-xl border flex items-start gap-3 ${
                      diag.level === 'warning'
                        ? 'bg-amber-500/10 border-amber-500/30'
                        : diag.level === 'error'
                        ? 'bg-rose-500/10 border-rose-500/30'
                        : 'bg-indigo-500/10 border-indigo-500/30'
                    }`}
                  >
                    <div className="mt-0.5 shrink-0">
                      {diag.level === 'warning' ? (
                        <AlertTriangle size={15} className="text-amber-500" />
                      ) : diag.level === 'error' ? (
                        <ShieldAlert size={15} className="text-rose-500" />
                      ) : (
                        <Info size={15} className="text-indigo-500" />
                      )}
                    </div>
                    <div className="flex-1 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold" style={{ color: 'var(--ov-text)' }}>
                          {diag.message}
                        </span>
                        {diag.ruleId && (
                          <span className="font-mono text-[10px]" style={{ color: 'var(--ov-text-muted)' }}>
                            {diag.ruleId}
                          </span>
                        )}
                      </div>
                      {diag.suggestion && (
                        <p className="mt-1.5 text-[11px] leading-relaxed" style={{ color: 'var(--ov-text-secondary)' }}>
                          💡 建议优化：{diag.suggestion}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  // 分屏模式 (Split View)
  if (currentMode === 'split') {
    return (
      <div className="flex h-full w-full overflow-hidden" style={{ background: 'var(--ov-bg)' }}>
        <div
          className="w-1/2 h-full border-r flex flex-col overflow-hidden"
          style={{ borderColor: 'var(--ov-border)' }}
        >
          <CodeViewer
            content={effectiveContent}
            extension={effectiveExtension}
            fileName={effectiveFileName}
            locale={locale}
            theme={theme}
            onContentChange={onContentChange}
          />
        </div>
        <div className="w-1/2 h-full flex flex-col overflow-hidden">
          {renderVisualContent()}
        </div>
      </div>
    );
  }

  return renderVisualContent();
};

K8sViewer.displayName = 'K8sViewer';
