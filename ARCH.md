# dep-hunter Architecture

## Overview

dep-hunter is a CLI tool that analyzes Node.js project dependencies to identify underutilized packages and calculate the actual disk space that would be freed by removing them. The tool uses a modular architecture with swappable size calculation strategies and persistent caching.

## Core Components

### 1. CLI Entry Point (`src/index.ts`)
- **Purpose**: Command-line interface and orchestration
- **Responsibilities**:
  - Parse command-line arguments using Commander.js
  - Orchestrate the analysis pipeline
  - Handle errors and coordinate output
- **Key Options**:
  - `--bundlephobia`: Use bundlephobia API for size calculation
  - `--include-dev`: Include devDependencies in analysis
  - `--json`: Output results as JSON

### 2. Dependency Discovery (`src/dependency-discovery.ts`)
- **Purpose**: Extract dependencies from package.json
- **Interface**: 
  ```typescript
  interface ProjectDependencies {
    direct: string[];
    dev: string[];
    path: string;
  }
  ```
- **Functionality**: Reads package.json and returns lists of direct and dev dependencies

### 3. Import Parser (`src/import-parser.ts`)
- **Purpose**: Count usage of each dependency in source code
- **Strategy**: Regex-based pattern matching
- **Patterns Detected**:
  - ES6 imports: `import ... from 'package'`
  - CommonJS requires: `require('package')`
  - Dynamic imports: `import('package')`
- **File Types**: `.js`, `.jsx`, `.ts`, `.tsx`
- **Output**: Map of dependency names to usage counts

### 4. Dependency Graph Builder (`src/dependency-graph.ts`)
- **Purpose**: Build complete dependency tree with transitive dependencies
- **Data Structure**:
  ```typescript
  interface DependencyGraph {
    nodes: Map<string, DependencyNode>;
    edges: Map<string, Set<string>>;
    reverseEdges: Map<string, Set<string>>;
  }
  ```
- **Key Algorithm**: Identifies "exclusive" dependencies
  - Exclusive deps = dependencies only used by one parent
  - These are safe to remove when parent is removed
- **Graph Traversal**: BFS through node_modules to build complete tree

### 5. Size Calculator Interface (`src/types.ts`)
- **Purpose**: Define contract for size calculation strategies
- **Interface**:
  ```typescript
  interface ISizeCalculator {
    getPackageSize(packagePath: string, name: string, version: string): number | Promise<number>;
  }
  ```
- **Design Principle**: Single responsibility - calculate size of ONE package

### 6. Size Calculator Implementations

#### 6.1 Filesystem Calculator (`src/size-calculator.ts`)
- **Strategy**: Recursive directory size calculation
- **Pros**: Fast, works offline, no rate limits
- **Cons**: Includes dev files, doesn't account for bundling
- **Use Case**: Quick local analysis

#### 6.2 Bundlephobia Calculator (`src/bundlephobia-size-calculator.ts`)
- **Strategy**: Query bundlephobia.com API for production bundle sizes
- **Features**:
  - Returns gzipped size (realistic network transfer size)
  - Accounts for tree-shaking and bundling optimizations
  - SQLite database caching
  - Request deduplication
  - Rate limiting (1 request/second)
- **Pros**: Accurate production sizes
- **Cons**: Slower, requires internet, rate limited
- **Use Case**: Accurate bundle impact analysis

### 7. Database Layer (`src/database.ts`)
- **Purpose**: Persistent caching of bundlephobia API responses
- **Technology**: SQLite3
- **Location**: `~/.dep-hunter/cache.db`
- **Schema**:
  ```sql
  CREATE TABLE bundlephobia_cache (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    version TEXT NOT NULL,
    gzip INTEGER,
    size INTEGER,
    dependency_count INTEGER,
    has_js_module BOOLEAN,
    has_js_next BOOLEAN,
    has_side_effects BOOLEAN,
    response TEXT NOT NULL,
    fetched_at INTEGER NOT NULL,
    UNIQUE(name, version)
  );
  ```
- **Benefits**:
  - Avoid repeated API calls
  - Speed up subsequent analyses
  - Store full response for future features

### 8. Dependency Analyzer (`src/dependency-analyzer.ts`)
- **Purpose**: Orchestrate size calculation across entire dependency graph
- **Responsibilities**:
  - Iterate through all nodes in graph
  - Call size calculator for each package
  - Calculate exclusive dependencies
  - Aggregate total removable sizes
- **Key Function**:
  ```typescript
  calculateDependencySizes(
    graph: DependencyGraph,
    directDeps: string[],
    sizeCalculator: ISizeCalculator
  ): Promise<Map<string, DependencySize>>
  ```

### 9. Output Formatter (`src/formatter.ts`)
- **Purpose**: Format and display analysis results
- **Features**:
  - Color-coded output using chalk
  - Sorted by usage (least used first)
  - Human-readable size formatting
  - Highlights removal candidates
- **Output Sections**:
  1. Table with all dependencies
  2. Top removal candidates
  3. Total unused dependency size

## Data Flow

```
1. CLI Input
     ↓
2. Dependency Discovery (package.json)
     ↓
3. Import Parsing (source files) ──┐
     ↓                              │
4. Graph Building (node_modules) ←─┘
     ↓
5. Size Calculation (via ISizeCalculator)
     ↓
6. Dependency Analysis (aggregation)
     ↓
7. Output Formatting
     ↓
8. Display Results
```

## Key Design Patterns

### 1. Strategy Pattern
- **Where**: Size calculators
- **Why**: Swap between filesystem and bundlephobia strategies
- **Benefit**: Easy to add new size calculation methods

### 2. Dependency Injection
- **Where**: `calculateDependencySizes` accepts ISizeCalculator
- **Why**: Decouple analysis logic from size calculation
- **Benefit**: Testable, flexible, follows SOLID principles

### 3. Request Deduplication
- **Where**: Bundlephobia calculator
- **How**: Map of in-flight requests by package key
- **Benefit**: Prevents duplicate concurrent API calls

### 4. Queue Pattern
- **Where**: Bundlephobia API requests
- **Why**: Respect rate limits
- **How**: Chain promises with minimum interval

## Performance Optimizations

1. **Caching**:
   - SQLite database for bundlephobia responses
   - In-memory cache during execution

2. **Concurrent Processing**:
   - Parallel file reading for import parsing
   - Controlled concurrency for API requests

3. **Request Deduplication**:
   - Share promises for identical concurrent requests
   - Prevent unnecessary API calls

## File Structure

```
dep-hunter/
├── src/
│   ├── index.ts                    # CLI entry point
│   ├── types.ts                    # TypeScript interfaces
│   ├── dependency-discovery.ts     # Package.json parser
│   ├── import-parser.ts           # Import statement counter
│   ├── dependency-graph.ts        # Graph builder & algorithms
│   ├── dependency-analyzer.ts     # Size aggregation orchestrator
│   ├── size-calculator.ts         # Filesystem size implementation
│   ├── bundlephobia-size-calculator.ts # API size implementation
│   ├── database.ts                # SQLite persistence layer
│   └── formatter.ts               # Output formatting
├── dist/                          # Compiled JavaScript
├── ~/.dep-hunter/                 # User data directory
│   └── cache.db                  # SQLite cache database
├── package.json
├── tsconfig.json
├── SPEC.md                       # Original specification
├── ARCH.md                       # This file
└── README.md                     # User documentation
```

## Future Enhancements

1. **AST-based Parsing**: Replace regex with proper AST parsing for more accurate import detection
2. **Alternative Size Sources**: npm registry, package-size, webpack-bundle-analyzer
3. **Cache Invalidation**: Time-based or version-based cache expiry
4. **Parallel Graph Building**: Speed up node_modules traversal
5. **Plugin System**: Allow custom analyzers and formatters
6. **Web UI**: Interactive visualization of dependency graph
7. **CI Integration**: GitHub Actions, warning thresholds
8. **Monorepo Support**: Handle workspaces and lerna projects

## Design Decisions

### Why Separate Interface for Size Calculation?
The `ISizeCalculator` interface has a single method for calculating one package size, not the entire graph. This separation:
- Keeps the interface simple and focused
- Makes implementations easier to test
- Allows the graph logic to be reused with any calculator
- Follows the Single Responsibility Principle

### Why SQLite for Caching?
- Persistent across sessions
- No need for external services
- Structured data with indexing
- Can store full API responses for future analysis
- Easy to query and analyze cached data

### Why Request Deduplication?
When analyzing large projects, the same sub-dependencies appear multiple times in the graph. Without deduplication:
- Multiple concurrent requests for the same package
- Unnecessary API calls and rate limit hits
- Slower analysis

With deduplication, concurrent requests for the same package share a single Promise, ensuring only one API call per unique package.