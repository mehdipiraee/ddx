#!/usr/bin/env node

/**
 * DDX CLI - Simplified entry point
 *
 * Commands: init, list
 * Default (no args): launches interactive REPL
 */

import { Command } from 'commander';
import * as chalk from 'chalk';
import { ConfigLoader } from './infra/config';
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
