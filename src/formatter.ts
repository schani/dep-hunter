import chalk from 'chalk';
import { AnalysisResult } from './types';
import { formatSize } from './size-calculator';

export function formatResults(results: AnalysisResult[]): void {
  if (results.length === 0) {
    console.log(chalk.yellow('No dependencies found to analyze.'));
    return;
  }
  
  console.log('\n' + chalk.bold('Dependency Usage Analysis:'));
  console.log('─'.repeat(80));
  
  const sortedResults = [...results].sort((a, b) => a.usage - b.usage);
  
  const maxNameLength = Math.max(...results.map(r => r.name.length), 15);
  
  console.log(
    chalk.gray('Package').padEnd(maxNameLength + 2) +
    chalk.gray('Usage').padEnd(8) +
    chalk.gray('Direct Size').padEnd(14) +
    chalk.gray('Removable Size').padEnd(16) +
    chalk.gray('Exclusive Deps')
  );
  console.log('─'.repeat(80));
  
  for (const result of sortedResults) {
    const usageColor = result.usage === 0 ? chalk.red :
                       result.usage < 5 ? chalk.yellow :
                       chalk.green;
    
    const sizeColor = result.totalSize > 10485760 ? chalk.red :
                      result.totalSize > 1048576 ? chalk.yellow :
                      chalk.green;
    
    console.log(
      chalk.cyan(result.name.padEnd(maxNameLength + 2)) +
      usageColor(result.usage.toString().padEnd(8)) +
      formatSize(result.directSize).padEnd(14) +
      sizeColor(formatSize(result.totalSize).padEnd(16)) +
      chalk.gray(`${result.exclusiveDeps} deps`)
    );
  }
  
  console.log('─'.repeat(80));
  
  const topCandidates = sortedResults
    .filter(r => r.usage < 5)
    .sort((a, b) => b.totalSize - a.totalSize)
    .slice(0, 5);
  
  if (topCandidates.length > 0) {
    console.log('\n' + chalk.bold('Top removal candidates (least used, most space):'));
    
    topCandidates.forEach((result, index) => {
      console.log(
        chalk.yellow(`${index + 1}. `) +
        chalk.cyan(result.name) +
        ': ' +
        chalk.red(`${result.usage} imports`) +
        ', could save ' +
        chalk.green(formatSize(result.totalSize))
      );
    });
  }
  
  const totalPotentialSavings = sortedResults
    .filter(r => r.usage === 0)
    .reduce((sum, r) => sum + r.totalSize, 0);
  
  if (totalPotentialSavings > 0) {
    console.log(
      '\n' +
      chalk.bold('Unused dependencies: ') +
      chalk.red(formatSize(totalPotentialSavings)) +
      ' could be freed'
    );
  }
}