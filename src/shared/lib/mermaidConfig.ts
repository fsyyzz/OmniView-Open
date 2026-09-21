/**
 * Mermaid 高对比度与全主题自适应初始化配置
 * 重点优化线条粗细、箭头清晰度、节点边框、文本背景以及子图分组对比度
 */
import type { MermaidConfig } from 'mermaid';

export function getMermaidConfig(isDark: boolean): MermaidConfig {
  return {
    startOnLoad: false,
    securityLevel: 'loose',
    fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    theme: isDark ? 'dark' : 'default',
    flowchart: {
      htmlLabels: true,
      curve: 'basis',
      padding: 15,
      useMaxWidth: true,
      nodeSpacing: 50,
      rankSpacing: 50,
    },
    sequence: {
      useMaxWidth: true,
      showSequenceNumbers: false,
      boxMargin: 10,
      boxTextMargin: 5,
      noteMargin: 10,
      messageMargin: 35,
    },
    state: {
      useMaxWidth: true,
      nodeSpacing: 50,
      rankSpacing: 50,
      dividerMargin: 10,
      sizeUnit: 5,
      padding: 8,
      textHeight: 10,
      titleShift: -15,
      noteMargin: 10,
      forkWidth: 100,
      forkHeight: 7,
      miniPadding: 2,
      fontSizeFactor: 5.02,
      fontSize: 12,
      labelHeight: 16,
    },
    themeVariables: isDark
      ? {
          darkMode: true,
          background: 'transparent',
          fontFamily: 'ui-sans-serif, system-ui, sans-serif',
          fontSize: '13px',
          // 流程图节点与形状全面高对比
          primaryColor: '#111827',
          primaryBorderColor: '#38bdf8',
          primaryTextColor: '#f8fafc',
          nodeBkg: '#111827',
          nodeBorder: '#38bdf8',
          nodeTextColor: '#f8fafc',
          mainBkg: '#111827',
          // 连线与箭头 (高对比亮天蓝，确保暗色背景下清晰可见)
          lineColor: '#60a5fa',
          textColor: '#f1f5f9',
          defaultLinkColor: '#60a5fa',
          titleColor: '#f1f5f9',
          // 连线文字背景 (杜绝线条穿刺文字，提供高对比纯净背景)
          edgeLabelBackground: '#0b1120',
          // 分组与集群子图 (高识别度边缘与微暗浮层)
          tertiaryColor: '#0f172a',
          tertiaryBorderColor: '#64748b',
          tertiaryTextColor: '#93c5fd',
          clusterBkg: '#0f172a',
          clusterBorder: '#64748b',
          // 备注框 (清晰暖色醒目背景)
          noteBkgColor: '#1e293b',
          noteBorderColor: '#f59e0b',
          noteTextColor: '#fef08a',
          // 时序图角色与生命线
          actorBkg: '#111827',
          actorBorder: '#38bdf8',
          actorTextColor: '#f8fafc',
          actorLineColor: '#64748b',
          signalColor: '#60a5fa',
          signalTextColor: '#f1f5f9',
          // 状态图与类图 (全面高对比度状态节点与文字颜色，杜绝深底深字)
          stateBkg: '#111827',
          stateBorder: '#38bdf8',
          stateLabelColor: '#f8fafc',
          stateEdgeLabelBackground: '#0b1120',
          transitionColor: '#60a5fa',
          transitionLabelColor: '#f1f5f9',
          specialStateColor: '#38bdf8',
          innerEndBackground: '#38bdf8',
          compositeBackground: '#0f172a',
          compositeTitleBackground: '#1e293b',
          compositeBorder: '#38bdf8',
          altBackground: '#1e293b',
          labelBackgroundColor: '#0b1120',
          classText: '#f8fafc',
        }
      : {
          darkMode: false,
          background: 'transparent',
          fontFamily: 'ui-sans-serif, system-ui, sans-serif',
          fontSize: '13px',
          // 流程图节点与形状全面高对比
          primaryColor: '#f8fafc',
          primaryBorderColor: '#2563eb',
          primaryTextColor: '#0f172a',
          nodeBkg: '#f8fafc',
          nodeBorder: '#2563eb',
          nodeTextColor: '#0f172a',
          mainBkg: '#f8fafc',
          // 连线与箭头 (深冷灰蓝，高反差锐利显现)
          lineColor: '#1e293b',
          textColor: '#0f172a',
          defaultLinkColor: '#1e293b',
          titleColor: '#0f172a',
          // 连线文字背景 (纯净白底高清晰边框)
          edgeLabelBackground: '#ffffff',
          // 分组与集群子图
          tertiaryColor: '#f1f5f9',
          tertiaryBorderColor: '#94a3b8',
          tertiaryTextColor: '#1d4ed8',
          clusterBkg: '#f1f5f9',
          clusterBorder: '#94a3b8',
          // 备注框
          noteBkgColor: '#fefce8',
          noteBorderColor: '#ca8a04',
          noteTextColor: '#713f12',
          // 时序图角色与生命线
          actorBkg: '#ffffff',
          actorBorder: '#2563eb',
          actorTextColor: '#0f172a',
          actorLineColor: '#94a3b8',
          signalColor: '#1e293b',
          signalTextColor: '#0f172a',
          // 状态图与类图 (全面高对比度状态节点与文字颜色，杜绝浅底浅字)
          stateBkg: '#f8fafc',
          stateBorder: '#2563eb',
          stateLabelColor: '#0f172a',
          stateEdgeLabelBackground: '#ffffff',
          transitionColor: '#1e293b',
          transitionLabelColor: '#0f172a',
          specialStateColor: '#2563eb',
          innerEndBackground: '#2563eb',
          compositeBackground: '#f8fafc',
          compositeTitleBackground: '#e2e8f0',
          compositeBorder: '#2563eb',
          altBackground: '#f1f5f9',
          labelBackgroundColor: '#ffffff',
          classText: '#0f172a',
        },
  };
}
