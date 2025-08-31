import { DependencyGraph, DependencySize, ISizeCalculator } from './types';
import { getExclusiveDependencies } from './dependency-graph';

export async function calculateDependencySizes(
  graph: DependencyGraph,
  directDeps: string[],
  sizeCalculator: ISizeCalculator
): Promise<Map<string, DependencySize>> {
  const sizes = new Map<string, DependencySize>();
  
  // First, calculate size for all nodes
  for (const [name, node] of graph.nodes) {
    node.size = await sizeCalculator.getPackageSize(node.path, node.name, node.version);
  }
  
  // Then calculate exclusive dependencies
  for (const dep of directDeps) {
    const node = graph.nodes.get(dep);
    if (!node) continue;
    
    const exclusiveDeps = getExclusiveDependencies(dep, graph, directDeps);
    let exclusiveSize = 0;
    const exclusiveDepsList: string[] = [];
    
    for (const exclusiveDep of exclusiveDeps) {
      const exclusiveNode = graph.nodes.get(exclusiveDep);
      if (exclusiveNode) {
        exclusiveSize += exclusiveNode.size;
        exclusiveDepsList.push(exclusiveDep);
      }
    }
    
    sizes.set(dep, {
      direct: node.size,
      exclusive: exclusiveSize,
      total: node.size + exclusiveSize,
      exclusiveDeps: exclusiveDepsList,
    });
  }
  
  return sizes;
}