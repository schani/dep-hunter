# dep-hunter Specification

## Overview
A CLI tool that analyzes Node.js project dependencies to identify underutilized packages and calculate the actual disk space that would be freed by removing them, including their exclusive transitive dependencies.

## Core Concepts

### Dependency Graph
- **Direct Dependencies**: Packages listed in the target project's package.json
- **Transitive Dependencies**: Dependencies of dependencies (recursively)
- **Shared Dependencies**: Packages used by multiple direct dependencies
- **Exclusive Dependencies**: Packages used only by a single direct dependency chain

### Usage Counting
Count how often each direct dependency is imported in the codebase using regex-based import detection.

### Size Calculation
Calculate the total size that would be freed by removing a dependency:
- Size of the direct dependency itself
- Size of all transitive dependencies that are ONLY used by this dependency
- Exclude shared dependencies that would remain due to other packages

## Architecture

### Modules

#### 1. CLI Module (`src/index.ts`)
- Parse command-line arguments using Commander
- Orchestrate the analysis pipeline
- Handle errors and display results

#### 2. Dependency Discovery (`src/dependency-discovery.ts`)
```typescript
interface ProjectDependencies {
  direct: string[];
  dev: string[];
  path: string;
}
```
- Read package.json from target project
- Extract direct dependencies (exclude devDependencies by default)

#### 3. Import Parser (`src/import-parser.ts`)
```typescript
interface ImportCount {
  [dependency: string]: number;
}
```
- Scan .js/.ts/.jsx/.tsx files
- Use modular regex patterns to detect imports
- Count usage per dependency

**Regex Patterns** (modular approach):
```javascript
// ES6 imports
/import\s+.*\s+from\s+['"]([^'"]+)['"]/g
/import\s+['"]([^'"]+)['"]/g

// CommonJS requires
/require\s*\(\s*['"]([^'"]+)['"]\s*\)/g

// Dynamic imports
/import\s*\(\s*['"]([^'"]+)['"]\s*\)/g
```

#### 4. Dependency Graph Builder (`src/dependency-graph.ts`)
```typescript
interface DependencyNode {
  name: string;
  version: string;
  dependencies: string[];
  size: number;
  path: string;
}

interface DependencyGraph {
  nodes: Map<string, DependencyNode>;
  edges: Map<string, Set<string>>;
  reverseEdges: Map<string, Set<string>>; // who depends on this
}
```
- Recursively read package.json files from node_modules
- Build bidirectional graph of dependencies
- Track which packages depend on which

#### 5. Size Calculator (`src/size-calculator.ts`)
```typescript
interface DependencySize {
  direct: number;        // Size of the package itself
  exclusive: number;     // Size of exclusive transitive deps
  total: number;         // direct + exclusive
  exclusiveDeps: string[]; // List of exclusive deps
}
```
- Calculate directory sizes recursively
- Identify exclusive dependencies using graph traversal
- Sum up total removable size

#### 6. Output Formatter (`src/formatter.ts`)
- Format results as a table
- Sort by usage count (ascending)
- Display size in human-readable format (KB/MB)

## Implementation Flow

1. **Parse Arguments**
   - Get target project path
   - Validate path exists and has package.json

2. **Discover Dependencies**
   - Read package.json
   - Get list of direct dependencies

3. **Count Usage**
   - Find all source files using fast-glob
   - Parse imports with regex
   - Map imports to dependencies
   - Count usage per dependency

4. **Build Dependency Graph**
   - Start with direct dependencies
   - Recursively read each dependency's package.json
   - Build graph structure with edges

5. **Calculate Sizes**
   - For each direct dependency:
     - Calculate its own size
     - Find all transitive dependencies
     - Identify which are exclusive (not used by other deps)
     - Sum up total removable size

6. **Display Results**
   - Sort by usage count
   - Show table with:
     - Dependency name
     - Usage count
     - Direct size
     - Total removable size
     - Number of exclusive dependencies

## Example Output

```
Analyzing dependencies in /path/to/project...

Found 15 direct dependencies
Scanned 142 source files

Dependency Usage Analysis:
┌─────────────────┬───────┬────────────┬───────────────┬──────────────┐
│ Package         │ Usage │ Direct Size│ Removable Size│ Exclusive    │
├─────────────────┼───────┼────────────┼───────────────┼──────────────┤
│ some-big-lib    │ 1     │ 2.3 MB     │ 5.8 MB        │ 12 deps      │
│ rarely-used     │ 2     │ 0.5 MB     │ 1.2 MB        │ 3 deps       │
│ another-package │ 3     │ 1.1 MB     │ 1.1 MB        │ 0 deps       │
│ ...             │ ...   │ ...        │ ...           │ ...          │
└─────────────────┴───────┴────────────┴───────────────┴──────────────┘

Least used packages that could save the most space:
1. some-big-lib: 1 import, could save 5.8 MB
2. rarely-used: 2 imports, could save 1.2 MB
```

## Future Enhancements (Post-MVP)

1. **AST-based parsing** instead of regex for more accurate import detection
2. **Caching** of dependency graph for faster subsequent runs
3. **Webpack/Rollup bundle analysis** integration
4. **Dev dependency analysis** option
5. **Export to JSON/CSV** for further analysis
6. **Ignore patterns** for test files, etc.
7. **Monorepo support** with workspace detection
8. **Tree-shaking estimation** for packages that support it