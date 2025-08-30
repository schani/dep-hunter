import * as fs from 'fs';
import * as path from 'path';
import glob from 'fast-glob';
import { ImportCount } from './types';

const IMPORT_PATTERNS = [
  /import\s+(?:[\w{},\s*]+\s+from\s+)?['"]([^'"]+)['"]/g,
  /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
];

export async function countImports(projectPath: string, dependencies: string[]): Promise<ImportCount> {
  const sourcePatterns = ['**/*.{js,jsx,ts,tsx}'];
  const ignorePatterns = ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.git/**'];
  
  const files = await glob(sourcePatterns, {
    cwd: projectPath,
    absolute: true,
    ignore: ignorePatterns,
  });
  
  const importCount: ImportCount = {};
  dependencies.forEach(dep => importCount[dep] = 0);
  
  for (const file of files) {
    try {
      const content = fs.readFileSync(file, 'utf-8');
      
      for (const pattern of IMPORT_PATTERNS) {
        let match;
        pattern.lastIndex = 0;
        
        while ((match = pattern.exec(content)) !== null) {
          const importPath = match[1];
          const dependency = extractDependencyName(importPath);
          
          if (dependency && importCount.hasOwnProperty(dependency)) {
            importCount[dependency]++;
          }
        }
      }
    } catch (error) {
      console.error(`Error reading file ${file}:`, error);
    }
  }
  
  return importCount;
}

function extractDependencyName(importPath: string): string | null {
  if (importPath.startsWith('.') || importPath.startsWith('/')) {
    return null;
  }
  
  if (importPath.startsWith('@')) {
    const parts = importPath.split('/');
    return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : null;
  }
  
  return importPath.split('/')[0];
}