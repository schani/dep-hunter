import { ISizeCalculator } from './types';

interface BundlephobiaResponse {
  gzip: number;
  size: number;
  dependencyCount: number;
  name: string;
  version: string;
}

export class BundlephobiaSizeCalculator implements ISizeCalculator {
  private cache = new Map<string, number>();
  private requestQueue: Promise<void> = Promise.resolve();
  private lastRequestTime = 0;
  private minRequestInterval = 1000; // 1 second between requests

  async getPackageSize(packagePath: string, name: string, version: string): Promise<number> {
    const cacheKey = `${name}@${version}`;
    
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }
    
    // Queue requests to respect rate limits
    return this.queueRequest(async () => {
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
    });
  }

  private async queueRequest<T>(fn: () => Promise<T>): Promise<T> {
    // Chain this request after the previous one
    const currentRequest = this.requestQueue.then(async () => {
      // Ensure minimum interval between requests
      const now = Date.now();
      const timeSinceLastRequest = now - this.lastRequestTime;
      if (timeSinceLastRequest < this.minRequestInterval) {
        await new Promise(resolve => 
          setTimeout(resolve, this.minRequestInterval - timeSinceLastRequest)
        );
      }
      
      this.lastRequestTime = Date.now();
      return fn();
    });
    
    // Update the queue (but don't wait for errors to break the chain)
    this.requestQueue = currentRequest.then(() => {}, () => {});
    
    return currentRequest;
  }
}

export const bundlephobiaSizeCalculator = new BundlephobiaSizeCalculator();