/**
 * OmniView 驱动分发与后缀路由表
 */
import { FileItem, DriverId } from '../../../shared/types';

export function getDriverIdForFile(file: FileItem): DriverId {
  const extension = (file.extension || '').toLowerCase();
  if (['md', 'markdown', 'okf'].includes(extension)) return 'markdown';
  if (['mm', 'markmap', 'mindmap', 'km'].includes(extension)) return 'mindmap';
  if (['puml', 'plantuml', 'iuml'].includes(extension)) return 'plantuml';
  if (extension === 'svg') return 'svg';
  if (extension === 'pdf') return 'pdf';
  if (['csv', 'tsv'].includes(extension)) return 'csv';
  return 'code';
}
