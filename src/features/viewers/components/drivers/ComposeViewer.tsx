/**
 * OmniView Docker Compose 微服务拓扑工作台 (Compose Viewer)
 * 支持微服务网络拓扑架构图、服务矩阵表格、环境变量脱敏检视与端口冲突静态体检
 * 深度遵循 --ov-* 语义设计令牌，像素级融入 VS Code 深浅系统主题
 */
import React, { useMemo, useState, useEffect } from 'react';
import {
  Network,
  Server,
  Layers,
  HardDrive,
  KeyRound,
  ShieldAlert,
  AlertTriangle,
  Info,
  CheckCircle2,
  Search,
  Eye,
  EyeOff,
  ArrowRight,
  Split,
  Code2,
} from 'lucide-react';
import type { ThemeId, ViewMode, FileItem } from '../../../../shared/types';
import type { Locale } from '../../../../shared/lib/i18n';
import { parseComposeFile, maskSensitiveValue } from '../../lib/parsers/composeParser';
import { useContainerWidth } from '../../hooks/useContainerWidth';
import { CodeViewer } from './CodeViewer';

type SubViewMode = 'topology' | 'matrix' | 'env' | 'diagnostics';

export interface ComposeViewerProps {
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

export const ComposeViewer: React.FC<ComposeViewerProps> = ({
  file,
  content,
  fileName,
  extension,
  mode = 'preview',
  theme,
  locale = 'zh-CN',
  onContentChange,
}) => {
  const [currentMode, setCurrentMode] = useState<ViewMode>(mode);
  const [subView, setSubView] = useState<SubViewMode>('topology');
  const [searchFilter, setSearchFilter] = useState('');
  const [revealedEnvKeys, setRevealedEnvKeys] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setCurrentMode(mode);
  }, [mode]);

  const effectiveContent = file?.content ?? content ?? '';
  const effectiveFileName = file?.name ?? fileName ?? 'docker-compose.yml';
  const effectiveExtension = file?.extension ?? extension ?? 'yml';

  const parsed = useMemo(() => parseComposeFile(effectiveContent), [effectiveContent]);

  const filteredServices = useMemo(() => {
    if (!searchFilter.trim()) return parsed.services;
    const q = searchFilter.toLowerCase();
    return parsed.services.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.image && s.image.toLowerCase().includes(q)) ||
        s.networks.some((n) => n.toLowerCase().includes(q))
    );
  }, [parsed.services, searchFilter]);

  const toggleRevealEnv = (serviceName: string, envKey: string) => {
    const key = `${serviceName}:${envKey}`;
    setRevealedEnvKeys((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const [toolbarRef, toolbarWidth] = useContainerWidth<HTMLDivElement>(600);

  // 容器响应式断点定义 (阶梯自适应收敛策略，杜绝文字与图标折行/截断)
  const isWide = toolbarWidth >= 680;
  const showSubViewActiveText = toolbarWidth >= 420;
  const showSubViewAllText = isWide;
  const showModeActiveText = toolbarWidth >= 460;
  const showModeAllText = isWide;
  const showVersionTag = toolbarWidth >= 460;
  const showStatsSummary = toolbarWidth >= 620;

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
              Compose Source
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
            <Network size={14} className="shrink-0" />
          </div>
          <span className="font-semibold tracking-wide truncate max-w-[110px] sm:max-w-[180px]" title="Docker Compose 微服务拓扑">
            Compose 拓扑
          </span>
          {showVersionTag && parsed.version && (
            <span
              className="px-1.5 py-0.5 rounded text-[10px] font-mono shrink-0 border"
              style={{
                background: 'var(--ov-code-bg)',
                borderColor: 'var(--ov-border)',
                color: 'var(--ov-accent)',
              }}
            >
              v{parsed.version}
            </span>
          )}
          {showStatsSummary && (
            <span
              className="px-2 py-0.5 rounded-full text-[10px] font-mono shrink-0 border truncate"
              style={{
                background: 'var(--ov-code-bg)',
                borderColor: 'var(--ov-border)',
                color: 'var(--ov-text-secondary)',
              }}
            >
              {parsed.services.length} 服务 · {parsed.networks.length} 网络
            </span>
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
              title="架构拓扑图"
              aria-label="架构拓扑图"
            >
              <Server size={13} className="shrink-0" />
              {(showSubViewAllText || (showSubViewActiveText && subView === 'topology')) && <span>拓扑图</span>}
            </button>

            <button
              type="button"
              onClick={() => setSubView('matrix')}
              className="flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium transition cursor-pointer shrink-0"
              style={{
                background: subView === 'matrix' ? 'var(--ov-accent)' : 'transparent',
                color: subView === 'matrix' ? '#ffffff' : 'var(--ov-text-secondary)',
              }}
              title="服务配置矩阵"
              aria-label="服务配置矩阵"
            >
              <Layers size={13} className="shrink-0" />
              {(showSubViewAllText || (showSubViewActiveText && subView === 'matrix')) && <span>矩阵</span>}
            </button>

            <button
              type="button"
              onClick={() => setSubView('env')}
              className="flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium transition cursor-pointer shrink-0"
              style={{
                background: subView === 'env' ? 'var(--ov-accent)' : 'transparent',
                color: subView === 'env' ? '#ffffff' : 'var(--ov-text-secondary)',
              }}
              title="环境变量透视"
              aria-label="环境变量透视"
            >
              <KeyRound size={13} className="shrink-0" />
              {(showSubViewAllText || (showSubViewActiveText && subView === 'env')) && <span>变量</span>}
            </button>

            <button
              type="button"
              onClick={() => setSubView('diagnostics')}
              className="flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium transition cursor-pointer shrink-0"
              style={{
                background: subView === 'diagnostics' ? 'var(--ov-accent)' : 'transparent',
                color: subView === 'diagnostics' ? '#ffffff' : 'var(--ov-text-secondary)',
              }}
              title={`配置诊断 (${parsed.diagnostics.length})`}
              aria-label="配置诊断"
            >
              <ShieldAlert size={13} className="shrink-0" />
              {(showSubViewAllText || (showSubViewActiveText && subView === 'diagnostics')) && (
                <span>诊断{parsed.diagnostics.length > 0 ? ` (${parsed.diagnostics.length})` : ''}</span>
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

      {/* 视图内容区 */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {/* SUBVIEW 1: 微服务架构拓扑图 */}
        {subView === 'topology' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs" style={{ color: 'var(--ov-text-secondary)' }}>
              <span>微服务拓扑与网络边界 (Service Topology & Networks)</span>
              <span className="text-[11px]" style={{ color: 'var(--ov-text-muted)' }}>
                展示微服务容器、端口映射、虚拟网络及 depends_on 启动依赖
              </span>
            </div>

            {/* 网络拓扑簇 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {parsed.services.map((svc) => (
                <div
                  key={svc.id}
                  className="p-3.5 border rounded-xl transition space-y-2.5 shadow-xs"
                  style={{
                    background: 'var(--ov-surface)',
                    borderColor: 'var(--ov-border)',
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-6 h-6 rounded flex items-center justify-center font-bold text-[10px] border"
                        style={{
                          background: 'var(--ov-surface-hover)',
                          borderColor: 'var(--ov-border)',
                          color: 'var(--ov-accent)',
                        }}
                      >
                        {svc.name.slice(0, 2).toUpperCase()}
                      </div>
                      <span className="font-semibold text-xs" style={{ color: 'var(--ov-text)' }}>
                        {svc.name}
                      </span>
                    </div>
                    {svc.restart && (
                      <span
                        className="text-[10px] font-mono px-1.5 py-0.5 rounded border"
                        style={{
                          background: 'var(--ov-code-bg)',
                          borderColor: 'var(--ov-border)',
                          color: 'var(--ov-text-secondary)',
                        }}
                      >
                        {svc.restart}
                      </span>
                    )}
                  </div>

                  <div className="text-xs font-mono truncate" style={{ color: 'var(--ov-text-secondary)' }}>
                    {svc.image ? `image: ${svc.image}` : svc.buildContext ? `build: ${svc.buildContext}` : 'custom'}
                  </div>

                  {/* 端口暴露 */}
                  {svc.ports.length > 0 && (
                    <div className="flex flex-wrap gap-1 text-[10px] font-mono">
                      {svc.ports.map((p, i) => (
                        <span
                          key={i}
                          className="px-1.5 py-0.5 rounded border"
                          style={{
                            background: 'rgba(59, 130, 246, 0.12)',
                            borderColor: 'rgba(59, 130, 246, 0.3)',
                            color: 'var(--ov-accent)',
                          }}
                        >
                          {p.hostPort ? `${p.hostPort}:${p.containerPort}` : p.containerPort}
                          {p.protocol ? `/${p.protocol}` : ''}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* 依赖与挂载信息 */}
                  <div
                    className="pt-2 border-t text-[11px] space-y-1"
                    style={{ borderColor: 'var(--ov-border)', color: 'var(--ov-text-secondary)' }}
                  >
                    {svc.dependsOn.length > 0 && (
                      <div className="flex items-center gap-1 truncate text-amber-500 dark:text-amber-300">
                        <ArrowRight size={11} className="shrink-0" />
                        <span className="truncate">依赖: {svc.dependsOn.join(', ')}</span>
                      </div>
                    )}
                    {svc.volumes.length > 0 && (
                      <div className="flex items-center gap-1 truncate" style={{ color: 'var(--ov-text-muted)' }}>
                        <HardDrive size={11} className="shrink-0" />
                        <span className="truncate">{svc.volumes.length} 个数据卷挂载</span>
                      </div>
                    )}
                    {svc.networks.length > 0 && (
                      <div className="flex items-center gap-1 truncate" style={{ color: 'var(--ov-accent)' }}>
                        <Network size={11} className="shrink-0" />
                        <span className="truncate">网络: {svc.networks.join(', ')}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SUBVIEW 2: 服务配置矩阵表格 */}
        {subView === 'matrix' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="relative max-w-sm flex-1">
                <Search size={14} className="absolute left-3 top-2.5" style={{ color: 'var(--ov-text-muted)' }} />
                <input
                  type="text"
                  placeholder="搜索服务名、镜像或网络..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="w-full border rounded-lg pl-8 pr-3 py-1.5 text-xs focus:outline-hidden"
                  style={{
                    background: 'var(--ov-surface)',
                    borderColor: 'var(--ov-border)',
                    color: 'var(--ov-text)',
                  }}
                />
              </div>
              <span className="text-xs" style={{ color: 'var(--ov-text-secondary)' }}>
                共 {filteredServices.length} 个服务项
              </span>
            </div>

            <div
              className="overflow-x-auto border rounded-xl"
              style={{
                background: 'var(--ov-surface)',
                borderColor: 'var(--ov-border)',
              }}
            >
              <table className="w-full text-left text-xs">
                <thead
                  className="border-b text-[11px]"
                  style={{
                    background: 'var(--ov-surface-header)',
                    borderColor: 'var(--ov-border)',
                    color: 'var(--ov-text-secondary)',
                  }}
                >
                  <tr>
                    <th className="p-2.5 pl-4">服务名称</th>
                    <th className="p-2.5">镜像 / 构建源</th>
                    <th className="p-2.5">外部端口映射</th>
                    <th className="p-2.5">数据卷</th>
                    <th className="p-2.5">所属网络</th>
                    <th className="p-2.5 pr-4">启动依赖</th>
                  </tr>
                </thead>
                <tbody
                  className="divide-y font-mono text-[11px]"
                  style={{
                    borderColor: 'var(--ov-border)',
                  }}
                >
                  {filteredServices.map((s) => (
                    <tr
                      key={s.id}
                      className="transition"
                      style={{ borderBottomColor: 'var(--ov-border)' }}
                    >
                      <td className="p-2.5 pl-4 font-semibold" style={{ color: 'var(--ov-text)' }}>
                        {s.name}
                      </td>
                      <td className="p-2.5 truncate max-w-[200px]" style={{ color: 'var(--ov-text-secondary)' }}>
                        {s.image || s.buildContext || '-'}
                      </td>
                      <td className="p-2.5" style={{ color: 'var(--ov-accent)' }}>
                        {s.ports.map((p) => p.raw).join(', ') || '-'}
                      </td>
                      <td className="p-2.5" style={{ color: 'var(--ov-text-muted)' }}>
                        {s.volumes.length > 0 ? `${s.volumes.length} 卷` : '-'}
                      </td>
                      <td className="p-2.5" style={{ color: 'var(--ov-accent)' }}>
                        {s.networks.join(', ') || 'default'}
                      </td>
                      <td className="p-2.5 pr-4 text-amber-500 dark:text-amber-300">
                        {s.dependsOn.join(', ') || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* SUBVIEW 3: 环境变量透视与敏感信息脱敏 */}
        {subView === 'env' && (
          <div className="space-y-4">
            <div className="text-xs flex items-center justify-between" style={{ color: 'var(--ov-text-secondary)' }}>
              <span>各微服务环境变量清单与自动脱敏检视</span>
              <span className="text-[10px] text-amber-500 dark:text-amber-400">
                🔒 密码、密钥、Token 字段已自动安全遮蔽，点击眼睛图标可临时解除遮蔽
              </span>
            </div>

            <div className="space-y-3">
              {parsed.services.map((svc) => (
                <div
                  key={svc.id}
                  className="p-3.5 border rounded-xl space-y-2"
                  style={{
                    background: 'var(--ov-surface)',
                    borderColor: 'var(--ov-border)',
                  }}
                >
                  <div className="font-semibold text-xs flex items-center justify-between" style={{ color: 'var(--ov-text)' }}>
                    <span>服务: {svc.name}</span>
                    <span className="text-[10px] font-mono" style={{ color: 'var(--ov-text-muted)' }}>
                      {svc.environment.length} 项环境变量
                    </span>
                  </div>

                  {svc.environment.length === 0 ? (
                    <div className="text-[11px] italic" style={{ color: 'var(--ov-text-muted)' }}>
                      未配置 environment 环境变量
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs font-mono">
                      {svc.environment.map((env) => {
                        const envKeyId = `${svc.name}:${env.key}`;
                        const isRevealed = Boolean(revealedEnvKeys[envKeyId]);
                        const displayVal = env.isSensitive && !isRevealed ? maskSensitiveValue(env.value) : env.value;

                        return (
                          <div
                            key={env.key}
                            className="p-1.5 px-2.5 rounded border flex items-center justify-between gap-2"
                            style={{
                              background: 'var(--ov-code-bg)',
                              borderColor: 'var(--ov-border)',
                            }}
                          >
                            <span className="truncate" style={{ color: 'var(--ov-text-secondary)' }}>
                              {env.key}:
                            </span>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className={env.isSensitive ? 'text-amber-500 dark:text-amber-300' : 'text-emerald-500 dark:text-emerald-300'}>
                                {displayVal || '""'}
                              </span>
                              {env.isSensitive && (
                                <button
                                  type="button"
                                  onClick={() => toggleRevealEnv(svc.name, env.key)}
                                  className="transition cursor-pointer"
                                  style={{ color: 'var(--ov-text-muted)' }}
                                  title={isRevealed ? '遮蔽敏感信息' : '显示敏感信息'}
                                >
                                  {isRevealed ? <EyeOff size={12} /> : <Eye size={12} />}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SUBVIEW 4: 静态问题诊断与冲突预警 */}
        {subView === 'diagnostics' && (
          <div className="space-y-3">
            {parsed.diagnostics.length === 0 ? (
              <div
                className="p-8 text-center border rounded-xl space-y-2"
                style={{
                  background: 'var(--ov-surface)',
                  borderColor: 'var(--ov-border)',
                }}
              >
                <CheckCircle2 size={32} className="text-emerald-500 dark:text-emerald-400 mx-auto" />
                <div className="font-medium text-sm" style={{ color: 'var(--ov-text)' }}>
                  Compose 配置结构健康，无端口或网络冲突
                </div>
                <div className="text-xs" style={{ color: 'var(--ov-text-muted)' }}>
                  未发现宿主机端口重复绑定、悬空卷或悬空依赖。
                </div>
              </div>
            ) : (
              parsed.diagnostics.map((diag, i) => (
                <div
                  key={i}
                  className={`p-3.5 rounded-xl border space-y-1.5 ${
                    diag.level === 'error'
                      ? 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-300'
                      : diag.level === 'warning'
                      ? 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-300'
                      : 'bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-300'
                  }`}
                >
                  <div className="flex items-center gap-2 font-semibold text-xs">
                    {diag.level === 'error' ? (
                      <ShieldAlert size={14} className="text-rose-500" />
                    ) : diag.level === 'warning' ? (
                      <AlertTriangle size={14} className="text-amber-500" />
                    ) : (
                      <Info size={14} className="text-blue-500" />
                    )}
                    <span>{diag.message}</span>
                  </div>
                  {diag.suggestion && (
                    <div className="text-[11px] opacity-90 pl-5 leading-relaxed">
                      💡 修复建议: {diag.suggestion}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );

  // 分屏协同模式 (Split View)
  if (currentMode === 'split') {
    return (
      <div className="w-full h-full flex overflow-hidden" style={{ background: 'var(--ov-bg)' }}>
        <div
          className="w-1/2 h-full border-r overflow-hidden"
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
        <div className="w-1/2 h-full overflow-hidden">
          {renderVisualContent()}
        </div>
      </div>
    );
  }

  // 纯预览模式 (Preview View)
  return renderVisualContent();
};

ComposeViewer.displayName = 'ComposeViewer';
