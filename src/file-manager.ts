/**
 * File management utilities for DDX
 */

import * as fs from 'fs';
import * as path from 'path';

export class FileManager {
  readFile(filePath: string): string {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }
    return fs.readFileSync(filePath, 'utf8');
  }

  writeFile(filePath: string, content: string): void {
    // Ensure directory exists
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, content, 'utf8');
  }

  fileExists(filePath: string): boolean {
    return fs.existsSync(filePath);
  }

  ensureDirectory(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  readFileIfExists(filePath: string): string | null {
    if (this.fileExists(filePath)) {
      return this.readFile(filePath);
    }
    return null;
  }
}
