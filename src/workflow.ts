/**
 * Workflow orchestration for document creation (CLI presentation layer)
 */

import * as chalk from 'chalk';
import { ConfigLoader } from './config';
import { FileManager } from './file-manager';
import { StateManager } from './state-manager';
import { LLMClient } from './llm-client';
import { DocumentService } from './services/document-service';
import { ConversationService } from './services/conversation-service';
import { ConsistencyService } from './services/consistency-service';
import { ConsistencyIssue } from './types';

export class WorkflowEngine {
  private configLoader: ConfigLoader;
  private fileManager: FileManager;
  private documentService: DocumentService;
  private conversationService: ConversationService;
  private consistencyService: ConsistencyService;

  constructor(
    configLoader: ConfigLoader,
    fileManager: FileManager,
    stateManager: StateManager,
    llmClient: LLMClient
  ) {
    this.configLoader = configLoader;
    this.fileManager = fileManager;

    // Initialize services
    this.documentService = new DocumentService(configLoader, fileManager);
    this.conversationService = new ConversationService(llmClient, stateManager, this.documentService);
    this.consistencyService = new ConsistencyService(llmClient, configLoader, fileManager, this.documentService);
  }

  async createDocument(documentType: string): Promise<void> {
    const docConfig = this.documentService.getDocumentConfig(documentType);

    console.log(`\nStarting ${docConfig.name} creation workflow...\n`);

    const result = await this.conversationService.createDocument(documentType);

    console.log(result.response);
    console.log('\n---\n');

    // Auto-check consistency after create
    if (result.documentWritten) {
      console.log(`\n🔍 Running consistency check...`);
      try {
        await this.checkDocument(documentType);
      } catch (error) {
        if (error instanceof Error && error.message.includes('not found')) {
          console.log(`  ℹ️  Skipping check: upstream documents not ready yet`);
        } else {
          throw error;
        }
      }
    }

    // Display next steps
    if (result.documentWritten || this.documentService.documentExists(documentType)) {
      console.log(`\n✓ Document created: ${docConfig.output}`);
      console.log(`\nPlease review and edit the document, then run:`);
      console.log(`  ddx continue ${documentType}\n`);
    } else {
      console.log(`\nConversation in progress. When ready to continue, run:`);
      console.log(`  ddx continue ${documentType}\n`);
    }
  }

  async continueDocument(documentType: string, userInput?: string): Promise<void> {
    const docConfig = this.documentService.getDocumentConfig(documentType);

    console.log(`\nContinuing ${docConfig.name} workflow...\n`);

    const result = await this.conversationService.continueDocument(documentType, userInput);

    console.log(result.response);
    console.log('\n---\n');

    // Auto-check consistency after every continue
    if (result.documentWritten) {
      console.log(`\n🔍 Running consistency check...`);
      try {
        await this.checkDocument(documentType);
      } catch (error) {
        if (error instanceof Error && error.message.includes('not found')) {
          console.log(`  ℹ️  Skipping check: upstream documents not ready yet`);
        } else {
          throw error;
        }
      }
    }

    // Display next steps
    const isComplete = result.response.toLowerCase().includes('document is complete') ||
                       result.response.toLowerCase().includes('workflow complete');

    if (result.documentWritten) {
      console.log(`\n✓ Document created/updated: ${docConfig.output}`);
      console.log(`\nPlease review the document. To continue, run:`);
      console.log(`  ddx continue ${documentType}\n`);
    } else if (isComplete) {
      console.log(`\n✓ ${docConfig.name} workflow complete!`);
      if (this.documentService.documentExists(documentType)) {
        console.log(`\nDocument saved: ${docConfig.output}\n`);
      }
    } else {
      console.log(`\nTo continue, run:`);
      console.log(`  ddx continue ${documentType}\n`);
    }
  }

  async checkDocument(documentType: string): Promise<void> {
    const docConfig = this.documentService.getDocumentConfig(documentType);

    console.log(`\nChecking ${docConfig.name} for consistency...\n`);

    const result = await this.consistencyService.checkDocument(documentType);

    // Display document hierarchy
    this.displayDocumentHierarchy(documentType, result.inconsistencies);

    // Display detailed inconsistencies
    if (result.inconsistencies.length > 0) {
      console.log('\n');
      for (const inconsistency of result.inconsistencies) {
        this.displayInconsistencyDetails(documentType, inconsistency);
      }
    }

    console.log('');
  }

  private displayDocumentHierarchy(
    currentDocType: string,
    inconsistencies: ConsistencyIssue[]
  ): void {
    const config = this.configLoader.load();
    const chain = this.documentService.buildDocumentChain(currentDocType);
    const inconsistentDocs = new Set(inconsistencies.map(i => i.docType));

    // Display the chain
    console.log(chalk.default.bold('Document Chain:'));
    for (const docType of chain) {
      const docConfig = config.documents[docType];
      const isCurrent = docType === currentDocType;
      const hasInconsistency = inconsistentDocs.has(docType);
      const documentExists = this.fileManager.fileExists(docConfig.output);

      let line = `  ${docConfig.name}`;

      if (!documentExists) {
        line = chalk.default.white(line + ' (document not available)');
      } else if (isCurrent && hasInconsistency) {
        line = chalk.default.cyan.bold(line) + chalk.default.yellow(' (has inconsistencies) ⚠');
      } else if (isCurrent) {
        line = chalk.default.cyan.bold(line + ' (checking this document)');
      } else if (hasInconsistency) {
        line = chalk.default.yellow(line + ' (inconsistent)');
      } else {
        line = chalk.default.green(line + ' (consistent)');
      }

      console.log(line);
    }
  }

  private displayInconsistencyDetails(
    currentDocType: string,
    inconsistency: ConsistencyIssue
  ): void {
    const config = this.configLoader.load();
    const currentConfig = config.documents[currentDocType];

    console.log(chalk.default.yellow.bold(`\n─── ${inconsistency.docName} ───`));

    // Parse and display issues with color scheme
    const lines = inconsistency.issues.split('\n');
    let inCurrentBlock = false;
    let inOtherBlock = false;

    for (const line of lines) {
      if (line.trim().startsWith('CURRENT:')) {
        inCurrentBlock = true;
        inOtherBlock = false;
        const content = line.replace(/^\s*CURRENT:\s*/, '');
        console.log(`  ${chalk.default.cyan.bold('CURRENT')} ${chalk.default.dim(`(${currentConfig.name}):`)} ${chalk.default.cyan(content)}`);
      } else if (line.trim().startsWith('UPSTREAM:')) {
        inCurrentBlock = false;
        inOtherBlock = true;
        const content = line.replace(/^\s*UPSTREAM:\s*/, '');
        console.log(`  ${chalk.default.yellow.bold('UPSTREAM')} ${chalk.default.dim(`(${inconsistency.docName}):`)} ${chalk.default.white(content)}`);
      } else if (line.trim().startsWith('DOWNSTREAM:')) {
        inCurrentBlock = false;
        inOtherBlock = true;
        const content = line.replace(/^\s*DOWNSTREAM:\s*/, '');
        console.log(`  ${chalk.default.yellow.bold('DOWNSTREAM')} ${chalk.default.dim(`(${inconsistency.docName}):`)} ${chalk.default.white(content)}`);
      } else if (line.trim().startsWith('-')) {
        inCurrentBlock = false;
        inOtherBlock = false;
        console.log(`\n${chalk.default.white(line)}`);
      } else if (line.trim() && !inCurrentBlock && !inOtherBlock) {
        console.log(chalk.default.white(line));
      } else if (line.trim() && inCurrentBlock) {
        console.log(`    ${chalk.default.cyan(line.trim())}`);
      } else if (line.trim() && inOtherBlock) {
        console.log(`    ${chalk.default.white(line.trim())}`);
      }
    }
  }
}
