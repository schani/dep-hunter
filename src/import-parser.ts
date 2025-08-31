import * as fs from 'fs';
import glob from 'fast-glob';
import { ImportCount, IImportParser } from './types';
import { RegexImportParser } from './regex-import-parser';

export async function countImports(
  projectPath: string, 
  dependencies: string[],
  parser: IImportParser = new RegexImportParser()
): Promise<ImportCount> {
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
      const imports = parser.parseImports(content);
      
      for (const importPath of imports) {
        const dependency = parser.extractDependencyName(importPath);
        
        if (dependency && importCount.hasOwnProperty(dependency)) {
          importCount[dependency]++;
        }
      }
    } catch (error) {
      console.error(`Error reading file ${file}:`, error);
    }
  }
  
  return importCount;
}