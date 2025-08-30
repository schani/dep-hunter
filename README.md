# dep-hunter

A CLI tool to analyze dependency usage in Node.js projects and identify candidates for removal based on usage frequency and potential space savings.

## Installation

```bash
npm install -g .
```

Or run directly:

```bash
npm run build
node dist/index.js <path-to-project>
```

## Usage

```bash
dep-hunter /path/to/node/project
```

### Options

- `--include-dev` - Include devDependencies in the analysis
- `--json` - Output results as JSON
- `--help` - Show help
- `--version` - Show version

## Example

```bash
dep-hunter ../my-app

# With dev dependencies
dep-hunter ../my-app --include-dev

# JSON output
dep-hunter ../my-app --json > analysis.json
```

## Features

- Analyzes direct dependencies from package.json
- Counts import statements for each dependency
- Builds a complete dependency graph with transitive dependencies
- Calculates actual removable size (including exclusive transitive dependencies)
- Identifies least-used packages that would save the most space
- Color-coded output for easy reading

## How it Works

1. **Discovery**: Reads package.json to find direct dependencies
2. **Usage Analysis**: Scans all JS/TS files to count imports
3. **Graph Building**: Recursively explores node_modules to build dependency graph
4. **Size Calculation**: Determines which transitive dependencies are exclusive
5. **Reporting**: Shows usage counts and potential space savings

The tool identifies "exclusive" dependencies - those that would be removed if you uninstall a direct dependency because no other packages depend on them.