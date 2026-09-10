/**
 * OmniView 渲染错误边界组件 (RenderErrorBoundary)
 * 捕获组件子树运行时异常，防止单个图表/代码块或局部渲染错误导致整页白屏
 */
import React, { ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Copy, Check, ChevronDown, ChevronRight } from 'lucide-react';
import { t } from '../../../../shared/lib/i18n';
import { VsCodeApi } from '../../../../shared/lib/vscode';

export interface RenderErrorBoundaryProps {
  key?: React.Key;
  children: ReactNode;
  fallback?: ReactNode | ((error: Error, reset: () => void) => ReactNode);
  title?: string;
  blockName?: string;
  locale?: string;
  vscode?: VsCodeApi;
  onCatch?: (error: Error, errorInfo: any) => void;
}

export interface RenderErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: any | null;
  showStack: boolean;
  copied: boolean;
}

// 继承自 React.Component
export class RenderErrorBoundary extends React.Component<RenderErrorBoundaryProps, RenderErrorBoundaryState> {
  constructor(props: RenderErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showStack: false,
      copied: false,
    };
  }

  public static getDerivedStateFromError(error: Error): Partial<RenderErrorBoundaryState> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: any): void {
    this.setState({ errorInfo });
    this.props.onCatch?.(error, errorInfo);

    // 报告给 VS Code 宿主方便统一调试排查
    try {
      this.props.vscode?.postMessage({
        type: 'webview-error',
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo?.componentStack,
        blockName: this.props.blockName,
      });
    } catch {
      // ignore
    }
  }

  private handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      showStack: false,
      copied: false,
    });
  };

  private handleCopyError = () => {
    const { error, errorInfo } = this.state;
    const { blockName } = this.props;
    const text = `[OmniView Render Error] ${blockName ? `(${blockName})` : ''}
Error: ${error?.message || 'Unknown Error'}
Stack:
${error?.stack || 'No stack'}
Component Stack:
${errorInfo?.componentStack || 'No component stack'}`;

    navigator.clipboard.writeText(text);
    this.setState({ copied: true });
    setTimeout(() => this.setState({ copied: false }), 2000);
  };

  public render(): ReactNode {
    const { hasError, error, errorInfo, showStack, copied } = this.state;
    const { children, fallback, title, blockName, locale = 'zh-CN' } = this.props;

    if (!hasError) {
      return children;
    }

    if (typeof fallback === 'function') {
      return fallback(error || new Error('Unknown Error'), this.handleReset);
    }

    if (fallback) {
      return fallback;
    }

    const displayTitle = title || (blockName ? `${blockName} - ${t('errorBoundaryTitle', locale)}` : t('errorBoundaryTitle', locale));

    return (
      <div className="ov-error-boundary-card">
        <div className="ov-error-boundary-header">
          <div className="ov-error-boundary-title-group">
            <AlertTriangle className="ov-error-icon" size={16} />
            <span className="ov-error-title">{displayTitle}</span>
          </div>
          <div className="ov-error-actions">
            <button
              type="button"
              className="ov-error-btn ov-error-btn-secondary"
              onClick={this.handleCopyError}
              title={t('errorCopyDetails', locale)}
            >
              {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
              <span>{copied ? t('errorCopied', locale) : t('errorCopyDetails', locale)}</span>
            </button>
            <button
              type="button"
              className="ov-error-btn ov-error-btn-primary"
              onClick={this.handleReset}
              title={t('errorRetry', locale)}
            >
              <RefreshCw size={13} />
              <span>{t('errorRetry', locale)}</span>
            </button>
          </div>
        </div>

        <p className="ov-error-desc">
          {error?.message || t('errorBoundaryDesc', locale)}
        </p>

        {error?.stack && (
          <div className="ov-error-stack-container">
            <button
              type="button"
              className="ov-error-stack-toggle"
              onClick={() => this.setState(prev => ({ showStack: !prev.showStack }))}
            >
              {showStack ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              <span>{t('errorStack', locale)}</span>
            </button>
            {showStack && (
              <pre className="ov-error-stack-content">
                <code>{error.stack}</code>
                {errorInfo?.componentStack && (
                  <code className="text-slate-500 mt-2 block">{errorInfo.componentStack}</code>
                )}
              </pre>
            )}
          </div>
        )}
      </div>
    );
  }
}
