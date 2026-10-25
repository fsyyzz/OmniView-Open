/**
 * OmniView 内置演示工作区文件聚合中心
 *
 * INITIAL_FILES 现基于 examples/ 目录中的真实文件动态生成，
 * 避免 4 个庞大内嵌样本文件的双份数据维护。
 */
import type { FileItem } from '../../types';
import { SUPPORTED_DRIVERS } from './driversMeta';

export { SUPPORTED_DRIVERS } from './driversMeta';
export { INITIAL_FILES } from './examplesLoader';

/** 聚合所有内置演示工作区文件（基于 examples/ 真实文件） */
export type { FileItem };
