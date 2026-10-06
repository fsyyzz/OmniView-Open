/**
 * OmniView 应用运行与诊断日志中枢引擎 (appLogger.ts)
 * 职责：
 * 1. 提供统一直观的分级日志记录 API (debug, info, warn, error)
 * 2. 内存环形缓冲区 (0ms 秒读)，支持 UI 实时响应与日志订阅
 * 3. 批量防抖持久化存入 IndexedDB (logs 仓库，最大保留 1000 条并自动 LRU 淘汰)
 * 4. 自动通过 VS Code IPC 将警告与错误同步投递至宿主原生 OutputChannel
 * 5. 支持格式化导出系统诊断日志与一键复制
 */
import {
  idbSaveLogs,
  idbGetLogs,
  idbClearLogs,
  idbCountLogs,
  type AppLogItem,
  type LogLevel,
} from './indexedDbStorage';
import { getVsCodeApi } from './vscode';

export type LogListener = (item: AppLogItem) => void;

class AppLoggerService {
  private inMemoryLogs: AppLogItem[] = [];
  private maxMemoryLogs: number = 200;
  private pendingToPersist: AppLogItem[] = [];
  private persistTimer: any = null;
  private listeners: Set<LogListener> = new Set();
  private seq: number = 0;

  constructor() {
    // 启动时异步从数据库加载最新历史日志回填内存环形缓冲区
    if (typeof window !== 'undefined') {
      setTimeout(() => {
        idbGetLogs({ limit: 50 })
          .then((persisted) => {
            if (persisted.length > 0) {
              // 按照时间戳升序规整入内存
              const sorted = [...persisted].reverse();
              this.inMemoryLogs = [...sorted, ...this.inMemoryLogs].slice(-this.maxMemoryLogs);
              this.notify();
            }
          })
          .catch(() => {});
      }, 100);
    }
  }

  /**
   * 记录一条日志并触发多通道分发
   */
  public log(level: LogLevel, source: string, message: string, details?: unknown): void {
    const timestamp = Date.now();
    const id = `log_${timestamp}_${++this.seq}`;
    let formattedDetails: string | undefined;

    if (details !== undefined) {
      try {
        if (details instanceof Error) {
          formattedDetails = details.stack || details.message;
        } else if (typeof details === 'object') {
          formattedDetails = JSON.stringify(details);
        } else {
          formattedDetails = String(details);
        }
      } catch {
        formattedDetails = '[Circular or Unserializable Object]';
      }
    }

    const size = (message.length + (formattedDetails?.length || 0) + source.length) * 2 + 64;

    const item: AppLogItem = {
      id,
      timestamp,
      level,
      source: source || 'app',
      message: String(message || ''),
      details: formattedDetails,
      size,
    };

    // 1. 压入内存环形缓冲区
    this.inMemoryLogs.push(item);
    if (this.inMemoryLogs.length > this.maxMemoryLogs) {
      this.inMemoryLogs.shift();
    }

    // 2. 压入待持久化队列
    this.pendingToPersist.push(item);
    this.schedulePersist();

    // 3. 宿主 IPC 桥接 (警告与错误自动上报至 VS Code OutputChannel)
    if (level === 'error' || level === 'warn') {
      try {
        const vscode = getVsCodeApi();
        vscode.postMessage({
          type: 'app-log',
          level,
          source,
          message: item.message,
          details: formattedDetails,
        });
      } catch {}
    }

    // 4. 控制台联动输出 (保留原生体验)
    if (typeof console !== 'undefined') {
      const prefix = `[OmniView:${source}]`;
      if (level === 'error') {
        console.error(prefix, message, details ?? '');
      } else if (level === 'warn') {
        console.warn(prefix, message, details ?? '');
      } else if (level === 'debug') {
        console.debug(prefix, message, details ?? '');
      } else {
        console.log(prefix, message, details ?? '');
      }
    }

    // 5. 通知前端响应式监听器
    this.notify(item);
  }

  public debug(source: string, message: string, details?: unknown): void {
    this.log('debug', source, message, details);
  }

  public info(source: string, message: string, details?: unknown): void {
    this.log('info', source, message, details);
  }

  public warn(source: string, message: string, details?: unknown): void {
    this.log('warn', source, message, details);
  }

  public error(source: string, message: string, details?: unknown): void {
    this.log('error', source, message, details);
  }

  /**
   * 防抖批量持久化保存至 IndexedDB
   */
  private schedulePersist(): void {
    if (this.persistTimer) return;
    this.persistTimer = setTimeout(async () => {
      this.persistTimer = null;
      if (this.pendingToPersist.length === 0) return;
      const batch = [...this.pendingToPersist];
      this.pendingToPersist = [];
      try {
        await idbSaveLogs(batch);
      } catch {
        // 存储异常静默忽略
      }
    }, 400);
  }

  /**
   * 立即刷新尚未落盘的暂存队列
   */
  public async flush(): Promise<void> {
    if (this.persistTimer) {
      clearTimeout(this.persistTimer);
      this.persistTimer = null;
    }
    if (this.pendingToPersist.length > 0) {
      const batch = [...this.pendingToPersist];
      this.pendingToPersist = [];
      await idbSaveLogs(batch);
    }
  }

  /**
   * 获取内存中的实时日志
   */
  public getMemoryLogs(level?: LogLevel): AppLogItem[] {
    if (!level) return [...this.inMemoryLogs];
    return this.inMemoryLogs.filter((i) => i.level === level);
  }

  /**
   * 异步从 IndexedDB 完整加载日志
   */
  public async loadLogs(options?: { level?: LogLevel; limit?: number }): Promise<AppLogItem[]> {
    await this.flush();
    return idbGetLogs(options);
  }

  /**
   * 清空所有日志（内存与 IndexedDB）
   */
  public async clearLogs(): Promise<void> {
    this.inMemoryLogs = [];
    this.pendingToPersist = [];
    await idbClearLogs();
    this.notify();
  }

  /**
   * 导出诊断日志为纯文本 (.log)
   */
  public async exportLogsAsText(options?: { level?: LogLevel; limit?: number }): Promise<string> {
    const logs = await this.loadLogs({ limit: options?.limit ?? 1000, level: options?.level });
    const lines: string[] = [
      '==================================================',
      `OmniView 系统诊断与运行日志导出`,
      `导出时间: ${new Date().toISOString()}`,
      `日志过滤: ${options?.level || '全部 (ALL)'}`,
      `日志条数: ${logs.length}`,
      '==================================================\n',
    ];

    for (const item of logs) {
      const time = new Date(item.timestamp).toISOString();
      const lvl = item.level.toUpperCase().padEnd(5, ' ');
      lines.push(`[${time}] [${lvl}] [${item.source}] ${item.message}`);
      if (item.details) {
        lines.push(`  Details: ${item.details}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * 导出结构化诊断日志为 JSON (.json)
   */
  public async exportLogsAsJson(options?: { level?: LogLevel; limit?: number }): Promise<string> {
    const logs = await this.loadLogs({ limit: options?.limit ?? 1000, level: options?.level });
    const payload = {
      exportTime: new Date().toISOString(),
      generator: 'OmniView Diagnostic Logger',
      filter: options?.level || 'all',
      count: logs.length,
      logs,
    };
    return JSON.stringify(payload, null, 2);
  }

  /**
   * 生成系统全景诊断与健康报告 (Markdown 格式)
   */
  public async exportSystemDiagnostics(): Promise<string> {
    const logs = await this.loadLogs({ limit: 200 });
    const errors = logs.filter((l) => l.level === 'error');
    const warns = logs.filter((l) => l.level === 'warn');
    const logStats = await idbCountLogs();

    const envInfo = {
      isVsCode: Boolean(getVsCodeApi()),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown / Node',
      platform: typeof navigator !== 'undefined' ? navigator.platform : 'Unknown',
      language: typeof navigator !== 'undefined' ? navigator.language : 'zh-CN',
      theme: typeof document !== 'undefined' ? document.documentElement.getAttribute('data-theme') || 'default' : 'unknown',
      time: new Date().toISOString(),
    };

    const lines: string[] = [
      '# OmniView 系统全景诊断与运行体检报告',
      `*生成时间: ${envInfo.time}*`,
      '',
      '## 1. 运行宿主与环境 (Environment)',
      `- **宿主环境**: ${envInfo.isVsCode ? 'VS Code 原生扩展 (Webview 模式)' : '独立浏览器 / Web 模式'}`,
      `- **用户代理 (UA)**: \`${envInfo.userAgent}\``,
      `- **系统语言**: \`${envInfo.language}\``,
      `- **当前主题**: \`${envInfo.theme}\``,
      '',
      '## 2. 数据库与日志存储概况 (Storage & Logs)',
      `- **IndexedDB 日志总条数**: ${logStats.count} 条`,
      `- **估算日志数据体积**: ${Math.round((logStats.totalBytes || 0) / 1024 * 10) / 10} KB`,
      `- **内存环形缓冲大小**: ${this.inMemoryLogs.length} 条 (上限 200 条)`,
      `- **日志保留策略**: 硬上限 1000 条，满额自动 LRU 淘汰至 800 条`,
      `- **最近 200 条中异常统计**: 错误 (${errors.length}) / 警告 (${warns.length})`,
      '',
      '## 3. 最近严重异常追踪 (Recent Errors)',
    ];

    if (errors.length === 0) {
      lines.push('*当前暂无未捕获的严重异常记录，运行状态优良。*');
    } else {
      for (const err of errors.slice(0, 10)) {
        lines.push(`- **[${new Date(err.timestamp).toISOString()}] [${err.source}]** ${err.message}`);
        if (err.details) {
          lines.push('  ```');
          lines.push(`  ${err.details.slice(0, 300)}`);
          lines.push('  ```');
        }
      }
    }

    lines.push('');
    lines.push('## 4. 最近活动流水 (Recent 30 Entries)');
    lines.push('```text');
    for (const item of logs.slice(0, 30)) {
      const time = new Date(item.timestamp).toLocaleTimeString();
      lines.push(`[${time}] [${item.level.toUpperCase()}] [${item.source}] ${item.message}`);
    }
    lines.push('```');

    return lines.join('\n');
  }

  /**
   * 触发浏览器文件下载
   */
  public downloadFile(filename: string, content: string, mimeType: string = 'text/plain;charset=utf-8'): void {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * 订阅日志变化
   */
  public subscribe(listener: LogListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(item?: AppLogItem): void {
    if (!item) return;
    for (const listener of this.listeners) {
      try {
        listener(item);
      } catch {}
    }
  }
}

/** 全局单例日志管理器 */
export const appLogger = new AppLoggerService();

