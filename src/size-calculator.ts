import * as fs from 'fs';
import * as path from 'path';
import { ISizeCalculator } from './types';

export class FilesystemSizeCalculator implements ISizeCalculator {
  getPackageSize(packagePath: string, name: string, version: string): number {
    return this.getDirectorySize(packagePath);
  }

  private getDirectorySize(dirPath: string): number {
    let totalSize = 0;
    
    try {
      const files = fs.readdirSync(dirPath);
      
      for (const file of files) {
        const filePath = path.join(dirPath, file);
        
        try {
          const stats = fs.statSync(filePath);
          
          if (stats.isDirectory()) {
            totalSize += this.getDirectorySize(filePath);
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
}

export const defaultSizeCalculator = new FilesystemSizeCalculator();

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