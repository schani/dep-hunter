#!/usr/bin/env node

import { Command } from 'commander';
import * as path from 'path';
import * as fs from 'fs';
import chalk from 'chalk';
import { discoverDependencies } from './dependency-discovery';
import { countImports } from './import-parser';
import { buildDependencyGraph } from './dependency-graph';
import { calculateDependencySizes } from './size-calculator';
import { formatResults } from './formatter';
import { AnalysisResult } from './types';

const program = new Command();

program
  .name('dep-hunter')
  .description('Analyze dependency usage in Node.js projects')
  .version('1.0.0')
  .argument('<path>', 'Path to the Node.js project to analyze')
  .option('--include-dev', 'Include devDependencies in the analysis')
  .option('--json', 'Output results as JSON')
  .action(async (targetPath: string, options: { includeDev?: boolean; json?: boolean }) => {
    try {
      const resolvedPath = path.resolve(targetPath);
      
      if (!fs.existsSync(resolvedPath)) {
        console.error(chalk.red(`Error: Path ${resolvedPath} does not exist`));
        process.exit(1);
      }
      
      console.log(chalk.blue(`\nAnalyzing dependencies in ${resolvedPath}...\n`));
      
      const dependencies = discoverDependencies(resolvedPath);
      
      if (dependencies.direct.length === 0) {
        console.log(chalk.yellow('No dependencies found in package.json'));
        process.exit(0);
      }
      
      console.log(chalk.gray(`Found ${dependencies.direct.length} direct dependencies`));
      
      const depsToAnalyze = options.includeDev 
        ? [...dependencies.direct, ...dependencies.dev]
        : dependencies.direct;
      
      console.log(chalk.gray('Counting imports...'));
      const importCounts = await countImports(resolvedPath, depsToAnalyze);
      
      console.log(chalk.gray('Building dependency graph...'));
      const graph = buildDependencyGraph(resolvedPath, depsToAnalyze);
      
      console.log(chalk.gray('Calculating sizes...'));
      const sizes = calculateDependencySizes(graph, depsToAnalyze);
      
      const results: AnalysisResult[] = [];
      
      for (const dep of depsToAnalyze) {
        const size = sizes.get(dep);
        if (size) {
          results.push({
            name: dep,
            usage: importCounts[dep] || 0,
            directSize: size.direct,
            totalSize: size.total,
            exclusiveDeps: size.exclusiveDeps.length,
          });
        }
      }
      
      if (options.json) {
        console.log(JSON.stringify(results, null, 2));
      } else {
        formatResults(results);
      }
      
    } catch (error) {
      console.error(chalk.red('Error:'), error);
      process.exit(1);
    }
  });

program.parse();