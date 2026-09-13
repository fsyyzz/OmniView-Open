// ========== 全局配置 ==========
#set page(
  width: 210mm,
  height: 297mm,
  margin: (top: 2cm, bottom: 2cm, left: 2cm, right: 2cm)
)
#set text(font: ("Microsoft YaHei", "SimHei"), size: 11pt, lang: "zh")
#show heading: set text(weight: "bold")

// 自定义分隔线
#let divider = line(length: 100%, stroke: 0.4pt + gray)

// 自定义区块标题
#let sect-title(name) = {
  set text(size: 13pt, weight: "bold")
  name
  divider
  v(4pt)
}

// ========== 头部信息 ==========
#align(center)[
  #text(size: 18pt, weight: "bold")[张三]
  #v(4pt)
  #text(size: 10pt)[13800000000 ｜ #"zhangsan@example.com" ｜ 北京 ｜ 前端架构师 / 全栈工程师]
]

#v(8pt)

// ========== 个人简介 ==========
#sect-title("个人简介")
#text(size: 10.5pt)[
  拥有 8 年大型 Web 应用与前端架构研发经验，深入理解现代浏览器底层渲染管线与 WebAssembly 虚拟机。精通 TypeScript、React 19 以及高阶跨端图形与文档引擎开发，具备卓越的代码架构设计与落地交付能力。
]

#v(6pt)

// ========== 教育背景 ==========
#sect-title("教育背景")
#grid(
  columns: (auto, 1fr, auto),
  gutter: 6pt,
  [*清华大学*], [计算机科学与技术 · 硕士], [2016.09 - 2019.06],
  [*北京大学*], [软件工程 · 本科], [2012.09 - 2016.06],
)

#v(6pt)

// ========== 专业技能 ==========
#sect-title("专业技能")
- *语言与生态*：精通 TypeScript / JavaScript、Rust、Python，熟悉 WebAssembly (WASM) 内存模型
- *前端与框架*：熟练掌握 React 19、Next.js、Tailwind CSS，具备极佳的组件解耦与状态管理工程素养
- *文档与排版*：深入掌握 Typst、LaTeX、SVG 矢量图形管线与现代排版引擎原理
- *工程化*：熟练运用 Vite、Turbopack、CI/CD 自动化流水线与大规模性能调优 (60 FPS 稳帧)

#v(6pt)

// ========== 项目经历 ==========
#sect-title("核心项目经历")
*OmniView 多格式统一文档排版与预览平台*
#v(2pt)
- 主导架构重构：基于 Myriad-Dreamin/typst.ts 官方 WebAssembly 编译与渲染内核，支持出版级矢量排版。
- 解决中文与特殊字形渲染：设计自适应缺失字形修补管线，实现毫米级排版保真度与平滑双页预览。
- 毫秒级防抖响应：构建异步多级 Worker 与响应式画布，实现万行复杂源码实时流畅预览。

#pagebreak()

// ========== 第二页：深度技术与开源贡献 ==========
#sect-title("开源与专利成果")
*OmniView 统一全能多格式渲染器*
#v(2pt)
- 开源 Star 2,500+，全网月下载量突破 10 万次，集成 50+ 文件格式与实时出版级排版工作台。
- 创新设计并实现基于 DOM 映射与字模投影的 WASM 中文字形动态补丁方案，彻底消除跨平台字库缺失白屏问题。

#v(6pt)

#sect-title("技术荣誉与认证")
- 2024 年开源中国最具价值开源技术架构师
- 获得国家发明专利《一种基于 WebAssembly 的浏览器端跨格式文档即时矢量排版方法及系统》
- 连续 3 年主导技术委员会前端技术栈向 React 19 与 WASM 现代化演进升级
