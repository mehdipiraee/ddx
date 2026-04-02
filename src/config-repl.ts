/**
 * Config TUI — keyboard-navigable interface for changing DDX settings post-init
 *
 * Up/Down:    navigate rows
 * Left/Right: cycle setting values
 * Enter:      execute action row (Exit / Save / Save & Exit)
 * q:          quit without saving
 */

import * as readline from 'readline';
import * as path from 'path';
import * as chalk from 'chalk';
import { ConfigWriter } from './infra/config-writer';
import { SettingHandler, DesignModeHandler } from './settings';
import { banner } from './utils/banner';

const c = chalk.default;
const dim = c.dim;
const green = c.green;
const red = c.red;
const cyan = c.cyan;
const bold = c.bold;
const yellow = c.yellow;

// ── Row types ───────────────────────────────────────────────

type ActionKind = 'exit' | 'save' | 'save-exit';

interface Action {
  label: string;
  kind: ActionKind;
}

const ACTIONS: Action[] = [
  { label: 'Exit', kind: 'exit' },
  { label: 'Save', kind: 'save' },
  { label: 'Save & Exit', kind: 'save-exit' },
];

interface ActionBarRow {
  type: 'action-bar';
}

interface SettingRow {
  type: 'setting';
  handler: SettingHandler;
}

type Row = ActionBarRow | SettingRow;

// ── ConfigRepl ──────────────────────────────────────────────

export class ConfigRepl {
  private writer: ConfigWriter;
  private toolingDir: string;
  private handlers: SettingHandler[];
  private rows: Row[];
  private cursor = 0;
  private actionCursor = 0; // which action within an action-bar is focused

  // Pending values that haven't been saved yet (key → value)
  private pending: Map<string, string> = new Map();
  // Values as they exist on disk
  private saved: Map<string, string> = new Map();

  private statusLines: string[] = [];
  private running = false;

  constructor() {
    this.toolingDir = path.join(process.cwd(), '.ddx-tooling');
    this.writer = new ConfigWriter();

    if (!this.writer.exists()) {
      throw new Error('DDX not initialized. Run \'ddx init\' first.');
    }

    this.handlers = [new DesignModeHandler()];
    this.rows = this.buildRows();
    this.loadSavedValues();

    // Start cursor on first setting row (after top action bar)
    this.cursor = 1;
  }

  private buildRows(): Row[] {
    const rows: Row[] = [];
    rows.push({ type: 'action-bar' });
    for (const handler of this.handlers) {
      rows.push({ type: 'setting', handler });
    }
    rows.push({ type: 'action-bar' });
    return rows;
  }

  private loadSavedValues(): void {
    const content = this.writer.readRaw();
    for (const handler of this.handlers) {
      const val = handler.getCurrentValue(content);
      this.saved.set(handler.key, val);
    }
  }

  private getCurrentValue(key: string): string {
    return this.pending.get(key) ?? this.saved.get(key) ?? '';
  }

  private get hasUnsaved(): boolean {
    for (const [key, val] of this.pending) {
      if (this.saved.get(key) !== val) return true;
    }
    return false;
  }

  // ── Lifecycle ───────────────────────────────────────────

  start(): Promise<void> {
    return new Promise((resolve) => {
      this.running = true;

      // Hide cursor & enable raw mode
      process.stdout.write('\x1B[?25l');
      process.stdin.setRawMode(true);
      process.stdin.resume();

      readline.emitKeypressEvents(process.stdin);

      const onKeypress = (_str: string | undefined, key: readline.Key) => {
        if (!this.running) return;

        if (key.name === 'up') {
          this.cursor = (this.cursor - 1 + this.rows.length) % this.rows.length;
          this.render();
        } else if (key.name === 'down') {
          this.cursor = (this.cursor + 1) % this.rows.length;
          this.render();
        } else if (key.name === 'left' || key.name === 'right') {
          this.handleLeftRight(key.name);
          this.render();
        } else if (key.name === 'return') {
          this.handleEnter().then(() => {
            if (this.running) this.render();
          });
          return;
        } else if (key.name === 'q' || (key.ctrl && key.name === 'c')) {
          this.exit();
        }
      };

      process.stdin.on('keypress', onKeypress);

      this.render();

      const cleanup = () => {
        this.running = false;
        process.stdin.removeListener('keypress', onKeypress);
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdout.write('\x1B[?25h'); // show cursor
        resolve();
      };

      // Store cleanup so exit() can call it
      this._cleanup = cleanup;
    });
  }

  private _cleanup: (() => void) | null = null;

  private exit(): void {
    if (this._cleanup) this._cleanup();
    console.log('');
  }

  // ── Input handlers ──────────────────────────────────────

  private handleLeftRight(direction: 'left' | 'right'): void {
    const row = this.rows[this.cursor];

    if (row.type === 'action-bar') {
      if (direction === 'right') {
        this.actionCursor = (this.actionCursor + 1) % ACTIONS.length;
      } else {
        this.actionCursor = (this.actionCursor - 1 + ACTIONS.length) % ACTIONS.length;
      }
      return;
    }

    if (row.type !== 'setting') return;

    const handler = row.handler;
    const current = this.getCurrentValue(handler.key);
    const values = handler.allowedValues;
    const idx = values.indexOf(current);
    let next: number;

    if (direction === 'right') {
      next = (idx + 1) % values.length;
    } else {
      next = (idx - 1 + values.length) % values.length;
    }

    this.pending.set(handler.key, values[next]);
    this.statusLines = [];
  }

  private async handleEnter(): Promise<void> {
    const row = this.rows[this.cursor];
    if (row.type !== 'action-bar') return;

    const action = ACTIONS[this.actionCursor];

    switch (action.kind) {
      case 'exit':
        this.exit();
        return;

      case 'save':
        await this.save();
        this.render();
        return;

      case 'save-exit':
        await this.save();
        this.exit();
        return;
    }
  }

  private async save(): Promise<void> {
    if (!this.hasUnsaved) {
      this.statusLines = [dim('  No changes to save.')];
      return;
    }

    this.statusLines = [];
    let content = this.writer.readRaw();

    for (const handler of this.handlers) {
      const pendingVal = this.pending.get(handler.key);
      if (pendingVal === undefined) continue;
      if (pendingVal === this.saved.get(handler.key)) continue;

      content = handler.apply(content, pendingVal);

      if (handler.sideEffects) {
        const progressMsg = handler.sideEffectMessage?.(pendingVal, this.toolingDir);
        if (progressMsg) {
          this.statusLines.push(yellow(`  ⏳ ${progressMsg}`));
          this.render();
        }
        try {
          await handler.sideEffects(pendingVal, this.toolingDir);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          this.statusLines.push(red(`  ✗ ${handler.key}: ${msg}`));
          return;
        }
      }
    }

    this.writer.writeRaw(content);

    // Update saved state and clear pending
    for (const handler of this.handlers) {
      const val = this.pending.get(handler.key);
      if (val !== undefined) {
        this.saved.set(handler.key, val);
      }
    }
    this.pending.clear();
    this.statusLines.push(green('  ✓ Saved'));
  }

  // ── Rendering ───────────────────────────────────────────

  private render(): void {
    // Clear screen and move to top
    process.stdout.write('\x1B[2J\x1B[H');

    const lines: string[] = [];

    lines.push(banner());
    lines.push('');
    lines.push(`    ${bold('Configuration')}${this.hasUnsaved ? yellow('  (unsaved changes)') : ''}`);
    lines.push('');

    for (let i = 0; i < this.rows.length; i++) {
      const row = this.rows[i];
      const selected = i === this.cursor;
      const isFirst = i === 0;
      const isLast = i === this.rows.length - 1;

      if (row.type === 'action-bar') {
        // Separator before bottom action bar
        if (isLast) {
          lines.push('');
          lines.push(dim('    ─────────────────────────────────────────'));
          lines.push('');
        }

        lines.push(this.renderActionBar(selected));

        // Separator after top action bar
        if (isFirst) {
          lines.push('');
          lines.push(dim('    ─────────────────────────────────────────'));
          lines.push('');
        }
      } else {
        lines.push(this.renderSettingRow(row, selected));
      }
    }
    lines.push('');

    if (this.statusLines.length > 0) {
      for (const line of this.statusLines) {
        lines.push(line);
      }
      lines.push('');
    }

    lines.push(dim('    ↑↓ navigate    ←→ change value    ⏎ select    q quit'));
    lines.push('');

    process.stdout.write(lines.join('\n'));
  }

  private renderActionBar(selected: boolean): string {
    const pointer = selected ? cyan('  ❯ ') : '    ';

    const items = ACTIONS.map((action, i) => {
      const isFocused = selected && i === this.actionCursor;
      if (isFocused) {
        return cyan(bold(`[ ${action.label} ]`));
      }
      return dim(action.label);
    });

    return `${pointer}${items.join(dim('    '))}`;
  }

  private renderSettingRow(row: SettingRow, selected: boolean): string {
    const handler = row.handler;
    const current = this.getCurrentValue(handler.key);
    const values = handler.allowedValues;
    const isModified = this.pending.has(handler.key) && this.pending.get(handler.key) !== this.saved.get(handler.key);

    const pointer = selected ? cyan('  ❯ ') : '    ';
    const label = selected ? bold(handler.key) : handler.key;
    const modified = isModified ? yellow(' *') : '  ';

    // Build value display with arrows
    const valueDisplay = values.map((v) => {
      if (v === current) {
        return selected ? cyan(bold(v)) : cyan(v);
      }
      return dim(v);
    }).join(dim('  │  '));

    const arrows = selected ? `${dim('◀')}  ${valueDisplay}  ${dim('▶')}` : `   ${valueDisplay}   `;

    return `${pointer}${label}${modified}${' '.repeat(Math.max(1, 18 - handler.key.length))}${arrows}`;
  }
}
