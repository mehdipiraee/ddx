#!/usr/bin/env node

/**
 * DDX CLI - Simplified entry point
 *
 * Commands: init, list
 * Default (no args): launches interactive REPL
 */

import { Command } from 'commander';
import * as chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { ConfigLoader } from './infra/config';
import { BeadsManager, BEADS_VERSION } from './infra/beads';
import { InitCommand } from './init';
import { DDXRepl } from './repl';
import { ConfigRepl } from './config-repl';
const program = new Command();

program
  .name('ddx')
  .description('AI-human collaboration tool for maintaining source of truth documentation')
  .version('0.1.5');

program
  .command('init')
  .description('Initialize DDX in the current directory')
  .option('-f, --force', 'Overwrite existing files')
  .action(async (options: { force?: boolean }) => {
    try {
      const initCommand = new InitCommand();
      await initCommand.execute(options);
    } catch (error) {
      handleError(error);
    }
  });

program
  .command('list')
  .description('List available document types')
  .action(() => {
    try {
      const configLoader = new ConfigLoader();
      const config = configLoader.load();

      console.log('\nAvailable document types:\n');

      for (const [docType, docConfig] of Object.entries(config.documents)) {
        console.log(`  ${chalk.default.bold(docType)} - ${docConfig.name}`);

        if (docConfig.upstream.length > 0) {
          console.log(`    Upstream: ${docConfig.upstream.join(', ')}`);
        }

        if (docConfig.downstream.length > 0) {
          console.log(`    Downstream: ${docConfig.downstream.join(', ')}`);
        }

        console.log(`    Output: ${docConfig.output}\n`);
      }
    } catch (error) {
      handleError(error);
    }
  });

program
  .command('config')
  .description('Change DDX settings')
  .action(async () => {
    try {
      const configRepl = new ConfigRepl();
      await configRepl.start();
    } catch (error) {
      handleError(error);
    }
  });

program
  .command('doctor')
  .description('Check DDX integration health')
  .action(async () => {
    const c = chalk.default;
    const targetDir = process.cwd();
    const configPath = path.join(targetDir, '.ddx-tooling', 'config.yaml');

    if (!fs.existsSync(configPath)) {
      console.log(c.yellow('\n  DDX is not initialized in this directory. Run: ddx init\n'));
      return;
    }

    const configContent = fs.readFileSync(configPath, 'utf8');
    const trackingMatch = configContent.match(/tracking:\s*\n\s+enabled:\s*(true|false)/);
    const trackingEnabled = trackingMatch && trackingMatch[1] === 'true';

    console.log(c.bold('\n  DDX Health Check\n'));

    // Check DDX core files
    const coreFiles = [
      { path: '.ddx-tooling/config.yaml', label: 'Config' },
      { path: '.ddx-tooling/prompts', label: 'Prompts' },
      { path: '.ddx-tooling/templates', label: 'Templates' },
      { path: '.claude/skills', label: 'Skills' },
      { path: 'ddx', label: 'DDX directory' },
    ];

    for (const file of coreFiles) {
      const exists = fs.existsSync(path.join(targetDir, file.path));
      const icon = exists ? c.green('  ✓') : c.red('  ✗');
      console.log(`${icon} ${file.label}`);
    }

    // Check beads if tracking is enabled
    if (!trackingEnabled) {
      console.log(c.dim('\n  Beads tracking: disabled\n'));
      return;
    }

    console.log(c.bold(`\n  Beads Tracking (pinned to v${BEADS_VERSION})\n`));

    const ddxPackageDir = path.join(__dirname, '..');
    const beads = new BeadsManager(targetDir, ddxPackageDir);
    const report = beads.verify();

    if (report.healthy) {
      console.log(c.green('  ✓ All beads components healthy\n'));
      return;
    }

    for (const issue of report.issues) {
      const icon = c.red('  ✗');
      const fixable = issue.fixable ? c.dim(' (auto-fixable)') : c.dim(' (manual fix required)');
      console.log(`${icon} ${issue.component}: ${issue.detail}${fixable}`);
    }

    const fixableCount = report.issues.filter(i => i.fixable).length;

    if (fixableCount === 0) {
      console.log();
      return;
    }

    console.log();
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

    const answer = await new Promise<string>((resolve) => {
      rl.question(c.dim(`  Fix ${fixableCount} issue(s) automatically? [y/N] `), resolve);
    });
    rl.close();

    if (answer.trim().toLowerCase() !== 'y') {
      console.log();
      return;
    }

    try {
      const fixed = await beads.repair(report);
      for (const msg of fixed) {
        console.log(c.green(`  ✓ ${msg}`));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(c.red(`  ✗ Repair failed: ${msg}`));
    }
    console.log();
  });

function handleError(error: any) {
  if (error instanceof Error) {
    console.error(chalk.default.red('\nError:'), error.message);
  } else {
    console.error(chalk.default.red('\nUnexpected error:'), error);
  }
  process.exit(1);
}

// If no subcommand given, launch REPL
if (process.argv.length <= 2) {
  try {
    const repl = new DDXRepl();
    repl.start();
  } catch (error) {
    handleError(error);
  }
} else {
  program.parse();
}
