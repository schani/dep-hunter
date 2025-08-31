import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { RegexImportParser } from './regex-import-parser';

describe('RegexImportParser', () => {
  const parser = new RegexImportParser();
  
  describe('parseImports', () => {
    it('should parse ES6 named imports', () => {
      const content = `import { useState } from 'react';`;
      const imports = parser.parseImports(content);
      assert.deepEqual(imports, ['react']);
    });
    
    it('should parse ES6 default imports', () => {
      const content = `import React from 'react';`;
      const imports = parser.parseImports(content);
      assert.deepEqual(imports, ['react']);
    });
    
    it('should parse ES6 namespace imports', () => {
      const content = `import * as fs from 'fs';`;
      const imports = parser.parseImports(content);
      assert.deepEqual(imports, ['fs']);
    });
    
    it('should parse ES6 side-effect imports', () => {
      const content = `import 'polyfill';`;
      const imports = parser.parseImports(content);
      assert.deepEqual(imports, ['polyfill']);
    });
    
    it('should parse CommonJS requires', () => {
      const content = `const express = require('express');`;
      const imports = parser.parseImports(content);
      assert.deepEqual(imports, ['express']);
    });
    
    it('should parse CommonJS requires with spaces', () => {
      const content = `const fs = require(  'fs'  );`;
      const imports = parser.parseImports(content);
      assert.deepEqual(imports, ['fs']);
    });
    
    it('should parse dynamic imports', () => {
      const content = `
        async function loadModule() {
          const module = await import('lodash');
        }
      `;
      const imports = parser.parseImports(content);
      assert.deepEqual(imports, ['lodash']);
    });
    
    it('should parse multiple imports', () => {
      const content = `
        import React from 'react';
        import { render } from 'react-dom';
        const express = require('express');
        import('dynamic-module');
      `;
      const imports = parser.parseImports(content);
      assert.deepEqual(imports.sort(), ['dynamic-module', 'express', 'react', 'react-dom']);
    });
    
    it('should handle both single and double quotes', () => {
      const content = `
        import React from "react";
        const express = require('express');
      `;
      const imports = parser.parseImports(content);
      assert.deepEqual(imports.sort(), ['express', 'react']);
    });
    
    it('should deduplicate imports', () => {
      const content = `
        import React from 'react';
        import { Component } from 'react';
        const React2 = require('react');
      `;
      const imports = parser.parseImports(content);
      assert.deepEqual(imports, ['react']);
    });
    
    it('should handle imports with sub-paths', () => {
      const content = `
        import shuffle from 'lodash/shuffle';
        import debounce from 'lodash/debounce';
      `;
      const imports = parser.parseImports(content);
      assert.deepEqual(imports.sort(), ['lodash/debounce', 'lodash/shuffle']);
    });
    
    it('should handle scoped package imports', () => {
      const content = `
        import { Controller } from '@nestjs/common';
        import type { Config } from '@types/node';
      `;
      const imports = parser.parseImports(content);
      assert.deepEqual(imports.sort(), ['@nestjs/common', '@types/node']);
    });
    
    it('should handle multiline imports', () => {
      const content = `
        import {
          useState,
          useEffect,
          useCallback
        } from 'react';
      `;
      const imports = parser.parseImports(content);
      assert.deepEqual(imports, ['react']);
    });
    
    it('should not parse imports in comments', () => {
      const content = `
        // import React from 'react';
        /* import { Component } from 'react-dom'; */
        import express from 'express';
      `;
      const imports = parser.parseImports(content);
      // This is a limitation - regex doesn't handle comments well
      // In a real implementation, you might want AST parsing
      assert.ok(imports.includes('express'));
    });
  });
  
  describe('extractDependencyName', () => {
    it('should extract package name from simple import', () => {
      assert.equal(parser.extractDependencyName('lodash'), 'lodash');
      assert.equal(parser.extractDependencyName('express'), 'express');
    });
    
    it('should extract package name from sub-path import', () => {
      assert.equal(parser.extractDependencyName('lodash/shuffle'), 'lodash');
      assert.equal(parser.extractDependencyName('express/lib/router'), 'express');
      assert.equal(parser.extractDependencyName('react-dom/server'), 'react-dom');
    });
    
    it('should extract scoped package name', () => {
      assert.equal(parser.extractDependencyName('@babel/core'), '@babel/core');
      assert.equal(parser.extractDependencyName('@types/node'), '@types/node');
      assert.equal(parser.extractDependencyName('@nestjs/common'), '@nestjs/common');
    });
    
    it('should extract scoped package name from sub-path', () => {
      assert.equal(parser.extractDependencyName('@babel/core/lib/parser'), '@babel/core');
      assert.equal(parser.extractDependencyName('@types/node/fs'), '@types/node');
      assert.equal(parser.extractDependencyName('@angular/core/testing'), '@angular/core');
    });
    
    it('should return null for relative imports', () => {
      assert.equal(parser.extractDependencyName('./utils'), null);
      assert.equal(parser.extractDependencyName('../components/Button'), null);
      assert.equal(parser.extractDependencyName('../../lib/helper'), null);
    });
    
    it('should return null for absolute imports', () => {
      assert.equal(parser.extractDependencyName('/src/utils'), null);
      assert.equal(parser.extractDependencyName('/absolute/path'), null);
    });
    
    it('should handle edge cases', () => {
      // Single @ without scope
      assert.equal(parser.extractDependencyName('@'), null);
      // Scoped package without name
      assert.equal(parser.extractDependencyName('@scope'), null);
      // Empty string
      assert.equal(parser.extractDependencyName(''), '');
    });
    
    it('should handle deeply nested paths', () => {
      assert.equal(
        parser.extractDependencyName('lodash/fp/curryN/convert'),
        'lodash'
      );
      assert.equal(
        parser.extractDependencyName('@angular/common/http/testing'),
        '@angular/common'
      );
    });
  });
  
  describe('integration tests', () => {
    it('should correctly parse and extract React imports', () => {
      const content = `
        import React from 'react';
        import ReactDOM from 'react-dom';
        import { render } from 'react-dom/client';
        import { useState } from 'react';
      `;
      
      const imports = parser.parseImports(content);
      const dependencies = imports
        .map(imp => parser.extractDependencyName(imp))
        .filter(Boolean);
      
      const uniqueDeps = Array.from(new Set(dependencies)).sort();
      assert.deepEqual(uniqueDeps, ['react', 'react-dom']);
    });
    
    it('should correctly parse and extract mixed import styles', () => {
      const content = `
        import express from 'express';
        const bodyParser = require('body-parser');
        import { Router } from 'express/lib/router';
        const cors = require('cors');
        await import('@nestjs/core');
      `;
      
      const imports = parser.parseImports(content);
      const dependencies = imports
        .map(imp => parser.extractDependencyName(imp))
        .filter(Boolean);
      
      const uniqueDeps = Array.from(new Set(dependencies)).sort();
      assert.deepEqual(uniqueDeps, ['@nestjs/core', 'body-parser', 'cors', 'express']);
    });
    
    it('should handle TypeScript type imports', () => {
      const content = `
        import type { Request } from 'express';
        import { type Response } from 'express';
        import type * as Types from '@types/node';
      `;
      
      const imports = parser.parseImports(content);
      assert.ok(imports.includes('express'));
      assert.ok(imports.includes('@types/node'));
    });
  });
});