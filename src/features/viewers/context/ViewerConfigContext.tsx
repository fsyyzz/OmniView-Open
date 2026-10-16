import React, { createContext, useContext, useMemo } from 'react';
import type { ThemeId, DensityMode } from '../../../shared/types';
import type { Locale } from '../../../shared/lib/i18n';
import type { VsCodeApi } from '../../../shared/lib/vscode';

export interface ViewerConfigContextValue {
  theme?: ThemeId;
  density?: DensityMode;
  locale?: Locale;
  vscode?: VsCodeApi;
}

const ViewerConfigContext = createContext<ViewerConfigContextValue>({});

export interface ViewerConfigProviderProps extends ViewerConfigContextValue {
  children: React.ReactNode;
}

export const ViewerConfigProvider: React.FC<ViewerConfigProviderProps> = ({
  theme,
  density,
  locale,
  vscode,
  children,
}) => {
  const value = useMemo(
    () => ({
      theme,
      density,
      locale,
      vscode,
    }),
    [theme, density, locale, vscode]
  );

  return <ViewerConfigContext.Provider value={value}>{children}</ViewerConfigContext.Provider>;
};

export const useViewerConfig = (): ViewerConfigContextValue => {
  return useContext(ViewerConfigContext);
};
