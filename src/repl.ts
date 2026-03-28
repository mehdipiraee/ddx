/**
 * Interactive REPL for DDX — fallback interface when not using Claude Code skills
 */

import * as readline from 'readline';
import * as chalk from 'chalk';
import { DDXEngine } from './engine';
import { ConsistencyIssue } from './types';

export class DDXRepl {
  private engine: DDXEngine;
  private rl: readline.Interface;

  constructor() {
    this.engine = new DDXEngine();
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }

  async start(): Promise<void> {
    console.log(chalk.default.bold('\nDDX Interactive Mode\n'));
    console.log('Commands: list, create <type>, check <type>, status, help, quit\n');

    this.prompt();
  }

  private prompt(): void {
    this.rl.question(chalk.default.cyan('ddx> '), async (input) => {
      const trimmed = input.trim();
      if (!trimmed) {
        this.prompt();
        return;
      }

      const [command, ...args] = trimmed.split(/\s+/);

      try {
        switch (command.toLowerCase()) {
          case 'list':
            this.handleList();
            break;
          case 'create':
            if (!args[0]) {
              console.log('Usage: create <document-type>');
            } else {
              await this.handleCreate(args[0]);
            }
            break;
          case 'check':
            if (!args[0]) {
              console.log('Usage: check <document-type>');
            } else {
              await this.handleCheck(args[0]);
            }
            break;
          case 'status':
            this.handleStatus();
            break;
          case 'help':
            this.handleHelp();
            break;
          case 'quit':
          case 'exit':
            console.log('');
            this.rl.close();
            return;
          default:
            console.log(`Unknown command: ${command}. Type 'help' for available commands.`);
        }
      } catch (error) {
        if (error instanceof Error) {
          console.error(chalk.default.red(`\nError: ${error.message}\n`));
        } else {
          console.error(chalk.default.red('\nUnexpected error'), error);
        }
      }

      this.prompt();
    });
  }

  private handleList(): void {
    const result = this.engine.listDocuments();
    console.log('');
    for (const doc of result.documents) {
      const status = doc.exists ? chalk.default.green('exists') : chalk.default.dim('not created');
      console.log(`  ${chalk.default.bold(doc.type)} - ${doc.name} [${status}]`);
      if (doc.upstream.length > 0) {
        console.log(`    Upstream: ${doc.upstream.join(', ')}`);
      }
      console.log(`    Output: ${doc.outputPath}`);
    }
    console.log('');
  }

  private async handleCreate(documentType: string): Promise<void> {
    // Start creation
    console.log('');
    const createResult = await this.engine.createDocument(documentType);
    console.log(createResult.response);

    if (createResult.consistencyCheck && !createResult.consistencyCheck.allConsistent) {
      this.printConsistencyIssues(createResult.consistencyCheck.inconsistencies);
    }

    if (createResult.documentWritten) {
      console.log(chalk.default.green(`\nDocument written: ${createResult.documentPath}`));
    }

    // Enter conversation loop
    await this.conversationLoop(documentType);
  }

  private async conversationLoop(documentType: string): Promise<void> {
    console.log(chalk.default.dim('\n(Type your response, or "done" to exit conversation)\n'));

    const askUser = (): Promise<string> => {
      return new Promise((resolve) => {
        this.rl.question(chalk.default.cyan('you> '), (answer) => {
          resolve(answer.trim());
        });
      });
    };

    while (true) {
      const userInput = await askUser();

      if (!userInput) continue;
      if (userInput.toLowerCase() === 'done' || userInput.toLowerCase() === 'quit') {
        console.log('');
        break;
      }

      const result = await this.engine.continueDocument(documentType, userInput);
      console.log(`\n${result.response}`);

      if (result.documentWritten) {
        console.log(chalk.default.green(`\nDocument written: ${result.documentPath}`));
      }

      if (result.consistencyCheck && !result.consistencyCheck.allConsistent) {
        this.printConsistencyIssues(result.consistencyCheck.inconsistencies);
      }

      if (result.isComplete) {
        console.log(chalk.default.green('\nWorkflow complete.'));
        break;
      }
    }
  }

  private async handleCheck(documentType: string): Promise<void> {
    console.log('');
    const result = await this.engine.checkDocument(documentType);

    // Print chain
    console.log(chalk.default.bold('Document Chain:'));
    const inconsistentDocs = new Set(result.inconsistencies.map(i => i.docType));
    for (const docType of result.chain) {
      const exists = this.engine.documentExists(docType);
      const isCurrent = docType === documentType;
      const hasIssue = inconsistentDocs.has(docType);

      let label = `  ${docType}`;
      if (!exists) {
        label = chalk.default.dim(`${label} (not created)`);
      } else if (isCurrent && hasIssue) {
        label = chalk.default.yellow(`${label} (has inconsistencies)`);
      } else if (isCurrent) {
        label = chalk.default.cyan(`${label} (checking)`);
      } else if (hasIssue) {
        label = chalk.default.yellow(`${label} (inconsistent)`);
      } else {
        label = chalk.default.green(`${label} (consistent)`);
      }
      console.log(label);
    }

    if (result.allConsistent) {
      console.log(chalk.default.green('\nAll documents are consistent.\n'));
    } else {
      this.printConsistencyIssues(result.inconsistencies);
      console.log('');
    }
  }

  private printConsistencyIssues(inconsistencies: ConsistencyIssue[]): void {
    for (const issue of inconsistencies) {
      console.log(chalk.default.yellow(`\n--- ${issue.docName} (${issue.direction}) ---`));
      console.log(issue.issues);
    }
  }

  private handleStatus(): void {
    const result = this.engine.listDocuments();
    console.log('');
    for (const doc of result.documents) {
      const icon = doc.exists ? chalk.default.green('●') : chalk.default.dim('○');
      console.log(`  ${icon} ${doc.name}`);
    }
    console.log('');
  }

  private handleHelp(): void {
    console.log(`
  ${chalk.default.bold('Commands:')}
    list              List all document types and their status
    create <type>     Start creating a document (enters conversation)
    check <type>      Check document consistency
    status            Show which documents exist
    help              Show this help
    quit              Exit

  ${chalk.default.bold('Document types:')} opportunity_brief, one_pager, prd, sdd

  ${chalk.default.bold('Tip:')} Use Claude Code skills for a better experience:
    /define           Create Opportunity Brief
    /architect        Create Product One-Pager
    /design           Create PRD
    /blueprint        Create System Design Document
    /check            Run consistency check
`);
  }
}
