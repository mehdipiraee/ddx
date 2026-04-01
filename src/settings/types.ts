/**
 * Setting handler interface for the config REPL.
 * Each configurable setting implements this interface.
 */

export interface SettingHandler {
  key: string;
  label: string;
  description: string;
  allowedValues: string[];

  getCurrentValue(configContent: string): string;
  validate(value: string): string | null; // null = valid, string = error message
  apply(configContent: string, value: string): string; // returns new config content
  sideEffects?(value: string, toolingDir: string): Promise<void>;
}
