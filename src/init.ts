/**
 * Project initialization - scaffolds DDX files and folders
 */

import * as fs from 'fs';
import * as path from 'path';
import * as chalk from 'chalk';
import { FileManager } from './infra/file-manager';

const c = chalk.default;
const dim = c.dim;
const green = c.green;
const red = c.red;
const yellow = c.yellow;
const bold = c.bold;
const cyan = c.cyan;

const BANNER = `
${dim('┌─────────────────────────────────────────────┐')}
${dim('│')}                                             ${dim('│')}
${dim('│')}    ${bold('██████╗  ██████╗  ██╗  ██╗')}               ${dim('│')}
${dim('│')}    ${bold('██╔══██╗ ██╔══██╗ ╚██╗██╔╝')}               ${dim('│')}
${dim('│')}    ${bold('██║  ██║ ██║  ██║  ╚███╔╝')}                ${dim('│')}
${dim('│')}    ${bold('██║  ██║ ██║  ██║  ██╔██╗')}                ${dim('│')}
${dim('│')}    ${bold('██████╔╝ ██████╔╝ ██╔╝ ██╗')}               ${dim('│')}
${dim('│')}    ${bold('╚═════╝  ╚═════╝  ╚═╝  ╚═╝')}               ${dim('│')}
${dim('│')}                                             ${dim('│')}
${dim('│')}    ${dim('Document-Driven Development')}              ${dim('│')}
${dim('│')}                                             ${dim('│')}
${dim('└─────────────────────────────────────────────┘')}
`;

interface StepResult {
  label: string;
  status: 'ok' | 'skip' | 'fail';
  detail?: string;
}

export class InitCommand {
  private fileManager: FileManager;
  private ddxRootDir: string;
  private steps: StepResult[] = [];

  constructor() {
    this.fileManager = new FileManager();
    this.ddxRootDir = path.join(__dirname, '..');
  }

  async execute(options: { force?: boolean } = {}): Promise<void> {
    console.log(BANNER);

    if (options.force) {
      console.log(dim('  --force enabled, overwriting existing files\n'));
    }

    const targetDir = process.cwd();
    const toolingDir = path.join(targetDir, '.ddx-tooling');
    const ddxDir = path.join(targetDir, 'ddx');

    // Pre-flight check
    if (!options.force) {
      try {
        this.checkExistingFiles(targetDir, toolingDir);
        this.logStep('Pre-flight check', 'ok');
      } catch (error) {
        this.logStep('Pre-flight check', 'fail', (error as Error).message);
        this.printSummary();
        throw error;
      }
    } else {
      this.logStep('Pre-flight check', 'skip', 'force mode');
    }

    // Scaffold tooling
    try {
      const result = this.createDirectory(toolingDir);
      this.logStep('Create .ddx-tooling/', result === 'created' ? 'ok' : 'skip', result === 'exists' ? 'already exists' : undefined);
    } catch (error) {
      this.logStep('Create .ddx-tooling/', 'fail', (error as Error).message);
    }

    // Config
    try {
      const result = this.copyConfigFile(toolingDir, options.force);
      this.logStep('Copy config.yaml', result === 'skipped' ? 'skip' : 'ok', result);
    } catch (error) {
      this.logStep('Copy config.yaml', 'fail', (error as Error).message);
    }

    // Prompts
    try {
      const result = this.copyDirectory(
        path.join(this.ddxRootDir, 'prompts'),
        path.join(toolingDir, 'prompts'),
        options.force
      );
      this.logStep(
        'Copy prompts/',
        result.status === 'skipped' ? 'skip' : 'ok',
        result.status === 'skipped' ? 'already exists' : `${result.status}: ${result.files.join(', ')}`
      );
    } catch (error) {
      this.logStep('Copy prompts/', 'fail', (error as Error).message);
    }

    // Templates
    try {
      const result = this.copyDirectory(
        path.join(this.ddxRootDir, 'templates'),
        path.join(toolingDir, 'templates'),
        options.force
      );
      this.logStep(
        'Copy templates/',
        result.status === 'skipped' ? 'skip' : 'ok',
        result.status === 'skipped' ? 'already exists' : `${result.status}: ${result.files.join(', ')}`
      );
    } catch (error) {
      this.logStep('Copy templates/', 'fail', (error as Error).message);
    }

    // Skills
    try {
      const result = this.copyDirectory(
        path.join(this.ddxRootDir, 'commands'),
        path.join(targetDir, '.claude', 'commands'),
        options.force
      );
      this.logStep(
        'Copy skills to .claude/commands/',
        result.status === 'skipped' ? 'skip' : 'ok',
        result.status === 'skipped' ? 'already exists' : `${result.status}: ${result.files.join(', ')}`
      );
    } catch (error) {
      this.logStep('Copy skills to .claude/commands/', 'fail', (error as Error).message);
    }

    // Output directory
    try {
      const result = this.createDirectory(ddxDir);
      this.logStep('Create ddx/', result === 'created' ? 'ok' : 'skip', result === 'exists' ? 'already exists' : undefined);
    } catch (error) {
      this.logStep('Create ddx/', 'fail', (error as Error).message);
    }

    // .env.example
    try {
      const result = this.createEnvExample(toolingDir, options.force);
      this.logStep('Create .env.example', result === 'skipped' ? 'skip' : 'ok', result);
    } catch (error) {
      this.logStep('Create .env.example', 'fail', (error as Error).message);
    }

    // .gitignore
    try {
      const result = this.updateGitignore(targetDir);
      this.logStep('Update .gitignore', result ? 'ok' : 'skip', result ? undefined : 'already up to date');
    } catch (error) {
      this.logStep('Update .gitignore', 'fail', (error as Error).message);
    }

    // Claude Code permissions
    try {
      const result = this.updateClaudePermissions(targetDir);
      this.logStep('Configure Claude Code permissions', result ? 'ok' : 'skip', result ? undefined : 'already configured');
    } catch (error) {
      this.logStep('Configure Claude Code permissions', 'fail', (error as Error).message);
    }

    // Project scan
    const hasCode = this.hasExistingFiles(targetDir);
    this.logStep('Scan for existing files', 'ok', hasCode ? 'files detected' : 'empty project');

    // Summary
    this.printSummary();

    // Next step
    console.log(dim('  ─────────────────────────────────────────\n'));
    console.log(`  DDX is ready. Open ${bold('Claude Code')} in this project\n`);
    if (hasCode) {
      console.log(`  Existing files were found. Run this in Claude Code`);
      console.log(`  to document your current project:\n`);
      console.log(cyan('    /ddx.derive'));
      console.log(dim('    Analyzes your codebase and generates product docs\n'));
    } else {
      console.log(`  This is an empty project. Run this in Claude Code\n`);
      console.log(cyan('    /ddx.define'));
      console.log(dim('    Start defining your product from scratch\n'));
    }
  }

  private logStep(label: string, status: 'ok' | 'skip' | 'fail', detail?: string): void {
    this.steps.push({ label, status, detail });

    const icon = status === 'ok' ? green('  ✓')
               : status === 'skip' ? yellow('  ○')
               : red('  ✗');

    const detailStr = detail ? dim(` (${detail})`) : '';
    console.log(`${icon} ${label}${detailStr}`);
  }

  private printSummary(): void {
    const ok = this.steps.filter((s) => s.status === 'ok').length;
    const skip = this.steps.filter((s) => s.status === 'skip').length;
    const fail = this.steps.filter((s) => s.status === 'fail').length;

    console.log();
    if (fail === 0) {
      console.log(green(`  Done. ${ok} completed, ${skip} skipped, ${fail} failed.`));
    } else {
      console.log(red(`  Done. ${ok} completed, ${skip} skipped, ${fail} failed.`));
    }
  }

  private checkExistingFiles(targetDir: string, toolingDir: string): void {
    const pathsToCheck = [
      path.join(toolingDir, 'config.yaml'),
      path.join(toolingDir, 'prompts'),
      path.join(toolingDir, 'templates'),
      path.join(targetDir, '.claude', 'commands'),
    ];

    const existing = pathsToCheck.filter((p) => fs.existsSync(p));

    if (existing.length > 0) {
      const names = existing.map((p) => path.relative(targetDir, p));
      throw new Error(
        `DDX files already exist: ${names.join(', ')}\n` +
        'Use --force to overwrite existing files.'
      );
    }
  }

  private copyConfigFile(toolingDir: string, force?: boolean): 'created' | 'overwritten' | 'skipped' {
    const sourcePath = path.join(this.ddxRootDir, 'ddx.config.yaml');
    const targetPath = path.join(toolingDir, 'config.yaml');
    const existed = fs.existsSync(targetPath);

    if (!force && existed) {
      return 'skipped';
    }

    if (!fs.existsSync(sourcePath)) {
      throw new Error('DDX config template not found. Is DDX properly installed?');
    }

    fs.copyFileSync(sourcePath, targetPath);
    return existed ? 'overwritten' : 'created';
  }

  private copyDirectory(sourceDir: string, targetDir: string, force?: boolean): { status: 'created' | 'overwritten' | 'skipped'; files: string[] } {
    if (!fs.existsSync(sourceDir)) {
      throw new Error(`Source not found: ${sourceDir}`);
    }

    const existed = fs.existsSync(targetDir);

    if (!force && existed) {
      return { status: 'skipped', files: [] };
    }

    this.fileManager.ensureDirectory(targetDir);
    const files = fs.readdirSync(sourceDir);
    const copied: string[] = [];

    for (const file of files) {
      if (file.startsWith('.')) continue;

      const sourcePath = path.join(sourceDir, file);
      const targetPath = path.join(targetDir, file);
      const stat = fs.statSync(sourcePath);

      if (stat.isDirectory()) {
        this.copyDirectory(sourcePath, targetPath, force);
      } else {
        fs.copyFileSync(sourcePath, targetPath);
        copied.push(file);
      }
    }

    return { status: existed ? 'overwritten' : 'created', files: copied };
  }

  private createDirectory(dirPath: string): 'created' | 'exists' {
    if (fs.existsSync(dirPath)) {
      return 'exists';
    }
    this.fileManager.ensureDirectory(dirPath);
    return 'created';
  }

  private createEnvExample(targetDir: string, force?: boolean): 'created' | 'overwritten' | 'skipped' {
    const targetPath = path.join(targetDir, '.env.example');
    const existed = fs.existsSync(targetPath);

    if (!force && existed) {
      return 'skipped';
    }

    const content = '# Anthropic API Key\nANTHROPIC_API_KEY=your_api_key_here\n';
    this.fileManager.writeFile(targetPath, content);
    return existed ? 'overwritten' : 'created';
  }

  private updateGitignore(targetDir: string): boolean {
    const gitignorePath = path.join(targetDir, '.gitignore');

    const entriesToAdd = [
      '.ddx-tooling/.env',
      '.ddx-tooling/.state/',
    ];

    let existingContent = '';
    if (fs.existsSync(gitignorePath)) {
      existingContent = this.fileManager.readFile(gitignorePath);
    }

    const existingLines = existingContent.split('\n').map((line) => line.trim());

    const linesToAdd = entriesToAdd.filter(
      (entry) => !this.isGitignored(entry, existingLines)
    );

    if (linesToAdd.length === 0) {
      return false;
    }

    let newContent = existingContent;

    if (existingContent && !existingContent.endsWith('\n')) {
      newContent += '\n';
    }

    if (existingContent) {
      newContent += '\n# DDX\n';
    }

    newContent += linesToAdd.join('\n') + '\n';

    this.fileManager.writeFile(gitignorePath, newContent);
    return true;
  }

  private hasExistingFiles(targetDir: string): boolean {
    const ignore = new Set([
      '.git', '.gitignore', '.ddx-tooling', '.claude',
      'ddx', 'node_modules', '.DS_Store',
    ]);

    try {
      const entries = fs.readdirSync(targetDir);
      return entries.some((name) => !ignore.has(name) && !name.startsWith('.'));
    } catch {
      return false;
    }
  }

  private updateClaudePermissions(targetDir: string): boolean {
    const settingsPath = path.join(targetDir, '.claude', 'settings.local.json');
    const ddxPermissions = [
      'Read(/ddx/**)',
      'Edit(/ddx/**)',
      'Write(/ddx/**)',
      'Read(/.ddx-tooling/**)',
      'Bash(mkdir -p ddx/:*)',
    ];

    let settings: any = { permissions: { allow: [], deny: [], ask: [] } };

    if (fs.existsSync(settingsPath)) {
      try {
        settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
        if (!settings.permissions) {
          settings.permissions = { allow: [], deny: [], ask: [] };
        }
        if (!Array.isArray(settings.permissions.allow)) {
          settings.permissions.allow = [];
        }
      } catch {
        // Malformed JSON, start fresh
        settings = { permissions: { allow: [], deny: [], ask: [] } };
      }
    }

    const existing = new Set(settings.permissions.allow);
    const toAdd = ddxPermissions.filter((p) => !existing.has(p));

    if (toAdd.length === 0) {
      return false;
    }

    settings.permissions.allow.push(...toAdd);

    this.fileManager.ensureDirectory(path.dirname(settingsPath));
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n', 'utf8');
    return true;
  }

  private isGitignored(entry: string, existingLines: string[]): boolean {
    const filename = path.basename(entry);

    for (const line of existingLines) {
      if (!line || line.startsWith('#')) continue;
      if (line === entry) return true;
      if (!line.includes('/') && line === filename) return true;
    }

    return false;
  }
}
