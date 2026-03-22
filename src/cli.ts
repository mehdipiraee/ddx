#!/usr/bin/env node

/**
 * DDX CLI - Main entry point
 */

import { Command } from 'commander';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as chalk from 'chalk';
import { ConfigLoader } from './config';
import { FileManager } from './file-manager';
import { StateManager } from './state-manager';
import { LLMClient } from './llm-client';
import { WorkflowEngine } from './workflow';
import { InitCommand } from './init';

// Load environment variables from ddx/.env
dotenv.config({ path: path.join(process.cwd(), 'ddx', '.env') });

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
  .command('create <document-type>')
  .description('Start creating a new document')
  .action(async (documentType: string) => {
    try {
      const { workflow } = initializeWorkflow();
      await workflow.createDocument(documentType);
    } catch (error) {
      handleError(error);
    }
  });

program
  .command('continue <document-type>')
  .description('Continue working on a document after editing')
  .option('-m, --message <message>', 'Optional message to send to the AI')
  .action(async (documentType: string, options: { message?: string }) => {
    try {
      const { workflow } = initializeWorkflow();
      await workflow.continueDocument(documentType, options.message);
    } catch (error) {
      handleError(error);
    }
  });

program
  .command('check <document-type>')
  .description('Check document consistency with upstream and downstream documents')
  .action(async (documentType: string) => {
    try {
      const { workflow } = initializeWorkflow();
      await workflow.checkDocument(documentType);
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

function initializeWorkflow() {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new Error(
      'ANTHROPIC_API_KEY not found.\n' +
      'Please create a ddx/.env file with your API key:\n' +
      '  echo "ANTHROPIC_API_KEY=your_key_here" > ddx/.env'
    );
  }

  const configLoader = new ConfigLoader();
  const config = configLoader.load();
  const fileManager = new FileManager();
  const stateManager = new StateManager(config.workflow.state_dir);
  const llmClient = new LLMClient(apiKey, config.llm);
  const workflow = new WorkflowEngine(configLoader, fileManager, stateManager, llmClient);

  return { configLoader, fileManager, stateManager, llmClient, workflow };
}

function handleError(error: any) {
  if (error instanceof Error) {
    console.error(chalk.default.red('\n✗ Error:'), error.message);
  } else {
    console.error(chalk.default.red('\n✗ Unexpected error:'), error);
  }
  process.exit(1);
}

program.parse();
