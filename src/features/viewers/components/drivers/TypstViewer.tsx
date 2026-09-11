/**
 * OmniView Typst (.typ) 出版级现代排版阅读器与双向分屏工作台
 */
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { compileTypstDocument, type TypstCompileResult } from '../../lib/typstEngine';
import { useI18n } from '../../../../shared/lib/i18n';
import { TypstToolbar, type TypstStudioMode, type TypstViewMode } from './typst/TypstToolbar';
import { TypstOutlineSidebar } from './typst/TypstOutlineSidebar';
import { TypstCodeEditor } from './typst/TypstCodeEditor';
import { TypstCanvas } from './typst/TypstCanvas';

export interface TypstViewerProps {
  content?: string;
  fileName?: string;
  isDarkTheme?: boolean;
  theme?: string;
  locale?: 'zh-CN' | 'en-US';
  onContentChange?: (content: string) => void;
  onOpenSourceAtLine?: (line: number) => void;
}

export const TypstViewer: React.FC<TypstViewerProps> = ({
  content = '',
  fileName = 'document.typ',
  isDarkTheme = true,
  locale = 'zh-CN',
  onContentChange,
  onOpenSourceAtLine,
}) => {
  const { t } = useI18n();
  const [localCode, setLocalCode] = useState(content);
  const [currentPage, setCurrentPage] = useState(1);
  const [zoom, setZoom] = useState(100);
  const [viewMode, setViewMode] = useState<TypstViewMode>('continuous');
  const [studioMode, setStudioMode] = useState<TypstStudioMode>('split');
  const [splitRatio, setSplitRatio] = useState<number>(45);
  const [isDraggingSplit, setIsDraggingSplit] = useState(false);
  const [showOutline, setShowOutline] = useState(true);
  const [copied, setCopied] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const splitContainerRef = useRef<HTMLDivElement>(null);

  // 同步外部传入 content
  useEffect(() => {
    setLocalCode(content);
  }, [content]);

  // 编辑源码并触发回写
  const handleCodeChange = (newCode: string) => {
    setLocalCode(newCode);
    if (onContentChange) {
      onContentChange(newCode);
    }
  };

  const handleResetCode = () => {
    setLocalCode(content);
    if (onContentChange) {
      onContentChange(content);
    }
  };

  // 拖拽调整左右分屏比例
  const handleSplitMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingSplit(true);
  };

  useEffect(() => {
    if (!isDraggingSplit) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!splitContainerRef.current) return;
      const rect = splitContainerRef.current.getBoundingClientRect();
      const offsetX = e.clientX - rect.left;
      const pct = (offsetX / rect.width) * 100;
      setSplitRatio(Math.min(Math.max(pct, 15), 85));
    };

    const handleMouseUp = () => {
      setIsDraggingSplit(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDraggingSplit]);

  // 实时编译 Typst 源码
  const compileResult: TypstCompileResult = useMemo(() => {
    return compileTypstDocument(localCode, { isDarkTheme });
  }, [localCode, isDarkTheme]);

  const totalPages = Math.max(1, compileResult.totalPageCount);

  // 页码约束
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  const handleZoomIn = () => setZoom((z) => Math.min(250, z + 15));
  const handleZoomOut = () => setZoom((z) => Math.max(40, z - 15));
  const handleZoomReset = () => setZoom(100);

  const handlePrevPage = () => setCurrentPage((p) => Math.max(1, p - 1));
  const handleNextPage = () => setCurrentPage((p) => Math.min(totalPages, p + 1));

  const handleJumpToPage = (pageNum: number) => {
    setCurrentPage(pageNum);
    const targetEl = document.getElementById(`typst-page-${pageNum}`);
    if (targetEl) {
      targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportSvg = () => {
    const page = compileResult.pages[currentPage - 1] || compileResult.pages[0];
    if (!page) return;
    const blob = new Blob([page.svgContent], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileName.replace(/\.typ$/i, '')}_page_${page.pageNumber}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopySource = async () => {
    try {
      await navigator.clipboard.writeText(localCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* 顶部工具栏 */}
      <TypstToolbar
        studioMode={studioMode}
        setStudioMode={setStudioMode}
        viewMode={viewMode}
        setViewMode={setViewMode}
        showOutline={showOutline}
        setShowOutline={setShowOutline}
        currentPage={currentPage}
        totalPages={totalPages}
        onPrevPage={handlePrevPage}
        onNextPage={handleNextPage}
        zoom={zoom}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onResetZoom={handleZoomReset}
        onExportSvg={handleExportSvg}
        onPrint={handlePrint}
        onCopySource={handleCopySource}
        copied={copied}
        compileResult={compileResult}
        fileName={fileName}
        locale={locale}
      />

      {/* 主体工作区 (大纲侧栏 + 源码编辑区 + 拖拽分隔手柄 + 多页排版画布) */}
      <div ref={splitContainerRef} className="flex-1 flex min-h-0 overflow-hidden relative">
        {/* 左侧大纲导航栏 */}
        {showOutline && studioMode !== 'code' && (
          <TypstOutlineSidebar
            compileResult={compileResult}
            currentPage={currentPage}
            onJumpToPage={handleJumpToPage}
            locale={locale}
          />
        )}

        {/* 源码编辑器区域 (分屏或纯源码模式) */}
        {(studioMode === 'split' || studioMode === 'code') && (
          <div
            className="flex flex-col min-h-0"
            style={{
              width: studioMode === 'split' ? `${splitRatio}%` : '100%',
              flexShrink: 0,
            }}
          >
            <TypstCodeEditor
              code={localCode}
              originalCode={content}
              fileName={fileName}
              onChange={handleCodeChange}
              onReset={handleResetCode}
              locale={locale}
            />
          </div>
        )}

        {/* 可拖拽分屏调节手柄 */}
        {studioMode === 'split' && (
          <div
            onMouseDown={handleSplitMouseDown}
            className={`w-1.5 hover:w-2 bg-slate-800/80 hover:bg-sky-500 cursor-col-resize transition-all z-20 flex-shrink-0 flex items-center justify-center ${
              isDraggingSplit ? 'bg-sky-500 w-2' : ''
            }`}
            title={locale === 'zh-CN' ? '拖拽调整左右分屏比例' : 'Drag to resize split'}
          />
        )}

        {/* 右侧排版多页矢量预览画布容器 */}
        {studioMode !== 'code' && (
          <TypstCanvas
            containerRef={containerRef}
            compileResult={compileResult}
            viewMode={viewMode}
            currentPage={currentPage}
            zoom={zoom}
            locale={locale}
          />
        )}
      </div>
    </div>
  );
};

export default TypstViewer;
