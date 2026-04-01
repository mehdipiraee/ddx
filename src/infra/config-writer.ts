/**
 * Config writer — regex-based mutations that preserve YAML comments and formatting
 */

import * as fs from 'fs';
import * as path from 'path';

export class ConfigWriter {
  private configPath: string;

  constructor(configPath?: string) {
    this.configPath = configPath || path.join(process.cwd(), '.ddx-tooling', 'config.yaml');
  }

  exists(): boolean {
    return fs.existsSync(this.configPath);
  }

  readRaw(): string {
    return fs.readFileSync(this.configPath, 'utf8');
  }

  writeRaw(content: string): void {
    fs.writeFileSync(this.configPath, content, 'utf8');
  }

  /**
   * Read, apply a regex replacement, and write back.
   * Returns true if the replacement matched and changed something.
   */
  replaceField(pattern: RegExp, replacement: string): boolean {
    const content = this.readRaw();
    const newContent = content.replace(pattern, replacement);
    if (newContent === content) return false;
    this.writeRaw(newContent);
    return true;
  }
}
