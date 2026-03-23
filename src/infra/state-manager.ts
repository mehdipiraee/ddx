/**
 * State management for workflow persistence
 */

import * as fs from 'fs';
import * as path from 'path';
import { WorkflowState } from '../types';
import { FileManager } from './file-manager';

export class StateManager {
  private stateDir: string;
  private fileManager: FileManager;

  constructor(stateDir: string = '.ddx') {
    this.stateDir = stateDir;
    this.fileManager = new FileManager();
  }

  load(documentType: string): WorkflowState | null {
    const stateFile = this.getStateFilePath(documentType);

    if (!this.fileManager.fileExists(stateFile)) {
      return null;
    }

    try {
      const content = this.fileManager.readFile(stateFile);
      return JSON.parse(content) as WorkflowState;
    } catch (error) {
      console.error(`Failed to load state for ${documentType}:`, error);
      return null;
    }
  }

  save(state: WorkflowState): void {
    this.fileManager.ensureDirectory(this.stateDir);
    const stateFile = this.getStateFilePath(state.documentType);

    const stateWithTimestamp = {
      ...state,
      timestamp: new Date().toISOString(),
    };

    this.fileManager.writeFile(
      stateFile,
      JSON.stringify(stateWithTimestamp, null, 2)
    );
  }

  clear(documentType: string): void {
    const stateFile = this.getStateFilePath(documentType);

    if (this.fileManager.fileExists(stateFile)) {
      fs.unlinkSync(stateFile);
    }
  }

  private getStateFilePath(documentType: string): string {
    return path.join(this.stateDir, `${documentType}.json`);
  }
}
