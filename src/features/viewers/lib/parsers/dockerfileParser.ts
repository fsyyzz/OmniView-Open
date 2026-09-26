/**
 * Dockerfile 语法与领域语义解析器 (Dockerfile AST & Stage Parser)
 * 纯前端高容错正则状态机，支持多阶段构建提取、跨阶段依赖分析与最佳实践体检
 */
import type { CloudNativeDiagnostic } from '../../../../shared/types';

export type DockerInstructionType =
  | 'FROM'
  | 'RUN'
  | 'CMD'
  | 'LABEL'
  | 'EXPOSE'
  | 'ENV'
  | 'ADD'
  | 'COPY'
  | 'ENTRYPOINT'
  | 'VOLUME'
  | 'USER'
  | 'WORKDIR'
  | 'ARG'
  | 'ONBUILD'
  | 'STOPSIGNAL'
  | 'HEALTHCHECK'
  | 'SHELL'
  | 'COMMENT'
  | 'UNKNOWN';

export interface DockerInstruction {
  line: number;
  raw: string;
  type: DockerInstructionType;
  args: string;
  category: 'base' | 'build' | 'config' | 'network' | 'runtime' | 'meta';
}

export interface DockerStage {
  id: string;
  name: string;
  baseImage: string;
  baseTag: string;
  startLine: number;
  endLine: number;
  instructions: DockerInstruction[];
  dependencies: string[]; // 依赖的前序 stage 名字 (来自 COPY --from=<stage>)
  isFinalStage: boolean;
}

export interface DockerfileParsedModel {
  stages: DockerStage[];
  allInstructions: DockerInstruction[];
  exposedPorts: number[];
  envVars: Array<{ key: string; value: string; line: number }>;
  diagnostics: CloudNativeDiagnostic[];
}

/** 指令类别归纳 */
function getInstructionCategory(type: DockerInstructionType): DockerInstruction['category'] {
  switch (type) {
    case 'FROM':
      return 'base';
    case 'RUN':
    case 'COPY':
    case 'ADD':
      return 'build';
    case 'ENV':
    case 'ARG':
    case 'WORKDIR':
    case 'USER':
    case 'SHELL':
      return 'config';
    case 'EXPOSE':
      return 'network';
    case 'CMD':
    case 'ENTRYPOINT':
    case 'HEALTHCHECK':
    case 'STOPSIGNAL':
      return 'runtime';
    default:
      return 'meta';
  }
}

/**
 * 解析单个 Dockerfile 内容
 */
export function parseDockerfile(content: string): DockerfileParsedModel {
  const lines = (content || '').split('\n');
  const instructions: DockerInstruction[] = [];
  const diagnostics: CloudNativeDiagnostic[] = [];
  const exposedPorts = new Set<number>();
  const envVars: Array<{ key: string; value: string; line: number }> = [];

  let accumulatedLine = '';
  let startLineNum = 1;

  // 1. 物理行到逻辑指令（合并反斜杠换行）
  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    if (!accumulatedLine) {
      startLineNum = i + 1;
    }

    if (trimmed.startsWith('#')) {
      // 注释行
      instructions.push({
        line: i + 1,
        raw: rawLine,
        type: 'COMMENT',
        args: trimmed.slice(1).trim(),
        category: 'meta',
      });
      continue;
    }

    if (!trimmed) continue;

    if (trimmed.endsWith('\\')) {
      accumulatedLine += trimmed.slice(0, -1).trim() + ' ';
      continue;
    } else {
      accumulatedLine += trimmed;
    }

    const firstSpace = accumulatedLine.indexOf(' ');
    const firstTab = accumulatedLine.indexOf('\t');
    let splitIdx = -1;
    if (firstSpace !== -1 && firstTab !== -1) {
      splitIdx = Math.min(firstSpace, firstTab);
    } else {
      splitIdx = firstSpace !== -1 ? firstSpace : firstTab;
    }

    const typeStr = (splitIdx === -1 ? accumulatedLine : accumulatedLine.slice(0, splitIdx)).toUpperCase();
    const argsStr = splitIdx === -1 ? '' : accumulatedLine.slice(splitIdx).trim();

    const validTypes: DockerInstructionType[] = [
      'FROM', 'RUN', 'CMD', 'LABEL', 'EXPOSE', 'ENV', 'ADD', 'COPY',
      'ENTRYPOINT', 'VOLUME', 'USER', 'WORKDIR', 'ARG', 'ONBUILD',
      'STOPSIGNAL', 'HEALTHCHECK', 'SHELL',
    ];

    const type: DockerInstructionType = validTypes.includes(typeStr as DockerInstructionType)
      ? (typeStr as DockerInstructionType)
      : 'UNKNOWN';

    instructions.push({
      line: startLineNum,
      raw: accumulatedLine,
      type,
      args: argsStr,
      category: getInstructionCategory(type),
    });

    // 收集端口
    if (type === 'EXPOSE') {
      const portParts = argsStr.split(/\s+/);
      portParts.forEach((p) => {
        const portNum = parseInt(p.split('/')[0], 10);
        if (!isNaN(portNum)) exposedPorts.add(portNum);
      });
    }

    // 收集环境变量
    if (type === 'ENV') {
      // ENV KEY=VAL or ENV KEY VAL
      const match = argsStr.match(/^([A-Za-z0-9_]+)[=\s](.*)$/);
      if (match) {
        envVars.push({ key: match[1], value: match[2]?.replace(/^['"]|['"]$/g, ''), line: startLineNum });
      }
    }

    accumulatedLine = '';
  }

  // 2. 切分与聚合阶段 (Multi-stage Builds)
  const stages: DockerStage[] = [];
  let currentStage: DockerStage | null = null;

  for (let i = 0; i < instructions.length; i++) {
    const inst = instructions[i];
    if (inst.type === 'FROM') {
      if (currentStage) {
        currentStage.endLine = inst.line - 1;
        stages.push(currentStage);
      }

      // FROM [--platform=xxx] <image>[:<tag>] [AS <name>]
      const fromArgs = inst.args;
      const asMatch = fromArgs.match(/\s+AS\s+([A-Za-z0-9_.-]+)/i);
      const stageName = asMatch ? asMatch[1] : `stage-${stages.length}`;
      
      const cleanArgs = fromArgs.replace(/--platform=\S+\s*/i, '').replace(/\s+AS\s+\S+/i, '').trim();
      const imageParts = cleanArgs.split(':');
      const baseImage = imageParts[0] || 'scratch';
      const baseTag = imageParts[1] || 'latest';

      currentStage = {
        id: `stage_${stages.length}`,
        name: stageName,
        baseImage,
        baseTag,
        startLine: inst.line,
        endLine: inst.line,
        instructions: [inst],
        dependencies: [],
        isFinalStage: false,
      };
    } else if (currentStage) {
      currentStage.instructions.push(inst);
      currentStage.endLine = inst.line;

      // 探测 COPY --from=<stage>
      if (inst.type === 'COPY') {
        const copyFromMatch = inst.args.match(/--from=([A-Za-z0-9_.-]+)/i);
        if (copyFromMatch) {
          const fromStage = copyFromMatch[1];
          if (!currentStage.dependencies.includes(fromStage)) {
            currentStage.dependencies.push(fromStage);
          }
        }
      }
    }
  }

  if (currentStage) {
    stages.push(currentStage);
  }

  if (stages.length > 0) {
    stages[stages.length - 1].isFinalStage = true;
  }

  // 3. 静态最佳实践体检规则 (Dockerfile Linter)
  checkDiagnostics(stages, instructions, diagnostics);

  return {
    stages,
    allInstructions: instructions,
    exposedPorts: Array.from(exposedPorts).sort((a, b) => a - b),
    envVars,
    diagnostics,
  };
}

/**
 * 最佳实践规则静态体检
 */
function checkDiagnostics(
  stages: DockerStage[],
  instructions: DockerInstruction[],
  diagnostics: CloudNativeDiagnostic[]
) {
  // 规则 1: 检查未锁定版本的 latest 标签
  for (const stage of stages) {
    if (stage.baseImage !== 'scratch' && (!stage.baseTag || stage.baseTag === 'latest')) {
      diagnostics.push({
        level: 'warning',
        message: `阶段 [${stage.name}] 使用了未锁定的镜像标签 [${stage.baseImage}:${stage.baseTag || 'latest'}]`,
        line: stage.startLine,
        ruleId: 'dockerfile/pinned-version',
        suggestion: '建议使用具体的 SemVer 版本号或 Digest SHA（如 node:20-alpine），防止基础镜像漂移造成构建不确定性。',
      });
    }
  }

  // 规则 2: 检查多个连续分散的 RUN 指令
  let consecutiveRuns = 0;
  let firstRunLine = 0;
  for (const inst of instructions) {
    if (inst.type === 'RUN') {
      consecutiveRuns++;
      if (consecutiveRuns === 1) firstRunLine = inst.line;
      if (consecutiveRuns >= 3) {
        diagnostics.push({
          level: 'info',
          message: `连续检测到 ${consecutiveRuns} 个独立的 RUN 指令，可能导致镜像层数过多`,
          line: firstRunLine,
          ruleId: 'dockerfile/squash-run',
          suggestion: '可使用 "&&" 和 "\\" 将多个相关命令合并到单条 RUN 指令中，并在同一层内清理包管理缓存以缩小镜像体积。',
        });
        consecutiveRuns = 0; // 避免重复报错
      }
    } else if (inst.type !== 'COMMENT') {
      consecutiveRuns = 0;
    }
  }

  // 规则 3: 检查最终生产镜像是否具有非 root USER 切换
  if (stages.length > 0) {
    const finalStage = stages[stages.length - 1];
    const hasUser = finalStage.instructions.some((inst) => inst.type === 'USER');
    if (!hasUser && finalStage.baseImage !== 'scratch') {
      diagnostics.push({
        level: 'warning',
        message: `终态生产阶段 [${finalStage.name}] 未声明 USER 切换指令，容器将默认以 root 身份运行`,
        line: finalStage.endLine,
        ruleId: 'dockerfile/non-root-user',
        suggestion: '建议通过 USER 指令切换为非特权用户（例如 nobody 或应用专用账号），遵循最小权限安全防御原则。',
      });
    }
  }

  // 规则 4: 检查是否配置健康检查 HEALTHCHECK
  const hasHealthcheck = instructions.some((inst) => inst.type === 'HEALTHCHECK');
  if (!hasHealthcheck && stages.length > 0) {
    diagnostics.push({
      level: 'info',
      message: 'Dockerfile 中未声明 HEALTHCHECK 容器健康检查指令',
      line: 1,
      ruleId: 'dockerfile/healthcheck-defined',
      suggestion: '建议添加 HEALTHCHECK 指令，以便编排系统（如 Docker Compose 或 Docker Swarm）感知容器存活状态。',
    });
  }
}
