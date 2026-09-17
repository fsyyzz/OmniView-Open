/**
 * OmniView EPUB 排版与样式配置弹出面板 (EpubTypographyPopover)
 */
import React from 'react';
import {
  Type,
  RotateCcw,
  Check,
  AlignJustify,
  AlignLeft,
} from 'lucide-react';
import {
  type EpubReaderSettings,
  type EpubReaderTheme,
  type EpubFontFamily,
  type EpubContentWidth,
  DEFAULT_EPUB_SETTINGS,
} from '../../../lib/epubSettingsStorage';
import type { ThemeId } from '../../../../../shared/types';

export interface EpubTypographyPopoverProps {
  settings: EpubReaderSettings;
  theme?: ThemeId;
  themeStyles: {
    paper: string;
    text: string;
    border: string;
    toolbarBg: string;
  };
  popoverRef: React.RefObject<HTMLDivElement | null>;
  onUpdateSetting: <K extends keyof EpubReaderSettings>(key: K, value: EpubReaderSettings[K]) => void;
  onResetSettings: (defaults: EpubReaderSettings) => void;
  onRecalculatePages: () => void;
}

export const EpubTypographyPopover: React.FC<EpubTypographyPopoverProps> = ({
  settings,
  theme,
  themeStyles,
  popoverRef,
  onUpdateSetting,
  onResetSettings,
  onRecalculatePages,
}) => {
  return (
    <div
      ref={popoverRef}
      className="absolute right-0 top-full mt-2 w-80 p-4 rounded-xl shadow-2xl border z-50 backdrop-blur-xl animate-in fade-in slide-in-from-top-1 duration-200"
      style={{
        background: themeStyles.paper,
        borderColor: themeStyles.border,
        color: themeStyles.text,
      }}
    >
      <div className="flex items-center justify-between pb-3 border-b mb-3" style={{ borderColor: themeStyles.border }}>
        <div className="flex items-center gap-1.5">
          <Type className="w-4 h-4 text-blue-500" />
          <span className="text-xs font-bold">流式排版设置</span>
        </div>
        <button
          onClick={() => {
            onResetSettings({ ...DEFAULT_EPUB_SETTINGS });
            setTimeout(onRecalculatePages, 50);
          }}
          className="text-[10px] flex items-center gap-1 opacity-60 hover:opacity-100 transition hover:text-blue-500"
          title="恢复默认排版"
        >
          <RotateCcw className="w-3 h-3" />
          <span>恢复默认</span>
        </button>
      </div>

      <div className="space-y-3.5 text-xs">
        {/* 阅读主题选择 */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-[11px] font-semibold opacity-70">阅读色彩主题</label>
            {settings.readerTheme === 'auto' ? (
              <span className="text-[10px] text-blue-500 font-mono">联动整体 ({theme || 'system'})</span>
            ) : (
              <span className="text-[10px] opacity-60 font-mono">专属阅读模式</span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {[
              { id: 'auto', label: '跟随整体主题', dot: 'var(--ov-accent)' },
              { id: 'light', label: '明雅日光 (纯白)', dot: '#f8fafc' },
              { id: 'sepia', label: '暖阳羊皮 (护眼)', dot: '#fbf3e4' },
              { id: 'dark', label: '暗夜深蓝 (深色)', dot: '#0b1120' },
              { id: 'midnight', label: '黑曜纯黑 (极夜)', dot: '#000000' },
            ].map(t => (
              <button
                key={t.id}
                onClick={() => onUpdateSetting('readerTheme', t.id as EpubReaderTheme)}
                className={`px-2 py-1.5 rounded-lg border text-[11px] text-left transition flex items-center justify-between ${
                  settings.readerTheme === t.id
                    ? 'bg-blue-600/10 border-blue-500 text-blue-600 dark:text-blue-400 font-semibold'
                    : 'hover:bg-black/5 dark:hover:bg-white/5 opacity-80'
                } ${t.id === 'midnight' ? 'col-span-2' : ''}`}
                style={{ borderColor: settings.readerTheme === t.id ? undefined : themeStyles.border }}
              >
                <div className="flex items-center gap-1.5 truncate">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0 border"
                    style={{ background: t.dot, borderColor: themeStyles.border }}
                  />
                  <span className="truncate">{t.label}</span>
                </div>
                {settings.readerTheme === t.id && <Check className="w-3 h-3 shrink-0 text-blue-500" />}
              </button>
            ))}
          </div>
        </div>

        {/* 排版字体选择 */}
        <div>
          <label className="block text-[11px] font-semibold opacity-70 mb-1.5">流式字体</label>
          <div className="grid grid-cols-2 gap-1.5">
            {[
              { id: 'serif', label: '典雅衬线 (宋体)' },
              { id: 'sans', label: '现代黑体 (无衬线)' },
              { id: 'kaiti', label: '人文楷体 (文学质感)' },
              { id: 'mono', label: '等宽代码' },
            ].map(f => (
              <button
                key={f.id}
                onClick={() => {
                  onUpdateSetting('fontFamily', f.id as EpubFontFamily);
                  setTimeout(onRecalculatePages, 50);
                }}
                className={`px-2 py-1.5 rounded-lg border text-[11px] text-left transition flex items-center justify-between ${
                  settings.fontFamily === f.id
                    ? 'bg-blue-600/10 border-blue-500 text-blue-600 dark:text-blue-400 font-semibold'
                    : 'hover:bg-black/5 dark:hover:bg-white/5 opacity-80'
                }`}
                style={{ borderColor: settings.fontFamily === f.id ? undefined : themeStyles.border }}
              >
                <span className="truncate">{f.label}</span>
                {settings.fontFamily === f.id && <Check className="w-3 h-3 shrink-0 text-blue-500" />}
              </button>
            ))}
          </div>
        </div>

        {/* 首行缩进与对齐方式 */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[11px] font-semibold opacity-70 mb-1">首行两字符缩进</label>
            <button
              onClick={() => {
                onUpdateSetting('textIndent', !settings.textIndent);
                setTimeout(onRecalculatePages, 50);
              }}
              className={`w-full py-1.5 px-2 rounded-lg border text-center transition ${
                settings.textIndent
                  ? 'bg-blue-600/10 border-blue-500 text-blue-600 dark:text-blue-400 font-semibold'
                  : 'hover:bg-black/5 dark:hover:bg-white/5 opacity-70'
              }`}
              style={{ borderColor: settings.textIndent ? undefined : themeStyles.border }}
            >
              {settings.textIndent ? '已开启缩进' : '关闭缩进'}
            </button>
          </div>

          <div>
            <label className="block text-[11px] font-semibold opacity-70 mb-1">对齐方式</label>
            <div className="flex border rounded-lg overflow-hidden" style={{ borderColor: themeStyles.border }}>
              <button
                onClick={() => onUpdateSetting('textAlign', 'justify')}
                className={`flex-1 py-1.5 flex items-center justify-center transition ${
                  settings.textAlign === 'justify' ? 'bg-blue-600 text-white' : 'hover:bg-black/5 opacity-70'
                }`}
                title="两端对齐"
              >
                <AlignJustify className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onUpdateSetting('textAlign', 'left')}
                className={`flex-1 py-1.5 flex items-center justify-center transition ${
                  settings.textAlign === 'left' ? 'bg-blue-600 text-white' : 'hover:bg-black/5 opacity-70'
                }`}
                title="靠左对齐"
              >
                <AlignLeft className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* 行高调节 */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-[11px] font-semibold opacity-70">行距倍率</label>
            <span className="font-mono text-[10px] opacity-70">{settings.lineHeight}x</span>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {[
              { val: 1.5, label: '紧凑 1.5' },
              { val: 1.75, label: '标准 1.75' },
              { val: 2.0, label: '宽松 2.0' },
            ].map(item => (
              <button
                key={item.val}
                onClick={() => {
                  onUpdateSetting('lineHeight', item.val);
                  setTimeout(onRecalculatePages, 50);
                }}
                className={`py-1 rounded-lg border text-center text-[10px] transition ${
                  settings.lineHeight === item.val
                    ? 'bg-blue-600 text-white border-blue-600 font-semibold'
                    : 'hover:bg-black/5 dark:hover:bg-white/5 opacity-70'
                }`}
                style={{ borderColor: settings.lineHeight === item.val ? undefined : themeStyles.border }}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* 版心宽度 */}
        <div>
          <label className="block text-[11px] font-semibold opacity-70 mb-1">版心宽度</label>
          <div className="grid grid-cols-3 gap-1.5">
            {[
              { id: 'standard', label: '标准 (720px)' },
              { id: 'wide', label: '宽幅 (960px)' },
              { id: 'full', label: '全幅 (100%)' },
            ].map(w => (
              <button
                key={w.id}
                onClick={() => {
                  onUpdateSetting('contentWidth', w.id as EpubContentWidth);
                  setTimeout(onRecalculatePages, 50);
                }}
                className={`py-1 rounded-lg border text-center text-[10px] transition ${
                  settings.contentWidth === w.id
                    ? 'bg-blue-600 text-white border-blue-600 font-semibold'
                    : 'hover:bg-black/5 dark:hover:bg-white/5 opacity-70'
                }`}
                style={{ borderColor: settings.contentWidth === w.id ? undefined : themeStyles.border }}
              >
                {w.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-3 pt-2.5 border-t text-[10px] opacity-50 flex items-center justify-between" style={{ borderColor: themeStyles.border }}>
        <span>OmniView 流式排版引擎</span>
        <span className="text-emerald-500 flex items-center gap-0.5">
          <Check className="w-2.5 h-2.5" /> 设置已实时持久化
        </span>
      </div>
    </div>
  );
};
