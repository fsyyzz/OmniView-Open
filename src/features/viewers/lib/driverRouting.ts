/**
 * OmniView 驱动分发与后缀路由表（委托至统一驱动注册表 driverRegistry）
 */
export { getDriverIdForFile, resolveDriverPluginForFile, getAllDriverPlugins, getDriverPluginById } from './driverRegistry.ts';
export type { DriverPlugin, DriverProps } from './driverRegistry.ts';

