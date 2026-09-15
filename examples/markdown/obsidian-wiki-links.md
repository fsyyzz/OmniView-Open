# Obsidian Wiki 链接与嵌入

本示例用于验证 OmniView 对 Obsidian 风格 Wiki 语法的支持。

## 链接

- 基础页面：[[basic-markdown]]
- 显示别名：[[gfm-features|GFM 功能示例]]
- 标题锚点：[[gfm-features#任务清单]]
- 当前文档标题：[[#图片嵌入]]
- 未解析目标（应显示缺失样式）：[[Does-Not-Exist]]

## 图片嵌入

普通图片/矢量嵌入：

![[../svg/performance-radar-chart.svg]]

指定宽度（像素）：

![[../svg/performance-radar-chart.svg|280]]

> 若相对路径在当前 Webview 无法解析，会显示破损占位；语法本身仍会正确解析为嵌入。
## 笔记嵌入

嵌入同目录笔记并展示预览卡片（需工作台已打开/加载目标文件）：

![[basic-markdown]]

![[callouts-and-tasks|Callouts 示例]]

## 与脚注共存

Wiki 链接可与脚注一起使用[^wiki-fn]：另见 [[code-blocks]]。

[^wiki-fn]: 脚注定义里也可以写 Wiki：[[math-formulas]]。

## 代码中不受影响

行内代码：`[[should-stay]]` 与 `![[no-embed.png]]`

围栏：

```md
[[not-a-link]]
![[not-an-embed.png]]
```
