# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Build and Run
```bash
npm run build         # Compile TypeScript to JavaScript (dist/)
npm run dev          # Run directly with ts-node for development
npm start            # Run compiled version from dist/
dep-hunter <path>    # Run CLI after global install
```

### Testing
```bash
npm test             # Run all tests (requires build first)
npm run test:watch   # Run tests in watch mode
```

**Note**: Tests run against compiled JavaScript in `dist/`, so run `npm run build` before testing.

## Architecture Overview

### Core Design Pattern: Strategy Pattern with Dependency Injection

The codebase uses a **modular strategy pattern** for size calculation, allowing different implementations (filesystem vs bundlephobia API) to be swapped at runtime:

```typescript
// Interface in src/types.ts
interface ISizeCalculator {
  getPackageSize(packagePath: string, name: string, version: string): number | Promise<number>;
}

// Implementations:
// - src/size-calculator.ts (filesystem)
// - src/bundlephobia-size-calculator.ts (API with SQLite caching)
```

### Dependency Graph Algorithm

The key innovation is **exclusive dependency detection** - identifying transitive dependencies that would be removed if a direct dependency is uninstalled:

1. **Graph Building** (`src/dependency-graph.ts`): Creates bidirectional edges (dependencies and reverse dependencies)
2. **Exclusive Detection**: A dependency is "exclusive" if it has only one parent in the reverse edges map
3. **Size Aggregation**: Total removable size = direct size + all exclusive transitive dependency sizes

### Import Parsing Architecture

Uses a **modular parser interface** (`IImportParser`) with regex-based implementation:

```typescript
// src/import-parser.ts orchestrates parsing
// src/regex-import-parser.ts provides the actual regex patterns
```

The parser detects ES6 imports, CommonJS requires, and dynamic imports across `.js`, `.jsx`, `.ts`, `.tsx` files.

### Caching Strategy

When using `--bundlephobia` flag, API responses are cached in SQLite:
- Location: `~/.dep-hunter/cache.db`
- Deduplication: In-flight requests share the same Promise
- Rate limiting: 1 request/second to respect API limits

### Data Flow Pipeline

```
CLI (index.ts) → Dependency Discovery → Import Parsing → Graph Building → Size Calculation → Analysis → Formatting
```

Each module has a single responsibility and clear interface, making the pipeline easy to extend or modify.

## Key Implementation Details

### Request Deduplication Pattern
In `src/bundlephobia-size-calculator.ts`, concurrent requests for the same package share a single Promise to prevent duplicate API calls:

```typescript
private pendingRequests = new Map<string, Promise<any>>();
```

### Graph Traversal for Exclusive Dependencies
The graph uses both `edges` and `reverseEdges` maps to efficiently identify which dependencies are only used by one parent, making them safe to remove.

### Testing Approach
Tests use Node.js native test runner (no external framework). Test files follow `*.test.ts` pattern and are compiled to `dist/` before running.

## Important Files

- **Entry Point**: `src/index.ts` - CLI orchestration
- **Core Algorithm**: `src/dependency-graph.ts` - Graph building and exclusive dependency detection
- **Size Strategies**: `src/size-calculator.ts` and `src/bundlephobia-size-calculator.ts`
- **Database Layer**: `src/database.ts` - SQLite caching for API responses
- **Types**: `src/types.ts` - All TypeScript interfaces