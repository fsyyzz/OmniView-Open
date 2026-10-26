import { SoftwareDoc } from '../../types';

export const PERSISTENCE_DOC: SoftwareDoc = {
  id: 'persistence',
  title: '5. 全局配置与工作区持久化规范 (Persistence Spec)',
  category: 'Architecture',
  summary: '阐述 OmniView v2 统一持久化架构、旧版本平滑向前迁移机制、数值安全截断钳位、容量度量与备份导入导出协议。',
  tags: ['持久化', 'LocalStorage', '数据迁移', '容错钳位', 'Mermaid流程图'],
  content: `# OmniView 全局配置与工作区持久化规范

| 属性 | 详情 |
| :--- | :--- |
| **存储版本** | v2 增强型存储规范 (\`omniview:workbench:settings:v2\`) |
| **文件管理** | 工作区多文件隔离持久化 (\`omniview:workbench:files:v1\`) |
| **容错机制** | 数值上下限物理钳位 + 旧版数据无缝自愈回写 |
| **设计作者** |  |

---

## 一、持久化中枢架构全景

\`\`\`mermaid
flowchart TD
    subgraph StorageEngine ["💾 浏览器 LocalStorage 持久化引擎"]
        V1["旧版键名 (v1)<br/>omniview_workbench_settings"]
        V2["当前新版键名 (v2)<br/>omniview:workbench:settings:v2"]
        Files["工作区文件存储<br/>omniview:workbench:files:v1"]
    end

    subgraph Middleware ["🛡️ 防护与校验中间件 (settingsStorage.ts)"]
        Migrator["平滑数据迁移器<br/>(自动读取 v1 并回写落盘至 v2)"]
        Clamper["数学边界钳位器<br/>• zoom: 0.5 ~ 2.5 (两位浮点)<br/>• fontSize: 12 ~ 22px<br/>• splitRatio: 15 ~ 85%"]
        Capacity["存储容量与键分析器<br/>(getStorageStats: 实时统计精确到 0.1KB)"]
    end

    subgraph Consumers ["🖥️ 核心消费与响应驱动组件"]
        AppShell["App.tsx (工作台主入口 / 视图路由 / 主题 / 密度)"]
        MindmapView["MindmapViewer.tsx (思维导图分屏比例 / 视图模式)"]
        PUMLView["PlantUmlViewer.tsx (私有服务地址 / 分屏比例)"]
        MarkdownView["ViewerRenderer.tsx (双向分屏预览/导图模式)"]
        SettingsModal["WorkbenchSettingsModal.tsx (设置与备份导入导出面板)"]
    end

    V1 -.->|初次加载迁移| Migrator
    Migrator --> V2
    V2 <===> Clamper
    Clamper <===> Consumers
    Files <===> AppShell
\`\`\`

---

## 二、配置项全量定义与类型契约

\`\`\`typescript
export interface WorkbenchSettings {
  // 外观与版式
  theme: ThemeId;             // 9 大精校主题 (system, vscode, dark, light, sepia, midnight, cyber, nord, dracula, forest, solarized)
  density: DensityMode;       // compact | standard | comfortable
  locale: 'zh-CN' | 'en-US';  // 国际化多语言
  contentWidth: 'narrow' | 'standard' | 'wide' | 'full';
  fontSize: number;           // 12px ~ 22px 钳位
  zoom: number;               // 0.5x ~ 2.5x 两位精度钳位
  viewMode: ViewMode;         // preview | split | source | mindmap

  // 工作区状态
  currentView: WorkbenchView; // editor | docs | drivers | scaffold
  sidebarOpen: boolean;       // 左侧导航开关
  explorerOpen: boolean;      // 资源树开关
  activeFileId?: string;      // 当前正在编辑的文件 ID
  openTabIds?: string[];      // 已打开标签页 ID 序列

  // 驱动级专属状态
  splitRatio: number;         // 通用分屏比例 (15% ~ 85%)
  splitRightMode: 'preview' | 'mindmap';
  mindmapSplitRatio: number;  // 思维导图专属分屏比 (15% ~ 85%)
  mindmapViewMode: 'split' | 'mindmap' | 'editor';
  plantUmlSplitRatio: number; // PlantUML 分屏比例 (15% ~ 85%)
  plantUmlServerUrl: string;  // 自定义 PlantUML 渲染服务地址
  wordWrap: boolean;          // 自动折行
  showLineNumbers: boolean;   // 代码行号
}
\`\`\`

---

## 三、备份导入导出与出厂重置协议

1. **导出备份**：通过 \`exportSettingsJson()\` 导出标准格式化 JSON 文件，方便跨设备迁移；
2. **导入与增量合并**：通过 \`importSettingsJson(json)\` 进行合法性校验，只覆盖有效字段，自动忽略非法属性；
3. **出厂恢复**：支持一键清空并重置为 \`DEFAULT_SETTINGS\`，清除残存脏数据。
`,
};
