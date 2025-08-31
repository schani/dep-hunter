import { ISizeCalculator } from './types';
import { database, BundlephobiaData } from './database';

interface BundlephobiaResponse {
  gzip: number;
  size: number;
  dependencyCount: number;
  name: string;
  version: string;
  hasJSModule?: boolean;
  hasJSNext?: boolean;
  hasSideEffects?: boolean;
}

export class BundlephobiaSizeCalculator implements ISizeCalculator {
  private initialized = false;
  private initPromise: Promise<void> | null = null;
  private inFlightRequests = new Map<string, Promise<number>>();
  private requestQueue: Promise<void> = Promise.resolve();
  private lastRequestTime = 0;
  private minRequestInterval = 1000; // 1 second between requests
  
  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return;
    
    if (!this.initPromise) {
      this.initPromise = database.init().then(() => {
        this.initialized = true;
      });
    }
    
    await this.initPromise;
  }

  async getPackageSize(packagePath: string, name: string, version: string): Promise<number> {
    await this.ensureInitialized();
    
    const cacheKey = `${name}@${version}`;
    
    // Check if we already have an in-flight request for this package
    if (this.inFlightRequests.has(cacheKey)) {
      return this.inFlightRequests.get(cacheKey)!;
    }
    
    // Create the promise for this request
    const sizePromise = this.fetchOrGetCached(name, version);
    
    // Store it as an in-flight request
    this.inFlightRequests.set(cacheKey, sizePromise);
    
    try {
      const size = await sizePromise;
      return size;
    } finally {
      // Remove from in-flight requests when done
      this.inFlightRequests.delete(cacheKey);
    }
  }
  
  private async fetchOrGetCached(name: string, version: string): Promise<number> {
    // Check database cache first
    const cached = await database.getBundlephobiaData(name, version);
    
    if (cached) {
      // Use cached data
      return cached.gzip || cached.size || 0;
    }
    
    // Not in cache, need to fetch from API
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
        
        // Save full response to database
        const bundlephobiaData: BundlephobiaData = {
          name: data.name || name,
          version: data.version || version,
          gzip: data.gzip || 0,
          size: data.size || 0,
          dependencyCount: data.dependencyCount || 0,
          hasJSModule: data.hasJSModule || false,
          hasJSNext: data.hasJSNext || false,
          hasSideEffects: data.hasSideEffects !== false, // Default to true if not specified
          response: JSON.stringify(data),
          fetchedAt: Date.now(),
        };
        
        await database.saveBundlephobiaData(bundlephobiaData);
        
        // Return gzip size as it's more realistic for network transfer
        return data.gzip || data.size || 0;
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