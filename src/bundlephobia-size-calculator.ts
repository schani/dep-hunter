import { DependencyGraph, DependencySize, ISizeCalculator } from './types';
import { getExclusiveDependencies } from './dependency-graph';

interface BundlephobiaResponse {
  gzip: number;
  size: number;
  dependencyCount: number;
  hasJSModule: boolean;
  hasJSNext: boolean;
  hasSideEffects: boolean;
  name: string;
  version: string;
  dependencySizes: Array<{
    name: string;
    approximateSize: number;
  }>;
}

export class BundlephobiaSizeCalculator implements ISizeCalculator {
  private cache = new Map<string, number>();

  async calculateDependencySizes(
    graph: DependencyGraph,
    directDeps: string[]
  ): Promise<Map<string, DependencySize>> {
    const sizes = new Map<string, DependencySize>();
    
    // First, fetch sizes for all nodes in parallel batches
    console.log('Fetching package sizes from bundlephobia...');
    const nodesToFetch = Array.from(graph.nodes.values());
    
    // Process in batches to avoid rate limiting
    const batchSize = 3;
    for (let i = 0; i < nodesToFetch.length; i += batchSize) {
      const batch = nodesToFetch.slice(i, i + batchSize);
      await Promise.all(
        batch.map(async (node) => {
          const size = await this.getPackageSize(node.name, node.version);
          node.size = size;
          this.cache.set(`${node.name}@${node.version}`, size);
        })
      );
      
      // Longer delay between batches to avoid rate limiting
      if (i + batchSize < nodesToFetch.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    // Now calculate exclusive dependencies like before
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

  private async getPackageSize(name: string, version: string): Promise<number> {
    const cacheKey = `${name}@${version}`;
    
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }
    
    try {
      const url = `https://bundlephobia.com/api/size?package=${encodeURIComponent(name)}@${encodeURIComponent(version)}&record=true`;
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'dep-hunter CLI tool',
          'Accept': 'application/json',
        },
      });
      
      if (!response.ok) {
        console.warn(`Failed to fetch size for ${name}@${version}: ${response.status}`);
        return 0;
      }
      
      const data = await response.json() as BundlephobiaResponse;
      
      // Use gzip size as it's more realistic for network transfer
      const size = data.gzip || data.size || 0;
      this.cache.set(cacheKey, size);
      
      return size;
    } catch (error) {
      console.warn(`Error fetching size for ${name}@${version}:`, error);
      return 0;
    }
  }
}

export const bundlephobiaSizeCalculator = new BundlephobiaSizeCalculator();