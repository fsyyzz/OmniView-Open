/**
 * OmniView 标准化视口缩放与导航控制器 (ViewZoomController)
 * 为各类矢量画布、架构图、富媒体与文档视口提供像素级一致的悬浮/内联缩放控制组件
 */
import React from 'react';
import { ZoomIn, ZoomOut, RotateCcw, Hand } from 'lucide-react';
import { Locale, t } from '../../../../shared/lib/i18n';

export interface ViewZoomControllerProps {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  panMode?: boolean;
  onTogglePanMode?: () => void;
  showPanToggle?: boolean;
  locale?: Locale;
  className?: string;
  size?: 'sm' | 'md';
}

export const ViewZoomController: React.FC<ViewZoomControllerProps> = ({
  zoom,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  panMode = false,
  onTogglePanMode,
  showPanToggle = false,
  locale = 'zh-CN',
  className = '',
  size = 'md',
}) => {
  const percentText = `${Math.round(zoom * 100)}%`;
  const isSmall = size === 'sm';
  const iconSize = isSmall ? 13 : 14;
  const btnPadding = isSmall ? 'p-1' : 'p-1.5';

  return (
    <div
      style={{
        backgroundColor: 'var(--ov-surface)',
        borderColor: 'var(--ov-border)',
        boxShadow: 'var(--ov-shadow)',
      }}
      className={`inline-flex items-center gap-0.5 px-1 py-0.5 rounded-lg border text-xs select-none backdrop-blur-md transition-colors ${className}`}
      role="toolbar"
      aria-label="Viewport zoom controls"
    >
      {showPanToggle && onTogglePanMode && (
        <>
          <button
            type="button"
            onClick={onTogglePanMode}
            style={
              panMode
                ? {
                    backgroundColor: 'var(--ov-accent)',
                    color: '#ffffff',
                  }
                : {
                    color: 'var(--ov-text-secondary)',
                  }
            }
            className={`${btnPadding} rounded-md hover:bg-[var(--ov-surface-hover,rgba(150,150,150,0.15))] transition`}
            title={panMode ? '退出抓手平移' : '激活抓手平移'}
            aria-pressed={panMode}
          >
            <Hand size={iconSize} />
          </button>
          <div
            style={{ backgroundColor: 'var(--ov-border)' }}
            className="w-px h-3.5 mx-0.5"
            aria-hidden="true"
          />
        </>
      )}

      <button
        type="button"
        onClick={onZoomOut}
        style={{ color: 'var(--ov-text-secondary)' }}
        className={`${btnPadding} rounded-md hover:bg-[var(--ov-surface-hover,rgba(150,150,150,0.15))] hover:text-[var(--ov-text)] transition`}
        title={t('zoomOut', locale)}
        aria-label={t('zoomOut', locale)}
      >
        <ZoomOut size={iconSize} />
      </button>

      <button
        type="button"
        onClick={onResetZoom}
        style={{ color: 'var(--ov-text)' }}
        className="px-1.5 py-0.5 font-mono text-[11px] font-medium rounded-md hover:bg-[var(--ov-surface-hover,rgba(150,150,150,0.15))] transition"
        title={t('resetZoom', locale)}
        aria-label={t('resetZoom', locale)}
      >
        {percentText}
      </button>

      <button
        type="button"
        onClick={onZoomIn}
        style={{ color: 'var(--ov-text-secondary)' }}
        className={`${btnPadding} rounded-md hover:bg-[var(--ov-surface-hover,rgba(150,150,150,0.15))] hover:text-[var(--ov-text)] transition`}
        title={t('zoomIn', locale)}
        aria-label={t('zoomIn', locale)}
      >
        <ZoomIn size={iconSize} />
      </button>

      <button
        type="button"
        onClick={onResetZoom}
        style={{ color: 'var(--ov-text-muted)' }}
        className={`${btnPadding} rounded-md hover:bg-[var(--ov-surface-hover,rgba(150,150,150,0.15))] hover:text-[var(--ov-text)] transition`}
        title={t('resetZoom', locale)}
        aria-label={t('resetZoom', locale)}
      >
        <RotateCcw size={iconSize - 1} />
      </button>
    </div>
  );
};
