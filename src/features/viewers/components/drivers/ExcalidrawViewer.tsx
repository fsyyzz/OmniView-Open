/**
 * OmniView Excalidraw 手绘白板工作室组件 (Phase 2 完整双向交互与白板系统)
 * 支持：
 * 1. 完整画布双向交互式编辑 (Canvas Studio) - 支持手绘图元、矩形、椭圆、箭头、线条、文本、画笔、橡皮擦等全量工具
 * 2. 双向分屏联动 (Split) - 左侧 JSON 源码即时编辑 / 右侧交互白板实时响应
 * 3. 高保真只读演示 (Preview) - 矢量 SVG 纯净展示，支持平移拖拽与缩放
 * 4. JSON 源码编辑 (Source Code) - 全屏源码编辑与一键语法美化
 * 5. 辅助网格 (Grid)、禅模式 (Zen Mode)、只读锁定 (Lock) 与视口自动居中 (Fit Content)
 * 6. 多维度高品质导出：.svg 矢量、.png 2x 视网膜图、.excalidraw 原生工程文件及剪贴板互通
 */
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Maximize,
  Copy,
  Check,
  Download,
  Share2,
  ChevronDown,
  Columns,
  Eye,
  FileCode,
  AlertCircle,
  Sparkles,
  Grid,
  Loader2,
  PenTool,
  Lock,
  Unlock,
  Focus,
  LayoutTemplate,
  X,
  Play,
  Layers,
  GitFork,
  ChevronLeft,
  ChevronRight,
  Info,
  BookmarkPlus,
  Trash2,
  ExternalLink,
  Upload,
  Search,
  Globe,
  FileUp,
  Package,
  MoreHorizontal,
} from 'lucide-react';
import { Locale } from '../../../../shared/lib/i18n';
import { ThemeId } from '../../../../shared/types';
import {
  parseExcalidrawJson,
  renderExcalidrawToSvgString,
  downloadBlob,
  embedExcalidrawPayloadInSvg,
  getFramesFromElements,
  autoCreateFrames,
  convertMermaidToExcalidraw,
  detectDanglingArrows,
  getExcalidrawLibraryUrl,
  parseExcalidrawLibJson,
  exportStencilsAsExcalidrawLibBlob,
  EXCALIDRAW_OFFICIAL_LIBRARY_BASE_URL,
} from './excalidraw/excalidrawEngine';
import {
  EXCALIDRAW_TEMPLATES,
  ExcalidrawTemplate,
  EXCALIDRAW_STENCILS,
  ExcalidrawStencil,
  OFFICIAL_COMMUNITY_CATEGORIES,
  getAllPresetLibraryItems,
  stencilsToLibraryItems,
} from './excalidraw/excalidrawTemplates';
import { RenderErrorBoundary } from '../common/RenderErrorBoundary';

const ExcalidrawCanvas = React.lazy(() =>
  import('./excalidraw/ExcalidrawCanvas').then((m) => ({ default: m.ExcalidrawCanvas }))
);

export interface ExcalidrawViewerProps {
  content: string;
  fileName?: string;
  locale?: Locale;
  theme?: ThemeId;
  isDarkTheme?: boolean;
  onContentChange?: (content: string) => void;
}

export const ExcalidrawViewer: React.FC<ExcalidrawViewerProps> = ({
  content,
  fileName = 'drawing.excalidraw',
  locale = 'zh-CN',
  isDarkTheme = false,
  onContentChange,
}) => {
  // 编辑态 JSON 文本
  const [sourceText, setSourceText] = useState<string>(content);
  // 模式：交互白板 (canvas) / 双向分屏 (split) / 只读演示 (preview) / 源码编辑 (code)
  const [viewMode, setViewMode] = useState<'canvas' | 'split' | 'preview' | 'code'>('canvas');

  // 画布工具选项
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [isZenMode, setIsZenMode] = useState<boolean>(false);
  const [isViewOnly, setIsViewOnly] = useState<boolean>(false);

  // 只读预览视口缩放与平移
  const [scale, setScale] = useState<number>(1);
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const startPanRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Excalidraw Imperative API 引用
  const excalidrawApiRef = useRef<any>(null);

  // 渲染产物与状态
  const [renderedSvg, setRenderedSvg] = useState<string>('');
  const [isLoadingSvg, setIsLoadingSvg] = useState<boolean>(false);
  const [renderError, setRenderError] = useState<string | null>(null);

  // 复制与导出反馈
  const [copiedAction, setCopiedAction] = useState<string | null>(null);
  const [showExportMenu, setShowExportMenu] = useState<boolean>(false);
  const [showTemplatesModal, setShowTemplatesModal] = useState<boolean>(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // 演播导览 (Slide Mode) 状态
  const [isSlideMode, setIsSlideMode] = useState<boolean>(false);
  const [currentFrameIndex, setCurrentFrameIndex] = useState<number>(0);

  // Mermaid 代码转译手绘模态框状态
  const [showMermaidModal, setShowMermaidModal] = useState<boolean>(false);
  const [mermaidCode, setMermaidCode] = useState<string>(
    'flowchart TD\n  A[用户终端 App] --> B[API Gateway 网关]\n  B --> C[Order 微服务]\n  B --> D[Payment 微服务]\n  C --> E[(MySQL 数据库)]\n  D --> F[Redis 缓存]'
  );
  const [mermaidError, setMermaidError] = useState<string | null>(null);

  // 架构物料与素材资产中心状态
  const [showStencilsDrawer, setShowStencilsDrawer] = useState<boolean>(false);
  const [stencilsTab, setStencilsTab] = useState<'stencils' | 'official' | 'import'>('stencils');
  const [stencilSearch, setStencilSearch] = useState<string>('');
  const [selectedStencilCategory, setSelectedStencilCategory] = useState<string>('all');
  const [copiedLibUrl, setCopiedLibUrl] = useState<boolean>(false);
  const [libraryToast, setLibraryToast] = useState<string | null>(null);

  // 外部导入 URL 与 JSON 状态
  const [importUrl, setImportUrl] = useState<string>('');
  const [isImportingUrl, setIsImportingUrl] = useState<boolean>(false);
  const [importUrlError, setImportUrlError] = useState<string | null>(null);
  const [importJsonText, setImportJsonText] = useState<string>('');
  const [importJsonError, setImportJsonError] = useState<string | null>(null);
  const [customStencilName, setCustomStencilName] = useState<string>('');
  const [showSaveCustomInput, setShowSaveCustomInput] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [customStencils, setCustomStencils] = useState<ExcalidrawStencil[]>(() => {
    try {
      const saved = localStorage.getItem('omniview_excalidraw_stencils');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // 同步外部传入的 content（例如打开不同文件或外部撤销恢复）
  useEffect(() => {
    setSourceText(content);
  }, [content]);

  // 解析 JSON 结构
  const parsedData = useMemo(() => {
    return parseExcalidrawJson(sourceText);
  }, [sourceText]);

  // 提取画框 (Frames) 列表
  const frames = useMemo(() => {
    return getFramesFromElements(parsedData?.elements || []);
  }, [parsedData?.elements]);

  // 拓扑健康诊断（悬空箭头统计）
  const arrowStats = useMemo(() => {
    return detectDanglingArrows(parsedData?.elements || []);
  }, [parsedData?.elements]);

  // 运镜聚焦指定 Frame
  const navigateToFrame = useCallback(
    (index: number) => {
      if (frames.length === 0) return;
      const targetIndex = (index + frames.length) % frames.length;
      setCurrentFrameIndex(targetIndex);
      const targetFrame = frames[targetIndex];
      if (excalidrawApiRef.current && targetFrame) {
        excalidrawApiRef.current.scrollToContent(targetFrame, {
          fitToContent: true,
          animate: true,
          duration: 350,
        });
      }
    },
    [frames]
  );

  // 幻灯片演示键盘快捷键
  useEffect(() => {
    if (!isSlideMode) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
        e.preventDefault();
        navigateToFrame(currentFrameIndex + 1);
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        navigateToFrame(currentFrameIndex - 1);
      } else if (e.key === '0' || e.key === 'Home') {
        e.preventDefault();
        excalidrawApiRef.current?.scrollToContent();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setIsSlideMode(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSlideMode, currentFrameIndex, navigateToFrame]);

  // 一键按图元分组自动生成演示画框
  const handleAutoCreateFrames = () => {
    if (!parsedData.isValid) return;
    const newElements = autoCreateFrames(parsedData.elements);
    const newDoc = {
      type: 'excalidraw',
      version: 2,
      source: 'https://omniview.dev',
      elements: newElements,
      appState: parsedData.appState,
      files: parsedData.files,
    };
    const jsonStr = JSON.stringify(newDoc, null, 2);
    setSourceText(jsonStr);
    onContentChange?.(jsonStr);
    excalidrawApiRef.current?.updateScene({ elements: newElements });
    setTimeout(() => {
      navigateToFrame(0);
    }, 150);
  };

  // Mermaid 代码转译导入
  const handleImportMermaid = () => {
    try {
      setMermaidError(null);
      const { elements, appState } = convertMermaidToExcalidraw(mermaidCode);
      if (elements.length === 0) {
        setMermaidError(isZh ? '未能从代码中解析出有效节点，请检查 Mermaid 语法' : 'No valid nodes parsed');
        return;
      }
      const newDoc = {
        type: 'excalidraw',
        version: 2,
        source: 'https://omniview.dev',
        elements,
        appState: {
          ...parsedData.appState,
          ...appState,
        },
        files: parsedData.files,
      };
      const jsonStr = JSON.stringify(newDoc, null, 2);
      setSourceText(jsonStr);
      onContentChange?.(jsonStr);
      excalidrawApiRef.current?.updateScene({ elements, appState: newDoc.appState });
      setShowMermaidModal(false);
      setTimeout(() => {
        excalidrawApiRef.current?.scrollToContent();
      }, 100);
    } catch (err: any) {
      setMermaidError(err?.message || 'Mermaid 转换失败');
    }
  };

  // 插入架构物料至画布
  const handleInsertStencil = (stencil: ExcalidrawStencil) => {
    if (!stencil || !stencil.elements) return;
    const existing = parsedData.elements || [];
    const offsetX = 240 + Math.random() * 50;
    const offsetY = 180 + Math.random() * 50;
    const stamp = Date.now();
    const newEls = stencil.elements.map((el, i) => ({
      ...el,
      id: `stencil-${stamp}-${i}`,
      x: (el.x || 0) + offsetX,
      y: (el.y || 0) + offsetY,
      seed: Math.floor(Math.random() * 100000),
      version: 1,
    }));
    const combined = [...existing, ...newEls];
    const newDoc = {
      type: 'excalidraw',
      version: 2,
      source: 'https://omniview.dev',
      elements: combined,
      appState: parsedData.appState,
      files: parsedData.files,
    };
    const jsonStr = JSON.stringify(newDoc, null, 2);
    setSourceText(jsonStr);
    onContentChange?.(jsonStr);
    excalidrawApiRef.current?.updateScene({ elements: combined });
    setShowStencilsDrawer(false);
  };

  // 动态生成 Excalidraw 官方社区素材库 URL（自动附带 OmniView 宿主回跳参数与 Token 标识）
  const officialLibraryUrl = useMemo(() => {
    return getExcalidrawLibraryUrl({
      theme: isDarkTheme ? 'dark' : 'light',
      token: 'M7h14NC7js4VCZ5yQsVUR',
    });
  }, [isDarkTheme]);

  const showLibraryToast = (msg: string) => {
    setLibraryToast(msg);
    setTimeout(() => setLibraryToast(null), 3500);
  };

  const handleCopyOfficialLibraryUrl = async () => {
    try {
      await navigator.clipboard.writeText(officialLibraryUrl);
      setCopiedLibUrl(true);
      setTimeout(() => setCopiedLibUrl(false), 2500);
      showLibraryToast(isZh ? '素材库完整链接已复制到剪贴板！' : 'Library URL copied!');
    } catch {
      // fallback
    }
  };

  // 收藏选中图元为自定义物料
  const handleSaveSelectedAsStencil = () => {
    const selected = excalidrawApiRef.current?.getSelectedElements?.() || [];
    if (!selected || selected.length === 0) {
      showLibraryToast(isZh ? '请先在画布中框选要收藏为物料的图元' : 'Please select elements on canvas first');
      return;
    }
    setShowSaveCustomInput(true);
  };

  const handleConfirmSaveCustomStencil = () => {
    const selected = excalidrawApiRef.current?.getSelectedElements?.() || [];
    if (!selected || selected.length === 0) return;
    const name = customStencilName.trim() || (isZh ? '自定义微服务组件' : 'Custom Component');
    const minX = Math.min(...selected.map((el: any) => el.x || 0));
    const minY = Math.min(...selected.map((el: any) => el.y || 0));
    const normalized = selected.map((el: any) => ({
      ...el,
      x: (el.x || 0) - minX,
      y: (el.y || 0) - minY,
    }));
    const newStencil: ExcalidrawStencil = {
      id: `custom-${Date.now()}`,
      name,
      nameEn: name,
      category: 'custom',
      color: '#3b82f6',
      description: isZh ? '工作区本地自定义物料' : 'Workspace custom stencil',
      elements: normalized,
    };
    const updated = [...customStencils, newStencil];
    setCustomStencils(updated);
    try {
      localStorage.setItem('omniview_excalidraw_stencils', JSON.stringify(updated));
    } catch {}
    setCustomStencilName('');
    setShowSaveCustomInput(false);
    showLibraryToast(isZh ? `已将「${name}」收藏至本地物料库！` : `Saved ${name}!`);
  };

  // 将物料直接加入白板素材库
  const handleAddStencilToExcalidrawLibrary = async (stencil: ExcalidrawStencil) => {
    if (!excalidrawApiRef.current) {
      showLibraryToast(isZh ? '请先切换到交互白板模式' : 'Switch to Canvas mode first');
      return;
    }
    try {
      const items = stencilsToLibraryItems([stencil]);
      await excalidrawApiRef.current.updateLibrary({
        libraryItems: items,
        merge: true,
        openLibraryMenu: true,
        defaultStatus: 'published',
      });
      showLibraryToast(isZh ? `已将「${stencil.name}」加入白板素材库！` : `Added ${stencil.name} to library!`);
    } catch (err: any) {
      showLibraryToast(err?.message || (isZh ? '加入失败' : 'Failed to add'));
    }
  };

  // 一键将全套预置素材包同步至白板
  const handleInstallAllPresetToCanvas = async () => {
    if (!excalidrawApiRef.current) {
      showLibraryToast(isZh ? '请先切换到交互白板模式' : 'Switch to Canvas mode first');
      return;
    }
    try {
      const presetItems = getAllPresetLibraryItems();
      await excalidrawApiRef.current.updateLibrary({
        libraryItems: presetItems,
        merge: true,
        openLibraryMenu: true,
        defaultStatus: 'published',
      });
      showLibraryToast(
        isZh
          ? `已将 ${presetItems.length} 个预置全套物料包同步至白板素材库！`
          : `Synced ${presetItems.length} stencils to library!`
      );
    } catch (err: any) {
      showLibraryToast(err?.message || (isZh ? '同步失败' : 'Sync failed'));
    }
  };

  // 本地文件导入 (.excalidrawlib / .json)
  const handleImportLibFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const res = parseExcalidrawLibJson(text);
      if (!res.isValid || res.libraryItems.length === 0) {
        showLibraryToast(res.errorMessage || (isZh ? '未能识别有效素材库格式' : 'Failed to parse library file'));
        return;
      }
      if (excalidrawApiRef.current) {
        await excalidrawApiRef.current.updateLibrary({
          libraryItems: res.libraryItems,
          merge: true,
          openLibraryMenu: true,
          defaultStatus: 'published',
        });
      }
      const newStencils: ExcalidrawStencil[] = res.libraryItems.map((item, idx) => ({
        id: `imported-${Date.now()}-${idx}`,
        name: item.name || file.name.replace(/\.[^/.]+$/, '') + ` #${idx + 1}`,
        nameEn: item.name || `Imported #${idx + 1}`,
        category: 'custom',
        color: '#06b6d4',
        description: isZh ? `从文件 ${file.name} 导入` : `Imported from ${file.name}`,
        elements: item.elements || [],
      }));
      const updated = [...customStencils, ...newStencils];
      setCustomStencils(updated);
      try {
        localStorage.setItem('omniview_excalidraw_stencils', JSON.stringify(updated));
      } catch {}
      showLibraryToast(isZh ? `成功导入 ${res.libraryItems.length} 个素材！` : `Imported ${res.libraryItems.length} items!`);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: any) {
      showLibraryToast(err?.message || (isZh ? '导入发生异常' : 'Import error'));
    }
  };

  // 网络 URL 导入
  const handleImportFromUrl = async () => {
    if (!importUrl.trim()) return;
    setIsImportingUrl(true);
    setImportUrlError(null);
    try {
      const resp = await fetch(importUrl.trim());
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const text = await resp.text();
      const res = parseExcalidrawLibJson(text);
      if (!res.isValid || res.libraryItems.length === 0) {
        setImportUrlError(res.errorMessage || (isZh ? '未能识别有效素材数据' : 'Invalid library content'));
        return;
      }
      if (excalidrawApiRef.current) {
        await excalidrawApiRef.current.updateLibrary({
          libraryItems: res.libraryItems,
          merge: true,
          openLibraryMenu: true,
          defaultStatus: 'published',
        });
      }
      const newStencils: ExcalidrawStencil[] = res.libraryItems.map((item, idx) => ({
        id: `url-imported-${Date.now()}-${idx}`,
        name: item.name || `网络素材 #${idx + 1}`,
        nameEn: item.name || `Network Stencil #${idx + 1}`,
        category: 'custom',
        color: '#8b5cf6',
        description: isZh ? `从网络地址导入` : `Imported from URL`,
        elements: item.elements || [],
      }));
      const updated = [...customStencils, ...newStencils];
      setCustomStencils(updated);
      try {
        localStorage.setItem('omniview_excalidraw_stencils', JSON.stringify(updated));
      } catch {}
      showLibraryToast(isZh ? `网络素材导入成功 (${res.libraryItems.length} 项)` : `Imported ${res.libraryItems.length} items`);
      setImportUrl('');
    } catch (err: any) {
      setImportUrlError(err?.message || (isZh ? '网络拉取失败，请检查跨域或 URL 有效性' : 'Fetch failed'));
    } finally {
      setIsImportingUrl(false);
    }
  };

  // 粘贴 JSON 源码导入
  const handleImportFromJsonText = async () => {
    if (!importJsonText.trim()) return;
    setImportJsonError(null);
    try {
      const res = parseExcalidrawLibJson(importJsonText.trim());
      if (!res.isValid || res.libraryItems.length === 0) {
        setImportJsonError(res.errorMessage || (isZh ? '无效的 Excalidraw 格式' : 'Invalid JSON format'));
        return;
      }
      if (excalidrawApiRef.current) {
        await excalidrawApiRef.current.updateLibrary({
          libraryItems: res.libraryItems,
          merge: true,
          openLibraryMenu: true,
          defaultStatus: 'published',
        });
      }
      const newStencils: ExcalidrawStencil[] = res.libraryItems.map((item, idx) => ({
        id: `json-imported-${Date.now()}-${idx}`,
        name: item.name || `JSON 素材 #${idx + 1}`,
        nameEn: item.name || `JSON Stencil #${idx + 1}`,
        category: 'custom',
        color: '#10b981',
        description: isZh ? '从 JSON 源码导入' : 'Imported from JSON',
        elements: item.elements || [],
      }));
      const updated = [...customStencils, ...newStencils];
      setCustomStencils(updated);
      try {
        localStorage.setItem('omniview_excalidraw_stencils', JSON.stringify(updated));
      } catch {}
      showLibraryToast(isZh ? `成功解析并导入 ${res.libraryItems.length} 个素材！` : `Imported ${res.libraryItems.length} items!`);
      setImportJsonText('');
    } catch (err: any) {
      setImportJsonError(err?.message || 'JSON 语法错误');
    }
  };

  // 导出全量素材库为 .excalidrawlib
  const handleExportAllStencils = () => {
    const all = [...EXCALIDRAW_STENCILS, ...customStencils];
    const blob = exportStencilsAsExcalidrawLibBlob(all);
    downloadBlob(blob, `omniview-materials-${Date.now()}.excalidrawlib`);
    showLibraryToast(isZh ? '素材库导出成功 (.excalidrawlib)' : 'Exported .excalidrawlib');
  };

  // 当处于预览或导出时，生成高保真 SVG 备份
  useEffect(() => {
    let isCancelled = false;

    if (!parsedData.isValid) {
      setRenderError(parsedData.errorMessage || '无效的 Excalidraw JSON 数据');
      setIsLoadingSvg(false);
      return;
    }

    setRenderError(null);
    setIsLoadingSvg(true);

    const timer = setTimeout(async () => {
      try {
        const { svgString } = await renderExcalidrawToSvgString(parsedData, {
          isDarkTheme,
          padding: 40,
        });

        if (!isCancelled) {
          setRenderedSvg(svgString);
          setIsLoadingSvg(false);
        }
      } catch (err: any) {
        if (!isCancelled) {
          setRenderError(err?.message || 'Excalidraw 矢量解析失败');
          setIsLoadingSvg(false);
        }
      }
    }, 150);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [parsedData, isDarkTheme]);

  // 监听点击外部关闭导出菜单
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowExportMenu(false);
      }
    };
    if (showExportMenu) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [showExportMenu]);

  // 切换模式时自动触发画布刷新以校准宽高尺寸
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        excalidrawApiRef.current?.refresh();
      } catch {
        // ignore
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [viewMode]);

  // 画布双向变动回写
  const handleCanvasDocChange = useCallback(
    (newJson: string) => {
      setSourceText(newJson);
      onContentChange?.(newJson);
    },
    [onContentChange]
  );

  // 源码直接输入变更
  const handleSourceChange = (newVal: string) => {
    setSourceText(newVal);
    onContentChange?.(newVal);
  };

  // 格式化 JSON
  const handlePrettifyJson = () => {
    try {
      const obj = JSON.parse(sourceText);
      const pretty = JSON.stringify(obj, null, 2);
      handleSourceChange(pretty);
    } catch {
      // ignore
    }
  };

  // 应用预置模板
  const handleApplyTemplate = (template: ExcalidrawTemplate) => {
    const jsonStr = JSON.stringify(template.data, null, 2);
    setSourceText(jsonStr);
    onContentChange?.(jsonStr);
    setShowTemplatesModal(false);
  };

  // 居中视口（适应内容）
  const handleCenterView = () => {
    if (viewMode === 'preview') {
      setScale(1);
      setPosition({ x: 0, y: 0 });
      return;
    }

    try {
      if (excalidrawApiRef.current) {
        excalidrawApiRef.current.scrollToContent();
      }
    } catch {
      // 降级
    }
  };

  // 只读预览画布平移交互
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0 || e.button === 1) {
      setIsPanning(true);
      startPanRef.current = {
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      };
    }
  };

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isPanning) return;
      setPosition({
        x: e.clientX - startPanRef.current.x,
        y: e.clientY - startPanRef.current.y,
      });
    },
    [isPanning]
  );

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
      setScale(prev => Math.min(4, Math.max(0.2, Number((prev * zoomFactor).toFixed(2)))));
    } else {
      setPosition(prev => ({
        x: prev.x - e.deltaX,
        y: prev.y - e.deltaY,
      }));
    }
  };

  // 复制反馈辅助
  const triggerCopyFeedback = async (label: string, action: () => Promise<void> | void) => {
    try {
      await action();
      setCopiedAction(label);
      setTimeout(() => setCopiedAction(null), 1800);
      setShowExportMenu(false);
    } catch (e) {
      console.error(e);
    }
  };

  // 导出操作
  const handleExportSelfContainedSvgFile = () => {
    if (!renderedSvg) return;
    const embedded = embedExcalidrawPayloadInSvg(renderedSvg, parsedData);
    const blob = new Blob([embedded], { type: 'image/svg+xml;charset=utf-8' });
    const name = fileName.replace(/\.(excalidraw|json|svg)$/i, '') + '.excalidraw.svg';
    downloadBlob(blob, name);
    setShowExportMenu(false);
  };

  const handleExportSvgFile = () => {
    if (!renderedSvg) return;
    const blob = new Blob([renderedSvg], { type: 'image/svg+xml;charset=utf-8' });
    const name = fileName.replace(/\.(excalidraw|json)$/i, '') + '.svg';
    downloadBlob(blob, name);
    setShowExportMenu(false);
  };

  const handleExportPngFile = () => {
    if (!renderedSvg) return;
    const img = new Image();
    const svgBlob = new Blob([renderedSvg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = (img.naturalWidth || 1200) * 2;
      canvas.height = (img.naturalHeight || 800) * 2;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(2, 2);
        ctx.drawImage(img, 0, 0);
        canvas.toBlob(blob => {
          if (blob) {
            const name = fileName.replace(/\.(excalidraw|json)$/i, '') + '.png';
            downloadBlob(blob, name);
          }
        }, 'image/png');
      }
      URL.revokeObjectURL(url);
    };
    img.src = url;
    setShowExportMenu(false);
  };

  const handleExportExcalidrawFile = () => {
    const blob = new Blob([sourceText], { type: 'application/json;charset=utf-8' });
    downloadBlob(blob, fileName.endsWith('.excalidraw') ? fileName : `${fileName}.excalidraw`);
    setShowExportMenu(false);
  };

  const handleCopySvgXml = async () => {
    if (!renderedSvg) return;
    await navigator.clipboard.writeText(renderedSvg);
  };

  const handleCopyJson = async () => {
    await navigator.clipboard.writeText(sourceText);
  };

  const isZh = locale === 'zh-CN';

  // 视口容器与工具栏宽度响应式监听 (解决 VS Code 分屏/侧边栏等小尺寸场景下的自适应折叠)
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [toolbarWidth, setToolbarWidth] = useState<number>(1000);
  const [showOverflowMenu, setShowOverflowMenu] = useState(false);
  const overflowMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!toolbarRef.current) return;
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        setToolbarWidth(entry.contentRect.width);
      }
    });
    ro.observe(toolbarRef.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (overflowMenuRef.current && !overflowMenuRef.current.contains(e.target as Node)) {
        setShowOverflowMenu(false);
      }
    };
    if (showOverflowMenu) {
      document.addEventListener('mousedown', handleOutside);
    }
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [showOverflowMenu]);

  // 尺寸断点
  const showModeLabels = toolbarWidth >= 860;
  const showBadge = toolbarWidth >= 700;
  const showStats = toolbarWidth >= 960;
  const showExtraCanvasTools = toolbarWidth >= 680;
  const showSlideFull = toolbarWidth >= 880;
  const showSlideBtn = toolbarWidth >= 620;
  const showMermaidBtn = toolbarWidth >= 740;
  const showMaterialsBtn = toolbarWidth >= 800;
  const showTemplatesBtn = toolbarWidth >= 620;
  const showExportLabel = toolbarWidth >= 520;
  const showOverflowBtn = toolbarWidth < 800;

  return (
    <div
      id="excalidraw-viewer-container"
      style={{
        backgroundColor: 'var(--ov-bg)',
        color: 'var(--ov-text)',
      }}
      className="h-full w-full flex flex-col select-none overflow-hidden"
    >
      {/* 顶部工具栏 */}
      <div
        ref={toolbarRef}
        style={{
          backgroundColor: 'var(--ov-surface-header)',
          borderBottomColor: 'var(--ov-border)',
          color: 'var(--ov-text)',
        }}
        className="flex-shrink-0 h-11 px-2.5 sm:px-3 border-b flex items-center justify-between gap-1.5 sm:gap-2 z-20 min-w-0"
      >
        {/* 左侧：文件名、白板标签与模式切换 */}
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
          <div className="flex items-center gap-1.5 font-medium text-xs shrink-0" style={{ color: 'var(--ov-text)' }}>
            <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
            <span className={`truncate ${toolbarWidth < 500 ? 'max-w-[70px]' : 'max-w-[130px] sm:max-w-xs'}`}>{fileName}</span>
            {showBadge && (
              <span
                style={{
                  backgroundColor: 'var(--ov-surface)',
                  borderColor: 'var(--ov-border)',
                  color: 'var(--ov-accent)',
                }}
                className="text-[10px] font-mono px-1.5 py-0.5 rounded border inline-block"
              >
                Excalidraw 2.0
              </span>
            )}
          </div>

          <div style={{ backgroundColor: 'var(--ov-border)' }} className="h-4 w-px mx-0.5 sm:mx-1 hidden xs:block" />

          {/* 模式切换 (白板工作室 / 双向分屏 / 只读演示 / JSON 源码) */}
          <div
            style={{
              backgroundColor: 'var(--ov-surface)',
              borderColor: 'var(--ov-border)',
            }}
            className="flex items-center p-0.5 rounded-lg border shrink-0"
          >
            <button
              onClick={() => setViewMode('canvas')}
              style={{
                backgroundColor: viewMode === 'canvas' ? 'var(--ov-accent, #d97706)' : 'transparent',
                color: viewMode === 'canvas' ? '#ffffff' : 'var(--ov-text-secondary)',
              }}
              className={`flex items-center gap-1 ${showModeLabels ? 'px-2.5' : 'p-1.5'} py-1 rounded-md text-xs transition hover:text-[var(--ov-text)]`}
              title={isZh ? '全屏交互白板工作室' : 'Full Whiteboard Canvas'}
            >
              <PenTool className="w-3.5 h-3.5" />
              {showModeLabels && <span>{isZh ? '交互白板' : 'Canvas'}</span>}
            </button>
            <button
              onClick={() => setViewMode('split')}
              style={{
                backgroundColor: viewMode === 'split' ? 'var(--ov-accent, #d97706)' : 'transparent',
                color: viewMode === 'split' ? '#ffffff' : 'var(--ov-text-secondary)',
              }}
              className={`flex items-center gap-1 ${showModeLabels ? 'px-2.5' : 'p-1.5'} py-1 rounded-md text-xs transition hover:text-[var(--ov-text)]`}
              title={isZh ? '双向分屏模式 (左侧 JSON 源码 / 右侧即时白板)' : 'Bidirectional Split View'}
            >
              <Columns className="w-3.5 h-3.5" />
              {showModeLabels && <span>{isZh ? '双向分屏' : 'Split'}</span>}
            </button>
            <button
              onClick={() => setViewMode('preview')}
              style={{
                backgroundColor: viewMode === 'preview' ? 'var(--ov-accent, #d97706)' : 'transparent',
                color: viewMode === 'preview' ? '#ffffff' : 'var(--ov-text-secondary)',
              }}
              className={`flex items-center gap-1 ${showModeLabels ? 'px-2.5' : 'p-1.5'} py-1 rounded-md text-xs transition hover:text-[var(--ov-text)]`}
              title={isZh ? '只读矢量展示与平移缩放' : 'Read-only Presentation'}
            >
              <Eye className="w-3.5 h-3.5" />
              {showModeLabels && <span>{isZh ? '只读演示' : 'Preview'}</span>}
            </button>
            <button
              onClick={() => setViewMode('code')}
              style={{
                backgroundColor: viewMode === 'code' ? 'var(--ov-accent, #d97706)' : 'transparent',
                color: viewMode === 'code' ? '#ffffff' : 'var(--ov-text-secondary)',
              }}
              className={`flex items-center gap-1 ${showModeLabels ? 'px-2.5' : 'p-1.5'} py-1 rounded-md text-xs transition hover:text-[var(--ov-text)]`}
              title={isZh ? 'JSON 源码编辑模式' : 'JSON Source Code'}
            >
              <FileCode className="w-3.5 h-3.5" />
              {showModeLabels && <span>{isZh ? '源码' : 'Source'}</span>}
            </button>
          </div>

          {/* 图元统计 */}
          {showStats && (
            <div className="flex items-center gap-2 text-[11px] font-mono ml-1.5 shrink-0" style={{ color: 'var(--ov-text-secondary)' }}>
              <span>{isZh ? '图元:' : 'Elements:'} <strong className="text-amber-400 font-normal">{parsedData?.elements?.length ?? 0}</strong></span>
              {parsedData?.files && Object.keys(parsedData.files).length > 0 && (
                <span>· {isZh ? '资源:' : 'Files:'} <strong className="text-cyan-400 font-normal">{Object.keys(parsedData.files).length}</strong></span>
              )}
            </div>
          )}
        </div>

        {/* 右侧：画布快捷工具与导出菜单 */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          {/* 白板通用功能：居中、网格、禅模式、锁定 */}
          {viewMode !== 'code' && (
            <div className="flex items-center gap-1">
              <button
                onClick={handleCenterView}
                style={{
                  backgroundColor: 'var(--ov-surface)',
                  borderColor: 'var(--ov-border)',
                  color: 'var(--ov-text-secondary)',
                }}
                className="p-1.5 rounded border transition hover:text-[var(--ov-text)] hover:border-[var(--ov-accent)]"
                title={isZh ? '视口自适应居中全部图元' : 'Fit to Content'}
                aria-label="居中视口"
              >
                <Focus className="w-3.5 h-3.5" />
              </button>

              {showExtraCanvasTools && (
                <>
                  <button
                    onClick={() => setShowGrid(!showGrid)}
                    style={{
                      backgroundColor: showGrid ? 'rgba(217, 119, 6, 0.2)' : 'var(--ov-surface)',
                      borderColor: showGrid ? 'var(--ov-accent, #d97706)' : 'var(--ov-border)',
                      color: showGrid ? 'var(--ov-accent, #fbbf24)' : 'var(--ov-text-secondary)',
                    }}
                    className="p-1.5 rounded border transition hover:text-[var(--ov-text)]"
                    title={isZh ? '开启/关闭绘图网格' : 'Toggle Grid'}
                    aria-label="网格模式"
                  >
                    <Grid className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => setIsZenMode(!isZenMode)}
                    style={{
                      backgroundColor: isZenMode ? 'rgba(217, 119, 6, 0.2)' : 'var(--ov-surface)',
                      borderColor: isZenMode ? 'var(--ov-accent, #d97706)' : 'var(--ov-border)',
                      color: isZenMode ? 'var(--ov-accent, #fbbf24)' : 'var(--ov-text-secondary)',
                    }}
                    className="p-1.5 rounded border transition hover:text-[var(--ov-text)]"
                    title={isZh ? '专注/禅模式 (隐藏冗余界面)' : 'Zen Mode'}
                    aria-label="禅模式"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => setIsViewOnly(!isViewOnly)}
                    style={{
                      backgroundColor: isViewOnly ? 'rgba(59, 130, 246, 0.2)' : 'var(--ov-surface)',
                      borderColor: isViewOnly ? '#3b82f6' : 'var(--ov-border)',
                      color: isViewOnly ? '#60a5fa' : 'var(--ov-text-secondary)',
                    }}
                    className="p-1.5 rounded border transition hover:text-[var(--ov-text)]"
                    title={isZh ? (isViewOnly ? '已只读锁定 (点击解锁编辑)' : '点击锁定为只读') : (isViewOnly ? 'Locked (Click to edit)' : 'Click to lock')}
                    aria-label="只读锁定"
                  >
                    {isViewOnly ? <Lock className="w-3.5 h-3.5 text-blue-400" /> : <Unlock className="w-3.5 h-3.5" />}
                  </button>
                </>
              )}
            </div>
          )}

          {/* 处于预览模式下的专属缩放控制器 */}
          {viewMode === 'preview' && (
            <div className="flex items-center gap-1 border-l pl-1 sm:pl-1.5" style={{ borderColor: 'var(--ov-border)' }}>
              <button
                onClick={() => setScale(s => Math.max(0.2, Number((s - 0.1).toFixed(2))))}
                style={{
                  backgroundColor: 'var(--ov-surface)',
                  borderColor: 'var(--ov-border)',
                  color: 'var(--ov-text-secondary)',
                }}
                className="p-1.5 rounded border transition hover:text-[var(--ov-text)] hover:border-[var(--ov-accent)]"
                title={isZh ? '缩小' : 'Zoom Out'}
                aria-label="缩小"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              {toolbarWidth >= 500 && (
                <span
                  onClick={() => { setScale(1); setPosition({ x: 0, y: 0 }); }}
                  className="font-mono text-amber-400 min-w-[36px] text-center font-semibold cursor-pointer hover:underline text-[11px]"
                  title="点击重置 100%"
                >
                  {Math.round(scale * 100)}%
                </span>
              )}
              <button
                onClick={() => setScale(s => Math.min(4, Number((s + 0.1).toFixed(2))))}
                style={{
                  backgroundColor: 'var(--ov-surface)',
                  borderColor: 'var(--ov-border)',
                  color: 'var(--ov-text-secondary)',
                }}
                className="p-1.5 rounded border transition hover:text-[var(--ov-text)] hover:border-[var(--ov-accent)]"
                title={isZh ? '放大' : 'Zoom In'}
                aria-label="放大"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => { setScale(1); setPosition({ x: 0, y: 0 }); }}
                style={{
                  backgroundColor: 'var(--ov-surface)',
                  borderColor: 'var(--ov-border)',
                  color: 'var(--ov-text-secondary)',
                }}
                className="p-1.5 rounded border transition hover:text-[var(--ov-text)] hover:border-[var(--ov-accent)]"
                title={isZh ? '重置视角' : 'Reset View'}
                aria-label="重置视角"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* 处于源码模式下的格式化按钮 */}
          {viewMode === 'code' && (
            <button
              onClick={handlePrettifyJson}
              style={{
                backgroundColor: 'var(--ov-surface)',
                borderColor: 'var(--ov-border)',
                color: 'var(--ov-text)',
              }}
              className="flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded border text-xs transition hover:border-[var(--ov-accent)]"
              title="格式化 JSON 源码"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              {toolbarWidth >= 600 && <span>{isZh ? '美化 JSON' : 'Prettify'}</span>}
            </button>
          )}

          {/* 幻灯片演播导览模式 (Prezi 式 Frame 运镜) */}
          {showSlideBtn && (
            <button
              onClick={() => {
                const next = !isSlideMode;
                setIsSlideMode(next);
                if (next && frames.length > 0) {
                  navigateToFrame(0);
                }
              }}
              style={{
                backgroundColor: isSlideMode ? 'rgba(147, 51, 234, 0.2)' : 'var(--ov-surface)',
                borderColor: isSlideMode ? 'rgba(147, 51, 234, 0.5)' : 'var(--ov-border)',
                color: isSlideMode ? '#c084fc' : 'var(--ov-text)',
              }}
              className={`flex items-center gap-1.5 ${showSlideFull ? 'px-2.5' : 'p-1.5'} py-1 rounded border text-xs transition hover:border-purple-500`}
              title={isZh ? '启动 Prezi 式 Frame 画框运镜导览演播' : 'Slide Presentation Mode'}
              aria-label="幻灯片演播"
            >
              <Play className="w-3.5 h-3.5 text-purple-400" />
              {showSlideFull && <span>{isZh ? '演播' : 'Slides'}</span>}
              {frames.length > 0 && (
                <span className="px-1 py-0.2 text-[10px] rounded bg-purple-500/20 text-purple-300 font-mono">
                  {frames.length}
                </span>
              )}
            </button>
          )}

          {/* Mermaid 转译导入按钮 */}
          {showMermaidBtn && (
            <button
              onClick={() => setShowMermaidModal(true)}
              style={{
                backgroundColor: 'var(--ov-surface)',
                borderColor: 'var(--ov-border)',
                color: 'var(--ov-text)',
              }}
              className={`flex items-center gap-1.5 ${toolbarWidth >= 860 ? 'px-2.5' : 'p-1.5'} py-1 rounded border text-xs transition hover:border-emerald-500 hover:text-emerald-400`}
              title={isZh ? 'Mermaid 代码一键转手绘白板图' : 'Import Mermaid'}
              aria-label="导入 Mermaid"
            >
              <GitFork className="w-3.5 h-3.5 text-emerald-400" />
              {toolbarWidth >= 860 && <span>Mermaid</span>}
            </button>
          )}

          {/* 素材与物料中心按钮 */}
          {showMaterialsBtn && (
            <button
              onClick={() => setShowStencilsDrawer(true)}
              style={{
                backgroundColor: 'var(--ov-surface)',
                borderColor: 'var(--ov-border)',
                color: 'var(--ov-text)',
              }}
              className={`flex items-center gap-1.5 ${toolbarWidth >= 900 ? 'px-2.5' : 'p-1.5'} py-1 rounded border text-xs transition group hover:border-cyan-500`}
              title={isZh ? '素材与物料中心 (包含 Excalidraw 官方社区素材库、预置物料包与离线导入)' : 'Materials & Stencils Hub'}
              aria-label="素材中心"
            >
              <Layers className="w-3.5 h-3.5 text-cyan-400 group-hover:text-cyan-300 transition" />
              {toolbarWidth >= 900 && <span>{isZh ? '素材中心' : 'Materials'}</span>}
              <span
                style={{
                  backgroundColor: 'var(--ov-surface-header)',
                  borderColor: 'var(--ov-border)',
                  color: 'var(--ov-accent)',
                }}
                className="text-[10px] px-1 py-0.2 rounded font-mono border"
              >
                {EXCALIDRAW_STENCILS.length + customStencils.length}
              </span>
            </button>
          )}

          {/* 预置模板库按钮 */}
          {showTemplatesBtn && (
            <button
              onClick={() => setShowTemplatesModal(true)}
              style={{
                backgroundColor: 'var(--ov-surface)',
                borderColor: 'var(--ov-border)',
                color: 'var(--ov-text)',
              }}
              className={`flex items-center gap-1.5 ${toolbarWidth >= 860 ? 'px-2.5' : 'p-1.5'} py-1 rounded border text-xs transition hover:border-amber-500 hover:text-amber-400`}
              title={isZh ? '选择架构图/流程图/思维导图预置模板' : 'Whiteboard Starter Templates'}
              aria-label="预置模板"
            >
              <LayoutTemplate className="w-3.5 h-3.5 text-amber-400" />
              {toolbarWidth >= 860 && <span>{isZh ? '预置模板' : 'Templates'}</span>}
            </button>
          )}

          {/* 统一导出与复制菜单 */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className={`flex items-center gap-1.5 ${showExportLabel ? 'px-2.5 sm:px-3' : 'p-1.5'} py-1 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white rounded-md transition shadow-sm font-medium text-xs cursor-pointer`}
              title="导出手绘白板图与文件"
              aria-label="导出"
            >
              {copiedAction ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Share2 className="w-3.5 h-3.5" />}
              {showExportLabel && (
                <span>
                  {copiedAction ? `${isZh ? '已复制' : 'Copied'}: ${copiedAction}` : (isZh ? '导出 / 分享' : 'Export')}
                </span>
              )}
              <ChevronDown className="w-3 h-3 opacity-70" />
            </button>

            {showExportMenu && (
              <div
                style={{
                  backgroundColor: 'var(--ov-surface-header)',
                  borderColor: 'var(--ov-border)',
                  color: 'var(--ov-text)',
                }}
                className="absolute right-0 mt-1.5 w-60 border rounded-lg shadow-2xl py-1.5 z-50 text-xs animate-in fade-in zoom-in-95 backdrop-blur"
              >
                <div className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wider border-b" style={{ color: 'var(--ov-text-secondary)', borderColor: 'var(--ov-border)' }}>
                  {isZh ? '图形与文件导出' : 'File Export'}
                </div>
                <button
                  onClick={handleExportSelfContainedSvgFile}
                  style={{ color: 'var(--ov-text)' }}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[var(--ov-surface-hover,rgba(150,150,150,0.1))] transition text-left group"
                >
                  <Download className="w-4 h-4 text-emerald-400" />
                  <div className="flex-1">
                    <div className="font-medium flex items-center gap-1.5">
                      <span>{isZh ? '导出为 .excalidraw.svg' : 'Export .excalidraw.svg'}</span>
                      <span className="text-[9px] px-1 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        {isZh ? '自包含' : 'Polyglot'}
                      </span>
                    </div>
                    <div className="text-[10px] leading-tight" style={{ color: 'var(--ov-text-secondary)' }}>
                      {isZh ? '矢量图内嵌工程数据，支持拖入再编辑' : 'Self-contained editable SVG'}
                    </div>
                  </div>
                </button>
                <button
                  onClick={handleExportSvgFile}
                  style={{ color: 'var(--ov-text)' }}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[var(--ov-surface-hover,rgba(150,150,150,0.1))] transition text-left"
                >
                  <Download className="w-4 h-4 text-amber-400" />
                  <div className="flex-1">
                    <div className="font-medium">{isZh ? '导出为 .SVG 矢量图' : 'Export as .SVG'}</div>
                    <div className="text-[10px]" style={{ color: 'var(--ov-text-secondary)' }}>{isZh ? '标准 SVG 矢量图形文件' : 'Standard vector format'}</div>
                  </div>
                </button>
                <button
                  onClick={handleExportPngFile}
                  style={{ color: 'var(--ov-text)' }}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[var(--ov-surface-hover,rgba(150,150,150,0.1))] transition text-left"
                >
                  <Download className="w-4 h-4 text-cyan-400" />
                  <div className="flex-1">
                    <div className="font-medium">{isZh ? '导出为 .PNG 高清位图' : 'Export as .PNG'}</div>
                    <div className="text-[10px]" style={{ color: 'var(--ov-text-secondary)' }}>{isZh ? '2x 视网膜清晰度' : 'Retina raster image'}</div>
                  </div>
                </button>
                <button
                  onClick={handleExportExcalidrawFile}
                  style={{ color: 'var(--ov-text)' }}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[var(--ov-surface-hover,rgba(150,150,150,0.1))] transition text-left"
                >
                  <Download className="w-4 h-4 text-orange-400" />
                  <div className="flex-1">
                    <div className="font-medium">{isZh ? '导出为 .excalidraw 原生文件' : 'Export .excalidraw file'}</div>
                    <div className="text-[10px]" style={{ color: 'var(--ov-text-secondary)' }}>{isZh ? '直接兼容官方 Web 客户端' : 'Compatible with excalidraw.com'}</div>
                  </div>
                </button>

                <div className="my-1 border-t" style={{ borderColor: 'var(--ov-border)' }} />
                <div className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--ov-text-secondary)' }}>
                  {isZh ? '快速复制至剪贴板' : 'Clipboard'}
                </div>
                <button
                  onClick={() => triggerCopyFeedback('SVG XML', handleCopySvgXml)}
                  style={{ color: 'var(--ov-text)' }}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[var(--ov-surface-hover,rgba(150,150,150,0.1))] transition text-left"
                >
                  <Copy className="w-4 h-4 text-amber-400" />
                  <div className="flex-1">
                    <div className="font-medium">{isZh ? '复制 SVG 代码' : 'Copy SVG XML'}</div>
                    <div className="text-[10px]" style={{ color: 'var(--ov-text-secondary)' }}>{isZh ? '用于插入网页或 Markdown' : 'Paste into HTML/Markdown'}</div>
                  </div>
                </button>
                <button
                  onClick={() => triggerCopyFeedback('JSON', handleCopyJson)}
                  style={{ color: 'var(--ov-text)' }}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[var(--ov-surface-hover,rgba(150,150,150,0.1))] transition text-left"
                >
                  <Copy className="w-4 h-4 text-blue-400" />
                  <div className="flex-1">
                    <div className="font-medium">{isZh ? '复制 Excalidraw JSON' : 'Copy Document JSON'}</div>
                    <div className="text-[10px]" style={{ color: 'var(--ov-text-secondary)' }}>{isZh ? '完整图元数据树' : 'Raw elements data'}</div>
                  </div>
                </button>
              </div>
            )}
          </div>

          {/* 小尺寸折叠溢出更多菜单 (...) */}
          {showOverflowBtn && (
            <div className="relative" ref={overflowMenuRef}>
              <button
                onClick={() => setShowOverflowMenu(!showOverflowMenu)}
                style={{
                  backgroundColor: showOverflowMenu ? 'var(--ov-surface-header)' : 'var(--ov-surface)',
                  borderColor: 'var(--ov-border)',
                  color: 'var(--ov-text)',
                }}
                className="p-1.5 rounded border transition hover:border-[var(--ov-accent)]"
                title={isZh ? '更多工具与扩展功能' : 'More Whiteboard Tools'}
                aria-label="更多工具"
              >
                <MoreHorizontal className="w-3.5 h-3.5" />
              </button>

              {showOverflowMenu && (
                <div
                  style={{
                    backgroundColor: 'var(--ov-surface-header)',
                    borderColor: 'var(--ov-border)',
                    color: 'var(--ov-text)',
                  }}
                  className="absolute right-0 mt-1.5 w-52 border rounded-lg shadow-2xl py-1 z-50 text-xs animate-in fade-in zoom-in-95 backdrop-blur"
                >
                  <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider border-b" style={{ color: 'var(--ov-text-secondary)', borderColor: 'var(--ov-border)' }}>
                    {isZh ? '快捷操作与扩展工具' : 'Extended Tools'}
                  </div>

                  {!showSlideBtn && (
                    <button
                      onClick={() => {
                        const next = !isSlideMode;
                        setIsSlideMode(next);
                        if (next && frames.length > 0) navigateToFrame(0);
                        setShowOverflowMenu(false);
                      }}
                      style={{ color: 'var(--ov-text)' }}
                      className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-[var(--ov-surface-hover,rgba(150,150,150,0.1))] transition text-left"
                    >
                      <Play className="w-3.5 h-3.5 text-purple-400" />
                      <span>{isZh ? '幻灯片演播导览' : 'Slide Presentation'}</span>
                    </button>
                  )}

                  {!showTemplatesBtn && (
                    <button
                      onClick={() => {
                        setShowTemplatesModal(true);
                        setShowOverflowMenu(false);
                      }}
                      style={{ color: 'var(--ov-text)' }}
                      className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-[var(--ov-surface-hover,rgba(150,150,150,0.1))] transition text-left"
                    >
                      <LayoutTemplate className="w-3.5 h-3.5 text-amber-400" />
                      <span>{isZh ? '预置模板库' : 'Starter Templates'}</span>
                    </button>
                  )}

                  {!showMermaidBtn && (
                    <button
                      onClick={() => {
                        setShowMermaidModal(true);
                        setShowOverflowMenu(false);
                      }}
                      style={{ color: 'var(--ov-text)' }}
                      className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-[var(--ov-surface-hover,rgba(150,150,150,0.1))] transition text-left"
                    >
                      <GitFork className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{isZh ? 'Mermaid 转手绘图' : 'Import Mermaid'}</span>
                    </button>
                  )}

                  {!showMaterialsBtn && (
                    <button
                      onClick={() => {
                        setShowStencilsDrawer(true);
                        setShowOverflowMenu(false);
                      }}
                      style={{ color: 'var(--ov-text)' }}
                      className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-[var(--ov-surface-hover,rgba(150,150,150,0.1))] transition text-left"
                    >
                      <Layers className="w-3.5 h-3.5 text-cyan-400" />
                      <span>{isZh ? '素材物料中心' : 'Materials & Stencils'}</span>
                    </button>
                  )}

                  {!showExtraCanvasTools && viewMode !== 'code' && (
                    <>
                      <div className="my-1 border-t" style={{ borderColor: 'var(--ov-border)' }} />
                      <button
                        onClick={() => {
                          setShowGrid(!showGrid);
                          setShowOverflowMenu(false);
                        }}
                        style={{ color: 'var(--ov-text)' }}
                        className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-[var(--ov-surface-hover,rgba(150,150,150,0.1))] transition text-left"
                      >
                        <Grid className="w-3.5 h-3.5 text-amber-400" />
                        <span>{showGrid ? (isZh ? '隐藏网格' : 'Hide Grid') : (isZh ? '开启网格' : 'Show Grid')}</span>
                      </button>
                      <button
                        onClick={() => {
                          setIsZenMode(!isZenMode);
                          setShowOverflowMenu(false);
                        }}
                        style={{ color: 'var(--ov-text)' }}
                        className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-[var(--ov-surface-hover,rgba(150,150,150,0.1))] transition text-left"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                        <span>{isZenMode ? (isZh ? '退出禅模式' : 'Exit Zen') : (isZh ? '进入禅模式' : 'Zen Mode')}</span>
                      </button>
                      <button
                        onClick={() => {
                          setIsViewOnly(!isViewOnly);
                          setShowOverflowMenu(false);
                        }}
                        style={{ color: 'var(--ov-text)' }}
                        className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-[var(--ov-surface-hover,rgba(150,150,150,0.1))] transition text-left"
                      >
                        {isViewOnly ? <Lock className="w-3.5 h-3.5 text-blue-400" /> : <Unlock className="w-3.5 h-3.5" />}
                        <span>{isViewOnly ? (isZh ? '解除只读锁定' : 'Unlock') : (isZh ? '只读锁定' : 'Lock')}</span>
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 主体交互区域 */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* 左侧：JSON 源码编辑器（分屏或源码全屏模式） */}
        {(viewMode === 'split' || viewMode === 'code') && (
          <div
            style={{
              backgroundColor: 'var(--ov-surface)',
              borderRightColor: 'var(--ov-border)',
            }}
            className={`flex flex-col border-r min-h-0 ${
              viewMode === 'split' ? 'w-full md:w-2/5 lg:w-1/3' : 'w-full'
            }`}
          >
            <div
              style={{
                backgroundColor: 'var(--ov-surface-header)',
                borderBottomColor: 'var(--ov-border)',
                color: 'var(--ov-text-secondary)',
              }}
              className="flex-shrink-0 px-3 py-1.5 border-b flex items-center justify-between text-[11px] font-mono"
            >
              <span className="flex items-center gap-1.5">
                <FileCode className="w-3.5 h-3.5 text-amber-400" />
                <span>Excalidraw JSON 数据源</span>
              </span>
              <span>{sourceText?.length ?? 0} 字符</span>
            </div>
            <div className="flex-1 min-h-0 p-2">
              <textarea
                value={sourceText}
                onChange={e => handleSourceChange(e.target.value)}
                placeholder="在此粘贴或编辑 Excalidraw JSON 结构..."
                spellCheck={false}
                style={{
                  backgroundColor: 'var(--ov-bg)',
                  borderColor: 'var(--ov-border)',
                  color: 'var(--ov-text)',
                }}
                className="w-full h-full font-mono text-xs p-3 rounded-lg border outline-none focus:border-amber-500/60 resize-none leading-relaxed transition shadow-inner"
              />
            </div>
            {!parsedData.isValid && (
              <div className="px-3 py-2 bg-red-950/80 border-t border-red-800 text-[11px] text-red-300 flex items-center gap-2">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 text-red-400" />
                <span className="truncate">{parsedData.errorMessage}</span>
              </div>
            )}
          </div>
        )}

        {/* 交互白板主画布（白板工作室模式与分屏模式） */}
        {(viewMode === 'canvas' || viewMode === 'split') && (
          <div className="flex-1 min-w-0 h-full relative overflow-hidden bg-slate-900">
            <RenderErrorBoundary
              blockName="Excalidraw Whiteboard Canvas"
              fallback={
                <div className="w-full h-full flex flex-col items-center justify-center p-6 text-slate-300 gap-3">
                  <div className="text-amber-400 font-semibold text-sm">手绘白板画布初始化容错回退</div>
                  <div className="text-xs text-slate-400 max-w-md text-center">
                    当前图元在白板引擎交互模式下遇到异常，您仍可使用顶部的“只读演示”、“分屏”或“源码”模式查看与编辑完整数据。
                  </div>
                  <button
                    onClick={() => setViewMode('preview')}
                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded text-xs transition"
                  >
                    切换到 SVG 矢量只读演示
                  </button>
                </div>
              }
            >
              <React.Suspense
                fallback={
                  <div className="flex-1 min-h-[400px] flex items-center justify-center text-slate-400 text-xs">
                    加载白板引擎...
                  </div>
                }
              >
                <ExcalidrawCanvas
                  key={fileName}
                  initialParsedData={parsedData}
                  isDarkTheme={isDarkTheme}
                  locale={locale}
                  showGrid={showGrid}
                  isZenMode={isZenMode}
                  isViewOnly={isViewOnly}
                  onDocChange={handleCanvasDocChange}
                  onApiReady={(api) => {
                    excalidrawApiRef.current = api;
                  }}
                  onLibraryLoaded={(count) => {
                    showLibraryToast(
                      isZh
                        ? `已将 ${count} 个外部素材成功载入白板！`
                        : `Loaded ${count} library items into canvas!`
                    );
                  }}
                />
              </React.Suspense>
            </RenderErrorBoundary>
          </div>
        )}

        {/* 只读演示画布（只读展示模式） */}
        {viewMode === 'preview' && (
          <div
            ref={containerRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheel}
            className={`flex-1 relative flex items-center justify-center overflow-hidden cursor-grab active:cursor-grabbing bg-[var(--ov-surface)] ${
              showGrid ? (isDarkTheme ? 'ov-svg-grid-dark' : 'ov-svg-grid-light') : ''
            }`}
            style={{ touchAction: 'none' }}
          >
            {isLoadingSvg && (
              <div className="absolute top-4 right-4 z-10 flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900/80 border border-slate-700 text-xs text-amber-300 shadow-lg backdrop-blur-sm animate-pulse">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
                <span>正在编译手绘图元...</span>
              </div>
            )}

            {renderError ? (
              <div className="max-w-md p-5 bg-red-950/80 border border-red-800/80 rounded-xl text-red-200 shadow-2xl backdrop-blur-sm flex flex-col gap-2.5">
                <div className="flex items-center gap-2 font-semibold text-sm text-red-300">
                  <AlertCircle className="w-4 h-4 text-red-400" />
                  <span>Excalidraw 格式解析异常</span>
                </div>
                <div className="font-mono text-xs text-red-300/80 break-words leading-relaxed">
                  {renderError}
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  提示：请切换至源码或分屏模式检查 JSON 语法。
                </div>
              </div>
            ) : (
              <div
                style={{
                  transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                  transformOrigin: 'center center',
                  transition: isPanning ? 'none' : 'transform 0.08s ease-out',
                }}
                className="select-none flex items-center justify-center shadow-xl rounded-lg p-2"
                dangerouslySetInnerHTML={{ __html: renderedSvg }}
              />
            )}

            <div className="absolute bottom-3 left-3 flex items-center gap-2 px-2.5 py-1 rounded-md bg-slate-900/80 border border-slate-800 text-[11px] text-slate-400 font-mono pointer-events-none backdrop-blur-sm">
              <span>滚轮 / 拖拽平移</span>
              <span>·</span>
              <span>Ctrl + 滚轮缩放</span>
              <span>·</span>
              <span>缩放: {Math.round(scale * 100)}%</span>
            </div>
          </div>
        )}
      </div>

      {/* 预置模板弹窗 */}
      {showTemplatesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
              <div className="flex items-center gap-2">
                <LayoutTemplate className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-semibold text-slate-100">
                  {isZh ? '选择 Excalidraw 预置模板' : 'Choose Starter Template'}
                </h3>
              </div>
              <button
                onClick={() => setShowTemplatesModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {EXCALIDRAW_TEMPLATES.map(template => (
                <div
                  key={template.id}
                  onClick={() => handleApplyTemplate(template)}
                  className="group relative p-4 rounded-lg bg-slate-950 border border-slate-800 hover:border-amber-500/60 hover:bg-slate-900/80 cursor-pointer transition flex flex-col justify-between gap-3 shadow-sm hover:shadow-md"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-semibold text-xs text-slate-100 group-hover:text-amber-300 transition">
                        {isZh ? template.name : template.nameEn}
                      </div>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                        {template?.data?.elements?.length ?? 0} 图元
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                      {isZh ? template.description : template.descriptionEn}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-900 text-[10px] text-amber-400 font-medium">
                    <span>{isZh ? '点击载入此模板' : 'Load Template'}</span>
                    <span className="opacity-0 group-hover:opacity-100 transition-transform transform group-hover:translate-x-0.5">
                      →
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="px-5 py-3 bg-slate-950 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
              <span>{isZh ? '⚠️ 载入模板将替换当前画面的内容' : '⚠️ Loading a template will overwrite current drawing'}</span>
              <button
                onClick={() => setShowTemplatesModal(false)}
                className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs transition"
              >
                {isZh ? '取消' : 'Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Prezi 式 Frame 运镜幻灯片演播 HUD */}
      {isSlideMode && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 px-4 py-2.5 bg-slate-900/95 border border-purple-500/40 rounded-2xl shadow-2xl backdrop-blur-md text-slate-200 animate-in fade-in slide-in-from-bottom-4">
          {frames.length > 0 ? (
            <>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-400 animate-pulse" />
                <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-mono text-xs font-semibold border border-purple-500/30">
                  {currentFrameIndex + 1} / {frames.length}
                </span>
                <span className="text-xs font-medium text-slate-100 max-w-[200px] truncate" title={frames[currentFrameIndex]?.name || '未命名画框'}>
                  {frames[currentFrameIndex]?.name || `Frame ${currentFrameIndex + 1}`}
                </span>
              </div>

              <div className="h-4 w-px bg-slate-800 mx-1" />

              <div className="flex items-center gap-1">
                <button
                  onClick={() => navigateToFrame(currentFrameIndex - 1)}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
                  title={isZh ? '上一画框 (Left / PageUp)' : 'Previous Frame'}
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => navigateToFrame(currentFrameIndex + 1)}
                  className="p-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white transition shadow-sm"
                  title={isZh ? '下一画框 (Right / Space / PageDown)' : 'Next Frame'}
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <div className="h-4 w-px bg-slate-800 mx-1" />

              <button
                onClick={() => excalidrawApiRef.current?.scrollToContent()}
                className="flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition"
                title={isZh ? '全景概览 (按键 0)' : 'Overview'}
              >
                <Focus className="w-3.5 h-3.5 text-cyan-400" />
                <span className="hidden sm:inline">{isZh ? '全景' : 'All'}</span>
              </button>

              <div className="hidden lg:flex items-center gap-1.5 text-[10px] text-slate-400 font-mono pl-1">
                <span>← / → 翻页</span>
                <span>·</span>
                <span>0 全景</span>
                <span>·</span>
                <span>Esc 退出</span>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-3">
              <span className="text-xs text-amber-300">
                {isZh ? '当前画布暂无 Frame 画框，支持快捷键 F 划定，或：' : 'No frames found on canvas. Use F key or:'}
              </span>
              <button
                onClick={handleAutoCreateFrames}
                className="px-2.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-medium text-xs transition shadow-sm flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{isZh ? '智能划定演示画框' : 'Auto Create Frames'}</span>
              </button>
            </div>
          )}

          <button
            onClick={() => setIsSlideMode(false)}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition ml-1"
            title={isZh ? '退出演播 (Esc)' : 'Exit Presentation'}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Mermaid 代码一键转译模态框 */}
      {showMermaidModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
              <div className="flex items-center gap-2">
                <GitFork className="w-5 h-5 text-emerald-400" />
                <h3 className="text-sm font-semibold text-slate-100">
                  {isZh ? 'Mermaid 代码转译为手绘白板' : 'Mermaid to Excalidraw'}
                </h3>
              </div>
              <button
                onClick={() => setShowMermaidModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 flex flex-col gap-3 flex-1 overflow-y-auto">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">
                  {isZh ? '支持 Flowchart / Graph 语法与方向拓扑自动分级排布：' : 'Paste Mermaid flowchart syntax:'}
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-slate-400">常用示例:</span>
                  <button
                    onClick={() =>
                      setMermaidCode(
                        'flowchart TD\n  App[用户端 App] --> GW[API 网关]\n  GW --> Order[订单服务]\n  GW --> Pay[支付服务]\n  Order --> DB[(MySQL 集群)]\n  Pay --> Cache[Redis 缓存]'
                      )
                    }
                    className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-emerald-300 text-[11px] transition"
                  >
                    微服务
                  </button>
                  <button
                    onClick={() =>
                      setMermaidCode(
                        'flowchart LR\n  Start[提交PR] --> CI{自动化检查}\n  CI -->|通过| Review[人工代码审查]\n  CI -->|失败| Fix[修复报错]\n  Review --> Merge[合入主干]'
                      )
                    }
                    className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-amber-300 text-[11px] transition"
                  >
                    审查流
                  </button>
                </div>
              </div>

              <textarea
                value={mermaidCode}
                onChange={e => setMermaidCode(e.target.value)}
                rows={8}
                className="w-full p-3 font-mono text-xs bg-slate-950 border border-slate-800 rounded-lg text-emerald-300 focus:outline-none focus:border-emerald-500 resize-none leading-relaxed"
                placeholder="flowchart TD\n  A --> B"
              />

              {mermaidError && (
                <div className="p-2.5 rounded bg-red-950/80 border border-red-800/80 text-xs text-red-200 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                  <span>{mermaidError}</span>
                </div>
              )}
            </div>

            <div className="px-5 py-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs">
              <span className="text-slate-400 text-[11px]">
                {isZh ? '转译将自动匹配手绘粗糙度、色彩与吸附连线' : 'Automatic hand-drawn styling and bindings'}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowMermaidModal(false)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded transition"
                >
                  {isZh ? '取消' : 'Cancel'}
                </button>
                <button
                  onClick={handleImportMermaid}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded transition shadow-sm flex items-center gap-1.5"
                >
                  <GitFork className="w-3.5 h-3.5" />
                  <span>{isZh ? '转译为手绘白板' : 'Convert to Canvas'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 素材与架构物料资产中心抽屉 */}
      {showStencilsDrawer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-3 sm:p-5 animate-in fade-in">
          <div className="w-full max-w-4xl bg-slate-900 border border-slate-700/80 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* 抽屉头部 */}
            <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-900/95">
              <div className="flex items-center gap-2.5">
                <Layers className="w-5 h-5 text-cyan-400" />
                <div>
                  <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                    <span>{isZh ? '素材与物料中心' : 'Materials & Stencils Hub'}</span>
                    <span className="text-[11px] font-normal px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800/60">
                      {EXCALIDRAW_STENCILS.length + customStencils.length} 项资源
                    </span>
                  </h3>
                </div>
              </div>

              {/* 标签栏切换 */}
              <div className="flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-xs">
                <button
                  onClick={() => setStencilsTab('stencils')}
                  className={`px-3 py-1 rounded-md transition ${
                    stencilsTab === 'stencils'
                      ? 'bg-cyan-600 text-white font-medium shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {isZh ? '🎨 物料画板' : '🎨 Stencils'}
                </button>
                <button
                  onClick={() => setStencilsTab('official')}
                  className={`px-3 py-1 rounded-md transition flex items-center gap-1 ${
                    stencilsTab === 'official'
                      ? 'bg-cyan-600 text-white font-medium shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span>{isZh ? '🌐 官方素材库' : '🌐 Official Lib'}</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                </button>
                <button
                  onClick={() => setStencilsTab('import')}
                  className={`px-3 py-1 rounded-md transition ${
                    stencilsTab === 'import'
                      ? 'bg-cyan-600 text-white font-medium shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {isZh ? '📥 导入 / 导出' : '📥 Import'}
                </button>
              </div>

              <button
                onClick={() => setShowStencilsDrawer(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 隐藏的本地文件输入 */}
            <input
              type="file"
              ref={fileInputRef}
              accept=".excalidrawlib,.json"
              onChange={handleImportLibFile}
              className="hidden"
            />

            {/* 抽屉内容区 */}
            <div className="p-5 flex-1 overflow-y-auto flex flex-col gap-4">
              {/* TAB 1: 官方素材库社区链接与指引 */}
              {stencilsTab === 'official' && (
                <div className="flex flex-col gap-4 animate-in fade-in">
                  {/* 官方素材库链接与快捷直达横幅 */}
                  <div className="p-4 rounded-xl bg-gradient-to-br from-cyan-950/60 via-slate-900 to-slate-950 border border-cyan-800/50 flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <Globe className="w-4 h-4 text-cyan-400" />
                          <h4 className="text-sm font-semibold text-slate-100">
                            {isZh ? 'Excalidraw 官方社区素材库 (libraries.excalidraw.com)' : 'Official Excalidraw Libraries'}
                          </h4>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800/60 font-mono">
                            LIVE
                          </span>
                        </div>
                        <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                          {isZh
                            ? '汇聚全球开发者分享的数万种高质量矢量素材包（AWS、GCP、Kubernetes、Cisco 网络、系统设计、移动端与 Web UI 原型、手绘便签等），均可一键载入 OmniView 白板。'
                            : 'Browse thousands of official and community-crafted assets (Cloud, K8s, System Architecture, UI Wireframing, and Sticky Notes).'}
                        </p>
                      </div>

                      {/* 打开官方素材库按钮 */}
                      <a
                        href={officialLibraryUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3.5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold shadow-md transition flex items-center gap-1.5 whitespace-nowrap shrink-0"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>{isZh ? '打开官方素材库 ↗' : 'Open Libraries ↗'}</span>
                      </a>
                    </div>

                    {/* 素材库直连地址代码卡片 */}
                    <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 flex items-center justify-between gap-2">
                      <div className="font-mono text-[11px] text-cyan-300 truncate select-all">
                        {officialLibraryUrl}
                      </div>
                      <button
                        onClick={handleCopyOfficialLibraryUrl}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs transition flex items-center gap-1 shrink-0 font-medium"
                        title={isZh ? '复制官方素材库完整链接' : 'Copy Library URL'}
                      >
                        {copiedLibUrl ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="text-emerald-400">{isZh ? '已复制' : 'Copied'}</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5 text-slate-400" />
                            <span>{isZh ? '复制链接' : 'Copy'}</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* 操作指南说明 */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-slate-300 pt-1">
                      <div className="p-2.5 rounded bg-slate-950/60 border border-slate-800/80">
                        <div className="font-semibold text-cyan-400 mb-0.5">1. 浏览与挑选</div>
                        <div className="text-[11px] text-slate-400 leading-normal">
                          {isZh ? '点击「打开官方素材库」在新标签页查阅分类与搜索素材' : 'Browse categories on the official library site'}
                        </div>
                      </div>
                      <div className="p-2.5 rounded bg-slate-950/60 border border-slate-800/80">
                        <div className="font-semibold text-cyan-400 mb-0.5">2. 一键添加 / 下载</div>
                        <div className="text-[11px] text-slate-400 leading-normal">
                          {isZh ? '点击「Add to Excalidraw」自动回写，或「Download」下载离线包' : 'Click "Add to Excalidraw" or download .excalidrawlib file'}
                        </div>
                      </div>
                      <div className="p-2.5 rounded bg-slate-950/60 border border-slate-800/80">
                        <div className="font-semibold text-cyan-400 mb-0.5">3. 拖入白板即用</div>
                        <div className="text-[11px] text-slate-400 leading-normal">
                          {isZh ? '离线 .excalidrawlib 文件可直接拖入画布或在「导入」面板载入' : 'Drag & drop offline file into canvas or use import tab'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 官方社区精选领域分类 */}
                  <div>
                    <h5 className="text-xs font-semibold text-slate-300 mb-2.5 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      <span>{isZh ? '官方素材精选分类导览' : 'Curated Library Categories'}</span>
                    </h5>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                      {OFFICIAL_COMMUNITY_CATEGORIES.map((cat) => (
                        <div
                          key={cat.id}
                          className="p-3 rounded-lg bg-slate-950 border border-slate-800 hover:border-cyan-500/50 transition flex flex-col justify-between gap-2"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-base">{cat.icon}</span>
                              <div className="font-semibold text-xs text-slate-200">
                                {isZh ? cat.name : cat.nameEn}
                              </div>
                            </div>
                            <div className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                              {cat.description}
                            </div>
                          </div>
                          <div className="flex items-center justify-between pt-2 border-t border-slate-900">
                            <div className="flex flex-wrap gap-1">
                              {cat.tags.slice(0, 3).map((t) => (
                                <span
                                  key={t}
                                  className="text-[9px] px-1 py-0.2 bg-slate-800 text-slate-400 rounded font-mono"
                                >
                                  {t}
                                </span>
                              ))}
                            </div>
                            <a
                              href={officialLibraryUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[11px] text-cyan-400 hover:text-cyan-300 flex items-center gap-0.5 font-medium"
                            >
                              <span>{isZh ? '查找' : 'Search'}</span>
                              <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: 内置物料与本地收藏 */}
              {stencilsTab === 'stencils' && (
                <div className="flex flex-col gap-4 animate-in fade-in">
                  {/* 搜索与分类过滤器 */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                    {/* 搜索输入 */}
                    <div className="relative flex-1">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={stencilSearch}
                        onChange={(e) => setStencilSearch(e.target.value)}
                        placeholder={isZh ? '搜索物料名称、类别或描述...' : 'Search stencils...'}
                        className="w-full bg-slate-900 border border-slate-700 rounded-md pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
                      />
                    </div>

                    {/* 分类快捷标签 */}
                    <div className="flex items-center gap-1 overflow-x-auto text-[11px]">
                      {[
                        { id: 'all', label: isZh ? '全部' : 'All' },
                        { id: 'compute', label: isZh ? '计算/容器' : 'Compute' },
                        { id: 'storage', label: isZh ? '存储/数据' : 'Storage' },
                        { id: 'network', label: isZh ? '网络/入口' : 'Network' },
                        { id: 'ai', label: isZh ? 'AI 智能体' : 'AI' },
                        { id: 'ui', label: isZh ? 'UI 原型' : 'UI' },
                        { id: 'chart', label: isZh ? '流程标记' : 'Notes' },
                        { id: 'custom', label: isZh ? `本地收藏 (${customStencils.length})` : 'Custom' },
                      ].map((tab) => (
                        <button
                          key={tab.id}
                          onClick={() => setSelectedStencilCategory(tab.id)}
                          className={`px-2 py-1 rounded whitespace-nowrap transition ${
                            selectedStencilCategory === tab.id
                              ? 'bg-cyan-600 text-white font-medium'
                              : 'bg-slate-900 text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 收藏选中图元区域 */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-slate-950 p-3 rounded-lg border border-slate-800">
                    <div>
                      <div className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                        <BookmarkPlus className="w-3.5 h-3.5 text-blue-400" />
                        <span>{isZh ? '自定义物料收藏' : 'Save Selection as Stencil'}</span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {isZh ? '在白板中框选任意图元组合，即可一键保存为可复用的专属物料' : 'Select elements on canvas and save as a reusable stencil'}
                      </div>
                    </div>

                    {showSaveCustomInput ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          value={customStencilName}
                          onChange={(e) => setCustomStencilName(e.target.value)}
                          placeholder={isZh ? '物料名称...' : 'Name...'}
                          className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-blue-500 w-36"
                          autoFocus
                          onKeyDown={(e) => e.key === 'Enter' && handleConfirmSaveCustomStencil()}
                        />
                        <button
                          onClick={handleConfirmSaveCustomStencil}
                          className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-medium transition"
                        >
                          {isZh ? '保存' : 'Save'}
                        </button>
                        <button
                          onClick={() => setShowSaveCustomInput(false)}
                          className="px-2 py-1 bg-slate-800 text-slate-400 hover:text-slate-200 rounded text-xs"
                        >
                          {isZh ? '取消' : 'Cancel'}
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={handleSaveSelectedAsStencil}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-medium transition shadow-sm flex items-center gap-1.5 whitespace-nowrap self-start sm:self-auto"
                      >
                        <BookmarkPlus className="w-3.5 h-3.5" />
                        <span>{isZh ? '收藏选中图元' : 'Save Selection'}</span>
                      </button>
                    )}
                  </div>

                  {/* 物料卡片网格 */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {[...EXCALIDRAW_STENCILS, ...customStencils]
                      .filter((s) => {
                        const matchCategory =
                          selectedStencilCategory === 'all'
                            ? true
                            : selectedStencilCategory === 'custom'
                            ? s.id.startsWith('custom-') || s.id.startsWith('imported-') || s.id.startsWith('url-') || s.id.startsWith('json-')
                            : s.category === selectedStencilCategory;
                        if (!matchCategory) return false;
                        if (!stencilSearch.trim()) return true;
                        const q = stencilSearch.toLowerCase();
                        return (
                          s.name.toLowerCase().includes(q) ||
                          s.nameEn.toLowerCase().includes(q) ||
                          (s.description && s.description.toLowerCase().includes(q))
                        );
                      })
                      .map((stencil) => (
                        <div
                          key={stencil.id}
                          className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 hover:border-cyan-500/60 transition flex flex-col justify-between gap-2.5 group"
                        >
                          <div>
                            <div className="flex items-center justify-between">
                              <div className="font-semibold text-xs text-slate-200 flex items-center gap-1.5 truncate">
                                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: stencil.color }} />
                                <span className="truncate">{isZh ? stencil.name : stencil.nameEn}</span>
                              </div>
                              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700 shrink-0">
                                {stencil.elements?.length || 0} 图元
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-400 mt-1 leading-relaxed line-clamp-2">
                              {stencil.description}
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-2 border-t border-slate-900">
                            <span className="text-[10px] text-slate-400 font-mono uppercase">
                              {stencil.category}
                            </span>
                            <div className="flex items-center gap-1">
                              {/* 删除自定义物料 */}
                              {(stencil.id.startsWith('custom-') || stencil.id.startsWith('imported-') || stencil.id.startsWith('url-') || stencil.id.startsWith('json-')) && (
                                <button
                                  onClick={() => {
                                    const updated = customStencils.filter((s) => s.id !== stencil.id);
                                    setCustomStencils(updated);
                                    try {
                                      localStorage.setItem('omniview_excalidraw_stencils', JSON.stringify(updated));
                                    } catch {}
                                    showLibraryToast(isZh ? '已删除物料' : 'Removed stencil');
                                  }}
                                  className="p-1 rounded text-red-400 hover:bg-red-500/10 transition"
                                  title={isZh ? '删除此物料' : 'Delete'}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}

                              {/* 加入白板素材库 */}
                              <button
                                onClick={() => handleAddStencilToExcalidrawLibrary(stencil)}
                                className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition"
                                title={isZh ? '添加到白板自带素材抽屉' : 'Add to Canvas Library'}
                              >
                                {isZh ? '加入库' : 'To Lib'}
                              </button>

                              {/* 插入画布 */}
                              <button
                                onClick={() => handleInsertStencil(stencil)}
                                className="px-2.5 py-1 rounded bg-cyan-600/20 hover:bg-cyan-600 text-cyan-300 hover:text-white border border-cyan-500/30 text-xs font-medium transition"
                              >
                                {isZh ? '插入画布' : 'Insert'}
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* TAB 3: 导入与导出素材 */}
              {stencilsTab === 'import' && (
                <div className="flex flex-col gap-4 animate-in fade-in">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* 本地文件拖拽与上传 */}
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="p-5 rounded-xl bg-slate-950 border-2 border-dashed border-slate-700 hover:border-cyan-500/80 transition flex flex-col items-center justify-center gap-2 cursor-pointer group text-center"
                    >
                      <div className="p-3 rounded-full bg-cyan-950/60 text-cyan-400 group-hover:scale-110 transition">
                        <Upload className="w-6 h-6" />
                      </div>
                      <div className="font-semibold text-xs text-slate-200">
                        {isZh ? '上传本地素材库文件' : 'Upload Local Library File'}
                      </div>
                      <div className="text-[11px] text-slate-400 max-w-xs leading-normal">
                        {isZh
                          ? '点击选择或直接将 .excalidrawlib / .json 拖入白板，自动完成解包与注入'
                          : 'Click to select .excalidrawlib or .json file to import'}
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-cyan-300 border border-slate-700 mt-1">
                        .excalidrawlib / .json
                      </span>
                    </div>

                    {/* 一键注入全量内置物料 & 导出备份 */}
                    <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between gap-3">
                      <div>
                        <div className="font-semibold text-xs text-slate-200 flex items-center gap-1.5">
                          <Package className="w-4 h-4 text-cyan-400" />
                          <span>{isZh ? '素材库快捷同步与备份' : 'Library Sync & Backup'}</span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                          {isZh
                            ? '一键将 OmniView 预置的 Kubernetes、微服务架构、UI 线框、AI 智能体等全套物料包注入白板侧边库；或将全体物料打包导出。'
                            : 'Sync all preset packs into canvas library, or export complete stencils as a backup file.'}
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-slate-900">
                        <button
                          onClick={handleInstallAllPresetToCanvas}
                          className="flex-1 px-3 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-lg text-xs font-medium shadow-sm transition flex items-center justify-center gap-1.5"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>{isZh ? '同步预置物料至白板' : 'Sync All to Canvas'}</span>
                        </button>

                        <button
                          onClick={handleExportAllStencils}
                          className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition flex items-center justify-center gap-1.5 shrink-0"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>{isZh ? '导出 .excalidrawlib' : 'Export .excalidrawlib'}</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* 网络链接 URL 导入 */}
                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col gap-2.5">
                    <div className="font-semibold text-xs text-slate-200 flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5 text-purple-400" />
                      <span>{isZh ? '通过网络链接 URL 导入素材' : 'Import from Web URL'}</span>
                    </div>
                    <div className="text-[11px] text-slate-400 leading-normal">
                      {isZh
                        ? '输入任何托管在 GitHub、CDN 或公开服务器的 .excalidrawlib 或 JSON 直链'
                        : 'Enter any public URL for a .excalidrawlib or JSON package'}
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="url"
                        value={importUrl}
                        onChange={(e) => setImportUrl(e.target.value)}
                        placeholder="https://.../my-library.excalidrawlib"
                        className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-purple-500 font-mono"
                        onKeyDown={(e) => e.key === 'Enter' && handleImportFromUrl()}
                      />
                      <button
                        onClick={handleImportFromUrl}
                        disabled={isImportingUrl || !importUrl.trim()}
                        className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-lg text-xs font-medium transition flex items-center gap-1 shrink-0"
                      >
                        {isImportingUrl ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>{isZh ? '拉取中...' : 'Fetching...'}</span>
                          </>
                        ) : (
                          <>
                            <FileUp className="w-3.5 h-3.5" />
                            <span>{isZh ? '拉取并导入' : 'Fetch & Import'}</span>
                          </>
                        )}
                      </button>
                    </div>
                    {importUrlError && (
                      <div className="text-[11px] text-red-400 flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" />
                        <span>{importUrlError}</span>
                      </div>
                    )}
                  </div>

                  {/* 粘贴 JSON 源码导入 */}
                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col gap-2.5">
                    <div className="font-semibold text-xs text-slate-200 flex items-center gap-1.5">
                      <FileCode className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{isZh ? '直接粘贴 JSON 源码导入' : 'Paste Raw JSON Content'}</span>
                    </div>
                    <textarea
                      value={importJsonText}
                      onChange={(e) => setImportJsonText(e.target.value)}
                      placeholder='{ "type": "excalidrawlib", "version": 2, "libraryItems": [...] }'
                      rows={3}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs font-mono text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 resize-none"
                    />
                    <div className="flex items-center justify-between">
                      {importJsonError ? (
                        <div className="text-[11px] text-red-400 flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5" />
                          <span>{importJsonError}</span>
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-500">
                          {isZh ? '支持 v1 数组与 v2 标准格式' : 'Supports v1 arrays and v2 standard schemas'}
                        </span>
                      )}
                      <button
                        onClick={handleImportFromJsonText}
                        disabled={!importJsonText.trim()}
                        className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-xs font-medium transition shrink-0"
                      >
                        {isZh ? '解析并导入' : 'Parse & Import'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 抽屉底部 */}
            <div className="px-5 py-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <span className="truncate">
                {isZh
                  ? '提示：在白板中选区图元可随时保存为物料，官方素材亦可直接拖入画布'
                  : 'Tip: You can drag & drop .excalidrawlib files directly into canvas'}
              </span>
              <button
                onClick={() => setShowStencilsDrawer(false)}
                className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded transition shrink-0"
              >
                {isZh ? '完成' : 'Done'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 浮动素材库 Toast 提示 */}
      {libraryToast && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-2.5 bg-slate-900/95 text-slate-100 text-xs border border-cyan-500/50 rounded-xl shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
          <Sparkles className="w-4 h-4 text-cyan-400 shrink-0" />
          <span>{libraryToast}</span>
        </div>
      )}
    </div>
  );
};
