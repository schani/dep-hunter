import * as sqlite3 from 'sqlite3';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

export interface BundlephobiaData {
  name: string;
  version: string;
  gzip: number;
  size: number;
  dependencyCount: number;
  hasJSModule: boolean;
  hasJSNext: boolean;
  hasSideEffects: boolean;
  response: string; // Full JSON response
  fetchedAt: number; // Timestamp
}

export class Database {
  private db!: sqlite3.Database;
  private dbPath: string;
  
  constructor() {
    // Create ~/.dep-hunter directory if it doesn't exist
    const depHunterDir = path.join(os.homedir(), '.dep-hunter');
    if (!fs.existsSync(depHunterDir)) {
      fs.mkdirSync(depHunterDir, { recursive: true });
    }
    
    this.dbPath = path.join(depHunterDir, 'cache.db');
  }
  
  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          reject(err);
        } else {
          this.createTables().then(resolve).catch(reject);
        }
      });
    });
  }
  
  private async createTables(): Promise<void> {
    return new Promise((resolve, reject) => {
      const sql = `
        CREATE TABLE IF NOT EXISTS bundlephobia_cache (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
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
        
        CREATE INDEX IF NOT EXISTS idx_name_version 
        ON bundlephobia_cache(name, version);
      `;
      
      this.db.exec(sql, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
  
  async getBundlephobiaData(name: string, version: string): Promise<BundlephobiaData | null> {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT * FROM bundlephobia_cache 
        WHERE name = ? AND version = ?
      `;
      
      this.db.get(sql, [name, version], (err, row: any) => {
        if (err) {
          reject(err);
        } else if (!row) {
          resolve(null);
        } else {
          resolve({
            name: row.name,
            version: row.version,
            gzip: row.gzip,
            size: row.size,
            dependencyCount: row.dependency_count,
            hasJSModule: row.has_js_module === 1,
            hasJSNext: row.has_js_next === 1,
            hasSideEffects: row.has_side_effects === 1,
            response: row.response,
            fetchedAt: row.fetched_at,
          });
        }
      });
    });
  }
  
  async saveBundlephobiaData(data: BundlephobiaData): Promise<void> {
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT OR REPLACE INTO bundlephobia_cache (
          name, version, gzip, size, dependency_count,
          has_js_module, has_js_next, has_side_effects,
          response, fetched_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      this.db.run(
        sql,
        [
          data.name,
          data.version,
          data.gzip,
          data.size,
          data.dependencyCount,
          data.hasJSModule ? 1 : 0,
          data.hasJSNext ? 1 : 0,
          data.hasSideEffects ? 1 : 0,
          data.response,
          data.fetchedAt,
        ],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }
  
  async close(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
}

export const database = new Database();