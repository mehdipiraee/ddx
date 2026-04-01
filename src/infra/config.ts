/**
 * Configuration loader for DDX
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { DDXConfig } from '../types';

export class ConfigLoader {
  private config: DDXConfig | null = null;
  private configPath: string;

  constructor(configPath: string = '.ddx-tooling/config.yaml') {
    this.configPath = configPath;
  }

  load(): DDXConfig {
    if (this.config) {
      return this.config;
    }

    if (!fs.existsSync(this.configPath)) {
      throw new Error(
        `Configuration file not found: ${this.configPath}\n` +
        'Please run this command from a directory containing ddx.config.yaml'
      );
    }

    const fileContents = fs.readFileSync(this.configPath, 'utf8');
    this.config = yaml.load(fileContents) as DDXConfig;

    // Validate config
    this.validate(this.config);

    return this.config;
  }

  private validate(config: DDXConfig): void {
    if (!config.documents || Object.keys(config.documents).length === 0) {
      throw new Error('Configuration must define at least one document type');
    }

    if (!config.llm || !config.llm.model) {
      throw new Error('Configuration must define LLM settings');
    }

    if (!config.workflow || !config.workflow.state_dir) {
      throw new Error('Configuration must define workflow settings');
    }

    // Validate tracking if present
    if (config.tracking) {
      if (!config.tracking.provider) {
        throw new Error('Tracking configuration must define a provider');
      }
      if (config.tracking.provider !== 'beads') {
        throw new Error(`Unknown tracking provider: ${config.tracking.provider}. Supported: beads`);
      }
    }

    // Validate document references
    for (const [docType, docConfig] of Object.entries(config.documents)) {
      // Check upstream references
      for (const upstream of docConfig.upstream) {
        if (!config.documents[upstream]) {
          throw new Error(
            `Document '${docType}' references unknown upstream document '${upstream}'`
          );
        }
      }

      // Check downstream references
      for (const downstream of docConfig.downstream) {
        if (!config.documents[downstream]) {
          throw new Error(
            `Document '${docType}' references unknown downstream document '${downstream}'`
          );
        }
      }
    }
  }

  getDocumentConfig(documentType: string) {
    const config = this.load();
    const docConfig = config.documents[documentType];

    if (!docConfig) {
      const available = Object.keys(config.documents).join(', ');
      throw new Error(
        `Unknown document type: ${documentType}\n` +
        `Available types: ${available}`
      );
    }

    return docConfig;
  }
}
