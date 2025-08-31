import { IImportParser } from './types';

export class RegexImportParser implements IImportParser {
  private readonly patterns = [
    // ES6 imports: import x from 'y', import 'y', import {x} from 'y'
    /import\s+(?:[\w{},\s*]+\s+from\s+)?['"]([^'"]+)['"]/g,
    // CommonJS requires: require('y')
    /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    // Dynamic imports: import('y')
    /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];

  parseImports(content: string): string[] {
    const imports = new Set<string>();
    
    for (const pattern of this.patterns) {
      let match;
      pattern.lastIndex = 0; // Reset regex state
      
      while ((match = pattern.exec(content)) !== null) {
        if (match[1]) {
          imports.add(match[1]);
        }
      }
    }
    
    return Array.from(imports);
  }

  extractDependencyName(importPath: string): string | null {
    // Ignore relative imports
    if (importPath.startsWith('.') || importPath.startsWith('/')) {
      return null;
    }
    
    // Handle scoped packages (@scope/package)
    if (importPath.startsWith('@')) {
      const parts = importPath.split('/');
      // Need at least @scope/package
      return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : null;
    }
    
    // Regular packages - take everything before first slash
    // lodash/shuffle -> lodash
    // express -> express
    return importPath.split('/')[0];
  }
}