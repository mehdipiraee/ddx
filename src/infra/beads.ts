/**
 * Centralized Beads integration manager.
 *
 * Owns all beads-related operations: install, init, hooks, permissions,
 * health-check, repair, setup, and teardown. Both init.ts and the
 * tracking setting handler delegate here.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { execSync } from 'child_process';
import { FileManager } from './file-manager';

// ── Constants ────────────────────────────────────────────────────────

export const BEADS_VERSION = '0.63.3';
const HOOK_FILENAME = 'ddx-refresh-plan.sh';
const HOOK_VERSION_PREFIX = '# ddx-hook-version:';
const BEADS_PERMISSION = 'Bash(bd:*)';

// ── Types ────────────────────────────────────────────────────────────

export interface InstallResult {
  status: 'found' | 'installed' | 'upgraded';
  version: string;
}

export interface HookResult {
  status: 'installed' | 'updated' | 'skipped';
}

export interface SetupResult {
  success: boolean;
  error?: string;
}

export interface TeardownResult {
  warnings: string[];
}

export type IssueStatus = 'missing' | 'stale' | 'wrong-version';

export interface BeadsIssue {
  component: 'bd-binary' | 'bd-version' | 'jq' | 'beads-init' | 'hook-file' | 'hook-config' | 'permission' | 'config';
  status: IssueStatus;
  detail: string;
  fixable: boolean;
}

export interface BeadsHealthReport {
  healthy: boolean;
  issues: BeadsIssue[];
}

// ── BeadsManager ─────────────────────────────────────────────────────

export class BeadsManager {
  private projectDir: string;
  private ddxPackageDir: string;
  private fileManager: FileManager;

  // Derived paths
  private hookSource: string;
  private hookTarget: string;
  private hooksDir: string;
  private settingsJsonPath: string;
  private settingsLocalPath: string;
  private beadsDir: string;

  constructor(projectDir: string, ddxPackageDir: string) {
    this.projectDir = projectDir;
    this.ddxPackageDir = ddxPackageDir;
    this.fileManager = new FileManager();

    this.hookSource = path.join(ddxPackageDir, 'hooks', HOOK_FILENAME);
    this.hooksDir = path.join(projectDir, '.claude', 'hooks');
    this.hookTarget = path.join(this.hooksDir, HOOK_FILENAME);
    this.settingsJsonPath = path.join(projectDir, '.claude', 'settings.json');
    this.settingsLocalPath = path.join(projectDir, '.claude', 'settings.local.json');
    this.beadsDir = path.join(projectDir, '.beads');
  }

  // ── Install / Upgrade ──────────────────────────────────────────

  async ensureInstalled(): Promise<InstallResult> {
    this.requireJq();

    // Check if bd is already available
    const installed = this.getBdVersion();

    if (installed === BEADS_VERSION) {
      return { status: 'found', version: BEADS_VERSION };
    }

    if (installed) {
      // Wrong version — needs upgrade, but ask first since it's system-wide
      throw new Error(
        `bd v${installed} found, but DDX requires v${BEADS_VERSION}. ` +
        `Run: brew upgrade beads`
      );
    }

    // Not installed — install fresh
    return this.installBd();
  }

  private requireJq(): void {
    try {
      execSync('which jq', { stdio: 'pipe' });
    } catch {
      throw new Error('jq is required for the Beads hook. Install: brew install jq');
    }
  }

  private getBdVersion(): string | null {
    try {
      const output = execSync('bd --version', { stdio: 'pipe' }).toString().trim();
      const match = output.match(/(\d+\.\d+\.\d+)/);
      return match ? match[1] : null;
    } catch {
      return null;
    }
  }

  private requireBrew(): void {
    try {
      execSync('which brew', { stdio: 'pipe' });
    } catch {
      throw new Error(
        `Homebrew not found. Install bd v${BEADS_VERSION} manually: https://github.com/beads-app/beads`
      );
    }
  }

  private upgradeBd(currentVersion: string): InstallResult {
    this.requireBrew();

    try {
      execSync('brew upgrade beads', { stdio: 'pipe' });
    } catch {
      // upgrade may fail if already latest in brew — try reinstall
      try {
        execSync('brew reinstall beads', { stdio: 'pipe' });
      } catch {
        throw new Error(
          `Failed to upgrade bd from v${currentVersion} to v${BEADS_VERSION}. Run manually: brew upgrade beads`
        );
      }
    }

    const after = this.getBdVersion();
    if (after !== BEADS_VERSION) {
      throw new Error(
        `bd v${after || 'unknown'} after upgrade, requires v${BEADS_VERSION}. ` +
        `The Homebrew formula may not have v${BEADS_VERSION} yet.`
      );
    }

    return { status: 'upgraded', version: BEADS_VERSION };
  }

  private installBd(): InstallResult {
    this.requireBrew();

    try {
      execSync('brew install beads', { stdio: 'pipe' });
    } catch {
      throw new Error(
        `brew install beads failed. Install bd v${BEADS_VERSION} manually.`
      );
    }

    const after = this.getBdVersion();
    if (after !== BEADS_VERSION) {
      throw new Error(
        `brew installed bd v${after || 'unknown'}, but DDX requires v${BEADS_VERSION}.`
      );
    }

    return { status: 'installed', version: BEADS_VERSION };
  }

  // ── Initialize ─────────────────────────────────────────────────

  initialize(): void {
    try {
      execSync('bd init --quiet', { cwd: this.projectDir, stdio: 'pipe' });
    } catch {
      // Already initialized is fine — verify .beads/ exists
      if (!fs.existsSync(this.beadsDir)) {
        throw new Error('bd init failed and no .beads/ directory found');
      }
    }
  }

  // ── Hook Management ────────────────────────────────────────────

  installHook(): HookResult {
    if (!fs.existsSync(this.hookSource)) {
      throw new Error(`Hook source not found: ${this.hookSource}`);
    }

    const sourceContent = fs.readFileSync(this.hookSource, 'utf8');
    const hash = crypto.createHash('sha256').update(sourceContent).digest('hex').slice(0, 8);
    const versionLine = `${HOOK_VERSION_PREFIX} ${hash}`;

    // Inject version line as line 2 (after #!/bin/bash)
    const lines = sourceContent.split('\n');
    const taggedContent = [lines[0], versionLine, ...lines.slice(1)].join('\n');

    // Check if target exists and is up to date
    if (fs.existsSync(this.hookTarget)) {
      const targetContent = fs.readFileSync(this.hookTarget, 'utf8');
      const targetVersionLine = targetContent.split('\n').find(l => l.startsWith(HOOK_VERSION_PREFIX));
      if (targetVersionLine === versionLine) {
        return { status: 'skipped' };
      }

      // Stale — overwrite
      fs.writeFileSync(this.hookTarget, taggedContent, 'utf8');
      fs.chmodSync(this.hookTarget, 0o755);
      return { status: 'updated' };
    }

    // New install
    this.fileManager.ensureDirectory(this.hooksDir);
    fs.writeFileSync(this.hookTarget, taggedContent, 'utf8');
    fs.chmodSync(this.hookTarget, 0o755);
    return { status: 'installed' };
  }

  removeHook(): void {
    if (fs.existsSync(this.hookTarget)) {
      fs.unlinkSync(this.hookTarget);
    }
  }

  // ── Hook Config (settings.json) ────────────────────────────────

  addHookConfig(): void {
    const settings = this.readJsonSafe(this.settingsJsonPath, {});

    if (!settings.hooks) settings.hooks = {};
    if (!Array.isArray(settings.hooks.PostToolUse)) settings.hooks.PostToolUse = [];

    const alreadyConfigured = settings.hooks.PostToolUse.some((entry: any) =>
      entry.matcher === 'Bash' &&
      Array.isArray(entry.hooks) &&
      entry.hooks.some((h: any) =>
        typeof h.command === 'string' && h.command.includes('ddx-refresh-plan')
      )
    );

    if (alreadyConfigured) return;

    settings.hooks.PostToolUse.push({
      matcher: 'Bash',
      hooks: [{
        type: 'command',
        if: 'Bash(bd *)',
        command: '.claude/hooks/ddx-refresh-plan.sh',
        timeout: 30,
      }],
    });

    this.writeJsonSafe(this.settingsJsonPath, settings);
  }

  removeHookConfig(): void {
    if (!fs.existsSync(this.settingsJsonPath)) return;

    try {
      const settings = JSON.parse(fs.readFileSync(this.settingsJsonPath, 'utf8'));
      if (!Array.isArray(settings.hooks?.PostToolUse)) return;

      settings.hooks.PostToolUse = settings.hooks.PostToolUse.filter((entry: any) =>
        !(entry.matcher === 'Bash' &&
          Array.isArray(entry.hooks) &&
          entry.hooks.some((h: any) =>
            typeof h.command === 'string' && h.command.includes('ddx-refresh-plan')
          ))
      );

      fs.writeFileSync(this.settingsJsonPath, JSON.stringify(settings, null, 2) + '\n', 'utf8');
    } catch {
      // Malformed settings — nothing to remove
    }
  }

  // ── Permission (settings.local.json) ───────────────────────────

  addPermission(): void {
    const settings = this.readJsonSafe(this.settingsLocalPath, {
      permissions: { allow: [], deny: [], ask: [] },
    });

    if (!settings.permissions) settings.permissions = { allow: [], deny: [], ask: [] };
    if (!Array.isArray(settings.permissions.allow)) settings.permissions.allow = [];

    if (settings.permissions.allow.includes(BEADS_PERMISSION)) return;

    settings.permissions.allow.push(BEADS_PERMISSION);
    this.writeJsonSafe(this.settingsLocalPath, settings);
  }

  removePermission(): void {
    if (!fs.existsSync(this.settingsLocalPath)) return;

    try {
      const settings = JSON.parse(fs.readFileSync(this.settingsLocalPath, 'utf8'));
      if (!Array.isArray(settings.permissions?.allow)) return;

      settings.permissions.allow = settings.permissions.allow.filter(
        (p: string) => p !== BEADS_PERMISSION
      );

      fs.writeFileSync(this.settingsLocalPath, JSON.stringify(settings, null, 2) + '\n', 'utf8');
    } catch {
      // Malformed settings — nothing to remove
    }
  }

  // ── Health Check ───────────────────────────────────────────────

  verify(): BeadsHealthReport {
    const issues: BeadsIssue[] = [];

    // Check jq
    try {
      execSync('which jq', { stdio: 'pipe' });
    } catch {
      issues.push({ component: 'jq', status: 'missing', detail: 'jq not found in PATH', fixable: false });
    }

    // Check bd binary
    const bdVersion = this.getBdVersion();
    if (!bdVersion) {
      issues.push({ component: 'bd-binary', status: 'missing', detail: 'bd not found in PATH', fixable: true });
    } else if (bdVersion !== BEADS_VERSION) {
      issues.push({
        component: 'bd-version',
        status: 'wrong-version',
        detail: `bd v${bdVersion} found, requires v${BEADS_VERSION}`,
        fixable: true,
      });
    }

    // Check .beads/ directory
    if (!fs.existsSync(this.beadsDir)) {
      issues.push({ component: 'beads-init', status: 'missing', detail: '.beads/ directory not found', fixable: true });
    }

    // Check hook file
    if (!fs.existsSync(this.hookTarget)) {
      issues.push({ component: 'hook-file', status: 'missing', detail: 'Hook script not installed', fixable: true });
    } else if (fs.existsSync(this.hookSource)) {
      // Check staleness
      const sourceContent = fs.readFileSync(this.hookSource, 'utf8');
      const hash = crypto.createHash('sha256').update(sourceContent).digest('hex').slice(0, 8);
      const expectedVersionLine = `${HOOK_VERSION_PREFIX} ${hash}`;

      const targetContent = fs.readFileSync(this.hookTarget, 'utf8');
      const targetVersionLine = targetContent.split('\n').find(l => l.startsWith(HOOK_VERSION_PREFIX));

      if (targetVersionLine !== expectedVersionLine) {
        issues.push({ component: 'hook-file', status: 'stale', detail: 'Hook script is outdated', fixable: true });
      }
    }

    // Check hook config in settings.json
    if (!this.hasHookConfig()) {
      issues.push({ component: 'hook-config', status: 'missing', detail: 'PostToolUse hook not configured', fixable: true });
    }

    // Check permission
    if (!this.hasPermission()) {
      issues.push({ component: 'permission', status: 'missing', detail: `${BEADS_PERMISSION} permission not set`, fixable: true });
    }

    return {
      healthy: issues.length === 0,
      issues,
    };
  }

  private hasHookConfig(): boolean {
    if (!fs.existsSync(this.settingsJsonPath)) return false;
    try {
      const settings = JSON.parse(fs.readFileSync(this.settingsJsonPath, 'utf8'));
      if (!Array.isArray(settings.hooks?.PostToolUse)) return false;
      return settings.hooks.PostToolUse.some((entry: any) =>
        entry.matcher === 'Bash' &&
        Array.isArray(entry.hooks) &&
        entry.hooks.some((h: any) =>
          typeof h.command === 'string' && h.command.includes('ddx-refresh-plan')
        )
      );
    } catch {
      return false;
    }
  }

  private hasPermission(): boolean {
    if (!fs.existsSync(this.settingsLocalPath)) return false;
    try {
      const settings = JSON.parse(fs.readFileSync(this.settingsLocalPath, 'utf8'));
      return Array.isArray(settings.permissions?.allow) &&
        settings.permissions.allow.includes(BEADS_PERMISSION);
    } catch {
      return false;
    }
  }

  // ── Repair ─────────────────────────────────────────────────────

  async repair(report: BeadsHealthReport): Promise<string[]> {
    const fixed: string[] = [];

    for (const issue of report.issues) {
      if (!issue.fixable) continue;

      switch (issue.component) {
        case 'bd-binary':
        case 'bd-version': {
          const result = await this.ensureInstalled();
          fixed.push(`bd ${result.status} (v${result.version})`);
          break;
        }
        case 'beads-init':
          this.initialize();
          fixed.push('.beads/ initialized');
          break;
        case 'hook-file':
          this.installHook();
          fixed.push('Hook script installed');
          break;
        case 'hook-config':
          this.addHookConfig();
          fixed.push('PostToolUse hook configured');
          break;
        case 'permission':
          this.addPermission();
          fixed.push(`${BEADS_PERMISSION} permission added`);
          break;
      }
    }

    return fixed;
  }

  // ── Full Setup (with rollback) ─────────────────────────────────

  async setup(): Promise<SetupResult> {
    const completed: string[] = [];

    try {
      await this.ensureInstalled();
      completed.push('install');

      this.initialize();
      completed.push('init');

      this.installHook();
      completed.push('hook');

      this.addHookConfig();
      completed.push('hook-config');

      this.addPermission();
      completed.push('permission');

      return { success: true };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);

      // Rollback hook/config/permission changes (leave bd and .beads/ alone)
      if (completed.includes('permission')) {
        try { this.removePermission(); } catch { /* best effort */ }
      }
      if (completed.includes('hook-config')) {
        try { this.removeHookConfig(); } catch { /* best effort */ }
      }
      if (completed.includes('hook')) {
        try { this.removeHook(); } catch { /* best effort */ }
      }

      return { success: false, error };
    }
  }

  // ── Full Teardown ──────────────────────────────────────────────

  teardown(): TeardownResult {
    const warnings: string[] = [];

    this.removeHook();
    this.removeHookConfig();
    this.removePermission();

    if (fs.existsSync(this.beadsDir)) {
      warnings.push('.beads/ directory preserved. To remove: rm -rf .beads/');
    }

    return { warnings };
  }

  // ── Helpers ────────────────────────────────────────────────────

  private readJsonSafe(filePath: string, fallback: any): any {
    if (fs.existsSync(filePath)) {
      try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
      } catch {
        return fallback;
      }
    }
    return fallback;
  }

  private writeJsonSafe(filePath: string, data: any): void {
    this.fileManager.ensureDirectory(path.dirname(filePath));
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
  }
}
