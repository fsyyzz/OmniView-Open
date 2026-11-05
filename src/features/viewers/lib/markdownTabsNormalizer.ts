/**
 * OmniView Markdown 现代多标签容器语法转换器 (Markdown Tabs Normalizer)
 * 将 VitePress / Docusaurus 风格的 `::: tabs` 以及 MkDocs Material 风格的 `=== "Tab"`
 * 自动规范化映射为 OmniView 原生支持的 `> [!TABS]` 扩展调用语法，实现零配置兼容。
 *
 * 作者: 周赞
 */

/**
 * 检测并规范化各类开源 Markdown 标签页语法为 OmniView 原生 `> [!TABS]` 块
 */
export function normalizeMarkdownTabs(content: string): string {
  if (!content) return content;

  let result = content;

  // 1. 处理 VitePress / Docusaurus / Markdown-it 容器语法:
  // ::: tabs [可选标题]
  // == 标签1
  // 内容1
  // == 标签2
  // 内容2
  // :::
  result = result.replace(
    /^[ \t]*:::[ \t]*(?:tabs|code-group)(?:[ \t]+([^\n]+))?\n([\s\S]+?)\n[ \t]*:::[ \t]*$/gm,
    (_match, title, body) => {
      const trimmedTitle = (title || '').trim();
      const tabHeader = trimmedTitle ? `> [!TABS] ${trimmedTitle}\n` : `> [!TABS]\n`;

      // 切分以 == 或 @tab 或 [TabName] 开头的子标签
      const tabSplitRegex = /(?:^|\n)[ \t]*(?:==|@tab|###)[ \t]+([^\n]+)\n([\s\S]*?)(?=(?:\n[ \t]*(?:==|@tab|###)[ \t]+[^\n]+\n)|$)/g;
      const tabs: Array<{ label: string; content: string }> = [];

      let tabMatch: RegExpExecArray | null;
      while ((tabMatch = tabSplitRegex.exec(body)) !== null) {
        const label = tabMatch[1].trim();
        const tabContent = tabMatch[2].trim();
        if (label) {
          tabs.push({ label, content: tabContent });
        }
      }

      if (tabs.length === 0) {
        // 尝试按带标题的代码块切分 (e.g. ```ts [TypeScript] ... ```)
        const codeBlockRegex = /```([a-zA-Z0-9_-]+)[ \t]+\[([^\]]+)\]\n([\s\S]*?)```/g;
        let codeMatch: RegExpExecArray | null;
        while ((codeMatch = codeBlockRegex.exec(body)) !== null) {
          const lang = codeMatch[1];
          const label = codeMatch[2];
          const code = codeMatch[3];
          tabs.push({
            label,
            content: `\`\`\`${lang}\n${code}\`\`\``,
          });
        }
      }

      if (tabs.length > 0) {
        const tabsMarkdown = tabs
          .map((tab) => {
            const indented = tab.content
              .split('\n')
              .map((line) => (line ? `>   ${line}` : '>'))
              .join('\n');
            return `> - **${tab.label}**\n${indented}`;
          })
          .join('\n');
        return `${tabHeader}${tabsMarkdown}\n`;
      }

      return _match;
    }
  );

  // 2. 处理 MkDocs Material 风格多标签语法:
  // === "TypeScript"
  //     ```ts
  //     code...
  //     ```
  // === "Python"
  //     ```py
  //     code...
  //     ```
  const mkDocsTabsRegex = /(?:^|\n)(===[ \t]+["']([^"'\n]+)["']\n(?:(?:[ \t]{4}|\t)[^\n]*\n*)+)+/g;
  result = result.replace(mkDocsTabsRegex, (fullMatch) => {
    const singleTabRegex = /===[ \t]+["']([^"'\n]+)["']\n((?:(?:[ \t]{4}|\t)[^\n]*\n*)+)/g;
    const tabs: Array<{ label: string; content: string }> = [];

    let match: RegExpExecArray | null;
    while ((match = singleTabRegex.exec(fullMatch)) !== null) {
      const label = match[1].trim();
      const rawBody = match[2];
      // 消除 4 空格缩进
      const dedentedBody = rawBody
        .split('\n')
        .map((line) => line.replace(/^(?: {4}|\t)/, ''))
        .join('\n')
        .trim();
      if (label) {
        tabs.push({ label, content: dedentedBody });
      }
    }

    if (tabs.length > 0) {
      const tabsMarkdown = tabs
        .map((tab) => {
          const indented = tab.content
            .split('\n')
            .map((line) => (line ? `>   ${line}` : '>'))
            .join('\n');
          return `> - **${tab.label}**\n${indented}`;
        })
        .join('\n');
      return `\n> [!TABS]\n${tabsMarkdown}\n\n`;
    }

    return fullMatch;
  });

  return result;
}
