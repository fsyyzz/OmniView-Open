/**
 * OmniView 拓扑节点邻接矩阵与拓扑排序分析器
 */
export class GraphTopologyAnalyzer {
  constructor() {
    this.adjacencyList = new Map();
  }

  addNode(node) {
    if (!this.adjacencyList.has(node)) {
      this.adjacencyList.set(node, new Set());
    }
  }

  addEdge(from, to) {
    this.addNode(from);
    this.addNode(to);
    this.adjacencyList.get(from).add(to);
  }

  topologicalSort() {
    const inDegree = new Map();
    for (const node of this.adjacencyList.keys()) {
      inDegree.set(node, 0);
    }
    for (const neighbors of this.adjacencyList.values()) {
      for (const neighbor of neighbors) {
        inDegree.set(neighbor, (inDegree.get(neighbor) || 0) + 1);
      }
    }

    const queue = [];
    for (const [node, degree] of inDegree.entries()) {
      if (degree === 0) queue.push(node);
    }

    const order = [];
    while (queue.length > 0) {
      const curr = queue.shift();
      order.push(curr);

      const neighbors = this.adjacencyList.get(curr) || [];
      for (const neighbor of neighbors) {
        inDegree.set(neighbor, inDegree.get(neighbor) - 1);
        if (inDegree.get(neighbor) === 0) {
          queue.push(neighbor);
        }
      }
    }

    if (order.length !== this.adjacencyList.size) {
      throw new Error('Graph contains cyclical dependencies');
    }
    return order;
  }
}
