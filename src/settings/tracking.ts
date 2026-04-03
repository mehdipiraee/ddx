/**
 * Tracking setting handler — toggles between text-based plan tracking and Beads
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { SettingHandler } from './types';
import { FileManager } from '../infra/file-manager';

const BEADS_VERSION = '0.63.3';

export class TrackingHandler implements SettingHandler {
  key = 'tracking';
  label = 'Plan Tracking';
  description = 'How build progress is tracked';
  allowedValues = ['text', 'beads'];

  getCurrentValue(configContent: string): string {
    const match = configContent.match(/tracking:\s*\n\s+enabled:\s*(true|false)/);
    if (match && match[1] === 'true') return 'beads';
    return 'text';
  }

  validate(value: string): string | null {
    if (this.allowedValues.includes(value)) return null;
    return `Invalid value "${value}". Allowed: ${this.allowedValues.join(', ')}`;
  }

  apply(configContent: string, value: string): string {
    const hasTracking = /^tracking:\s*$/m.test(configContent);

    if (value === 'beads') {
      if (hasTracking) {
        return configContent.replace(
          /^(tracking:\s*\n\s+enabled:\s*)(?:true|false)/m,
          '$1true'
        );
      }
      return configContent + '\n# Task Tracking (Beads)\ntracking:\n  enabled: true\n';
    }

    // value === 'text'
    if (hasTracking) {
      return configContent.replace(
        /^(tracking:\s*\n\s+enabled:\s*)(?:true|false)/m,
        '$1false'
      );
    }
    return configContent;
  }

  sideEffectMessage(value: string, _toolingDir: string): string | null {
    if (value === 'beads') return 'Setting up Beads tracking...';
    return 'Removing Beads tracking...';
  }

  async sideEffects(value: string, toolingDir: string): Promise<void> {
    const projectDir = path.dirname(toolingDir);
    const ddxPackageDir = path.join(__dirname, '..', '..');

    if (value === 'beads') {
      await this.enableBeads(projectDir, ddxPackageDir);
    } else {
      this.disableBeads(projectDir);
    }
  }

  private async enableBeads(projectDir: string, ddxPackageDir: string): Promise<void> {
    // Check jq
    try {
      execSync('which jq', { stdio: 'pipe' });
    } catch {
      throw new Error('jq is required for Beads tracking. Install: brew install jq');
    }

    // Check bd version
    try {
      const versionOutput = execSync('bd --version', { stdio: 'pipe' }).toString().trim();
      const versionMatch = versionOutput.match(/(\d+\.\d+\.\d+)/);
      const installedVersion = versionMatch ? versionMatch[1] : null;
      if (installedVersion !== BEADS_VERSION) {
        throw new Error(`bd v${installedVersion || 'unknown'} found, requires v${BEADS_VERSION}. Run: brew upgrade beads`);
      }
    } catch (err) {
      if (err instanceof Error && err.message.includes('requires')) throw err;
      throw new Error(`bd not found. Install: brew install beads`);
    }

    // Initialize beads if not already
    try {
      execSync('bd init --quiet', { cwd: projectDir, stdio: 'pipe' });
    } catch {
      // Already initialized is fine
    }

    // Install hook
    const sourceHook = path.join(ddxPackageDir, 'hooks', 'ddx-refresh-plan.sh');
    const targetHooksDir = path.join(projectDir, '.claude', 'hooks');
    const targetHook = path.join(targetHooksDir, 'ddx-refresh-plan.sh');

    if (fs.existsSync(sourceHook)) {
      const fileManager = new FileManager();
      fileManager.ensureDirectory(targetHooksDir);
      fs.copyFileSync(sourceHook, targetHook);
      fs.chmodSync(targetHook, 0o755);
    }

    // Add hook config to settings.json
    this.addHookConfig(projectDir);

    // Add Bash(bd:*) permission
    this.addBeadsPermission(projectDir);
  }

  private disableBeads(projectDir: string): void {
    // Remove hook file
    const hookPath = path.join(projectDir, '.claude', 'hooks', 'ddx-refresh-plan.sh');
    if (fs.existsSync(hookPath)) {
      fs.unlinkSync(hookPath);
    }

    // Remove hook config from settings.json
    this.removeHookConfig(projectDir);

    // Remove Bash(bd:*) permission
    this.removeBeadsPermission(projectDir);
  }

  private addHookConfig(projectDir: string): void {
    const settingsPath = path.join(projectDir, '.claude', 'settings.json');

    let settings: any = {};
    if (fs.existsSync(settingsPath)) {
      try {
        settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      } catch {
        settings = {};
      }
    }

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

    const fileManager = new FileManager();
    fileManager.ensureDirectory(path.dirname(settingsPath));
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n', 'utf8');
  }

  private removeHookConfig(projectDir: string): void {
    const settingsPath = path.join(projectDir, '.claude', 'settings.json');
    if (!fs.existsSync(settingsPath)) return;

    try {
      const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      if (!Array.isArray(settings.hooks?.PostToolUse)) return;

      settings.hooks.PostToolUse = settings.hooks.PostToolUse.filter((entry: any) =>
        !(entry.matcher === 'Bash' &&
          Array.isArray(entry.hooks) &&
          entry.hooks.some((h: any) =>
            typeof h.command === 'string' && h.command.includes('ddx-refresh-plan')
          ))
      );

      fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n', 'utf8');
    } catch {
      // Malformed settings, nothing to remove
    }
  }

  private addBeadsPermission(projectDir: string): void {
    const settingsPath = path.join(projectDir, '.claude', 'settings.local.json');

    let settings: any = { permissions: { allow: [], deny: [], ask: [] } };
    if (fs.existsSync(settingsPath)) {
      try {
        settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
        if (!settings.permissions) settings.permissions = { allow: [], deny: [], ask: [] };
        if (!Array.isArray(settings.permissions.allow)) settings.permissions.allow = [];
      } catch {
        settings = { permissions: { allow: [], deny: [], ask: [] } };
      }
    }

    if (settings.permissions.allow.includes('Bash(bd:*)')) return;

    settings.permissions.allow.push('Bash(bd:*)');
    const fileManager = new FileManager();
    fileManager.ensureDirectory(path.dirname(settingsPath));
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n', 'utf8');
  }

  private removeBeadsPermission(projectDir: string): void {
    const settingsPath = path.join(projectDir, '.claude', 'settings.local.json');
    if (!fs.existsSync(settingsPath)) return;

    try {
      const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      if (!Array.isArray(settings.permissions?.allow)) return;

      settings.permissions.allow = settings.permissions.allow.filter(
        (p: string) => p !== 'Bash(bd:*)'
      );

      fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n', 'utf8');
    } catch {
      // Malformed settings, nothing to remove
    }
  }
}
