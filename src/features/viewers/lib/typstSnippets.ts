/**
 * Typst 常用学术与现代排版语法快捷片段
 */
export interface TypstSnippet {
  id: string;
  label: string;
  description: string;
  code: string;
}

export const TYPST_SNIPPETS: TypstSnippet[] = [
  {
    id: 'pagebreak',
    label: '物理分页',
    description: '插入 #pagebreak() 强制新起一页',
    code: '\n#pagebreak()\n',
  },
  {
    id: 'math_block',
    label: '块级数学公式',
    description: '插入独立多行数学公式 $ ... $',
    code: '\n$ \\mathcal{L}(\\theta) = - \\sum_{i=1}^n y_i \\log \\hat{y}_i + \\lambda \\|\\theta\\|_2^2 $\n',
  },
  {
    id: 'math_inline',
    label: '行内数学公式',
    description: '插入 $ x^2 + y^2 = r^2 $',
    code: '$ x^2 + y^2 = r^2 $',
  },
  {
    id: 'heading_1',
    label: '一级章节标题',
    description: '插入 = 1. 章节标题',
    code: '\n= 1. Section Title\n',
  },
  {
    id: 'heading_2',
    label: '二级子标题',
    description: '插入 == 1.1 子章节',
    code: '\n== 1.1 Subsection Title\n',
  },
  {
    id: 'code_block',
    label: '代码块',
    description: '插入带有语法高亮的代码块',
    code: '\n```python\ndef compute_loss(y_true, y_pred):\n    return np.mean((y_true - y_pred) ** 2)\n```\n',
  },
  {
    id: 'bullet_list',
    label: '无序列表',
    description: '插入无序项目符号列表',
    code: '\n- First key observation\n- Second quantitative result\n- Third concluding remark\n',
  },
  {
    id: 'page_setup',
    label: 'A4 页面与作者声明',
    description: '重置页面纸张与元数据',
    code: '#set page(paper: "a4", columns: 1)\n#set document(title: "Research Paper Title", author: ("Author Name"))\n#set text(font: "Linux Libertine", size: 10.5pt)\n',
  },
];
