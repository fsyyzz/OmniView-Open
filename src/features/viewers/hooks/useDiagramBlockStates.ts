/**
 * OmniView Markdown 内嵌图表与代码块交互状态管理 Hook
 * 遵循 SRP (单一职责原则)
 */
import { useState, useCallback } from 'react';
import type { LightboxItem } from '../components/common/LightboxModal';
import mermaid from 'mermaid';

export function useDiagramBlockStates() {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [zoomScales, setZoomScales] = useState<Record<string, number>>({});
  const [diagramViewModes, setDiagramViewModes] = useState<Record<string, 'visual' | 'code'>>({});
  const [editedCodes, setEditedCodes] = useState<Record<string, string>>({});
  const [collapsedCodeBlocks, setCollapsedCodeBlocks] = useState<Record<string, boolean>>({});
  const [svgBgModes, setSvgBgModes] = useState<Record<string, 'dark' | 'grid' | 'light'>>({});
  const [lightboxItem, setLightboxItem] = useState<LightboxItem | null>(null);

  const setSvgBgMode = useCallback((id: string, mode: 'dark' | 'grid' | 'light') => {
    setSvgBgModes((prev) => ({ ...prev, [id]: mode }));
  }, []);

  const handleCopy = useCallback(async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      // 降级使用 textarea 复制
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    }
  }, []);

  const adjustZoom = useCallback((id: string, delta: number) => {
    setZoomScales((prev) => {
      const current = prev[id] || 1;
      const next = Math.min(Math.max(0.2, Number((current + delta).toFixed(2))), 4.0);
      return { ...prev, [id]: next };
    });
  }, []);

  const resetZoom = useCallback((id: string) => {
    setZoomScales((prev) => ({ ...prev, [id]: 1 }));
  }, []);

  const toggleCollapse = useCallback((id: string) => {
    setCollapsedCodeBlocks((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const setDiagramViewMode = useCallback((id: string, mode: 'visual' | 'code') => {
    setDiagramViewModes((prev) => ({ ...prev, [id]: mode }));
  }, []);

  const setEditedCode = useCallback((id: string, code: string) => {
    setEditedCodes((prev) => ({ ...prev, [id]: code }));
  }, []);

  const handleDownloadSvg = useCallback((svgContent: string, fileName = 'diagram') => {
    if (!svgContent) return;
    const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileName}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  const handleReRenderMermaid = useCallback(async (blockId: string, currentCode: string) => {
    try {
      const { svg } = await mermaid.render(`mermaid-rerender-${Date.now()}`, currentCode);
      return { success: true, svg };
    } catch (e: any) {
      return { success: false, error: e?.message || 'Mermaid 语法错误' };
    }
  }, []);

  return {
    copiedId,
    zoomScales,
    diagramViewModes,
    editedCodes,
    collapsedCodeBlocks,
    svgBgModes,
    lightboxItem,
    setLightboxItem,
    handleCopy,
    adjustZoom,
    resetZoom,
    toggleCollapse,
    setDiagramViewMode,
    setSvgBgMode,
    setEditedCode,
    handleDownloadSvg,
    handleReRenderMermaid,
  };
}

