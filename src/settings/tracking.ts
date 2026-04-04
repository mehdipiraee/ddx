/**
 * Tracking setting handler — toggles between text-based plan tracking and Beads.
 * Delegates all beads operations to BeadsManager.
 */

import * as fs from 'fs';
import * as path from 'path';
import { SettingHandler } from './types';
import { BeadsManager } from '../infra/beads';

export class TrackingHandler implements SettingHandler {
  key = 'tracking';
  label = 'Plan Tracking';
  description = 'How build progress is tracked';
  allowedValues = ['text', 'beads'];

  private lastTeardownWarnings: string[] = [];

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
    const beads = new BeadsManager(projectDir, ddxPackageDir);

    if (value === 'beads') {
      const result = await beads.setup();
      if (!result.success) {
        throw new Error(result.error || 'Beads setup failed');
      }
    } else {
      const result = beads.teardown();
      this.lastTeardownWarnings = result.warnings;
    }
  }

  sideEffectWarnings(value: string, toolingDir: string): string[] | null {
    if (value === 'text' && this.lastTeardownWarnings.length > 0) {
      return this.lastTeardownWarnings;
    }

    // Also check proactively when disabling (in case sideEffects hasn't run yet)
    if (value === 'text') {
      const projectDir = path.dirname(toolingDir);
      const beadsDir = path.join(projectDir, '.beads');
      if (fs.existsSync(beadsDir)) {
        return ['.beads/ directory preserved. To remove: rm -rf .beads/'];
      }
    }

    return null;
  }
}
