/**
 * Univer 专业电子表格工作台 (UniverSheetViewer)
 * 基于 Univer 1.0+ 现代化企业级 Canvas 2D 双缓冲渲染引擎与离线公式引擎
 * 提供媲美原生 Excel 的复杂选区、就地编辑、公式计算、行列拖拽与冻结交互
 * 支持组件卸载自动资源释放 (Univer.dispose)，防止任何 Canvas 与 Worker 内存泄漏
 * 作者: 周赞
 */
import React, { useEffect, useRef, useState } from 'react';
import { Univer, UniverInstanceType, LocaleType } from '@univerjs/core';
import { UniverRenderEnginePlugin } from '@univerjs/engine-render';
import { UniverFormulaEnginePlugin } from '@univerjs/engine-formula';
import { UniverUIPlugin } from '@univerjs/ui';
import { UniverSheetsPlugin } from '@univerjs/sheets';
import { UniverSheetsUIPlugin } from '@univerjs/sheets-ui';
import { UniverSheetsFormulaPlugin } from '@univerjs/sheets-formula';
import { UniverSheetsFormulaUIPlugin } from '@univerjs/sheets-formula-ui';
import { UniverSheetsNumfmtPlugin } from '@univerjs/sheets-numfmt';

import '@univerjs/design/lib/index.css';
import '@univerjs/ui/lib/index.css';
import '@univerjs/sheets-ui/lib/index.css';
import '@univerjs/sheets-formula-ui/lib/index.css';

import DesignZhCN from '@univerjs/design/locale/zh-CN';
import UIZhCN from '@univerjs/ui/locale/zh-CN';
import SheetsZhCN from '@univerjs/sheets/locale/zh-CN';
import SheetsUIZhCN from '@univerjs/sheets-ui/locale/zh-CN';
import SheetsFormulaUIZhCN from '@univerjs/sheets-formula-ui/locale/zh-CN';

import DesignEnUS from '@univerjs/design/locale/en-US';
import UIEnUS from '@univerjs/ui/locale/en-US';
import SheetsEnUS from '@univerjs/sheets/locale/en-US';
import SheetsUIEnUS from '@univerjs/sheets-ui/locale/en-US';
import SheetsFormulaUIEnUS from '@univerjs/sheets-formula-ui/locale/en-US';

import type { ParsedXlsxWorkbook } from '../../../lib/xlsxEngine';
import type { ThemeId } from '../../../../../shared/types';
import type { Locale } from '../../../../../shared/lib/i18n';
import { convertOmniWorkbookToUniver } from './xlsxToUniverAdapter';
import { getUniverThemeConfig } from './univerThemeBridge';

export interface UniverSheetViewerProps {
  workbook: ParsedXlsxWorkbook;
  fileName?: string;
  theme?: ThemeId;
  isDarkTheme?: boolean;
  locale?: Locale;
}

export const UniverSheetViewer: React.FC<UniverSheetViewerProps> = ({
  workbook,
  fileName = 'spreadsheet.xlsx',
  theme,
  isDarkTheme = false,
  locale = 'zh-CN',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const univerRef = useRef<Univer | null>(null);
  const [initError, setInitError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState<boolean>(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let isDisposed = false;

    try {
      // 1. 构建主题与国际化配置
      const themeConfig = getUniverThemeConfig(isDarkTheme, theme);
      const univerLocale = locale === 'en-US' ? LocaleType.EN_US : LocaleType.ZH_CN;

      // 2. 实例化 Univer 核心
      const univer = new Univer({
        theme: themeConfig,
        locale: univerLocale,
        locales: {
          [LocaleType.ZH_CN]: {
            ...DesignZhCN,
            ...UIZhCN,
            ...SheetsZhCN,
            ...SheetsUIZhCN,
            ...SheetsFormulaUIZhCN,
          },
          [LocaleType.EN_US]: {
            ...DesignEnUS,
            ...UIEnUS,
            ...SheetsEnUS,
            ...SheetsUIEnUS,
            ...SheetsFormulaUIEnUS,
          },
        },
      });

      // 3. 注册渲染与公式引擎插件
      univer.registerPlugin(UniverRenderEnginePlugin);
      univer.registerPlugin(UniverFormulaEnginePlugin);

      // 4. 注册 UI 框架插件
      univer.registerPlugin(UniverUIPlugin, {
        container,
        header: true,
        toolbar: true,
        footer: true,
      });

      // 5. 注册电子表格业务插件
      univer.registerPlugin(UniverSheetsPlugin);
      univer.registerPlugin(UniverSheetsUIPlugin);
      univer.registerPlugin(UniverSheetsFormulaPlugin);
      univer.registerPlugin(UniverSheetsFormulaUIPlugin);
      univer.registerPlugin(UniverSheetsNumfmtPlugin);

      // 6. 转换数据模型并装载工作簿
      const univerData = convertOmniWorkbookToUniver(workbook, fileName, undefined, isDarkTheme);
      univer.createUnit(UniverInstanceType.UNIVER_SHEET, univerData);

      if (!isDisposed) {
        univerRef.current = univer;
        setIsReady(true);
      } else {
        univer.dispose();
      }
    } catch (err: any) {
      console.error('[OmniView Univer] Initialization failed:', err);
      if (!isDisposed) {
        setInitError(err?.message || 'Univer 表格工作台初始化失败');
      }
    }

    // 清理与销毁生命周期
    return () => {
      isDisposed = true;
      if (univerRef.current) {
        try {
          univerRef.current.dispose();
        } catch (e) {
          console.warn('[OmniView Univer] Error while disposing instance:', e);
        }
        univerRef.current = null;
      }
    };
  }, [workbook, fileName, isDarkTheme, theme, locale]);

  if (initError) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center" style={{ backgroundColor: 'var(--ov-bg)', color: 'var(--ov-text)' }}>
        <div className="p-4 mb-4 rounded-lg bg-red-500/10 border border-red-500/20 max-w-md">
          <p className="font-semibold text-sm mb-1 text-red-400">Univer 引擎加载异常</p>
          <p className="text-xs opacity-80 text-red-300">{initError}</p>
        </div>
        <p className="text-xs text-[var(--ov-text-secondary)]">
          您可以切换回「极速轻量预览」模式以保证正常阅读表格。
        </p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full overflow-hidden" style={{ backgroundColor: 'var(--ov-bg)', color: 'var(--ov-text)' }}>
      {!isReady && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center backdrop-blur-xs" style={{ backgroundColor: 'var(--ov-bg, rgba(20,20,20,0.85))' }}>
          <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin mb-3" />
          <span className="text-xs text-[var(--ov-text-secondary)] font-mono">
            正在初始化 Univer 专业电子表格工作台...
          </span>
        </div>
      )}
      <div
        ref={containerRef}
        id="omniview-univer-sheet-container"
        className="w-full h-full univer-workbench-host"
        style={{
          height: '100%',
          width: '100%',
        }}
      />
    </div>
  );
};

export default UniverSheetViewer;
