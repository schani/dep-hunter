import * as fs from 'fs';
import * as path from 'path';
import { ProjectDependencies } from './types';

export function discoverDependencies(projectPath: string): ProjectDependencies {
  const packageJsonPath = path.join(projectPath, 'package.json');
  
  if (!fs.existsSync(packageJsonPath)) {
    throw new Error(`No package.json found at ${packageJsonPath}`);
  }
  
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
  
  const direct = Object.keys(packageJson.dependencies || {});
  const dev = Object.keys(packageJson.devDependencies || {});
  
  return {
    direct,
    dev,
    path: projectPath
  };
}