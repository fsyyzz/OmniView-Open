/**
 * OmniView 原生 Excel (.xlsx / .xls) 纯前端离线解析与工作簿提取引擎 (xlsxEngine)
 * 基于 OOXML (Open Packaging Conventions) 标准与 JSZip 离线解包管道
 * 支持多工作表 (Worksheets)、共享字符串池 (SharedStrings)、公式计算值、单元格坐标对齐与多格式导出
 */
import JSZip from 'jszip';

export interface XlsxCell {
  ref: string; // e.g. "A1"
  col: number; // 0-based column index
  row: number; // 0-based row index
  value: string;
  formula?: string;
  type?: 'string' | 'number' | 'boolean' | 'date' | 'error' | 'formula';
}

export interface XlsxWorksheet {
  id: string;
  name: string;
  sheetId: number;
  rowCount: number;
  colCount: number;
  headers: string[];
  rows: string[][];
  cells: Record<string, XlsxCell>;
  dimension?: string;
  mergedRanges?: string[];
}

export interface XlsxMetadata {
  title?: string;
  creator?: string;
  lastModifiedBy?: string;
  created?: string;
  modified?: string;
  application?: string;
  totalSheets: number;
  sheetNames: string[];
}

export interface ParsedXlsxWorkbook {
  metadata: XlsxMetadata;
  sheets: XlsxWorksheet[];
  activeSheetIndex: number;
}

/**
 * 将列字母（如 A, B, Z, AA, BC）转为 0-based 索引
 */
export function colLetterToIndex(colStr: string): number {
  let index = 0;
  const upper = colStr.toUpperCase();
  for (let i = 0; i < upper.length; i++) {
    index = index * 26 + (upper.charCodeAt(i) - 64);
  }
  return index - 1;
}

/**
 * 将 0-based 索引转为列字母（如 0 -> "A", 25 -> "Z", 26 -> "AA"）
 */
export function indexToColLetter(index: number): string {
  let colStr = '';
  let temp = index + 1;
  while (temp > 0) {
    const rem = (temp - 1) % 26;
    colStr = String.fromCharCode(65 + rem) + colStr;
    temp = Math.floor((temp - 1) / 26);
  }
  return colStr;
}

/**
 * 解析单元格引用，如 "BC15" -> { col: 54, row: 14 }
 */
export function parseCellRef(ref: string): { col: number; row: number; colStr: string; rowNum: number } {
  const match = ref.match(/^([A-Za-z]+)(\d+)$/);
  if (!match) {
    return { col: 0, row: 0, colStr: 'A', rowNum: 1 };
  }
  const colStr = match[1].toUpperCase();
  const rowNum = parseInt(match[2], 10);
  return {
    col: colLetterToIndex(colStr),
    row: rowNum - 1,
    colStr,
    rowNum,
  };
}

/**
 * 解析 sharedStrings.xml 获取共享字符串池
 */
export function parseSharedStrings(xmlStr: string): string[] {
  const strings: string[] = [];
  if (!xmlStr) return strings;

  // 匹配所有 <si>...</si> 节点
  const siRegex = /<si\b[^>]*>([\s\S]*?)<\/si>/gi;
  let siMatch: RegExpExecArray | null;

  while ((siMatch = siRegex.exec(xmlStr)) !== null) {
    const siContent = siMatch[1];
    
    // 提取所有 <t> 或 <t ...> 文本
    const tRegex = /<t\b[^>]*>([\s\S]*?)<\/t>/gi;
    let tMatch: RegExpExecArray | null;
    let textPieces: string[] = [];

    while ((tMatch = tRegex.exec(siContent)) !== null) {
      textPieces.push(unescapeXml(tMatch[1]));
    }

    if (textPieces.length > 0) {
      strings.push(textPieces.join(''));
    } else {
      // 容错空字符串节点
      strings.push('');
    }
  }

  return strings;
}

/**
 * XML 实体字符转义还原
 */
function unescapeXml(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

/**
 * 解析单个工作表 XML
 */
export function parseWorksheetXml(
  sheetXml: string,
  sheetMeta: { id: string; name: string; sheetId: number },
  sharedStrings: string[]
): XlsxWorksheet {
  const cells: Record<string, XlsxCell> = {};
  let maxCol = -1;
  let maxRow = -1;

  // 1. 提取 dimension（例如 A1:G25）
  let dimension = '';
  const dimMatch = sheetXml.match(/<dimension\b[^>]*\bref="([^"]+)"/i);
  if (dimMatch) {
    dimension = dimMatch[1];
    if (dimension.includes(':')) {
      const [, endRef] = dimension.split(':');
      const parsedEnd = parseCellRef(endRef);
      maxCol = Math.max(maxCol, parsedEnd.col);
      maxRow = Math.max(maxRow, parsedEnd.row);
    }
  }

  // 2. 提取合并单元格
  const mergedRanges: string[] = [];
  const mergeRegex = /<mergeCell\b[^>]*\bref="([^"]+)"/gi;
  let mergeMatch: RegExpExecArray | null;
  while ((mergeMatch = mergeRegex.exec(sheetXml)) !== null) {
    mergedRanges.push(mergeMatch[1]);
  }

  // 3. 提取每行与每个单元格
  const rowRegex = /<row\b([^>]*)>([\s\S]*?)<\/row>/gi;
  let rowMatch: RegExpExecArray | null;

  while ((rowMatch = rowRegex.exec(sheetXml)) !== null) {
    const rowAttrs = rowMatch[1];
    const rowContent = rowMatch[2];
    
    const rAttrMatch = rowAttrs.match(/\br="(\d+)"/i);
    const rowNum = rAttrMatch ? parseInt(rAttrMatch[1], 10) : 1;
    const rowIndex = rowNum - 1;
    if (rowIndex > maxRow) maxRow = rowIndex;

    // 解析单元格 <c r="A1" t="s"><v>0</v></c>
    const cellRegex = /<c\b([^>]*)>([\s\S]*?)<\/c>/gi;
    let cellMatch: RegExpExecArray | null;

    while ((cellMatch = cellRegex.exec(rowContent)) !== null) {
      const cellAttrs = cellMatch[1];
      const cellBody = cellMatch[2];

      const rMatch = cellAttrs.match(/\br="([A-Za-z0-9]+)"/i);
      if (!rMatch) continue;
      const ref = rMatch[1];
      const { col, row } = parseCellRef(ref);

      if (col > maxCol) maxCol = col;
      if (row > maxRow) maxRow = row;

      const tMatch = cellAttrs.match(/\bt="([A-Za-z0-9]+)"/i);
      const cellType = tMatch ? tMatch[1] : '';

      // 解析公式 <f>SUM(A1:B1)</f>
      let formula: string | undefined;
      const fMatch = cellBody.match(/<f\b[^>]*>([\s\S]*?)<\/f>/i);
      if (fMatch) {
        formula = unescapeXml(fMatch[1]);
      }

      // 解析值 <v>123</v>
      let rawVal = '';
      const vMatch = cellBody.match(/<v\b[^>]*>([\s\S]*?)<\/v>/i);
      if (vMatch) {
        rawVal = unescapeXml(vMatch[1]);
      }

      // 格式化解析最终显示值
      let displayValue = '';
      let detectedType: XlsxCell['type'] = 'number';

      if (cellType === 's') {
        // 共享字符串索引
        const sIndex = parseInt(rawVal, 10);
        displayValue = !isNaN(sIndex) && sharedStrings[sIndex] !== undefined ? sharedStrings[sIndex] : rawVal;
        detectedType = 'string';
      } else if (cellType === 'inlineStr') {
        // 行内字符串 <is><t>text</t></is>
        const isMatch = cellBody.match(/<is>[\s\S]*?<t\b[^>]*>([\s\S]*?)<\/t>[\s\S]*?<\/is>/i);
        displayValue = isMatch ? unescapeXml(isMatch[1]) : rawVal;
        detectedType = 'string';
      } else if (cellType === 'b') {
        // 布尔值
        displayValue = rawVal === '1' ? 'TRUE' : 'FALSE';
        detectedType = 'boolean';
      } else if (cellType === 'e') {
        // 错误类型
        displayValue = rawVal || '#ERROR';
        detectedType = 'error';
      } else if (cellType === 'str') {
        // 计算公式产生的字符串
        displayValue = rawVal;
        detectedType = 'string';
      } else {
        // 默认为数值或常规
        displayValue = rawVal;
        if (formula) {
          detectedType = 'formula';
        } else if (rawVal !== '' && !isNaN(Number(rawVal))) {
          detectedType = 'number';
        } else {
          detectedType = 'string';
        }
      }

      cells[ref] = {
        ref,
        col,
        row,
        value: displayValue,
        formula,
        type: detectedType,
      };
    }
  }

  // 4. 构建密集矩阵网格 (2D Array)
  const effectiveRowCount = Math.max(maxRow + 1, 0);
  const effectiveColCount = Math.max(maxCol + 1, 0);

  const gridRows: string[][] = [];
  for (let r = 0; r < effectiveRowCount; r++) {
    const rowArr: string[] = [];
    for (let c = 0; c < effectiveColCount; c++) {
      const ref = `${indexToColLetter(c)}${r + 1}`;
      const cell = cells[ref];
      rowArr.push(cell ? cell.value : '');
    }
    gridRows.push(rowArr);
  }

  // 5. 提取表头：以第一行为默认表头，如第一行全空则使用列标 A, B, C...
  let headers: string[] = [];
  if (gridRows.length > 0 && gridRows[0].some(val => val.trim() !== '')) {
    headers = gridRows[0].map((val, idx) => (val.trim() !== '' ? val : indexToColLetter(idx)));
  } else {
    headers = Array.from({ length: effectiveColCount }, (_, idx) => indexToColLetter(idx));
  }

  return {
    id: sheetMeta.id,
    name: sheetMeta.name,
    sheetId: sheetMeta.sheetId,
    rowCount: effectiveRowCount,
    colCount: effectiveColCount,
    headers,
    rows: gridRows,
    cells,
    dimension,
    mergedRanges,
  };
}

/**
 * 解析核心元数据 (core.xml & app.xml)
 */
export async function parseXlsxMetadata(zip: JSZip, sheetNames: string[]): Promise<XlsxMetadata> {
  const metadata: XlsxMetadata = {
    totalSheets: sheetNames.length,
    sheetNames,
  };

  try {
    const coreXmlFile = zip.file('docProps/core.xml');
    if (coreXmlFile) {
      const coreXml = await coreXmlFile.async('string');
      const titleMatch = coreXml.match(/<dc:title\b[^>]*>([\s\S]*?)<\/dc:title>/i);
      if (titleMatch) metadata.title = unescapeXml(titleMatch[1]);

      const creatorMatch = coreXml.match(/<dc:creator\b[^>]*>([\s\S]*?)<\/dc:creator>/i);
      if (creatorMatch) metadata.creator = unescapeXml(creatorMatch[1]);

      const lastModMatch = coreXml.match(/<cp:lastModifiedBy\b[^>]*>([\s\S]*?)<\/cp:lastModifiedBy>/i);
      if (lastModMatch) metadata.lastModifiedBy = unescapeXml(lastModMatch[1]);

      const createdMatch = coreXml.match(/<dcterms:created\b[^>]*>([\s\S]*?)<\/dcterms:created>/i);
      if (createdMatch) metadata.created = createdMatch[1];

      const modifiedMatch = coreXml.match(/<dcterms:modified\b[^>]*>([\s\S]*?)<\/dcterms:modified>/i);
      if (modifiedMatch) metadata.modified = modifiedMatch[1];
    }

    const appXmlFile = zip.file('docProps/app.xml');
    if (appXmlFile) {
      const appXml = await appXmlFile.async('string');
      const appMatch = appXml.match(/<Application\b[^>]*>([\s\S]*?)<\/Application>/i);
      if (appMatch) metadata.application = unescapeXml(appMatch[1]);
    }
  } catch {
    // 元数据提取失败不阻塞主流程
  }

  return metadata;
}

/**
 * 完整解析 XLSX 归档数据
 */
export async function parseXlsx(data: ArrayBuffer | Uint8Array | string): Promise<ParsedXlsxWorkbook> {
  let zip: JSZip;

  if (typeof data === 'string') {
    if (data.startsWith('data:')) {
      const base64Content = data.split(',')[1] || '';
      zip = await JSZip.loadAsync(base64Content, { base64: true });
    } else if (data.length > 0 && !data.includes('<') && !data.includes('\n')) {
      try {
        zip = await JSZip.loadAsync(data, { base64: true });
      } catch {
        // Fallback 生成演示工作簿
        zip = await generateSampleXlsxZip();
      }
    } else {
      zip = await generateSampleXlsxZip();
    }
  } else {
    zip = await JSZip.loadAsync(data);
  }

  // 1. 读取共享字符串池
  let sharedStrings: string[] = [];
  const sstFile = zip.file('xl/sharedStrings.xml');
  if (sstFile) {
    const sstXml = await sstFile.async('string');
    sharedStrings = parseSharedStrings(sstXml);
  }

  // 2. 读取工作簿结构 xl/workbook.xml
  const workbookFile = zip.file('xl/workbook.xml');
  if (!workbookFile) {
    throw new Error('无效的 Excel 文件：缺少 xl/workbook.xml');
  }
  const workbookXml = await workbookFile.async('string');

  // 解析 sheet 列表
  const sheetMetaList: { id: string; name: string; sheetId: number; rId: string }[] = [];
  const sheetRegex = /<sheet\b([^>]*)\/>/gi;
  let sheetMatch: RegExpExecArray | null;

  while ((sheetMatch = sheetRegex.exec(workbookXml)) !== null) {
    const attrs = sheetMatch[1];
    const nameMatch = attrs.match(/\bname="([^"]+)"/i);
    const idMatch = attrs.match(/\bsheetId="(\d+)"/i);
    const rIdMatch = attrs.match(/\br:id="([^"]+)"/i);

    const name = nameMatch ? unescapeXml(nameMatch[1]) : `Sheet${sheetMetaList.length + 1}`;
    const sheetId = idMatch ? parseInt(idMatch[1], 10) : sheetMetaList.length + 1;
    const rId = rIdMatch ? rIdMatch[1] : `rId${sheetMetaList.length + 1}`;

    sheetMetaList.push({
      id: `sheet-${sheetId}`,
      name,
      sheetId,
      rId,
    });
  }

  // 3. 读取关系映射 xl/_rels/workbook.xml.rels
  const relMap: Record<string, string> = {};
  const relsFile = zip.file('xl/_rels/workbook.xml.rels');
  if (relsFile) {
    const relsXml = await relsFile.async('string');
    const relRegex = /<Relationship\b([^>]*)\/>/gi;
    let relMatch: RegExpExecArray | null;
    while ((relMatch = relRegex.exec(relsXml)) !== null) {
      const attrs = relMatch[1];
      const idM = attrs.match(/\bId="([^"]+)"/i);
      const targetM = attrs.match(/\bTarget="([^"]+)"/i);
      if (idM && targetM) {
        let target = targetM[1];
        if (!target.startsWith('xl/') && !target.startsWith('/')) {
          target = `xl/${target.replace(/^\.\//, '')}`;
        }
        relMap[idM[1]] = target;
      }
    }
  }

  // 4. 读取各工作表
  const parsedSheets: XlsxWorksheet[] = [];

  for (let i = 0; i < sheetMetaList.length; i++) {
    const meta = sheetMetaList[i];
    let sheetPath = relMap[meta.rId] || `xl/worksheets/sheet${i + 1}.xml`;
    if (!sheetPath.startsWith('xl/')) {
      sheetPath = `xl/${sheetPath}`;
    }

    let sheetFile = zip.file(sheetPath);
    if (!sheetFile) {
      // 容错匹配任何 worksheets/ 目录下的对应索引文件
      sheetFile = zip.file(`xl/worksheets/sheet${meta.sheetId}.xml`) ||
                 zip.file(`xl/worksheets/sheet${i + 1}.xml`);
    }

    if (sheetFile) {
      const sheetXml = await sheetFile.async('string');
      const ws = parseWorksheetXml(sheetXml, meta, sharedStrings);
      parsedSheets.push(ws);
    }
  }

  // 若未成功提取任何工作表，构造一个空兜底工作表
  if (parsedSheets.length === 0) {
    parsedSheets.push({
      id: 'sheet-1',
      name: 'Sheet1',
      sheetId: 1,
      rowCount: 1,
      colCount: 1,
      headers: ['A'],
      rows: [['']],
      cells: {},
    });
  }

  // 5. 提取元数据
  const metadata = await parseXlsxMetadata(zip, parsedSheets.map(s => s.name));

  return {
    metadata,
    sheets: parsedSheets,
    activeSheetIndex: 0,
  };
}

/**
 * 导出工作表为 CSV 文本
 */
export function exportSheetToCsv(sheet: XlsxWorksheet, delimiter: string = ','): string {
  return sheet.rows
    .map(row =>
      row
        .map(cell => {
          const str = cell || '';
          if (str.includes(delimiter) || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        })
        .join(delimiter)
    )
    .join('\n');
}

/**
 * 导出工作表为 JSON 数据
 */
export function exportSheetToJson(sheet: XlsxWorksheet): string {
  if (sheet.rows.length === 0) return '[]';
  const headers = sheet.headers;
  const dataRows = sheet.rows.length > 1 ? sheet.rows.slice(1) : [];

  const jsonArr = dataRows.map(row => {
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      obj[h || `Col_${idx + 1}`] = row[idx] || '';
    });
    return obj;
  });

  return JSON.stringify(jsonArr, null, 2);
}

/**
 * 导出工作表为 Markdown 表格
 */
export function exportSheetToMarkdown(sheet: XlsxWorksheet): string {
  if (sheet.rows.length === 0) return '';
  const headers = sheet.headers.map(h => h.replace(/\|/g, '\\|') || ' ');
  const sep = headers.map(() => '---');

  const lines: string[] = [
    `| ${headers.join(' | ')} |`,
    `| ${sep.join(' | ')} |`,
  ];

  const dataRows = sheet.rows.length > 1 ? sheet.rows.slice(1) : [];
  dataRows.forEach(row => {
    const formatted = headers.map((_, i) => (row[i] || '').replace(/\|/g, '\\|'));
    lines.push(`| ${formatted.join(' | ')} |`);
  });

  return lines.join('\n');
}

/**
 * 生成内置的合规演示 XLSX Zip 包
 */
export async function generateSampleXlsxZip(): Promise<JSZip> {
  const zip = new JSZip();

  // [Content_Types].xml
  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`
  );

  // _rels/.rels
  zip.file(
    '_rels/.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`
  );

  // docProps/core.xml
  zip.file(
    'docProps/core.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/">
  <dc:title>OmniView 业务数据总览与预算报表</dc:title>
  <dc:creator>OmniView Architecture Team</dc:creator>
  <cp:lastModifiedBy>OmniView Architecture Team</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">2026-09-17T12:00:00Z</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">2026-09-17T12:00:00Z</dcterms:modified>
</cp:coreProperties>`
  );

  // docProps/app.xml
  zip.file(
    'docProps/app.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">
  <Application>OmniView Professional Spreadsheet Suite</Application>
  <DocSecurity>0</DocSecurity>
  <ScaleCrop>false</ScaleCrop>
  <HeadingPairs>
    <vt:vector size="2" baseType="variant" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
      <vt:variant><vt:lpstr>Worksheets</vt:lpstr></vt:variant>
      <vt:variant><vt:i4>2</vt:i4></vt:variant>
    </vt:vector>
  </HeadingPairs>
  <TitlesOfParts>
    <vt:vector size="2" baseType="lpstr" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
      <vt:lpstr>2026年度业务营收与增长</vt:lpstr>
      <vt:lpstr>研发及运营预算明细</vt:lpstr>
    </vt:vector>
  </TitlesOfParts>
</Properties>`
  );

  // xl/_rels/workbook.xml.rels
  zip.file(
    'xl/_rels/workbook.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>
</Relationships>`
  );

  // xl/workbook.xml
  zip.file(
    'xl/workbook.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="2026年度业务营收与增长" sheetId="1" r:id="rId1"/>
    <sheet name="研发及运营预算明细" sheetId="2" r:id="rId2"/>
  </sheets>
</workbook>`
  );

  // Shared Strings Pool
  const strings = [
    '产品业务线', '品类分类', '第一季度 (Q1)', '第二季度 (Q2)', '第三季度 (Q3)', '第四季度 (Q4)', '年度总营收', '增长率 (YoY)', '达成状态',
    'OmniView IDE 商业授权', '企业开发套件', '2850000', '3200000', '3650000', '4120000', '13820000', '38.5%', '超额达成',
    'CodeGraph 智能索引服务', '企业AI服务', '1540000', '1920000', '2280000', '2700000', '8440000', '45.2%', '超额达成',
    'DiagramStudio 协同画布', '可视化套件', '980000', '1150000', '1320000', '1580000', '5030000', '26.8%', '顺利达成',
    'Office 三剑客解析组件', '离线组件库', '650000', '880000', '1050000', '1350000', '3930000', '52.1%', '超额达成',
    // Sheet 2 Strings
    '部门与支出项目', '负责人', '年度规划预算 (¥)', '实际已执行支出 (¥)', '剩余可用预算 (¥)', '预算执行率', '风险预警',
    'AI 核心架构组', '赵工', '5000000', '3200000', '1800000', '64.0%', '正常',
    '前端体验与渲染组', '李工', '3500000', '2450000', '1050000', '70.0%', '正常',
    '云原生基础设施组', '王工', '4000000', '3100000', '900000', '77.5%', '关注',
    '质量工程与对抗测试组', '张工', '2000000', '1300000', '700000', '65.0%', '正常'
  ];

  const sstXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${strings.length}" uniqueCount="${strings.length}">
  ${strings.map(s => `<si><t>${s}</t></si>`).join('\n  ')}
</sst>`;
  zip.file('xl/sharedStrings.xml', sstXml);

  // Sheet 1 XML
  const sheet1Xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <dimension ref="A1:I5"/>
  <sheetData>
    <row r="1">
      <c r="A1" t="s"><v>0</v></c>
      <c r="B1" t="s"><v>1</v></c>
      <c r="C1" t="s"><v>2</v></c>
      <c r="D1" t="s"><v>3</v></c>
      <c r="E1" t="s"><v>4</v></c>
      <c r="F1" t="s"><v>5</v></c>
      <c r="G1" t="s"><v>6</v></c>
      <c r="H1" t="s"><v>7</v></c>
      <c r="I1" t="s"><v>8</v></c>
    </row>
    <row r="2">
      <c r="A2" t="s"><v>9</v></c>
      <c r="B2" t="s"><v>10</v></c>
      <c r="C2"><v>2850000</v></c>
      <c r="D2"><v>3200000</v></c>
      <c r="E2"><v>3650000</v></c>
      <c r="F2"><v>4120000</v></c>
      <c r="G2"><f>SUM(C2:F2)</f><v>13820000</v></c>
      <c r="H2" t="s"><v>16</v></c>
      <c r="I2" t="s"><v>17</v></c>
    </row>
    <row r="3">
      <c r="A3" t="s"><v>18</v></c>
      <c r="B3" t="s"><v>19</v></c>
      <c r="C3"><v>1540000</v></c>
      <c r="D3"><v>1920000</v></c>
      <c r="E3"><v>2280000</v></c>
      <c r="F3"><v>2700000</v></c>
      <c r="G3"><f>SUM(C3:F3)</f><v>8440000</v></c>
      <c r="H3" t="s"><v>25</v></c>
      <c r="I3" t="s"><v>26</v></c>
    </row>
    <row r="4">
      <c r="A4" t="s"><v>27</v></c>
      <c r="B4" t="s"><v>28</v></c>
      <c r="C4"><v>980000</v></c>
      <c r="D4"><v>1150000</v></c>
      <c r="E4"><v>1320000</v></c>
      <c r="F4"><v>1580000</v></c>
      <c r="G4"><f>SUM(C4:F4)</f><v>5030000</v></c>
      <c r="H4" t="s"><v>34</v></c>
      <c r="I4" t="s"><v>35</v></c>
    </row>
    <row r="5">
      <c r="A5" t="s"><v>36</v></c>
      <c r="B5" t="s"><v>37</v></c>
      <c r="C5"><v>650000</v></c>
      <c r="D5"><v>880000</v></c>
      <c r="E5"><v>1050000</v></c>
      <c r="F5"><v>1350000</v></c>
      <c r="G5"><f>SUM(C5:F5)</f><v>3930000</v></c>
      <c r="H5" t="s"><v>43</v></c>
      <c r="I5" t="s"><v>44</v></c>
    </row>
  </sheetData>
</worksheet>`;
  zip.file('xl/worksheets/sheet1.xml', sheet1Xml);

  // Sheet 2 XML
  const sheet2Xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <dimension ref="A1:G5"/>
  <sheetData>
    <row r="1">
      <c r="A1" t="s"><v>45</v></c>
      <c r="B1" t="s"><v>46</v></c>
      <c r="C1" t="s"><v>47</v></c>
      <c r="D1" t="s"><v>48</v></c>
      <c r="E1" t="s"><v>49</v></c>
      <c r="F1" t="s"><v>50</v></c>
      <c r="G1" t="s"><v>51</v></c>
    </row>
    <row r="2">
      <c r="A2" t="s"><v>52</v></c>
      <c r="B2" t="s"><v>53</v></c>
      <c r="C2"><v>5000000</v></c>
      <c r="D2"><v>3200000</v></c>
      <c r="E2"><f>C2-D2</f><v>1800000</v></c>
      <c r="F2" t="s"><v>57</v></c>
      <c r="G2" t="s"><v>58</v></c>
    </row>
    <row r="3">
      <c r="A3" t="s"><v>59</v></c>
      <c r="B3" t="s"><v>60</v></c>
      <c r="C3"><v>3500000</v></c>
      <c r="D3"><v>2450000</v></c>
      <c r="E3"><f>C3-D3</f><v>1050000</v></c>
      <c r="F3" t="s"><v>64</v></c>
      <c r="G3" t="s"><v>65</v></c>
    </row>
    <row r="4">
      <c r="A4" t="s"><v>66</v></c>
      <c r="B4" t="s"><v>67</v></c>
      <c r="C4"><v>4000000</v></c>
      <c r="D4"><v>3100000</v></c>
      <c r="E4"><f>C4-D4</f><v>900000</v></c>
      <c r="F4" t="s"><v>71</v></c>
      <c r="G4" t="s"><v>72</v></c>
    </row>
    <row r="5">
      <c r="A5" t="s"><v>73</v></c>
      <c r="B5" t="s"><v>74</v></c>
      <c r="C5"><v>2000000</v></c>
      <c r="D5"><v>1300000</v></c>
      <c r="E5"><f>C5-D5</f><v>700000</v></c>
      <c r="F5" t="s"><v>78</v></c>
      <c r="G5" t="s"><v>79</v></c>
    </row>
  </sheetData>
</worksheet>`;
  zip.file('xl/worksheets/sheet2.xml', sheet2Xml);

  return zip;
}
