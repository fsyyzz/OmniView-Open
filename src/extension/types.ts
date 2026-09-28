export const SUPPORTED_EXTENSIONS = [
  '.md', '.markdown', '.okf', '.puml', '.plantuml', '.iuml', '.mmd', '.mermaid',
  '.dot', '.gv', '.svg', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.ico', '.avif', '.tiff',
  '.pdf', '.epub', '.docx', '.pptx', '.xlsx', '.xls', '.xlsm', '.xltx',
  '.csv', '.tsv', '.json', '.yaml', '.yml', '.xml', '.ts', '.tsx', '.js', '.jsx', '.txt',
  '.markmap', '.mm', '.mindmap', '.km', '.typ', '.typst', '.excalidraw', '.ipynb', '.dst', '.egn', '.domainstory',
  '.html', '.htm'
];

export const BINARY_EXTENSIONS = [
  '.pdf', '.epub', '.docx', '.pptx', '.xlsx', '.xls', '.xlsm', '.xltx',
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.ico', '.avif', '.tiff'
];

export function getMimeType(extension: string): string {
  const mimeMap: Record<string, string> = {
    '.pdf': 'application/pdf',
    '.epub': 'application/epub+zip',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.xls': 'application/vnd.ms-excel',
    '.xlsm': 'application/vnd.ms-excel.sheet.macroEnabled.12',
    '.xltx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.template',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.bmp': 'image/bmp',
    '.ico': 'image/x-icon',
    '.avif': 'image/avif',
    '.tiff': 'image/tiff',
  };
  return mimeMap[extension] || 'application/octet-stream';
}

export interface HostConfiguration {
  theme: string;
  density: string;
  fontSize: number;
  contentWidth: string;
  zoom: number;
  viewMode: string;
  splitRatio: number;
  splitRightMode: string;
  enableLazyBlockUnmount: boolean;
  scrollSync: boolean;
  wordWrap: boolean;
  showLineNumbers: boolean;
  enableDoubleClickEdit: boolean;
  outlineOpen: boolean;
  outlinePosition: string;
  outlineDisplayMode: string;
  plantUmlServerUrl: string;
  enableOkfRendering: boolean;
  locale: string;
}
