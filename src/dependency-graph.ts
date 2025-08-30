import * as fs from 'fs';
import * as path from 'path';
import { DependencyGraph, DependencyNode } from './types';

export function buildDependencyGraph(projectPath: string, directDeps: string[]): DependencyGraph {
  const graph: DependencyGraph = {
    nodes: new Map(),
    edges: new Map(),
    reverseEdges: new Map(),
  };
  
  const visited = new Set<string>();
  const nodeModulesPath = path.join(projectPath, 'node_modules');
  
  for (const dep of directDeps) {
    exploreDependency(dep, nodeModulesPath, graph, visited);
  }
  
  return graph;
}

function exploreDependency(
  depName: string,
  nodeModulesPath: string,
  graph: DependencyGraph,
  visited: Set<string>
): void {
  if (visited.has(depName)) {
    return;
  }
  visited.add(depName);
  
  const depPath = path.join(nodeModulesPath, depName);
  
  if (!fs.existsSync(depPath)) {
    return;
  }
  
  const packageJsonPath = path.join(depPath, 'package.json');
  
  if (!fs.existsSync(packageJsonPath)) {
    return;
  }
  
  try {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    const dependencies = Object.keys(packageJson.dependencies || {});
    
    const node: DependencyNode = {
      name: depName,
      version: packageJson.version || 'unknown',
      dependencies,
      size: 0,
      path: depPath,
    };
    
    graph.nodes.set(depName, node);
    
    if (!graph.edges.has(depName)) {
      graph.edges.set(depName, new Set());
    }
    
    for (const childDep of dependencies) {
      graph.edges.get(depName)!.add(childDep);
      
      if (!graph.reverseEdges.has(childDep)) {
        graph.reverseEdges.set(childDep, new Set());
      }
      graph.reverseEdges.get(childDep)!.add(depName);
      
      exploreDependency(childDep, nodeModulesPath, graph, visited);
    }
  } catch (error) {
    console.error(`Error processing ${depName}:`, error);
  }
}

export function getExclusiveDependencies(
  depName: string,
  graph: DependencyGraph,
  directDeps: string[]
): Set<string> {
  const exclusive = new Set<string>();
  const allTransitive = getAllTransitiveDependencies(depName, graph);
  
  for (const transitiveDep of allTransitive) {
    if (isExclusiveTo(transitiveDep, depName, graph, directDeps)) {
      exclusive.add(transitiveDep);
    }
  }
  
  return exclusive;
}

function getAllTransitiveDependencies(
  depName: string,
  graph: DependencyGraph
): Set<string> {
  const result = new Set<string>();
  const queue = [depName];
  const visited = new Set<string>();
  
  while (queue.length > 0) {
    const current = queue.shift()!;
    
    if (visited.has(current)) {
      continue;
    }
    visited.add(current);
    
    const edges = graph.edges.get(current);
    if (edges) {
      for (const child of edges) {
        result.add(child);
        queue.push(child);
      }
    }
  }
  
  return result;
}

function isExclusiveTo(
  dep: string,
  parentDep: string,
  graph: DependencyGraph,
  directDeps: string[]
): boolean {
  const reverseEdges = graph.reverseEdges.get(dep);
  
  if (!reverseEdges) {
    return false;
  }
  
  for (const parent of reverseEdges) {
    if (parent === parentDep) {
      continue;
    }
    
    if (directDeps.includes(parent)) {
      return false;
    }
    
    const parentTransitive = getAllTransitiveDependencies(parent, graph);
    if (!parentTransitive.has(parentDep)) {
      for (const directDep of directDeps) {
        if (directDep !== parentDep && parentTransitive.has(directDep)) {
          return false;
        }
      }
    }
  }
  
  return true;
}