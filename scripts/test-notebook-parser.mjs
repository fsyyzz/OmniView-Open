import assert from 'node:assert';
import {
  parseJupyterNotebook,
  convertAnsiToHtml,
  exportNotebookToMarkdown,
  exportNotebookToScript,
  normalizeSource,
} from '../src/features/viewers/lib/notebookParser.ts';

console.log('🧪 开始 Jupyter Notebook (.ipynb v4) 纯端侧解析与转换引擎单元测试...');

// 1. source 字段规整化测试 (单行、数组、空值)
console.log('--- 测试 1: source 数组/字符串归一化 ---');
assert.strictEqual(normalizeSource(['import numpy as np\n', 'import pandas as pd']), 'import numpy as np\nimport pandas as pd');
assert.strictEqual(normalizeSource('print("hello world")'), 'print("hello world")');
assert.strictEqual(normalizeSource(null), '');
assert.strictEqual(normalizeSource(undefined), '');
console.log('✅ source 归一化测试全部通过');

// 2. ANSI 转义色彩序列转换为富文本 HTML
console.log('--- 测试 2: ANSI Traceback 转 HTML ---');
const ansiSample = '\u001b[31;1mZeroDivisionError\u001b[0m: \u001b[33mdivision by zero\u001b[0m';
const convertedHtml = convertAnsiToHtml(ansiSample);
assert.ok(convertedHtml.includes('color: #f43f5e'), '红色 ANSI 码应转换为对应 CSS');
assert.ok(convertedHtml.includes('font-weight: 700'), 'Bold ANSI 码应转换为对应 CSS');
assert.ok(convertedHtml.includes('ZeroDivisionError'), '原错误类名必须保留');
console.log('✅ ANSI 转义色彩转换测试通过');

// 3. 完整合法 v4 Notebook 结构解析
console.log('--- 测试 3: 完整 v4 Notebook 解析与统计 ---');
const sampleNotebookJson = JSON.stringify({
  nbformat: 4,
  nbformat_minor: 5,
  metadata: {
    kernelspec: {
      name: 'python3',
      display_name: 'Python 3.11 (ipykernel)',
      language: 'python',
    },
    language_info: {
      name: 'python',
      version: '3.11.5',
    },
    title: 'Data Science Exploratory Analysis',
  },
  cells: [
    {
      id: 'cell_md_1',
      cell_type: 'markdown',
      source: ['# 数据分析报告\n', '这是第一段引言说明。'],
      metadata: {},
    },
    {
      id: 'cell_code_1',
      cell_type: 'code',
      execution_count: 1,
      source: ['import numpy as np\n', 'arr = np.array([1, 2, 3])\n', 'print(arr)'],
      outputs: [
        {
          output_type: 'stream',
          name: 'stdout',
          text: ['[1 2 3]\n'],
        },
      ],
      metadata: {},
    },
    {
      id: 'cell_code_2',
      cell_type: 'code',
      execution_count: 2,
      source: ['# 绘制折线图\n', 'plt.show()'],
      outputs: [
        {
          output_type: 'display_data',
          data: {
            'text/plain': ['<Figure size 640x480 with 1 Axes>'],
            'image/png': 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
          },
          metadata: {},
        },
      ],
      metadata: {},
    },
    {
      id: 'cell_raw_1',
      cell_type: 'raw',
      source: 'RAW_CONFIG_KEY=12345',
      metadata: {},
    },
  ],
});

const { notebook, error, stats } = parseJupyterNotebook(sampleNotebookJson);
assert.strictEqual(error, null, '合法 Notebook 解析不应报错');
assert.ok(notebook !== null, '解析结果不应为空');
assert.strictEqual(stats.totalCells, 4);
assert.strictEqual(stats.codeCells, 2);
assert.strictEqual(stats.markdownCells, 1);
assert.strictEqual(stats.rawCells, 1);
assert.strictEqual(stats.executedCount, 2);
assert.strictEqual(stats.language, 'python');
assert.strictEqual(stats.kernelName, 'Python 3.11 (ipykernel)');

assert.strictEqual(notebook.cells[0].source, '# 数据分析报告\n这是第一段引言说明。');
assert.strictEqual(notebook.cells[1].outputs[0].output_type, 'stream');
assert.strictEqual(notebook.cells[1].outputs[0].text, '[1 2 3]\n');
assert.ok(notebook.cells[2].outputs[0].data['image/png'], '图片 Base64 需正常提取');
console.log('✅ 完整 v4 Notebook 解析与属性映射测试通过');

// 4. 一键导出为 Markdown 测试
console.log('--- 测试 4: 一键导出为 Markdown ---');
const exportedMd = exportNotebookToMarkdown(notebook);
assert.ok(exportedMd.includes('# Data Science Exploratory Analysis'), '应包含文档标题');
assert.ok(exportedMd.includes('# 数据分析报告'), '应包含 Markdown Cell 正文');
assert.ok(exportedMd.includes('```python # In [1]'), '代码块应标明语言与执行编号');
assert.ok(exportedMd.includes('data:image/png;base64,'), '图片应输出为嵌入 Markdown 图像语法');
console.log('✅ Markdown 导出测试通过');

// 5. 一键导出为纯代码 Script 测试
console.log('--- 测试 5: 一键导出为 Python 脚本 ---');
const exportedPy = exportNotebookToScript(notebook);
assert.ok(exportedPy.includes('# %% In [1]'), '应输出单元格分隔符');
assert.ok(exportedPy.includes('import numpy as np'), '应包含源码代码');
assert.ok(exportedPy.includes('# %% [Markdown Cell 1]'), 'Markdown 块应以注释形式安全导出');
console.log('✅ Python 脚本导出测试通过');

// 6. 异常边界防御测试 (非法 JSON, 空输入, 缺少 cells)
console.log('--- 测试 6: 异常边界容错 ---');
const emptyRes = parseJupyterNotebook('');
assert.ok(emptyRes.error !== null, '空输入必须被拦截');

const invalidJsonRes = parseJupyterNotebook('{ bad json');
assert.ok(invalidJsonRes.error !== null, '损坏 JSON 必须被拦截');

const nonNotebookRes = parseJupyterNotebook('{"hello": "world"}');
assert.ok(nonNotebookRes.error?.includes('缺少 cells'), '非 Notebook 结构必须拦截并清晰报错');
console.log('✅ 异常边界容错测试全部通过');

console.log('🎉 全部 6 组 Jupyter Notebook 解析与转换引擎测试用例 100% 通过！');
