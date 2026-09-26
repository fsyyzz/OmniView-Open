/**
 * Kubernetes 复合资源清单解析与拓扑引力模型 (K8s Manifest Parser)
 * 依赖 js-yaml loadAll，自动切分多文档，建立 4 层云原生资源拓扑与跨资源依赖连线
 */
import { loadAll as loadAllYaml } from 'js-yaml';
import type { CloudNativeDiagnostic } from '../../../../shared/types';

export type K8sCategory = 'workload' | 'network' | 'config' | 'storage' | 'rbac' | 'other';

export interface K8sResourceItem {
  id: string;
  index: number;
  apiVersion: string;
  kind: string;
  name: string;
  namespace?: string;
  category: K8sCategory;
  labels: Record<string, string>;
  annotations: Record<string, string>;
  summary: string;
  rawDoc: Record<string, any>;
  containers?: Array<{
    name: string;
    image: string;
    ports?: number[];
    hasLimits?: boolean;
    hasProbes?: boolean;
  }>;
  replicas?: number;
}

export interface K8sTopologyNode {
  id: string;
  resourceId: string;
  kind: string;
  name: string;
  namespace?: string;
  category: K8sCategory;
  label: string;
  subtitle?: string;
  statusBadge?: string;
}

export interface K8sTopologyEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  relationType: 'route' | 'select' | 'mount' | 'ref';
}

export interface K8sParsedModel {
  resources: K8sResourceItem[];
  topology: {
    nodes: K8sTopologyNode[];
    edges: K8sTopologyEdge[];
  };
  categoriesCount: Record<K8sCategory, number>;
  diagnostics: CloudNativeDiagnostic[];
}

/** 资源类别判定 */
function categorizeKind(kind: string): K8sCategory {
  switch (kind) {
    case 'Deployment':
    case 'StatefulSet':
    case 'DaemonSet':
    case 'Pod':
    case 'Job':
    case 'CronJob':
    case 'ReplicaSet':
      return 'workload';
    case 'Service':
    case 'Ingress':
    case 'NetworkPolicy':
    case 'Gateway':
    case 'HTTPRoute':
      return 'network';
    case 'ConfigMap':
    case 'Secret':
      return 'config';
    case 'PersistentVolumeClaim':
    case 'PersistentVolume':
    case 'StorageClass':
      return 'storage';
    case 'ServiceAccount':
    case 'Role':
    case 'RoleBinding':
    case 'ClusterRole':
    case 'ClusterRoleBinding':
      return 'rbac';
    default:
      return 'other';
  }
}

/**
 * 标签匹配判定：selector 必须是 targetLabels 的子集
 */
function isSelectorMatched(selector: Record<string, string>, targetLabels: Record<string, string>): boolean {
  const selKeys = Object.keys(selector);
  if (selKeys.length === 0) return false;
  return selKeys.every((k) => targetLabels[k] === selector[k]);
}

/**
 * 解析 Kubernetes 多文档 YAML
 */
export function parseK8sManifest(content: string): K8sParsedModel {
  const diagnostics: CloudNativeDiagnostic[] = [];
  const rawDocs: Array<Record<string, any>> = [];

  try {
    loadAllYaml(content, (doc) => {
      if (doc && typeof doc === 'object') {
        rawDocs.push(doc as Record<string, any>);
      }
    });
  } catch (err) {
    diagnostics.push({
      level: 'error',
      message: `Kubernetes YAML 解析失败: ${err instanceof Error ? err.message : String(err)}`,
      ruleId: 'k8s/yaml-syntax',
    });
    return {
      resources: [],
      topology: { nodes: [], edges: [] },
      categoriesCount: { workload: 0, network: 0, config: 0, storage: 0, rbac: 0, other: 0 },
      diagnostics,
    };
  }

  const resources: K8sResourceItem[] = [];
  const categoriesCount: Record<K8sCategory, number> = {
    workload: 0,
    network: 0,
    config: 0,
    storage: 0,
    rbac: 0,
    other: 0,
  };

  // 1. 构建标准化资源列表
  rawDocs.forEach((doc, idx) => {
    const apiVersion = typeof doc.apiVersion === 'string' ? doc.apiVersion : 'v1';
    const kind = typeof doc.kind === 'string' ? doc.kind : 'Unknown';
    const metadata = doc.metadata || {};
    const name = typeof metadata.name === 'string' ? metadata.name : `unnamed-${idx + 1}`;
    const namespace = typeof metadata.namespace === 'string' ? metadata.namespace : undefined;
    const labels = metadata.labels && typeof metadata.labels === 'object' ? metadata.labels : {};
    const annotations = metadata.annotations && typeof metadata.annotations === 'object' ? metadata.annotations : {};
    const category = categorizeKind(kind);

    categoriesCount[category]++;

    // 提取容器与副本
    const containers: K8sResourceItem['containers'] = [];
    let replicas: number | undefined = undefined;

    const podSpec = doc.spec?.template?.spec || (kind === 'Pod' ? doc.spec : undefined);
    if (podSpec?.containers && Array.isArray(podSpec.containers)) {
      podSpec.containers.forEach((c: any) => {
        const ports = Array.isArray(c.ports) ? c.ports.map((p: any) => p.containerPort).filter(Boolean) : [];
        const hasLimits = Boolean(c.resources?.limits?.cpu || c.resources?.limits?.memory);
        const hasProbes = Boolean(c.livenessProbe || c.readinessProbe);
        containers.push({
          name: c.name || 'app',
          image: c.image || 'scratch',
          ports,
          hasLimits,
          hasProbes,
        });
      });
    }

    if (typeof doc.spec?.replicas === 'number') {
      replicas = doc.spec.replicas;
    }

    // 生成概要描述
    let summary = `${kind}: ${name}`;
    if (replicas !== undefined) summary += ` (${replicas} 副本)`;
    if (containers.length > 0) summary += ` · ${containers.map((c) => c.image).join(', ')}`;

    resources.push({
      id: `${kind.toLowerCase()}-${name}-${idx}`,
      index: idx,
      apiVersion,
      kind,
      name,
      namespace,
      category,
      labels,
      annotations,
      summary,
      rawDoc: doc,
      containers,
      replicas,
    });
  });

  // 2. 构造 4 层拓扑引力图 (Topology Nodes & Edges)
  const nodes: K8sTopologyNode[] = [];
  const edges: K8sTopologyEdge[] = [];
  const nodeMap = new Map<string, K8sTopologyNode>();

  resources.forEach((res) => {
    const node: K8sTopologyNode = {
      id: res.id,
      resourceId: res.id,
      kind: res.kind,
      name: res.name,
      namespace: res.namespace,
      category: res.category,
      label: `${res.kind} / ${res.name}`,
      subtitle: res.containers?.[0]?.image,
      statusBadge: res.replicas !== undefined ? `${res.replicas} 副本` : undefined,
    };
    nodes.push(node);
    nodeMap.set(res.name, node);
  });

  // 3. 计算跨资源依赖关联 (Edges)
  const ingresses = resources.filter((r) => r.kind === 'Ingress');
  const services = resources.filter((r) => r.kind === 'Service');
  const workloads = resources.filter((r) => r.category === 'workload');
  const configMaps = resources.filter((r) => r.kind === 'ConfigMap');
  const secrets = resources.filter((r) => r.kind === 'Secret');
  const pvcs = resources.filter((r) => r.kind === 'PersistentVolumeClaim');

  // A. Ingress -> Service
  ingresses.forEach((ing) => {
    const rules = ing.rawDoc.spec?.rules || [];
    rules.forEach((rule: any) => {
      const paths = rule.http?.paths || [];
      paths.forEach((p: any) => {
        const svcName = p.backend?.service?.name || p.backend?.serviceName;
        if (svcName) {
          const targetSvc = services.find((s) => s.name === svcName);
          if (targetSvc) {
            edges.push({
              id: `edge-${ing.id}-${targetSvc.id}`,
              source: ing.id,
              target: targetSvc.id,
              label: p.path || '/',
              relationType: 'route',
            });
          } else {
            diagnostics.push({
              level: 'warning',
              message: `Ingress [${ing.name}] 路由规则引用了文件中未定义的 Service [${svcName}]`,
              ruleId: 'k8s/missing-service-backend',
              suggestion: '请检查后端 Service 拼写或确认是否部署在相同命名空间。',
            });
          }
        }
      });
    });
  });

  // B. Service -> Workload / Pod
  services.forEach((svc) => {
    const selector = svc.rawDoc.spec?.selector;
    if (selector && typeof selector === 'object') {
      let matchedCount = 0;
      workloads.forEach((wl) => {
        const podLabels = wl.rawDoc.spec?.template?.metadata?.labels || wl.labels;
        if (isSelectorMatched(selector, podLabels)) {
          matchedCount++;
          const portStr = svc.rawDoc.spec?.ports?.[0]?.port ? `:${svc.rawDoc.spec.ports[0].port}` : '';
          edges.push({
            id: `edge-${svc.id}-${wl.id}`,
            source: svc.id,
            target: wl.id,
            label: `select${portStr}`,
            relationType: 'select',
          });
        }
      });

      if (matchedCount === 0 && workloads.length > 0) {
        diagnostics.push({
          level: 'info',
          message: `Service [${svc.name}] 的 selector 标签未在当前文件的任何 Workload/Pod 中匹配到实例`,
          ruleId: 'k8s/orphan-service-selector',
          suggestion: '请核对 spec.selector 与 Deployment/Pod 的 template.metadata.labels 是否完全对应。',
        });
      }
    }
  });

  // C. Workload -> ConfigMap / Secret / PVC
  workloads.forEach((wl) => {
    const podSpec = wl.rawDoc.spec?.template?.spec || (wl.kind === 'Pod' ? wl.rawDoc.spec : undefined);
    if (!podSpec) return;

    // 检查 envFrom
    const containers = podSpec.containers || [];
    containers.forEach((c: any) => {
      const envFromList = c.envFrom || [];
      envFromList.forEach((ef: any) => {
        if (ef.configMapRef?.name) {
          const cmName = ef.configMapRef.name;
          const targetCm = configMaps.find((cm) => cm.name === cmName);
          if (targetCm) {
            edges.push({
              id: `edge-${wl.id}-${targetCm.id}`,
              source: wl.id,
              target: targetCm.id,
              label: 'envFrom',
              relationType: 'ref',
            });
          }
        }
        if (ef.secretRef?.name) {
          const secName = ef.secretRef.name;
          const targetSec = secrets.find((s) => s.name === secName);
          if (targetSec) {
            edges.push({
              id: `edge-${wl.id}-${targetSec.id}`,
              source: wl.id,
              target: targetSec.id,
              label: 'secretRef',
              relationType: 'ref',
            });
          }
        }
      });

      // 诊断：缺少 resources limits
      if (c.image && (!c.resources?.limits?.cpu || !c.resources?.limits?.memory)) {
        diagnostics.push({
          level: 'info',
          message: `Workload [${wl.name}] 容器 [${c.name}] 未声明 resources.limits 资源上限`,
          ruleId: 'k8s/missing-resource-limits',
          suggestion: '在生产环境中建议为容器配置 CPU/内存 limits，防止单容器失控耗尽节点资源。',
        });
      }

      // 诊断：缺少健康探针
      if (c.image && !c.livenessProbe && !c.readinessProbe && wl.kind !== 'Job') {
        diagnostics.push({
          level: 'info',
          message: `Workload [${wl.name}] 容器 [${c.name}] 缺少 liveness/readiness 存活探针`,
          ruleId: 'k8s/missing-probes',
          suggestion: '配置探针可协助 Kubernetes 实现平滑滚动升级与自愈剔除异常 Pod。',
        });
      }
    });

    // 检查 volumes 挂载
    const vols = podSpec.volumes || [];
    vols.forEach((v: any) => {
      if (v.persistentVolumeClaim?.claimName) {
        const pvcName = v.persistentVolumeClaim.claimName;
        const targetPvc = pvcs.find((p) => p.name === pvcName);
        if (targetPvc) {
          edges.push({
            id: `edge-${wl.id}-${targetPvc.id}`,
            source: wl.id,
            target: targetPvc.id,
            label: 'mount',
            relationType: 'mount',
          });
        }
      }
      if (v.configMap?.name) {
        const cmName = v.configMap.name;
        const targetCm = configMaps.find((cm) => cm.name === cmName);
        if (targetCm) {
          edges.push({
            id: `edge-${wl.id}-${targetCm.id}`,
            source: wl.id,
            target: targetCm.id,
            label: 'volMap',
            relationType: 'mount',
          });
        }
      }
    });
  });

  return {
    resources,
    topology: { nodes, edges },
    categoriesCount,
    diagnostics,
  };
}
