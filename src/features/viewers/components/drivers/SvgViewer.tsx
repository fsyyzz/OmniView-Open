/**
 * OmniView 矢量图形驱动与工作台编辑器 (SVG Studio Viewer)
 *
 * 已全面统一至 v2 不可变 Document 模型 + 命令管线架构，移除旧版 v1 编辑器。
 */
import React, { useEffect } from 'react';
import { SvgV2Studio } from './svg/SvgV2Studio';
import { setSvgEngineFlag } from './svg/core/featureFlag';

export interface SvgViewerProps {
  content: string;
  fileName?: string;
  fileSize?: number;
  locale?: 'zh-CN' | 'en-US';
  onContentChange?: (newContent: string) => void;
}

export const SvgViewer: React.FC<SvgViewerProps> = ({
  content,
  fileName = 'graphic.svg',
  onContentChange,
}) => {
  // 自动清理历史遗留的 v1 缓存标记，统一固定为 v2 引擎
  useEffect(() => {
    setSvgEngineFlag('v2');
  }, []);

  return <SvgV2Studio content={content} fileName={fileName} onContentChange={onContentChange} />;
};

export default SvgViewer;
