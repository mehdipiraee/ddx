/**
 * Project initialization - scaffolds DDX files and folders
 */

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { execSync } from 'child_process';
import * as chalk from 'chalk';
import { FileManager } from './infra/file-manager';
import { downloadTailwind } from './utils/tailwind';
import { banner } from './utils/banner';

const c = chalk.default;
const dim = c.dim;
const green = c.green;
const red = c.red;
const yellow = c.yellow;
const bold = c.bold;
const cyan = c.cyan;

interface StepResult {
  label: string;
  status: 'ok' | 'skip' | 'fail';
  detail?: string;
}

const BEADS_VERSION = '0.63.3';

export class InitCommand {
  private fileManager: FileManager;
  private ddxRootDir: string;
  private steps: StepResult[] = [];

  constructor() {
    this.fileManager = new FileManager();
    this.ddxRootDir = path.join(__dirname, '..');
  }

  async execute(options: { force?: boolean } = {}): Promise<void> {
    console.log(banner());

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

    // Create .ddx-tooling/
    try {
      const result = this.createDirectory(toolingDir);
      this.logStep('Create .ddx-tooling/', result === 'created' ? 'ok' : 'skip', result === 'exists' ? 'already exists' : undefined);
    } catch (error) {
      this.logStep('Create .ddx-tooling/', 'fail', (error as Error).message);
    }

    // Config
    try {
      const result = this.copyConfigFile(toolingDir, options.force);
      this.logStep('Create config.yaml', result === 'skipped' ? 'skip' : 'ok', result);
    } catch (error) {
      this.logStep('Create config.yaml', 'fail', (error as Error).message);
    }

    // Design mode
    let designMode: 'ascii' | 'html' = 'ascii';
    try {
      designMode = await this.askDesignMode();
      this.setDesignMode(toolingDir, designMode);
      this.logStep('Design mode', 'ok', designMode);
    } catch (error) {
      this.logStep('Design mode', 'fail', (error as Error).message);
    }

    // Download Tailwind CSS if HTML mode
    if (designMode === 'html') {
      try {
        await this.downloadTailwind(toolingDir);
        this.logStep('Download Tailwind CSS', 'ok', '.ddx-tooling/tailwind.js');
      } catch (error) {
        designMode = 'ascii';
        this.setDesignMode(toolingDir, 'ascii');
        this.logStep('Download Tailwind CSS', 'fail', 'reverting to ASCII mode');
      }
    }

    // Beads tracking
    let beadsEnabled = false;
    try {
      const wantsBeads = await this.askBeadsTracking();
      if (wantsBeads) {
        beadsEnabled = await this.setupBeads(targetDir);
        if (beadsEnabled) {
          this.enableBeadsInConfig(toolingDir);
          this.installBeadsHook(targetDir);
          this.addBeadsHookConfig(targetDir);
          this.logStep('Setup Beads tracking', 'ok', 'enabled');
        } else {
          this.logStep('Setup Beads tracking', 'fail', 'installation failed, continuing without tracking');
        }
      } else {
        this.logStep('Beads tracking', 'skip', 'not enabled');
      }
    } catch (error) {
      this.logStep('Beads tracking', 'fail', (error as Error).message);
    }

    // Prompts
    this.copyDirectoryWithFileLogging(
      path.join(this.ddxRootDir, 'prompts'),
      path.join(toolingDir, 'prompts'),
      'Create prompts/',
      options.force
    );

    // Templates
    this.copyDirectoryWithFileLogging(
      path.join(this.ddxRootDir, 'templates'),
      path.join(toolingDir, 'templates'),
      'Create templates/',
      options.force
    );

    // Skills
    this.copySkillsDirectory(
      path.join(this.ddxRootDir, 'skills'),
      path.join(targetDir, '.claude', 'skills'),
      'Create skills in .claude/skills/',
      options.force
    );

    // Create ddx/
    try {
      const result = this.createDirectory(ddxDir);
      this.logStep('Create ddx/', result === 'created' ? 'ok' : 'skip', result === 'exists' ? 'already exists' : undefined);
    } catch (error) {
      this.logStep('Create ddx/', 'fail', (error as Error).message);
    }

    // Mandate
    try {
      const result = this.createMandate(ddxDir, options.force);
      this.logStep('Create ddx/MANDATE.md', result === 'skipped' ? 'skip' : 'ok', result);
    } catch (error) {
      this.logStep('Create ddx/MANDATE.md', 'fail', (error as Error).message);
    }

    // CLAUDE.md (reference to mandate)
    try {
      const result = this.updateClaudeMd(targetDir);
      this.logStep('Link mandate in CLAUDE.md', result ? 'ok' : 'skip', result ? undefined : 'already linked');
    } catch (error) {
      this.logStep('Link mandate in CLAUDE.md', 'fail', (error as Error).message);
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
      const result = this.updateClaudePermissions(targetDir, beadsEnabled);
      this.logStep('Configure Claude Code permissions', result ? 'ok' : 'skip', result ? undefined : 'already configured');
    } catch (error) {
      this.logStep('Configure Claude Code permissions', 'fail', (error as Error).message);
    }

    // Scan for existing files
    const hasCode = this.hasExistingFiles(targetDir);
    this.logStep('Scan for existing files', 'ok', hasCode ? 'files detected' : 'empty project');

    // Summary
    this.printSummary();

    // Next step
    const projectName = path.basename(targetDir);
    console.log(dim('  ─────────────────────────────────────────\n'));
    if (hasCode) {
      console.log(`  DDX is ready for ${bold(projectName)}.`);
      console.log(`  Seems like a ${cyan('project already exists.')}`);
      console.log(`  Open Claude Code and run ${cyan('/ddx.derive')}`);
      console.log(`  Or run ${cyan('claude /ddx.derive')} from your terminal.`);
      console.log(dim('  Analyzes your codebase and generates product docs.\n'));
    } else {
      console.log(`  DDX is ready for ${bold(projectName)}.`);
      console.log(`  This seems like a ${cyan('brand new project.')}`);
      console.log(`  Open Claude Code and run ${cyan('/ddx.define')}`);
      console.log(`  Or run ${cyan('claude /ddx.define')} from your terminal.`);
      console.log(dim('  Start defining your product from scratch.\n'));
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

  private logSubStep(label: string, status: 'ok' | 'skip' | 'fail', detail?: string): void {
    this.steps.push({ label, status, detail });

    const icon = status === 'ok' ? green('    ✓')
               : status === 'skip' ? yellow('    ○')
               : red('    ✗');

    const detailStr = detail ? dim(` (${detail})`) : '';
    console.log(`${icon} ${label}${detailStr}`);
  }

  private copySkillsDirectory(sourceDir: string, targetDir: string, dirLabel: string, force?: boolean): void {
    if (!fs.existsSync(sourceDir)) {
      this.logStep(dirLabel, 'fail', `source not found: ${sourceDir}`);
      return;
    }

    const dirExisted = fs.existsSync(targetDir);

    if (!force && dirExisted) {
      this.logStep(dirLabel, 'skip', 'already exists');
      return;
    }

    try {
      this.fileManager.ensureDirectory(targetDir);
      this.logStep(dirLabel, 'ok', dirExisted ? 'overwritten' : 'created');
    } catch (error) {
      this.logStep(dirLabel, 'fail', (error as Error).message);
      return;
    }

    const skillDirs = fs.readdirSync(sourceDir).filter((f) => {
      return !f.startsWith('.') && fs.statSync(path.join(sourceDir, f)).isDirectory();
    });

    for (const skillDir of skillDirs) {
      const sourceSkillDir = path.join(sourceDir, skillDir);
      const targetSkillDir = path.join(targetDir, skillDir);
      const sourceSkillFile = path.join(sourceSkillDir, 'SKILL.md');
      const targetSkillFile = path.join(targetSkillDir, 'SKILL.md');

      if (!fs.existsSync(sourceSkillFile)) continue;

      try {
        this.fileManager.ensureDirectory(targetSkillDir);
        const fileExisted = fs.existsSync(targetSkillFile);
        fs.copyFileSync(sourceSkillFile, targetSkillFile);
        this.logSubStep(skillDir, 'ok', fileExisted ? 'overwritten' : 'created');
      } catch (error) {
        this.logSubStep(skillDir, 'fail', (error as Error).message);
      }
    }
  }

  private copyDirectoryWithFileLogging(sourceDir: string, targetDir: string, dirLabel: string, force?: boolean): void {
    if (!fs.existsSync(sourceDir)) {
      this.logStep(dirLabel, 'fail', `source not found: ${sourceDir}`);
      return;
    }

    const dirExisted = fs.existsSync(targetDir);

    if (!force && dirExisted) {
      this.logStep(dirLabel, 'skip', 'already exists');
      return;
    }

    try {
      this.fileManager.ensureDirectory(targetDir);
      this.logStep(dirLabel, 'ok', dirExisted ? 'overwritten' : 'created');
    } catch (error) {
      this.logStep(dirLabel, 'fail', (error as Error).message);
      return;
    }

    const files = fs.readdirSync(sourceDir).filter((f) => !f.startsWith('.'));

    for (const file of files) {
      const sourcePath = path.join(sourceDir, file);
      const targetPath = path.join(targetDir, file);

      if (fs.statSync(sourcePath).isDirectory()) continue;

      try {
        const fileExisted = fs.existsSync(targetPath);
        fs.copyFileSync(sourcePath, targetPath);
        this.logSubStep(file, 'ok', fileExisted ? 'overwritten' : 'created');
      } catch (error) {
        this.logSubStep(file, 'fail', (error as Error).message);
      }
    }
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
      path.join(targetDir, '.claude', 'skills'),
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
      '.ddx-tooling/tailwind.js',
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

  private updateClaudePermissions(targetDir: string, beadsEnabled: boolean = false): boolean {
    const settingsPath = path.join(targetDir, '.claude', 'settings.local.json');
    const ddxPermissions = [
      'Read(ddx/**)',
      'Edit(ddx/**)',
      'Write(ddx/**)',
      'Read(.ddx-tooling/**)',
    ];

    if (beadsEnabled) {
      ddxPermissions.push('Bash(bd:*)');
    }

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

  private askDesignMode(): Promise<'ascii' | 'html'> {
    return new Promise((resolve) => {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      console.log();
      console.log(dim('  ─────────────────────────────────────────'));
      console.log();
      console.log(`  How should ${bold('design documents')} be generated?`);
      console.log();
      console.log(`    ${cyan('1)')} ${bold('ASCII')}  — Markdown with ASCII wireframes ${dim('(default)')}`);
      console.log(`    ${cyan('2)')} ${bold('HTML')}   — Single HTML file with Tailwind CSS designs`);
      console.log();

      rl.question(`  ${dim('Enter 1 or 2 [1]:')} `, (answer) => {
        rl.close();
        console.log();
        const trimmed = answer.trim();
        if (trimmed === '2' || trimmed.toLowerCase() === 'html') {
          resolve('html');
        } else {
          resolve('ascii');
        }
      });
    });
  }

  private downloadTailwind(toolingDir: string): Promise<void> {
    return downloadTailwind(toolingDir);
  }

  private setDesignMode(toolingDir: string, mode: 'ascii' | 'html'): void {
    const configPath = path.join(toolingDir, 'config.yaml');
    if (!fs.existsSync(configPath)) return;

    let content = fs.readFileSync(configPath, 'utf8');
    content = content.replace(
      /mode:\s*"ascii"\s*#.*$/m,
      `mode: "${mode}"   # "ascii" or "html"`
    );
    fs.writeFileSync(configPath, content, 'utf8');
  }

  private createMandate(ddxDir: string, force?: boolean): 'created' | 'overwritten' | 'skipped' {
    const targetPath = path.join(ddxDir, 'MANDATE.md');
    const existed = fs.existsSync(targetPath);

    if (!force && existed) {
      return 'skipped';
    }

    const sourcePath = path.join(this.ddxRootDir, 'templates', 'mandate_template.md');
    if (!fs.existsSync(sourcePath)) {
      throw new Error('Mandate template not found. Is DDX properly installed?');
    }

    fs.copyFileSync(sourcePath, targetPath);
    return existed ? 'overwritten' : 'created';
  }

  private updateClaudeMd(targetDir: string): boolean {
    const claudeMdPath = path.join(targetDir, 'CLAUDE.md');
    const mandateRef = 'Read and follow the project mandate: ddx/MANDATE.md';

    let existingContent = '';
    if (fs.existsSync(claudeMdPath)) {
      existingContent = this.fileManager.readFile(claudeMdPath);
    }

    if (existingContent.includes('ddx/MANDATE.md')) {
      return false;
    }

    let newContent = existingContent;

    if (existingContent) {
      if (!existingContent.endsWith('\n')) {
        newContent += '\n';
      }
      newContent += '\n' + mandateRef + '\n';
    } else {
      newContent = mandateRef + '\n';
    }

    this.fileManager.writeFile(claudeMdPath, newContent);
    return true;
  }

  private askBeadsTracking(): Promise<boolean> {
    return new Promise((resolve) => {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      console.log();
      console.log(dim('  ─────────────────────────────────────────'));
      console.log();
      console.log(`  Enable ${bold('task tracking')} with Beads?`);
      console.log();
      console.log(`    ${cyan('1)')} ${bold('No')}    — Plan steps in plan.md only ${dim('(default)')}`);
      console.log(`    ${cyan('2)')} ${bold('Yes')}   — Also track tasks with Beads (bd CLI)`);
      console.log();

      rl.question(`  ${dim('Enter 1 or 2 [1]:')} `, (answer) => {
        rl.close();
        console.log();
        const trimmed = answer.trim();
        resolve(trimmed === '2' || trimmed.toLowerCase() === 'yes');
      });
    });
  }

  private async setupBeads(targetDir: string): Promise<boolean> {
    // The refresh hook requires jq
    try {
      execSync('which jq', { stdio: 'pipe' });
    } catch {
      this.logSubStep('Check jq dependency', 'fail', 'jq is required for the Beads hook. Install: brew install jq');
      return false;
    }

    // Check if bd is already in PATH
    try {
      const versionOutput = execSync('bd --version', { stdio: 'pipe' }).toString().trim();
      const versionMatch = versionOutput.match(/(\d+\.\d+\.\d+)/);
      const installedVersion = versionMatch ? versionMatch[1] : null;

      if (installedVersion !== BEADS_VERSION) {
        this.logSubStep('Check bd version', 'fail', `found v${installedVersion || 'unknown'}, requires v${BEADS_VERSION}. Run: brew upgrade beads`);
        return false;
      }

      this.logSubStep(`Found bd v${BEADS_VERSION} in PATH`, 'ok');
    } catch {
      // Not in PATH, try to install via Homebrew
      try {
        execSync('which brew', { stdio: 'pipe' });
      } catch {
        this.logSubStep('Install Beads', 'fail', `bd not found and Homebrew not available. Install manually: brew install beads@${BEADS_VERSION}`);
        return false;
      }

      console.log(`  ${dim('Installing Beads v' + BEADS_VERSION + ' via Homebrew...')}`);
      try {
        execSync('brew install beads', { stdio: 'pipe' });
        // Verify installed version
        const versionOutput = execSync('bd --version', { stdio: 'pipe' }).toString().trim();
        const versionMatch = versionOutput.match(/(\d+\.\d+\.\d+)/);
        const installedVersion = versionMatch ? versionMatch[1] : null;

        if (installedVersion !== BEADS_VERSION) {
          this.logSubStep('Install Beads', 'fail', `installed v${installedVersion || 'unknown'} but requires v${BEADS_VERSION}`);
          return false;
        }

        this.logSubStep(`Install Beads v${BEADS_VERSION} via Homebrew`, 'ok');
      } catch {
        this.logSubStep('Install Beads', 'fail', `brew install failed. Install manually: brew install beads`);
        return false;
      }
    }

    try {
      execSync('bd init --quiet', { cwd: targetDir, stdio: 'pipe' });
      this.logSubStep('Initialize Beads', 'ok');
    } catch {
      this.logSubStep('Initialize Beads', 'fail', 'bd init failed');
      return false;
    }

    return true;
  }

  private enableBeadsInConfig(toolingDir: string): void {
    const configPath = path.join(toolingDir, 'config.yaml');
    if (!fs.existsSync(configPath)) return;

    let content = fs.readFileSync(configPath, 'utf8');
    if (content.includes('tracking:')) return;

    content += '\n# Task Tracking (Beads)\ntracking:\n  enabled: true\n';
    fs.writeFileSync(configPath, content, 'utf8');
  }

  private installBeadsHook(targetDir: string): void {
    const sourceHook = path.join(this.ddxRootDir, 'hooks', 'ddx-refresh-plan.sh');
    const targetHooksDir = path.join(targetDir, '.claude', 'hooks');
    const targetHook = path.join(targetHooksDir, 'ddx-refresh-plan.sh');

    if (!fs.existsSync(sourceHook)) {
      this.logSubStep('Copy refresh-plan hook', 'fail', 'hook source not found');
      return;
    }

    this.fileManager.ensureDirectory(targetHooksDir);
    fs.copyFileSync(sourceHook, targetHook);
    fs.chmodSync(targetHook, 0o755);
    this.logSubStep('Copy refresh-plan hook', 'ok', '.claude/hooks/ddx-refresh-plan.sh');
  }

  private addBeadsHookConfig(targetDir: string): void {
    const settingsPath = path.join(targetDir, '.claude', 'settings.json');

    let settings: any = {};
    if (fs.existsSync(settingsPath)) {
      try {
        settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      } catch {
        settings = {};
      }
    }

    if (!settings.hooks) {
      settings.hooks = {};
    }
    if (!Array.isArray(settings.hooks.PostToolUse)) {
      settings.hooks.PostToolUse = [];
    }

    // Check if the hook is already configured
    const alreadyConfigured = settings.hooks.PostToolUse.some((entry: any) =>
      entry.matcher === 'Bash' &&
      Array.isArray(entry.hooks) &&
      entry.hooks.some((h: any) =>
        typeof h.command === 'string' && h.command.includes('ddx-refresh-plan')
      )
    );

    if (alreadyConfigured) {
      this.logSubStep('Configure refresh-plan hook', 'skip', 'already configured');
      return;
    }

    settings.hooks.PostToolUse.push({
      matcher: 'Bash',
      hooks: [
        {
          type: 'command',
          if: 'Bash(bd *)',
          command: '.claude/hooks/ddx-refresh-plan.sh',
          timeout: 30,
        },
      ],
    });

    this.fileManager.ensureDirectory(path.dirname(settingsPath));
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n', 'utf8');
    this.logSubStep('Configure refresh-plan hook', 'ok', 'PostToolUse hook added');
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
