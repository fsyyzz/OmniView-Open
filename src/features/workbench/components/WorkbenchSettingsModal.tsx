/**
 * OmniView 工作台全局设置管理模态框 (Workbench Settings Modal)
 */
import React, { useState, useEffect } from 'react';
import {
  X,
  Settings,
  Palette,
  Layout,
  Code2,
  Database,
  RotateCcw,
  Download,
  Upload,
  Check,
  AlertTriangle,
  Server,
  Type,
  Maximize2,
  FileText,
  Sliders,
  Globe,
  Sparkles,
  Info,
  Keyboard,
  HelpCircle,
  Search,
  ExternalLink,
  HardDrive,
  Copy,
  Trash2,
  RefreshCw,
  AlertCircle,
  FileCode,
  Activity,
} from 'lucide-react';
import {
  WorkbenchSettings,
  RENDER_THEMES,
  DENSITY_PRESETS,
  ThemeId,
  DensityMode,
  ContentWidthMode,
  ViewMode,
  OutlinePosition,
  OutlineDisplayMode,
} from '../../../shared/types';
import {
  loadStoredSettings,
  saveStoredSettings,
  resetStoredSettings,
  exportSettingsJson,
  importSettingsJson,
  getStorageStats,
} from '../../../shared/lib/settingsStorage';
import { resetStoredFiles, getStorageEngineInfo } from '../../../shared/lib/fileStorage';
import {
  idbGetStorageStats,
  idbGetRenderCacheStats,
  idbClearRenderCache,
  idbClearBlobs,
  idbClearViewerStates,
  idbCountViewerStates,
  idbClearLogs,
  idbCountLogs,
  getBrowserStorageEstimate,
  type AppLogItem,
  type LogLevel,
} from '../../../shared/lib/indexedDbStorage';
import { appLogger } from '../../../shared/lib/appLogger';
import { LogViewerModal } from './LogViewerModal';
import { Locale, getStoredLocale, saveStoredLocale, t } from '../../../shared/lib/i18n';
import { PLANTUML_SERVER_PRESETS, setPlantUmlServerBase } from '../../../shared/lib/plantuml';
import {
  isVsCodeEnvironment,
  getVsCodeThemeInfo,
  THIRD_PARTY_THEMES,
  applySimulatedTheme,
} from '../../../shared/lib/nativeTheme';
import { getVsCodeApi } from '../../../shared/lib/vscode';

interface WorkbenchSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: WorkbenchSettings;
  onSettingsChange: (newSettings: WorkbenchSettings) => void;
  onResetWorkspace?: () => void;
  initialTab?: TabKey;
}

export type TabKey = 'appearance' | 'editor' | 'diagrams' | 'shortcuts' | 'storage' | 'logs';

export const WorkbenchSettingsModal: React.FC<WorkbenchSettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSettingsChange,
  onResetWorkspace,
  initialTab = 'appearance',
}) => {
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);
  const [localSettings, setLocalSettings] = useState<WorkbenchSettings>(settings);
  const [storageStats, setStorageStats] = useState(() => getStorageStats());
  const [copied, setCopied] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [themeInfo, setThemeInfo] = useState(() => getVsCodeThemeInfo());
  const [activeSimulatedTheme, setActiveSimulatedTheme] = useState<string>('one-dark-pro');

  const [idbStats, setIdbStats] = useState<{
    supported: boolean;
    fileCount: number;
    blobCount: number;
    renderCacheCount: number;
    totalEstimatedBytes: number;
    filesEstimatedBytes?: number;
    renderCacheEstimatedBytes?: number;
  }>({ supported: false, fileCount: 0, blobCount: 0, renderCacheCount: 0, totalEstimatedBytes: 0, filesEstimatedBytes: 0, renderCacheEstimatedBytes: 0 });

  const [renderCacheStats, setRenderCacheStats] = useState<{
    count: number;
    totalKb: number;
    maxBytes: number;
    percentUsed: number;
  }>({ count: 0, totalKb: 0, maxBytes: 50 * 1024 * 1024, percentUsed: 0 });

  const [browserEstimate, setBrowserEstimate] = useState<{
    supported: boolean;
    quotaFormatted: string;
    usageFormatted: string;
    percentUsed: number;
  }>({ supported: false, quotaFormatted: '', usageFormatted: '', percentUsed: 0 });

  const [viewerStateStats, setViewerStateStats] = useState<{
    count: number;
    totalBytes: number;
  }>({ count: 0, totalBytes: 0 });

  const [logStats, setLogStats] = useState<{
    count: number;
    totalBytes: number;
  }>({ count: 0, totalBytes: 0 });

  const [isLogModalOpen, setIsLogModalOpen] = useState<boolean>(false);
  const [tabLogs, setTabLogs] = useState<AppLogItem[]>([]);
  const [tabLogLoading, setTabLogLoading] = useState<boolean>(false);
  const [tabLogLevel, setTabLogLevel] = useState<LogLevel | 'all'>('all');
  const [tabLogSearch, setTabLogSearch] = useState<string>('');
  const [tabLogCopied, setTabLogCopied] = useState<boolean>(false);

  const storageEngineInfo = getStorageEngineInfo();

  const fetchTabLogs = async () => {
    setTabLogLoading(true);
    try {
      const list = await appLogger.loadLogs({ limit: 100 });
      setTabLogs(list);
    } catch {
      setTabLogs([]);
    } finally {
      setTabLogLoading(false);
    }
  };

  const refreshStorageData = () => {
    setStorageStats(getStorageStats());
    idbGetStorageStats().then(setIdbStats).catch(() => {});
    idbGetRenderCacheStats().then(setRenderCacheStats).catch(() => {});
    idbCountViewerStates().then(setViewerStateStats).catch(() => {});
    idbCountLogs().then(setLogStats).catch(() => {});
    getBrowserStorageEstimate().then(setBrowserEstimate).catch(() => {});
  };

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  useEffect(() => {
    if (isOpen) {
      if (initialTab) {
        setActiveTab(initialTab);
      }
      refreshStorageData();
      setStatusMessage(null);
      setThemeInfo(getVsCodeThemeInfo());
    }
  }, [isOpen, initialTab]);

  useEffect(() => {
    if (isOpen && activeTab === 'logs') {
      void fetchTabLogs();
      const unsub = appLogger.subscribe(() => {
        void fetchTabLogs();
      });
      return unsub;
    }
  }, [isOpen, activeTab]);

  const handleExportLogs = async (format: 'log' | 'json' | 'report') => {
    try {
      const dateTag = new Date().toISOString().replace(/[:.]/g, '-');
      const levelFilter = tabLogLevel === 'all' ? undefined : tabLogLevel;
      if (format === 'json') {
        const text = await appLogger.exportLogsAsJson({ level: levelFilter });
        appLogger.downloadFile(`omniview-logs-${dateTag}.json`, text, 'application/json;charset=utf-8');
        setStatusMessage({ type: 'success', text: '已导出 JSON 结构化日志文件' });
      } else if (format === 'report') {
        const text = await appLogger.exportSystemDiagnostics();
        appLogger.downloadFile(`omniview-diagnostics-report-${dateTag}.md`, text, 'text/markdown;charset=utf-8');
        setStatusMessage({ type: 'success', text: '已生成并导出系统全景诊断报告 (.md)' });
      } else {
        const text = await appLogger.exportLogsAsText({ level: levelFilter });
        appLogger.downloadFile(`omniview-diagnostics-${dateTag}.log`, text, 'text/plain;charset=utf-8');
        setStatusMessage({ type: 'success', text: '已导出标准 .log 运行与诊断日志文件' });
      }
    } catch {
      setStatusMessage({ type: 'error', text: '导出日志失败，请重试' });
    }
  };

  const handleCopyLogsText = async () => {
    try {
      const text = await appLogger.exportLogsAsText({
        level: tabLogLevel === 'all' ? undefined : tabLogLevel,
      });
      await navigator.clipboard.writeText(text);
      setTabLogCopied(true);
      setStatusMessage({ type: 'success', text: '已成功复制诊断日志到剪贴板' });
      setTimeout(() => setTabLogCopied(false), 2500);
    } catch {
      setStatusMessage({ type: 'error', text: '复制失败，请重试' });
    }
  };

  const handleClearRenderCache = async () => {
    await idbClearRenderCache();
    refreshStorageData();
    setStatusMessage({ type: 'success', text: '已清空离线渲染快照缓存池，已释放存储空间' });
  };

  const handleClearBlobs = async () => {
    if (window.confirm('确定要清空所有离线媒体大对象（PDF/Office/图片本地缓存）吗？')) {
      await idbClearBlobs();
      refreshStorageData();
      setStatusMessage({ type: 'success', text: '已清空二进制多媒体附件缓存' });
    }
  };

  const handleClearViewerStates = async () => {
    if (window.confirm('确定要重置所有文件的阅读进度、表格排序列宽与播放记忆吗？文档本身不受影响。')) {
      await idbClearViewerStates();
      refreshStorageData();
      setStatusMessage({ type: 'success', text: '已清空所有文件的交互偏好与历史阅读进度' });
    }
  };

  const handleClearLogs = async () => {
    if (window.confirm('确定要清空所有应用运行与诊断日志吗？已持久化到 IndexedDB 的记录也将被清除。')) {
      await idbClearLogs();
      await appLogger.clearLogs();
      setTabLogs([]);
      refreshStorageData();
      setStatusMessage({ type: 'success', text: '已彻底清空应用运行与诊断日志库' });
    }
  };

  const handleResetFilesOnly = () => {
    if (window.confirm('确定要重置当前工作区文档为初始官方示范集合吗？自定义上传与修改将被重置。')) {
      resetStoredFiles();
      refreshStorageData();
      onResetWorkspace?.();
      setStatusMessage({ type: 'success', text: '已将工作区文档还原为初始示例模板' });
    }
  };

  if (!isOpen) return null;

  const updateSetting = <K extends keyof WorkbenchSettings>(key: K, value: WorkbenchSettings[K]) => {
    const updated = { ...localSettings, [key]: value };
    setLocalSettings(updated);
    saveStoredSettings({ [key]: value });
    onSettingsChange(updated);

    if (key === 'theme') {
      if (typeof document !== 'undefined') {
        document.documentElement.setAttribute('data-theme', String(value));
        document.body?.setAttribute('data-theme', String(value));
      }
    }

    if (key === 'density') {
      if (typeof document !== 'undefined') {
        document.documentElement.setAttribute('data-density', String(value));
        document.body?.setAttribute('data-density', String(value));
      }
    }

    const vsApi = getVsCodeApi();
    if (vsApi) {
      vsApi.postMessage({
        type: 'save-configuration',
        settings: { [key]: value },
      });
    }

    if (key === 'plantUmlServerUrl' && typeof value === 'string') {
      setPlantUmlServerBase(value);
    }

    if (key === 'locale' && (value === 'zh-CN' || value === 'en-US')) {
      saveStoredLocale(value);
    }
  };

  const handleExport = () => {
    try {
      const json = exportSettingsJson();
      const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `omniview-settings-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setStatusMessage({ type: 'success', text: '配置已成功导出为 JSON 文件' });
    } catch {
      setStatusMessage({ type: 'error', text: '导出配置失败' });
    }
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const res = importSettingsJson(content);
      if (res.success) {
        const refreshed = loadStoredSettings();
        setLocalSettings(refreshed);
        onSettingsChange(refreshed);
        setStorageStats(getStorageStats());
        setStatusMessage({ type: 'success', text: '配置导入成功并已应用' });
      } else {
        setStatusMessage({ type: 'error', text: res.error || '导入配置文件失败' });
      }
    };
    reader.readAsText(file);
  };

  const handleResetAll = () => {
    if (window.confirm('确定要重置所有配置项为初始默认值吗？演示文件也将被还原。')) {
      const defaultSettings = resetStoredSettings();
      resetStoredFiles();
      setLocalSettings(defaultSettings);
      onSettingsChange(defaultSettings);
      setStorageStats(getStorageStats());
      onResetWorkspace?.();
      setStatusMessage({ type: 'success', text: '已成功恢复全部出厂设置与演示文件' });
    }
  };

  const handleOpenVsCodeSettings = () => {
    const vsApi = getVsCodeApi();
    if (vsApi) {
      vsApi.postMessage({ type: 'open-vscode-settings' });
    } else {
      setStatusMessage({ type: 'error', text: '当前处于独立网页预览模式，仅 VS Code 宿主环境支持唤起原生配置面板' });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in-50 duration-150">
      <div
        id="workbench-settings-modal"
        className="w-full max-w-4xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col max-h-[88vh] overflow-hidden text-slate-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="h-14 px-6 border-b border-slate-800 flex items-center justify-between shrink-0 bg-slate-950/70">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center shadow-xs">
              <Settings className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-white">工作台偏好与持久化配置中心</h2>
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  VS Code 双向就绪
                </span>
              </div>
              <p className="text-[11px] text-slate-400">所有选项均实时持久化存储并与 VS Code 宿主配置双向同步</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleOpenVsCodeSettings}
              className="px-2.5 py-1 rounded-lg text-xs bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white border border-slate-700 flex items-center gap-1.5 transition"
              title="在 VS Code 原生设置面板中打开 omniview 配置"
            >
              <ExternalLink className="w-3.5 h-3.5 text-blue-400" />
              <span className="hidden sm:inline">VS Code 设置</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition"
              title="关闭设置"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center px-4 border-b border-slate-800 bg-slate-950/40 shrink-0 gap-1 overflow-x-auto">
          <button
            onClick={() => setActiveTab('appearance')}
            title="外观与排版"
            className={`flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-medium border-b-2 whitespace-nowrap shrink-0 transition ${
              activeTab === 'appearance'
                ? 'border-blue-500 text-blue-400 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Palette className="w-3.5 h-3.5" />
            <span>外观与排版</span>
          </button>

          <button
            onClick={() => setActiveTab('editor')}
            title="视图与分屏"
            className={`flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-medium border-b-2 whitespace-nowrap shrink-0 transition ${
              activeTab === 'editor'
                ? 'border-blue-500 text-blue-400 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layout className="w-3.5 h-3.5" />
            <span>视图与分屏</span>
          </button>

          <button
            onClick={() => setActiveTab('diagrams')}
            title="图表引擎服务"
            className={`flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-medium border-b-2 whitespace-nowrap shrink-0 transition ${
              activeTab === 'diagrams'
                ? 'border-blue-500 text-blue-400 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>图表引擎服务</span>
          </button>

          <button
            onClick={() => setActiveTab('shortcuts')}
            title="快捷键与指南"
            className={`flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-medium border-b-2 whitespace-nowrap shrink-0 transition ${
              activeTab === 'shortcuts'
                ? 'border-blue-500 text-blue-400 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Keyboard className="w-3.5 h-3.5" />
            <span>快捷键与指南</span>
          </button>

          <button
            onClick={() => setActiveTab('storage')}
            title="存储与备份"
            className={`flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-medium border-b-2 whitespace-nowrap shrink-0 transition ${
              activeTab === 'storage'
                ? 'border-blue-500 text-blue-400 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>存储与备份</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('logs');
              void fetchTabLogs();
            }}
            title="运行与诊断日志"
            className={`flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-medium border-b-2 whitespace-nowrap shrink-0 transition ${
              activeTab === 'logs'
                ? 'border-blue-500 text-blue-400 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>运行日志</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs">
          {statusMessage && (
            <div
              className={`p-2.5 rounded-lg border flex items-center gap-2 ${
                statusMessage.type === 'success'
                  ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300'
                  : 'bg-rose-950/40 border-rose-800 text-rose-300'
              }`}
            >
              {statusMessage.type === 'success' ? <Check className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
              <span>{statusMessage.text}</span>
            </div>
          )}

          {/* TAB 1: 外观与排版 */}
          {activeTab === 'appearance' && (
            <div className="space-y-4">
              {/* 主题选择 */}
              <div>
                <label className="font-semibold text-slate-200 block mb-1.5">色彩渲染主题</label>
                <div className="grid grid-cols-3 gap-2">
                  {RENDER_THEMES.map((th) => {
                    const active = localSettings.theme === th.id;
                    return (
                      <button
                        key={th.id}
                        onClick={() => updateSetting('theme', th.id)}
                        className={`p-2 rounded-lg border text-left flex items-center gap-2 transition ${
                          active
                            ? 'border-blue-500 bg-blue-600/15 text-white font-medium shadow-xs'
                            : 'border-slate-800 bg-slate-850 text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        <span
                          className="w-3 h-3 rounded-full shrink-0 border border-slate-700 shadow-xs"
                          style={{ backgroundColor: th.colorDot }}
                        />
                        <div className="truncate">
                          <div className="text-xs truncate">{th.name}</div>
                          <div className="text-[10px] text-slate-500 truncate">{th.label}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* VS Code 原生主题动态注入卡片 */}
              <div className="p-3 rounded-lg border border-blue-500/30 bg-blue-950/20 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-blue-400 font-medium text-xs">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>VS Code 原生主题动态注入 (Native Theme Injection)</span>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-medium ${
                    themeInfo.isVsCode
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                  }`}>
                    {themeInfo.isVsCode ? '● VS Code 宿主直连' : '○ Webview 仿真模式'}
                  </span>
                </div>

                <p className="text-[11px] text-slate-300 leading-relaxed">
                  {themeInfo.isVsCode
                    ? '已深度绑定 VS Code 内置 CSS 变量（--vscode-editor-*、--vscode-sideBar-* 等），支持与 One Dark Pro、Dracula、Tokyo Night 等任意第三方主题 100% 像素级无缝融合。'
                    : '已就绪原生 CSS 变量注入机制。在浏览器独立预览下，您可通过下方仿真器一键注入知名第三方主题的内置变量，验证像素级融合效果：'}
                </p>

                {/* 活跃变量指示器 */}
                <div className="grid grid-cols-3 gap-2 bg-slate-900/80 p-2 rounded-md border border-slate-800 text-[10px]">
                  <div className="flex items-center gap-1.5 truncate">
                    <span
                      className="w-2.5 h-2.5 rounded-full border border-white/20 shrink-0"
                      style={{ backgroundColor: themeInfo.editorBackground }}
                    />
                    <span className="text-slate-400 truncate">背景: {themeInfo.editorBackground}</span>
                  </div>
                  <div className="flex items-center gap-1.5 truncate">
                    <span
                      className="w-2.5 h-2.5 rounded-full border border-white/20 shrink-0"
                      style={{ backgroundColor: themeInfo.editorForeground }}
                    />
                    <span className="text-slate-400 truncate">前景色: {themeInfo.editorForeground}</span>
                  </div>
                  <div className="flex items-center gap-1.5 truncate">
                    <span
                      className="w-2.5 h-2.5 rounded-full border border-white/20 shrink-0"
                      style={{ backgroundColor: themeInfo.buttonBackground }}
                    />
                    <span className="text-slate-400 truncate">按钮: {themeInfo.buttonBackground}</span>
                  </div>
                </div>

                {/* 第三方主题模拟注入切换器 */}
                <div>
                  <div className="text-[10px] text-slate-400 mb-1.5 font-medium flex items-center gap-1">
                    <Info className="w-3 h-3 text-slate-500" />
                    <span>第三方主题模拟注入 (选择后生效并切换为 system 主题):</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {THIRD_PARTY_THEMES.map((themePreset) => {
                      const isActiveSim = activeSimulatedTheme === themePreset.id;
                      return (
                        <button
                          key={themePreset.id}
                          onClick={() => {
                            applySimulatedTheme(themePreset.id);
                            setActiveSimulatedTheme(themePreset.id);
                            updateSetting('theme', 'system');
                            setThemeInfo(getVsCodeThemeInfo());
                          }}
                          className={`px-2 py-1 rounded text-[11px] flex items-center gap-1.5 border transition ${
                            isActiveSim
                              ? 'bg-blue-600/30 text-white border-blue-500 font-medium shadow-xs'
                              : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-800'
                          }`}
                        >
                          <span
                            className="w-2 h-2 rounded-full border border-white/20"
                            style={{ backgroundColor: themePreset.variables['--vscode-editor-background'] }}
                          />
                          <span>{themePreset.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* 语言偏好与排版密度 */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="font-semibold text-slate-200 block mb-1.5">界面语言 (Language)</label>
                  <select
                    value={localSettings.locale || 'zh-CN'}
                    onChange={(e) => updateSetting('locale', e.target.value as 'zh-CN' | 'en-US')}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-hidden focus:border-blue-500"
                  >
                    <option value="zh-CN">🇨🇳 简体中文 (Chinese Simplified)</option>
                    <option value="en-US">🇺🇸 English (US)</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-200 block mb-1.5">信息排版密度</label>
                  <div className="flex bg-slate-800 p-0.5 rounded-lg border border-slate-700">
                    {DENSITY_PRESETS.map((d) => (
                      <button
                        key={d.id}
                        onClick={() => updateSetting('density', d.id)}
                        className={`flex-1 py-1 rounded text-center transition ${
                          localSettings.density === d.id
                            ? 'bg-blue-600 text-white font-medium shadow-xs'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {d.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* 正文宽度与基准字号 */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="font-semibold text-slate-200 block mb-1.5">文档正文阅读宽度</label>
                  <select
                    value={localSettings.contentWidth || 'standard'}
                    onChange={(e) => updateSetting('contentWidth', e.target.value as ContentWidthMode)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-hidden focus:border-blue-500"
                  >
                    <option value="narrow">窄幅居中 (Narrow · 720px)</option>
                    <option value="standard">标准适中 (Standard · 960px)</option>
                    <option value="wide">宽屏视野 (Wide · 1280px)</option>
                    <option value="full">全幅铺展 (Full · 100%)</option>
                    <option value="a4">A4 纸张排版 (A4 Paper · 210mm 物理印刷视图)</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-200 block mb-1.5">
                    基准正文字号: <span className="text-blue-400 font-mono">{localSettings.fontSize || 15}px</span>
                  </label>
                  <input
                    type="range"
                    min={12}
                    max={22}
                    step={1}
                    value={localSettings.fontSize || 15}
                    onChange={(e) => updateSetting('fontSize', Number(e.target.value))}
                    className="w-full accent-blue-500"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-0.5">
                    <span>12px 紧凑</span>
                    <span>15px 推荐</span>
                    <span>22px 舒适</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: 视图与分屏 */}
          {activeTab === 'editor' && (
            <div className="space-y-4">
              {/* 默认视图模式 */}
              <div>
                <label className="font-semibold text-slate-200 block mb-1.5">默认文档打开视图</label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { id: 'preview', label: '预览优先', desc: '富文本与矢量图' },
                    { id: 'split', label: '分屏协作', desc: '边写边渲染' },
                    { id: 'source', label: '源码纯编', desc: '专注纯代码' },
                    { id: 'mindmap', label: '全景导图', desc: '矢量树形视口' },
                  ].map((m) => (
                    <button
                      key={m.id}
                      onClick={() => updateSetting('viewMode', m.id as ViewMode)}
                      className={`p-2 rounded-lg border text-left transition ${
                        localSettings.viewMode === m.id
                          ? 'border-blue-500 bg-blue-600/15 text-white font-medium shadow-xs'
                          : 'border-slate-800 bg-slate-850 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <div className="font-medium text-xs">{m.label}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">{m.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* 分屏右侧默认展现与分屏默认比例 */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="font-semibold text-slate-200 block mb-1.5">分屏模式右侧优先展示</label>
                  <select
                    value={localSettings.splitRightMode || 'preview'}
                    onChange={(e) => updateSetting('splitRightMode', e.target.value as 'preview' | 'mindmap')}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-hidden focus:border-blue-500"
                  >
                    <option value="preview">📖 实时富文本与图表预览 (Preview)</option>
                    <option value="mindmap">🌿 交互式 Markmap 导图 (Mindmap)</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-200 block mb-1.5">
                    默认分屏比例 (代码占比): <span className="text-blue-400 font-mono">{localSettings.splitRatio || 50}%</span>
                  </label>
                  <input
                    type="range"
                    min={20}
                    max={80}
                    step={5}
                    value={localSettings.splitRatio || 50}
                    onChange={(e) => updateSetting('splitRatio', Number(e.target.value))}
                    className="w-full accent-blue-500"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-0.5">
                    <span>30% 紧凑</span>
                    <span>50% 对等</span>
                    <span>70% 源码主导</span>
                  </div>
                </div>
              </div>

              {/* 开关选项 */}
              <div className="pt-2 border-t border-slate-800 space-y-2.5">
                <div className="p-2 rounded-lg bg-slate-850 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-slate-200">
                        默认渲染视口缩放比例: <span className="text-blue-400 font-mono">{Math.round((localSettings.zoom || 1.0) * 100)}%</span>
                      </div>
                      <div className="text-[10px] text-slate-400">调整图表与富文本视口默认渲染初始比例 (50% ~ 200%)</div>
                    </div>
                    <div className="flex items-center gap-2 w-48">
                      <input
                        type="range"
                        min={0.5}
                        max={2.0}
                        step={0.1}
                        value={localSettings.zoom || 1.0}
                        onChange={(e) => updateSetting('zoom', Number(Number(e.target.value).toFixed(1)))}
                        className="w-full accent-blue-500"
                      />
                    </div>
                  </div>
                </div>

                <label className="flex items-center justify-between cursor-pointer p-2 rounded-lg bg-slate-850 hover:bg-slate-800 transition">
                  <div>
                    <div className="font-medium text-slate-200">默认展开大纲目录抽屉 (Outline)</div>
                    <div className="text-[10px] text-slate-400">打开 Markdown 文档时自动唤起右侧章节导航</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={localSettings.outlineOpen ?? true}
                    onChange={(e) => updateSetting('outlineOpen', e.target.checked)}
                    className="w-4 h-4 rounded accent-blue-600"
                  />
                </label>

                <div className="p-2 rounded-lg bg-slate-850 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-slate-200">文档大纲停靠位置 (Outline Position)</div>
                      <div className="text-[10px] text-slate-400">支持靠左侧边栏、靠右侧边栏或悬浮微型浮窗</div>
                    </div>
                    <div className="flex bg-slate-800 p-0.5 rounded-lg border border-slate-700">
                      {[
                        { id: 'left', label: '靠左' },
                        { id: 'right', label: '靠右' },
                        { id: 'floating', label: '悬浮' },
                      ].map((pos) => (
                        <button
                          key={pos.id}
                          type="button"
                          onClick={() => updateSetting('outlinePosition', pos.id as OutlinePosition)}
                          className={`px-2.5 py-1 rounded text-xs transition ${
                            (localSettings.outlinePosition || 'right') === pos.id
                              ? 'bg-blue-600 text-white font-medium shadow-xs'
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          {pos.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="p-2 rounded-lg bg-slate-850 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-slate-200">文档大纲展示形态 (Outline Display Mode)</div>
                      <div className="text-[10px] text-slate-400">支持树形分级折叠或紧凑扁平缩进列表</div>
                    </div>
                    <div className="flex bg-slate-800 p-0.5 rounded-lg border border-slate-700">
                      {[
                        { id: 'tree', label: '折叠树形' },
                        { id: 'list', label: '扁平列表' },
                      ].map((mode) => (
                        <button
                          key={mode.id}
                          type="button"
                          onClick={() => updateSetting('outlineDisplayMode', mode.id as OutlineDisplayMode)}
                          className={`px-2.5 py-1 rounded text-xs transition ${
                            (localSettings.outlineDisplayMode || 'tree') === mode.id
                              ? 'bg-blue-600 text-white font-medium shadow-xs'
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          {mode.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <label className="flex items-center justify-between cursor-pointer p-2 rounded-lg bg-slate-850 hover:bg-slate-800 transition">
                  <div>
                    <div className="font-medium text-slate-200">代码与文档自动换行 (Word Wrap)</div>
                    <div className="text-[10px] text-slate-400">源码视图与编辑框依据可视宽度软折行</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={localSettings.wordWrap ?? true}
                    onChange={(e) => updateSetting('wordWrap', e.target.checked)}
                    className="w-4 h-4 rounded accent-blue-600"
                  />
                </label>

                <label className="flex items-center justify-between cursor-pointer p-2 rounded-lg bg-slate-850 hover:bg-slate-800 transition">
                  <div>
                    <div className="font-medium text-slate-200">显示代码行号 (Line Numbers)</div>
                    <div className="text-[10px] text-slate-400">在各源码编辑器与诊断报告中标识行号定位</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={localSettings.showLineNumbers ?? true}
                    onChange={(e) => updateSetting('showLineNumbers', e.target.checked)}
                    className="w-4 h-4 rounded accent-blue-600"
                  />
                </label>

                <label className="flex items-center justify-between cursor-pointer p-2 rounded-lg bg-slate-850 hover:bg-slate-800 transition">
                  <div>
                    <div className="font-medium text-slate-200">Google OKF 概念元数据卡片渲染</div>
                    <div className="text-[10px] text-slate-400">自动解析 Markdown Frontmatter 元数据、Tags 标签栏及知识图谱关系</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={localSettings.enableOkfRendering ?? true}
                    onChange={(e) => updateSetting('enableOkfRendering', e.target.checked)}
                    className="w-4 h-4 rounded accent-blue-600"
                  />
                </label>

                <label className="flex items-center justify-between cursor-pointer p-2 rounded-lg bg-slate-850 hover:bg-slate-800 transition">
                  <div>
                    <div className="font-medium text-slate-200">Markdown 源码与预览双向同步 (Scroll Sync)</div>
                    <div className="text-[10px] text-slate-400">分屏模式下编辑器滚动实时同步预览视口位置</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={localSettings.scrollSync ?? true}
                    onChange={(e) => updateSetting('scrollSync', e.target.checked)}
                    className="w-4 h-4 rounded accent-blue-600"
                  />
                </label>

                <label className="flex items-center justify-between cursor-pointer p-2 rounded-lg bg-slate-850 hover:bg-slate-800 transition">
                  <div>
                    <div className="font-medium text-slate-200">双击打开编辑 / 源码定位 (Double-click to Edit)</div>
                    <div className="text-[10px] text-slate-400">关闭后双击段落或图表不会跳转源码编辑，避免文本选择与浏览时的误触中断（默认关闭）</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={localSettings.enableDoubleClickEdit ?? false}
                    onChange={(e) => updateSetting('enableDoubleClickEdit', e.target.checked)}
                    className="w-4 h-4 rounded accent-blue-600"
                  />
                </label>

                <label className="flex items-center justify-between cursor-pointer p-2 rounded-lg bg-slate-850 hover:bg-slate-800 transition">
                  <div>
                    <div className="font-medium text-slate-200">离屏复杂元素懒卸载性能优化 (Lazy Viewport Unmount)</div>
                    <div className="text-[10px] text-slate-400">超长文档中的离屏大型图表与代码块自动占位卸载，避免高内存开销并确保 60 FPS 滚动</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={localSettings.enableLazyBlockUnmount ?? true}
                    onChange={(e) => updateSetting('enableLazyBlockUnmount', e.target.checked)}
                    className="w-4 h-4 rounded accent-blue-600"
                  />
                </label>
              </div>
            </div>
          )}

          {/* TAB 3: 图表引擎服务 */}
          {activeTab === 'diagrams' && (
            <div className="space-y-4">
              <div>
                <label className="font-semibold text-slate-200 block mb-1">PlantUML 渲染服务器端点</label>
                <p className="text-[11px] text-slate-400 mb-2">
                  支持切换公网官方服务器或本地 Docker/企业自建内网私有渲染节点
                </p>
                <div className="space-y-2">
                  {PLANTUML_SERVER_PRESETS.map((p) => (
                    <label
                      key={p.id}
                      className={`flex items-center justify-between p-2.5 rounded-lg border cursor-pointer transition ${
                        localSettings.plantUmlServerUrl === p.url || (!p.url && !['https://www.plantuml.com/plantuml', 'http://localhost:8080'].includes(localSettings.plantUmlServerUrl || ''))
                          ? 'border-blue-500 bg-blue-600/15 text-white'
                          : 'border-slate-800 bg-slate-850 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Server className="w-3.5 h-3.5 text-blue-400" />
                        <div>
                          <div className="font-medium">{p.name}</div>
                          {p.url && <div className="text-[10px] text-slate-500 font-mono">{p.url}</div>}
                        </div>
                      </div>
                      <input
                        type="radio"
                        name="plantuml_server"
                        checked={localSettings.plantUmlServerUrl === p.url || (!p.url && !['https://www.plantuml.com/plantuml', 'http://localhost:8080'].includes(localSettings.plantUmlServerUrl || ''))}
                        onChange={() => {
                          if (p.url) updateSetting('plantUmlServerUrl', p.url);
                        }}
                        className="accent-blue-600"
                      />
                    </label>
                  ))}

                  <div className="pt-2">
                    <label className="text-[11px] text-slate-400 block mb-1">自定义服务端点 URL：</label>
                    <input
                      type="url"
                      value={localSettings.plantUmlServerUrl || ''}
                      onChange={(e) => updateSetting('plantUmlServerUrl', e.target.value)}
                      placeholder="https://your-private-plantuml.internal/plantuml"
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 font-mono focus:outline-hidden focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800">
                <label className="font-semibold text-slate-200 block mb-1">思维导图分屏偏好</label>
                <div className="flex items-center gap-3">
                  <span className="text-slate-400">大纲源码占比：</span>
                  <div className="flex bg-slate-800 p-0.5 rounded-lg border border-slate-700">
                    {[30, 42, 50, 70].map((ratio) => (
                      <button
                        key={ratio}
                        onClick={() => updateSetting('mindmapSplitRatio', ratio)}
                        className={`px-2.5 py-1 rounded text-xs transition ${
                          (localSettings.mindmapSplitRatio || 42) === ratio
                            ? 'bg-cyan-600 text-white font-medium shadow-xs'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {ratio}%
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: 存储与备份 */}
          {activeTab === 'storage' && (
            <div className="space-y-4">
              {/* VS Code 原生设置双向集成卡片 */}
              <div className="p-3.5 bg-blue-950/20 border border-blue-500/30 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-blue-400 font-medium">
                    <Sparkles className="w-4 h-4" />
                    <span>VS Code 原生设置双向集成 (Two-Way Sync)</span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-mono bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    19 项配置双向就绪
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  OmniView 采用统一配置中心模型：在当前弹窗修改的任何偏好均会自动写回 VS Code 全局设置 (<code className="text-blue-300 font-mono">omniview.*</code>)；同样地，在 VS Code 设置面板或 <code className="text-blue-300 font-mono">settings.json</code> 中的任何改动也会通过双向通道即时热重载到工作台。
                </p>
                <div className="pt-1 flex items-center justify-between">
                  <span className="text-[10px] text-slate-400 font-mono">
                    配置命名空间: omniview.* (19 项属性已完全对齐)
                  </span>
                  <button
                    type="button"
                    onClick={handleOpenVsCodeSettings}
                    className="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium flex items-center gap-1.5 transition shadow-xs"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>在 VS Code 原生设置中配置</span>
                  </button>
                </div>
              </div>

              {/* 浏览器/宿主环境总配额估算条 */}
              {browserEstimate.supported && (
                <div className="p-3 bg-slate-850/90 rounded-xl border border-slate-800 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-300 font-medium flex items-center gap-1.5">
                      <HardDrive className="w-3.5 h-3.5 text-blue-400" />
                      <span>宿主沙箱总配额估算 (Browser Storage Quota)</span>
                    </span>
                    <span className="font-mono text-slate-300 text-[11px]">
                      已用 {browserEstimate.usageFormatted} / 配额上限 {browserEstimate.quotaFormatted} ({browserEstimate.percentUsed}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden border border-slate-800">
                    <div
                      className="bg-blue-500 h-full rounded-full transition-all duration-300"
                      style={{ width: `${Math.max(1, browserEstimate.percentUsed)}%` }}
                    />
                  </div>
                </div>
              )}

              {/* 四大分区存储分析与独立清理控制台 */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5 text-indigo-400" />
                    <span>分区存储分析与精细化清理 (Storage Partition & Cleanup)</span>
                  </div>
                  <button
                    type="button"
                    onClick={refreshStorageData}
                    className="text-[11px] text-blue-400 hover:text-blue-300 transition flex items-center gap-1"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>刷新统计</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {/* 分区 1: 图表离线渲染快照 */}
                  <div className="p-3 bg-slate-850 rounded-xl border border-slate-800 flex flex-col justify-between space-y-2">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-slate-200 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-indigo-400" />
                          <span>图表离线快照 (Render Cache)</span>
                        </span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded font-mono bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                          50MB 守护
                        </span>
                      </div>
                      <div className="text-sm font-bold text-white font-mono mt-1">
                        {renderCacheStats.totalKb} KB <span className="text-[11px] font-normal text-slate-500">/ 50 MB</span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        共持久化 {renderCacheStats.count} 处 PlantUML / Mermaid / Graphviz 矢量产物
                      </div>
                    </div>
                    <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                      <span className="text-[10px] text-emerald-400 font-mono">断网秒开就绪</span>
                      <button
                        type="button"
                        onClick={handleClearRenderCache}
                        disabled={renderCacheStats.count === 0}
                        className="px-2 py-0.8 text-[10px] font-medium bg-slate-800 hover:bg-rose-950/40 text-slate-300 hover:text-rose-300 border border-slate-700 hover:border-rose-800/60 rounded transition disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        清空快照缓存
                      </button>
                    </div>
                  </div>

                  {/* 分区 2: 多媒体与二进制大对象 */}
                  <div className="p-3 bg-slate-850 rounded-xl border border-slate-800 flex flex-col justify-between space-y-2">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-slate-200 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-400" />
                          <span>二进制多媒体 (Blobs Store)</span>
                        </span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded font-mono bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          IndexedDB
                        </span>
                      </div>
                      <div className="text-sm font-bold text-white font-mono mt-1">
                        {idbStats.blobCount} 项媒体大对象
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        存储 PDF、Office、高保真图片等本地 ArrayBuffer 介质
                      </div>
                    </div>
                    <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                      <span className="text-[10px] text-slate-400">大文件安全隔离</span>
                      <button
                        type="button"
                        onClick={handleClearBlobs}
                        disabled={idbStats.blobCount === 0}
                        className="px-2 py-0.8 text-[10px] font-medium bg-slate-800 hover:bg-rose-950/40 text-slate-300 hover:text-rose-300 border border-slate-700 hover:border-rose-800/60 rounded transition disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        清理媒体附件
                      </button>
                    </div>
                  </div>

                  {/* 分区 3: 工作区文档内容 */}
                  <div className="p-3 bg-slate-850 rounded-xl border border-slate-800 flex flex-col justify-between space-y-2">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-slate-200 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-blue-400" />
                          <span>工作区文档 (Workspace Files)</span>
                        </span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded font-mono bg-blue-500/20 text-blue-300 border border-blue-500/30">
                          双层引擎
                        </span>
                      </div>
                      <div className="text-sm font-bold text-white font-mono mt-1">
                        {idbStats.supported ? `${Math.round((idbStats.filesEstimatedBytes || 0) / 1024 * 10) / 10} KB` : `${storageStats.usedKb} KB`}
                        <span className="text-[11px] font-normal text-slate-400 ml-1.5">({idbStats.supported ? idbStats.fileCount : storageEngineInfo.hotCacheCount} 篇文档)</span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        内存热缓存 (0ms) + IndexedDB 后台异步防抖自动落盘
                      </div>
                    </div>
                    <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                      <span className="text-[10px] text-blue-400 font-mono">无 5MB 上限</span>
                      <button
                        type="button"
                        onClick={handleResetFilesOnly}
                        className="px-2 py-0.8 text-[10px] font-medium bg-slate-800 hover:bg-amber-950/40 text-slate-300 hover:text-amber-300 border border-slate-700 hover:border-amber-800/60 rounded transition"
                      >
                        还原示例文档
                      </button>
                    </div>
                  </div>

                  {/* 分区 4: 系统配置与 UI 偏好 */}
                  <div className="p-3 bg-slate-850 rounded-xl border border-slate-800 flex flex-col justify-between space-y-2">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-slate-200 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-purple-400" />
                          <span>配置偏好 (Settings & State)</span>
                        </span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded font-mono bg-purple-500/20 text-purple-300 border border-purple-500/30">
                          LocalStorage
                        </span>
                      </div>
                      <div className="text-sm font-bold text-white font-mono mt-1">
                        {storageStats.usedKb} KB <span className="text-[11px] font-normal text-slate-500">/ 5MB 配额</span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        已与 VS Code 宿主双向同步 {storageStats.itemCount} 项配置
                      </div>
                    </div>
                    <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                      <span className="text-[10px] text-purple-300 font-mono">双向热重载</span>
                      <button
                        type="button"
                        onClick={handleExport}
                        className="px-2 py-0.8 text-[10px] font-medium bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white border border-slate-700 rounded transition"
                      >
                        备份配置 JSON
                      </button>
                    </div>
                  </div>

                  {/* 分区 5: 查看器交互与阅读偏好状态 */}
                  <div className="p-3 bg-slate-850 rounded-xl border border-slate-800 flex flex-col justify-between space-y-2">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-slate-200 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-amber-400" />
                          <span>阅读与交互记忆 (Viewer States)</span>
                        </span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded font-mono bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          V3 仓库
                        </span>
                      </div>
                      <div className="text-sm font-bold text-white font-mono mt-1">
                        {viewerStateStats.count} 份文档状态
                        <span className="text-[11px] font-normal text-slate-400 ml-1.5">({Math.round((viewerStateStats.totalBytes || 0) / 1024 * 10) / 10} KB)</span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        记忆 PDF 阅读页码/批注、CSV 排序/分页大小等交互偏好
                      </div>
                    </div>
                    <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                      <span className="text-[10px] text-amber-400/90 font-mono">跨会话记忆</span>
                      <button
                        type="button"
                        onClick={handleClearViewerStates}
                        disabled={viewerStateStats.count === 0}
                        className="px-2 py-0.8 text-[10px] font-medium bg-slate-800 hover:bg-rose-950/40 text-slate-300 hover:text-rose-300 border border-slate-700 hover:border-rose-800/60 rounded transition disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        重置阅读偏好
                      </button>
                    </div>
                  </div>

                  {/* 分区 6: 应用运行与诊断日志 */}
                  <div className="p-3 bg-slate-850 rounded-xl border border-slate-800 flex flex-col justify-between space-y-2">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-slate-200 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-rose-400" />
                          <span>运行与诊断日志 (App Logs)</span>
                        </span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded font-mono bg-rose-500/20 text-rose-300 border border-rose-500/30">
                          V4 仓库
                        </span>
                      </div>
                      <div className="text-sm font-bold text-white font-mono mt-1">
                        {logStats.count} 条日志
                        <span className="text-[11px] font-normal text-slate-400 ml-1.5">({Math.round((logStats.totalBytes || 0) / 1024 * 10) / 10} KB)</span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        记录运行时异常与警告，最多保留 1000 条并自动 LRU 淘汰
                      </div>
                    </div>
                    <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setIsLogModalOpen(true)}
                          className="px-2 py-0.8 text-[10px] font-medium bg-blue-950/40 hover:bg-blue-900/60 text-blue-300 border border-blue-800/60 rounded transition"
                        >
                          检视
                        </button>
                        <button
                          type="button"
                          onClick={() => handleExportLogs('log')}
                          disabled={logStats.count === 0}
                          className="px-2 py-0.8 text-[10px] font-medium bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white border border-slate-700 rounded transition disabled:opacity-40"
                          title="快速导出为 .log 文件"
                        >
                          .log
                        </button>
                        <button
                          type="button"
                          onClick={() => handleExportLogs('json')}
                          disabled={logStats.count === 0}
                          className="px-2 py-0.8 text-[10px] font-medium bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white border border-slate-700 rounded transition disabled:opacity-40"
                          title="快速导出为 .json 文件"
                        >
                          .json
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={handleClearLogs}
                        disabled={logStats.count === 0}
                        className="px-2 py-0.8 text-[10px] font-medium bg-slate-800 hover:bg-rose-950/40 text-slate-300 hover:text-rose-300 border border-slate-700 hover:border-rose-800/60 rounded transition disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        清空
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* 备份与恢复 */}
              <div className="space-y-2 pt-2">
                <div className="font-semibold text-slate-200">配置备份与迁移</div>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    onClick={handleExport}
                    className="p-2.5 bg-slate-800 hover:bg-slate-750 border border-slate-700 rounded-lg flex items-center gap-2 text-slate-200 transition"
                  >
                    <Download className="w-4 h-4 text-blue-400" />
                    <div className="text-left">
                      <div className="font-medium">导出设置备份</div>
                      <div className="text-[10px] text-slate-500">下载完整 .json 配置文件</div>
                    </div>
                  </button>

                  <label className="p-2.5 bg-slate-800 hover:bg-slate-750 border border-slate-700 rounded-lg flex items-center gap-2 text-slate-200 cursor-pointer transition">
                    <Upload className="w-4 h-4 text-emerald-400" />
                    <div className="text-left">
                      <div className="font-medium">导入设置还原</div>
                      <div className="text-[10px] text-slate-500">从已有 .json 恢复</div>
                    </div>
                    <input type="file" accept=".json" onChange={handleImportFile} className="hidden" />
                  </label>
                </div>
              </div>

              {/* 恢复出厂设置 */}
              <div className="pt-3 border-t border-slate-800">
                <div className="font-semibold text-rose-300 flex items-center gap-1.5 mb-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>危险区域：重置与恢复出厂</span>
                </div>
                <p className="text-[11px] text-slate-400 mb-2.5">
                  重置后，主题、排版、分屏、服务器端点等全部配置将恢复为标准预设，工作区将重置为标准示范文档集。
                </p>
                <button
                  onClick={handleResetAll}
                  className="px-3 py-1.5 bg-rose-950/60 hover:bg-rose-900/80 border border-rose-800 text-rose-300 rounded-lg text-xs font-medium flex items-center gap-1.5 transition"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>恢复出厂设置并还原演示工作区</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 5: 快捷键与使用指南 */}
          {activeTab === 'shortcuts' && (
            <div className="space-y-4">
              <div className="p-3.5 bg-slate-800/60 border border-slate-700/80 rounded-xl flex items-center justify-between">
                <div>
                  <div className="font-semibold text-slate-100 flex items-center gap-2">
                    <span>快捷键与高效交互清单</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-blue-500/20 text-blue-300 border border-blue-500/30">
                      Ctrl + ?
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    支持在任意界面按下 Ctrl+? (或 Shift+/) 随时呼出全屏快捷键速查面板
                  </div>
                </div>
                <div className="w-9 h-9 rounded-lg bg-blue-600/10 text-blue-400 border border-blue-500/20 flex items-center justify-center shrink-0">
                  <Keyboard className="w-4 h-4" />
                </div>
              </div>

              {/* 核心分类卡片 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* 1. 宿主与视图 */}
                <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-lg space-y-2">
                  <div className="text-xs font-semibold text-sky-300 flex items-center gap-1.5 border-b border-slate-800 pb-1.5">
                    <Layout className="w-3.5 h-3.5" />
                    <span>宿主与全局</span>
                  </div>
                  <div className="space-y-1.5 text-[11px]">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-300">侧边打开实时预览</span>
                      <kbd className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-700 font-mono text-[10px] text-slate-300">Ctrl+Shift+V</kbd>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-300">标准 Markdown 预览</span>
                      <kbd className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-700 font-mono text-[10px] text-slate-300">Ctrl+K V</kbd>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-300">保存并落盘写回</span>
                      <kbd className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-700 font-mono text-[10px] text-slate-300">Ctrl+S</kbd>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-300">关闭弹窗 / 退出全屏</span>
                      <kbd className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-700 font-mono text-[10px] text-slate-300">Esc</kbd>
                    </div>
                  </div>
                </div>

                {/* 2. Markdown 划选排版 */}
                <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-lg space-y-2">
                  <div className="text-xs font-semibold text-emerald-300 flex items-center gap-1.5 border-b border-slate-800 pb-1.5">
                    <Type className="w-3.5 h-3.5" />
                    <span>Markdown 选区排版</span>
                  </div>
                  <div className="space-y-1.5 text-[11px]">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-300">粗体 (**text**)</span>
                      <kbd className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-700 font-mono text-[10px] text-slate-300">Ctrl+B</kbd>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-300">斜体 (*text*)</span>
                      <kbd className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-700 font-mono text-[10px] text-slate-300">Ctrl+I</kbd>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-300">删除线 (~~text~~)</span>
                      <kbd className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-700 font-mono text-[10px] text-slate-300">Ctrl+Shift+X</kbd>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-300">行内代码 (`code`)</span>
                      <kbd className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-700 font-mono text-[10px] text-slate-300">Ctrl+E</kbd>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-300">超链接 / 双链</span>
                      <kbd className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-700 font-mono text-[10px] text-slate-300">Ctrl+K</kbd>
                    </div>
                  </div>
                </div>

                {/* 3. 浏览与检视 */}
                <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-lg space-y-2">
                  <div className="text-xs font-semibold text-purple-300 flex items-center gap-1.5 border-b border-slate-800 pb-1.5">
                    <Search className="w-3.5 h-3.5" />
                    <span>检视与缩放</span>
                  </div>
                  <div className="space-y-1.5 text-[11px]">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-300">页面内全文高亮查找</span>
                      <kbd className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-700 font-mono text-[10px] text-slate-300">Ctrl+F</kbd>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-300">放大 / 缩小比例</span>
                      <kbd className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-700 font-mono text-[10px] text-slate-300">+ / -</kbd>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-300">重置缩放到 100%</span>
                      <kbd className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-700 font-mono text-[10px] text-slate-300">0</kbd>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-300">打印 / 导出为 PDF</span>
                      <kbd className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-700 font-mono text-[10px] text-slate-300">Ctrl+P</kbd>
                    </div>
                  </div>
                </div>

                {/* 4. 鼠键协同交互手势 */}
                <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-lg space-y-2">
                  <div className="text-xs font-semibold text-amber-300 flex items-center gap-1.5 border-b border-slate-800 pb-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>鼠键协同手势</span>
                  </div>
                  <div className="space-y-1.5 text-[11px]">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-300">双击段落反向定位源码</span>
                      <span className="font-mono text-[10px] text-amber-300/80">双击文本</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-300">表格就地修改单元格</span>
                      <span className="font-mono text-[10px] text-amber-300/80">双击单元格</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-300">无限画布无级缩放</span>
                      <span className="font-mono text-[10px] text-amber-300/80">Ctrl + 滚轮</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-300">拖动画布平移视口</span>
                      <span className="font-mono text-[10px] text-amber-300/80">空格 + 拖拽</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: 运行与诊断日志 */}
          {activeTab === 'logs' && (
            <div className="space-y-4">
              {/* 顶部总览卡片 */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3 bg-slate-850 rounded-xl border border-slate-800">
                  <div className="text-[11px] text-slate-400 flex items-center justify-between">
                    <span>持久化日志</span>
                    <FileText className="w-3.5 h-3.5 text-blue-400" />
                  </div>
                  <div className="text-base font-bold text-white font-mono mt-1">
                    {logStats.count} <span className="text-xs font-normal text-slate-400">条</span>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    占用 ~{Math.round((logStats.totalBytes || 0) / 1024 * 10) / 10} KB
                  </div>
                </div>

                <div className="p-3 bg-slate-850 rounded-xl border border-slate-800">
                  <div className="text-[11px] text-rose-300 flex items-center justify-between">
                    <span>异常捕获 (Error)</span>
                    <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                  </div>
                  <div className="text-base font-bold text-rose-400 font-mono mt-1">
                    {tabLogs.filter((l) => l.level === 'error').length} <span className="text-xs font-normal text-slate-400">项</span>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    IndexedDB 自动拦截持久化
                  </div>
                </div>

                <div className="p-3 bg-slate-850 rounded-xl border border-slate-800">
                  <div className="text-[11px] text-amber-300 flex items-center justify-between">
                    <span>警告提示 (Warn)</span>
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                  </div>
                  <div className="text-base font-bold text-amber-400 font-mono mt-1">
                    {tabLogs.filter((l) => l.level === 'warn').length} <span className="text-xs font-normal text-slate-400">项</span>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    渲染降级与状态兼容提示
                  </div>
                </div>

                <div className="p-3 bg-slate-850 rounded-xl border border-slate-800">
                  <div className="text-[11px] text-emerald-300 flex items-center justify-between">
                    <span>宿主管道联动</span>
                    <Activity className="w-3.5 h-3.5 text-emerald-400" />
                  </div>
                  <div className="text-xs font-semibold text-emerald-400 mt-1.5 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>OutputChannel 激活</span>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    VS Code 视图实时同频
                  </div>
                </div>
              </div>

              {/* 导出与核心操作中心 */}
              <div className="p-3.5 bg-slate-850 rounded-xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-white flex items-center gap-2">
                      <Download className="w-4 h-4 text-blue-400" />
                      <span>诊断日志导出中枢</span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      支持导出标准纯文本日志、结构化 JSON 数据以及包含软硬件与存储状态的完整体检报告
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-700">
                      硬上限: 1000 条 (LRU 自动修剪)
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handleExportLogs('log')}
                    disabled={logStats.count === 0}
                    className="p-2.5 bg-slate-800 hover:bg-slate-750 border border-slate-700 rounded-lg flex items-center gap-2 text-slate-200 transition disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <FileText className="w-4 h-4 text-blue-400 shrink-0" />
                    <div className="text-left truncate">
                      <div className="font-medium text-xs truncate">导出 .log 文件</div>
                      <div className="text-[10px] text-slate-400 truncate">标准日志文本行</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleExportLogs('json')}
                    disabled={logStats.count === 0}
                    className="p-2.5 bg-slate-800 hover:bg-slate-750 border border-slate-700 rounded-lg flex items-center gap-2 text-slate-200 transition disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <FileCode className="w-4 h-4 text-emerald-400 shrink-0" />
                    <div className="text-left truncate">
                      <div className="font-medium text-xs truncate">导出 .json 数据</div>
                      <div className="text-[10px] text-slate-400 truncate">结构化原始字段</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleExportLogs('report')}
                    disabled={logStats.count === 0}
                    className="p-2.5 bg-slate-800 hover:bg-slate-750 border border-slate-700 rounded-lg flex items-center gap-2 text-slate-200 transition disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Activity className="w-4 h-4 text-purple-400 shrink-0" />
                    <div className="text-left truncate">
                      <div className="font-medium text-xs truncate">系统诊断报告</div>
                      <div className="text-[10px] text-slate-400 truncate">全景排障 Markdown</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={handleCopyLogsText}
                    disabled={logStats.count === 0}
                    className="p-2.5 bg-slate-800 hover:bg-slate-750 border border-slate-700 rounded-lg flex items-center gap-2 text-slate-200 transition disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {tabLogCopied ? <Check className="w-4 h-4 text-emerald-400 shrink-0" /> : <Copy className="w-4 h-4 text-amber-400 shrink-0" />}
                    <div className="text-left truncate">
                      <div className="font-medium text-xs truncate">{tabLogCopied ? '已复制成功' : '复制诊断文本'}</div>
                      <div className="text-[10px] text-slate-400 truncate">直接粘贴反馈</div>
                    </div>
                  </button>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-[11px]">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsLogModalOpen(true)}
                      className="px-3 py-1 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/40 rounded-lg transition flex items-center gap-1.5"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>打开全屏检视抽屉</span>
                    </button>
                    <button
                      type="button"
                      onClick={fetchTabLogs}
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-lg transition flex items-center gap-1"
                    >
                      <RefreshCw className={`w-3 h-3 ${tabLogLoading ? 'animate-spin text-blue-400' : ''}`} />
                      <span>刷新</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleClearLogs}
                    disabled={logStats.count === 0}
                    className="px-2.5 py-1 text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 border border-transparent hover:border-rose-900/60 rounded-lg transition disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>清空日志库</span>
                  </button>
                </div>
              </div>

              {/* 实时日志流快速预览与检索 */}
              <div className="p-3.5 bg-slate-850 rounded-xl border border-slate-800 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-semibold text-slate-200 flex items-center gap-2">
                    <span>最近实时日志流</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-900 text-slate-400 border border-slate-800">
                      Top 100
                    </span>
                  </div>

                  {/* 级别过滤与搜索 */}
                  <div className="flex items-center gap-2">
                    <div className="flex items-center bg-slate-900 p-0.5 rounded-lg border border-slate-800">
                      {(['all', 'error', 'warn', 'info'] as const).map((lvl) => (
                        <button
                          key={lvl}
                          type="button"
                          onClick={() => setTabLogLevel(lvl)}
                          className={`px-2 py-0.5 rounded text-[10px] font-medium transition ${
                            tabLogLevel === lvl
                              ? 'bg-blue-600 text-white shadow-xs'
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          {lvl === 'all' ? '全部' : lvl.toUpperCase()}
                        </button>
                      ))}
                    </div>

                    <div className="relative">
                      <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-slate-500" />
                      <input
                        type="text"
                        value={tabLogSearch}
                        onChange={(e) => setTabLogSearch(e.target.value)}
                        placeholder="过滤消息..."
                        className="pl-6 pr-2 py-0.8 bg-slate-900 border border-slate-800 rounded-lg text-[11px] text-slate-200 placeholder-slate-500 w-32 focus:outline-none focus:border-blue-500/50"
                      />
                    </div>
                  </div>
                </div>

                {/* 滚动日志预览列表 */}
                <div className="max-h-60 overflow-y-auto space-y-1.5 font-mono text-[11px] pr-1">
                  {tabLogs
                    .filter((item) => {
                      if (tabLogLevel !== 'all' && item.level !== tabLogLevel) return false;
                      if (tabLogSearch.trim()) {
                        const q = tabLogSearch.toLowerCase();
                        return (
                          item.message.toLowerCase().includes(q) ||
                          item.source.toLowerCase().includes(q) ||
                          (item.details && item.details.toLowerCase().includes(q))
                        );
                      }
                      return true;
                    })
                    .map((item) => {
                      const isErr = item.level === 'error';
                      const isWarn = item.level === 'warn';
                      return (
                        <div
                          key={item.id}
                          className={`p-2 rounded-lg border text-[10px] leading-tight ${
                            isErr
                              ? 'bg-rose-950/25 border-rose-900/40 text-rose-200'
                              : isWarn
                              ? 'bg-amber-950/25 border-amber-900/40 text-amber-200'
                              : 'bg-slate-900/60 border-slate-800 text-slate-300'
                          }`}
                        >
                          <div className="flex items-center justify-between text-slate-400 text-[9px] mb-0.5">
                            <span className="font-bold uppercase tracking-wider text-white">
                              [{item.level}] [{item.source}]
                            </span>
                            <span>{new Date(item.timestamp).toLocaleTimeString()}</span>
                          </div>
                          <div className="break-all whitespace-pre-wrap">{item.message}</div>
                        </div>
                      );
                    })}
                  {tabLogs.length === 0 && (
                    <div className="py-8 text-center text-slate-500 text-xs">
                      暂无日志记录
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="h-12 px-5 border-t border-slate-800 flex items-center justify-between shrink-0 bg-slate-950/60">
          <div className="flex items-center gap-2 text-[10px] text-slate-400">
            <span className="font-mono text-slate-500">Key: omniview:workbench:settings:v2</span>
            <span>·</span>
            <span className="text-emerald-400/90 flex items-center gap-1">
              <Check className="w-3 h-3" />
              已与 VS Code 宿主双向同步
            </span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-medium transition shadow-sm"
          >
            完成并关闭
          </button>
        </div>
      </div>

      {/* 诊断日志查看器抽屉/弹窗 */}
      <LogViewerModal
        isOpen={isLogModalOpen}
        onClose={() => setIsLogModalOpen(false)}
        onClearLogs={refreshStorageData}
      />
    </div>
  );
};
