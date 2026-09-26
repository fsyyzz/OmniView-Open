/**
 * OmniView 内置演示样本与驱动元数据聚合中心
 */
import type { FileItem } from '../../types';
import { SUPPORTED_DRIVERS } from './driversMeta';
import { DIAGRAM_SAMPLES } from './diagramSamples';
import { DOCUMENT_SAMPLES } from './documentSamples';
import { DATA_SAMPLES } from './dataSamples';
import { CLOUD_NATIVE_SAMPLES } from './cloudNativeSamples';

export { SUPPORTED_DRIVERS } from './driversMeta';
export { DIAGRAM_SAMPLES } from './diagramSamples';
export { DOCUMENT_SAMPLES } from './documentSamples';
export { DATA_SAMPLES } from './dataSamples';
export { CLOUD_NATIVE_SAMPLES } from './cloudNativeSamples';

/**
 * 聚合所有内置演示工作区文件
 */
export const INITIAL_FILES: FileItem[] = [
  ...DIAGRAM_SAMPLES,
  ...DOCUMENT_SAMPLES,
  ...DATA_SAMPLES,
  ...CLOUD_NATIVE_SAMPLES,
];
