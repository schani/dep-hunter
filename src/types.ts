export interface ProjectDependencies {
  direct: string[];
  dev: string[];
  path: string;
}

export interface ImportCount {
  [dependency: string]: number;
}

export interface DependencyNode {
  name: string;
  version: string;
  dependencies: string[];
  size: number;
  path: string;
}

export interface DependencyGraph {
  nodes: Map<string, DependencyNode>;
  edges: Map<string, Set<string>>;
  reverseEdges: Map<string, Set<string>>;
}

export interface DependencySize {
  direct: number;
  exclusive: number;
  total: number;
  exclusiveDeps: string[];
}

export interface AnalysisResult {
  name: string;
  usage: number;
  directSize: number;
  totalSize: number;
  exclusiveDeps: number;
}

export interface ISizeCalculator {
  getPackageSize(packagePath: string, name: string, version: string): number | Promise<number>;
}