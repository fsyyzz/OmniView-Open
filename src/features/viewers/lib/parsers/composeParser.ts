/**
 * Docker Compose 拓扑与微服务语义解析器 (Docker Compose Parser)
 * 依赖现有 js-yaml 库，构造微服务架构拓扑、网络边界、数据卷挂载与端口矩阵
 */
import { load as loadYaml } from 'js-yaml';
import type { CloudNativeDiagnostic } from '../../../../shared/types';

export interface ComposePortMapping {
  hostPort?: number;
  containerPort: number;
  protocol?: string;
  raw: string;
}

export interface ComposeVolumeMount {
  source: string;
  target: string;
  mode?: string;
  isNamedVolume: boolean;
  raw: string;
}

export interface ComposeService {
  id: string;
  name: string;
  image?: string;
  buildContext?: string;
  ports: ComposePortMapping[];
  volumes: ComposeVolumeMount[];
  networks: string[];
  dependsOn: string[];
  environment: Array<{ key: string; value: string; isSensitive: boolean }>;
  restart?: string;
  replicas?: number;
}

export interface ComposeParsedModel {
  version?: string;
  services: ComposeService[];
  networks: string[];
  volumes: string[];
  diagnostics: CloudNativeDiagnostic[];
}

/**
 * 敏感环境变量关键词匹配
 */
const SENSITIVE_KEY_REGEX = /(password|secret|key|token|auth|credential|cert|private|pass)/i;

/**
 * 敏感值脱敏打码
 */
export function maskSensitiveValue(value: string): string {
  if (!value) return '';
  if (value.length <= 4) return '••••';
  return value.slice(0, 2) + '••••' + value.slice(-2);
}

/**
 * 格式化端口映射字符串
 * 支持 "8080:80", "127.0.0.1:8080:80/tcp", 80 等
 */
function parsePortMapping(rawPort: unknown): ComposePortMapping | null {
  if (typeof rawPort === 'number') {
    return { containerPort: rawPort, raw: String(rawPort) };
  }
  if (typeof rawPort !== 'string') return null;

  const raw = rawPort.trim();
  const [portWithProto, proto] = raw.split('/');
  const parts = portWithProto.split(':');

  if (parts.length === 1) {
    const p = parseInt(parts[0], 10);
    return isNaN(p) ? null : { containerPort: p, protocol: proto, raw };
  } else if (parts.length === 2) {
    const hp = parseInt(parts[0], 10);
    const cp = parseInt(parts[1], 10);
    return isNaN(cp) ? null : { hostPort: isNaN(hp) ? undefined : hp, containerPort: cp, protocol: proto, raw };
  } else if (parts.length >= 3) {
    const hp = parseInt(parts[1], 10);
    const cp = parseInt(parts[2], 10);
    return isNaN(cp) ? null : { hostPort: isNaN(hp) ? undefined : hp, containerPort: cp, protocol: proto, raw };
  }
  return null;
}

/**
 * 格式化挂载卷字符串
 */
function parseVolumeMount(rawVol: unknown): ComposeVolumeMount | null {
  if (typeof rawVol !== 'string') return null;
  const raw = rawVol.trim();
  const parts = raw.split(':');
  if (parts.length === 1) {
    return { source: parts[0], target: parts[0], isNamedVolume: false, raw };
  }
  const source = parts[0];
  const target = parts[1];
  const mode = parts[2];
  // 命名卷通常不以 ./ 或 / 开头
  const isNamedVolume = !source.startsWith('.') && !source.startsWith('/') && !source.startsWith('~');
  return { source, target, mode, isNamedVolume, raw };
}

/**
 * 解析 Docker Compose 文件
 */
export function parseComposeFile(content: string): ComposeParsedModel {
  const diagnostics: CloudNativeDiagnostic[] = [];
  let rootData: Record<string, unknown> | null = null;

  try {
    rootData = loadYaml(content) as Record<string, unknown>;
  } catch (err) {
    diagnostics.push({
      level: 'error',
      message: `Compose YAML 语法解析失败: ${err instanceof Error ? err.message : String(err)}`,
      ruleId: 'compose/yaml-syntax',
    });
    return { services: [], networks: [], volumes: [], diagnostics };
  }

  if (!rootData || typeof rootData !== 'object') {
    return { services: [], networks: [], volumes: [], diagnostics };
  }

  const version = typeof rootData.version === 'string' ? rootData.version : undefined;
  const declaredNetworks = rootData.networks && typeof rootData.networks === 'object'
    ? Object.keys(rootData.networks)
    : [];
  const declaredVolumes = rootData.volumes && typeof rootData.volumes === 'object'
    ? Object.keys(rootData.volumes)
    : [];

  const rawServices = (rootData.services && typeof rootData.services === 'object' ? rootData.services : {}) as Record<string, any>;
  const services: ComposeService[] = [];
  const hostPortMap: Record<number, string[]> = {};

  for (const [serviceName, sDef] of Object.entries(rawServices)) {
    if (!sDef || typeof sDef !== 'object') continue;

    // 1. 端口提取
    const ports: ComposePortMapping[] = [];
    if (Array.isArray(sDef.ports)) {
      for (const p of sDef.ports) {
        const parsed = parsePortMapping(p);
        if (parsed) {
          ports.push(parsed);
          if (parsed.hostPort) {
            if (!hostPortMap[parsed.hostPort]) hostPortMap[parsed.hostPort] = [];
            hostPortMap[parsed.hostPort].push(serviceName);
          }
        }
      }
    }

    // 2. 挂载卷提取
    const volumes: ComposeVolumeMount[] = [];
    if (Array.isArray(sDef.volumes)) {
      for (const v of sDef.volumes) {
        const parsed = parseVolumeMount(v);
        if (parsed) volumes.push(parsed);
      }
    }

    // 3. 网络关联
    let networks: string[] = [];
    if (Array.isArray(sDef.networks)) {
      networks = sDef.networks.filter((n: unknown): n is string => typeof n === 'string');
    } else if (sDef.networks && typeof sDef.networks === 'object') {
      networks = Object.keys(sDef.networks);
    } else if (declaredNetworks.length > 0) {
      // 默认网络
      networks = ['default'];
    }

    // 4. 依赖分析 (depends_on)
    let dependsOn: string[] = [];
    if (Array.isArray(sDef.depends_on)) {
      dependsOn = sDef.depends_on.filter((d: unknown): d is string => typeof d === 'string');
    } else if (sDef.depends_on && typeof sDef.depends_on === 'object') {
      dependsOn = Object.keys(sDef.depends_on);
    }

    // 5. 环境变量提取与脱敏
    const environment: Array<{ key: string; value: string; isSensitive: boolean }> = [];
    if (Array.isArray(sDef.environment)) {
      for (const envItem of sDef.environment) {
        if (typeof envItem === 'string') {
          const [k, ...vParts] = envItem.split('=');
          const kClean = (k || '').trim();
          const valClean = vParts.join('=').trim();
          environment.push({
            key: kClean,
            value: valClean,
            isSensitive: SENSITIVE_KEY_REGEX.test(kClean),
          });
        }
      }
    } else if (sDef.environment && typeof sDef.environment === 'object') {
      for (const [k, v] of Object.entries(sDef.environment)) {
        environment.push({
          key: k,
          value: String(v ?? ''),
          isSensitive: SENSITIVE_KEY_REGEX.test(k),
        });
      }
    }

    // 6. 副本数
    let replicas: number | undefined = undefined;
    if (sDef.deploy?.replicas && typeof sDef.deploy.replicas === 'number') {
      replicas = sDef.deploy.replicas;
    }

    services.push({
      id: serviceName,
      name: serviceName,
      image: typeof sDef.image === 'string' ? sDef.image : undefined,
      buildContext: typeof sDef.build === 'string' ? sDef.build : sDef.build?.context,
      ports,
      volumes,
      networks,
      dependsOn,
      environment,
      restart: typeof sDef.restart === 'string' ? sDef.restart : undefined,
      replicas,
    });
  }

  // 7. 静态诊断规则
  checkComposeDiagnostics(services, declaredNetworks, declaredVolumes, hostPortMap, diagnostics);

  return {
    version,
    services,
    networks: Array.from(new Set([...declaredNetworks, ...services.flatMap((s) => s.networks)])),
    volumes: Array.from(new Set([...declaredVolumes, ...services.flatMap((s) => s.volumes.filter((v) => v.isNamedVolume).map((v) => v.source))])),
    diagnostics,
  };
}

/**
 * Docker Compose 静态问题诊断
 */
function checkComposeDiagnostics(
  services: ComposeService[],
  declaredNetworks: string[],
  declaredVolumes: string[],
  hostPortMap: Record<number, string[]>,
  diagnostics: CloudNativeDiagnostic[]
) {
  // 规则 1: 检查宿主机端口冲突
  for (const [port, svcList] of Object.entries(hostPortMap)) {
    if (svcList.length > 1) {
      diagnostics.push({
        level: 'error',
        message: `宿主端口 [${port}] 被多个服务重复占用映射: ${svcList.join(', ')}`,
        ruleId: 'compose/port-conflict',
        suggestion: '在同一宿主环境下，多个容器不能绑定同一个公网宿主端口，请为冲突服务分配不同的外部端口。',
      });
    }
  }

  // 规则 2: 检查服务引用了未在全局声明的命名卷
  for (const svc of services) {
    for (const vol of svc.volumes) {
      if (vol.isNamedVolume && !declaredVolumes.includes(vol.source)) {
        diagnostics.push({
          level: 'warning',
          message: `服务 [${svc.name}] 引用了未在顶层 volumes 节显式声明的命名卷 [${vol.source}]`,
          ruleId: 'compose/undeclared-volume',
          suggestion: '请在 Compose 文件根级 volumes: 列表中添加该命名数据卷声明，防止挂载初始化失败。',
        });
      }
    }
  }

  // 规则 3: 检查服务引用了未在全局声明的自定义网络 (排除 default)
  for (const svc of services) {
    for (const net of svc.networks) {
      if (net !== 'default' && declaredNetworks.length > 0 && !declaredNetworks.includes(net)) {
        diagnostics.push({
          level: 'warning',
          message: `服务 [${svc.name}] 加入了未在顶层 networks 节声明的网络 [${net}]`,
          ruleId: 'compose/undeclared-network',
          suggestion: '请在 Compose 文件顶层 networks: 列表中显式声明该网络。',
        });
      }
    }
  }

  // 规则 4: 检查无效的 depends_on 目标服务
  const allServiceNames = new Set(services.map((s) => s.name));
  for (const svc of services) {
    for (const dep of svc.dependsOn) {
      if (!allServiceNames.has(dep)) {
        diagnostics.push({
          level: 'error',
          message: `服务 [${svc.name}] 的 depends_on 依赖了当前文件中不存在的目标服务 [${dep}]`,
          ruleId: 'compose/missing-dependency',
          suggestion: '请检查服务拼写，或确认该依赖服务是否已在同一个 compose.yml 中定义。',
        });
      }
    }
  }
}
