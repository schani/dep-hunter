import * as fs from 'fs';
import * as path from 'path';
import { DependencyGraph, DependencySize } from './types';
import { getExclusiveDependencies } from './dependency-graph';

export function calculateDependencySizes(
  graph: DependencyGraph,
  directDeps: string[]
): Map<string, DependencySize> {
  const sizes = new Map<string, DependencySize>();
  
  for (const [name, node] of graph.nodes) {
    node.size = getDirectorySize(node.path);
  }
  
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

function getDirectorySize(dirPath: string): number {
  let totalSize = 0;
  
  try {
    const files = fs.readdirSync(dirPath);
    
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      
      try {
        const stats = fs.statSync(filePath);
        
        if (stats.isDirectory()) {
          totalSize += getDirectorySize(filePath);
        } else {
          totalSize += stats.size;
        }
      } catch (error) {
        continue;
      }
    }
  } catch (error) {
    console.error(`Error calculating size for ${dirPath}:`, error);
  }
  
  return totalSize;
}

export function formatSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(2)} ${units[unitIndex]}`;
}