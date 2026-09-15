# GFM 功能示例

这个文件集中展示 GitHub Flavored Markdown 常用能力。

## 任务清单

- [x] 解析 Markdown 标题和段落
- [x] 显示代码块
- [x] 支持 Mermaid 图表
- [ ] 支持更多主题配置

## 数据表格

| 模块 | 状态 | 说明 |
| --- | :---: | --- |
| Markdown | 已完成 | 基础排版和 GFM |
| Mermaid | 已完成 | 内嵌流程图 |
| PlantUML | 已完成 | 架构图和时序图 |
| VS Code | 进行中 | Custom Editor 集成 |

## 嵌套列表

1. 准备文档
   - 编写标题
   - 添加正文
2. 打开预览
   - 选择 OmniView 渲染器
   - 使用左侧大纲定位

## 删除线与自动链接

这是一段 ~~已经废弃的文案~~，新的文案发布在 https://code.visualstudio.com/docs/languages/markdown。

## 脚注

正文里可以插入 GFM / Pandoc 风格脚注引用[^intro]，同一条脚注也能被再次引用[^intro]。

另一条脚注可以写更长的说明[^detail]。

未定义的引用会原样保留：[^missing]。

[^intro]: 这是第一条脚注，支持 **行内强调** 与 [链接](https://github.github.com/gfm/)。

[^detail]: 多行脚注第一行。
    续行需要缩进四个空格（或一个 Tab）。

    空行后的缩进段落仍属于同一脚注。
