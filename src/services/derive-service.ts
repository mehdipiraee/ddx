/**
 * Derive Service - Analyzes existing codebases to generate product docs
 */

import * as fs from 'fs';
import * as path from 'path';
import { ConfigLoader } from '../infra/config';
import { FileManager } from '../infra/file-manager';
import { LLMClient } from '../infra/llm-client';

export interface DeriveResult {
  derived: boolean;
  filesWritten: string[];
  message: string;
}

export class DeriveService {
  private configLoader: ConfigLoader;
  private fileManager: FileManager;
  private llmClient: LLMClient;

  constructor(configLoader: ConfigLoader, fileManager: FileManager, llmClient: LLMClient) {
    this.configLoader = configLoader;
    this.fileManager = fileManager;
    this.llmClient = llmClient;
  }

  /**
   * Check if the project has source code
   */
  hasSourceCode(): boolean {
    const cwd = process.cwd();
    const indicators = [
      'src', 'app', 'lib', 'pkg', 'cmd',
      'package.json', 'Cargo.toml', 'go.mod', 'pyproject.toml',
      'requirements.txt', 'Gemfile', 'pom.xml', 'build.gradle',
    ];

    return indicators.some((name) => fs.existsSync(path.join(cwd, name)));
  }

  /**
   * Check if product docs already exist
   */
  productExists(): boolean {
    return fs.existsSync(path.join(process.cwd(), 'ddx', 'product', 'definition.md'));
  }

  /**
   * Scan the project and collect context for the LLM
   */
  private gatherProjectContext(): string {
    const cwd = process.cwd();
    const sections: string[] = [];

    // README
    for (const name of ['README.md', 'readme.md', 'README']) {
      const p = path.join(cwd, name);
      if (fs.existsSync(p)) {
        const content = fs.readFileSync(p, 'utf8').slice(0, 3000);
        sections.push(`## README\n${content}`);
        break;
      }
    }

    // Manifest files
    const manifests = ['package.json', 'Cargo.toml', 'go.mod', 'pyproject.toml', 'requirements.txt'];
    for (const name of manifests) {
      const p = path.join(cwd, name);
      if (fs.existsSync(p)) {
        const content = fs.readFileSync(p, 'utf8').slice(0, 2000);
        sections.push(`## ${name}\n${content}`);
      }
    }

    // Top-level directory listing
    try {
      const entries = fs.readdirSync(cwd, { withFileTypes: true });
      const listing = entries
        .filter((e) => !e.name.startsWith('.') && e.name !== 'node_modules' && e.name !== 'dist')
        .map((e) => `${e.isDirectory() ? '📁' : '📄'} ${e.name}`)
        .join('\n');
      sections.push(`## Directory Structure\n${listing}`);
    } catch {
      // Skip if can't read
    }

    // Source entry points (first 100 lines)
    const entryPoints = [
      'src/index.ts', 'src/index.js', 'src/main.ts', 'src/main.js',
      'src/app.ts', 'src/app.js', 'app/page.tsx', 'app/layout.tsx',
      'src/lib.rs', 'main.go', 'cmd/main.go',
    ];
    for (const ep of entryPoints) {
      const p = path.join(cwd, ep);
      if (fs.existsSync(p)) {
        const lines = fs.readFileSync(p, 'utf8').split('\n').slice(0, 100).join('\n');
        sections.push(`## ${ep}\n${lines}`);
      }
    }

    return sections.join('\n\n---\n\n');
  }

  /**
   * Derive product docs from an existing codebase
   */
  async derive(): Promise<DeriveResult> {
    if (this.productExists()) {
      return {
        derived: false,
        filesWritten: [],
        message: 'Product docs already exist at ddx/product/. Nothing to derive.',
      };
    }

    if (!this.hasSourceCode()) {
      return {
        derived: false,
        filesWritten: [],
        message: 'No source code detected. Nothing to derive.',
      };
    }

    const config = this.configLoader.load();
    const projectContext = this.gatherProjectContext();
    const filesWritten: string[] = [];

    // Derive each doc type that has a template
    const docTypes = ['definition', 'design', 'spec'] as const;

    for (const docType of docTypes) {
      const docConfig = config.documents[docType];
      if (!docConfig || !docConfig.template) continue;

      const templatePath = docConfig.template;
      if (!this.fileManager.fileExists(templatePath)) continue;

      const template = this.fileManager.readFile(templatePath);
      const outputPath = docConfig.output.replace('{scope}', 'product');

      const systemPrompt =
        `You are analyzing an existing codebase to generate a ${docConfig.name} document.\n\n` +
        `Use this template structure:\n${template}\n\n` +
        `Fill in every section based on what you can infer from the codebase context below. ` +
        `Be factual — only include what the code evidence supports. ` +
        `If a section can't be filled from the available context, write "Not derivable from codebase." for that section.\n\n` +
        `Output ONLY the completed document in markdown. No preamble, no explanation.`;

      const response = await this.llmClient.sendMessage(systemPrompt, projectContext);
      this.fileManager.writeFile(outputPath, response.trim());
      filesWritten.push(outputPath);
    }

    return {
      derived: true,
      filesWritten,
      message:
        `Derived ${filesWritten.length} product docs from codebase:\n` +
        filesWritten.map((f) => `  ${f}`).join('\n') +
        '\n\nPlease review and edit these files. Then run /ddx.define to define your first capability.',
    };
  }
}
