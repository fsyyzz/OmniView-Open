/**
 * OmniView 研发设计文档中心聚合导出
 */
import { SoftwareDoc } from '../../types';
import { PRD_DOC } from './prdDoc';
import { ARCHITECTURE_DOC } from './architectureDoc';
import { SCAFFOLD_DOC } from './scaffoldDoc';
import { SECURITY_DOC } from './securityDoc';
import { PERSISTENCE_DOC } from './persistenceDoc';

export { PRD_DOC } from './prdDoc';
export { ARCHITECTURE_DOC } from './architectureDoc';
export { SCAFFOLD_DOC } from './scaffoldDoc';
export { SECURITY_DOC } from './securityDoc';
export { PERSISTENCE_DOC } from './persistenceDoc';

/**
 * 研发文档中心完整文档矩阵清单
 */
export const PROJECT_DOCS: SoftwareDoc[] = [
  PRD_DOC,
  ARCHITECTURE_DOC,
  SCAFFOLD_DOC,
  SECURITY_DOC,
  PERSISTENCE_DOC,
];
