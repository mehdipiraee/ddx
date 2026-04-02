/**
 * Design mode setting handler — toggles between ASCII and HTML design documents
 */

import { SettingHandler } from './types';
import { downloadTailwind, tailwindExists, removeTailwind } from '../utils/tailwind';

export class DesignModeHandler implements SettingHandler {
  key = 'design-mode';
  label = 'Design Mode';
  description = 'How design documents are generated';
  allowedValues = ['ascii', 'html'];

  getCurrentValue(configContent: string): string {
    const match = configContent.match(/mode:\s*"([^"]*)"/);
    return match ? match[1] : 'ascii';
  }

  validate(value: string): string | null {
    if (this.allowedValues.includes(value)) return null;
    return `Invalid value "${value}". Allowed: ${this.allowedValues.join(', ')}`;
  }

  apply(configContent: string, value: string): string {
    return configContent.replace(
      /mode:\s*"[^"]*".*$/m,
      `mode: "${value}"   # "ascii" or "html"`
    );
  }

  sideEffectMessage(value: string, toolingDir: string): string | null {
    if (value === 'html' && !tailwindExists(toolingDir)) {
      return 'Downloading Tailwind CSS...';
    }
    if (value === 'ascii' && tailwindExists(toolingDir)) {
      return 'Removing Tailwind CSS...';
    }
    return null;
  }

  async sideEffects(value: string, toolingDir: string): Promise<void> {
    if (value === 'html' && !tailwindExists(toolingDir)) {
      await downloadTailwind(toolingDir);
    }
    if (value === 'ascii' && tailwindExists(toolingDir)) {
      removeTailwind(toolingDir);
    }
  }
}
