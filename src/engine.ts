/**
 * DDXEngine - Core engine with structured returns (no console output)
 *
 * Used by the REPL and library consumers. Skills bypass this entirely —
 * they instruct Claude Code to read/write files directly.
 */

import * as path from 'path';
import * as dotenv from 'dotenv';
import { ConfigLoader } from './infra/config';
import { FileManager } from './infra/file-manager';
import { StateManager as StateManagerImpl } from './infra/state-manager';
import { LLMClient } from './infra/llm-client';
import { DocumentService } from './services/document-service';
import { ConversationService } from './services/conversation-service';
import { ConsistencyService } from './services/consistency-service';
import { DeriveService, DeriveResult } from './services/derive-service';
import {
  DDXConfig,
  CreateResult,
  ContinueResult,
  CheckResult,
  ListResult,
  DocumentStatus,
} from './types';

export class DDXEngine {
  private configLoader: ConfigLoader;
  private fileManager: FileManager;
  private documentService: DocumentService;
  private conversationService: ConversationService;
  private consistencyService: ConsistencyService;
  private deriveService: DeriveService;

  constructor(configPath?: string) {
    // Load .env from .ddx-tooling
    dotenv.config({ path: path.join(process.cwd(), '.ddx-tooling', '.env') });

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error(
        'ANTHROPIC_API_KEY not found.\n' +
        'Please create a .ddx-tooling/.env file with your API key:\n' +
        '  echo "ANTHROPIC_API_KEY=your_key_here" > .ddx-tooling/.env'
      );
    }

    this.configLoader = new ConfigLoader(configPath);
    this.fileManager = new FileManager();

    const config = this.configLoader.load();
    const stateManager = new StateManagerImpl(config.workflow.state_dir);
    const llmClient = new LLMClient(apiKey, config.llm);

    this.documentService = new DocumentService(this.configLoader, this.fileManager);
    this.conversationService = new ConversationService(llmClient, stateManager, this.documentService);
    this.consistencyService = new ConsistencyService(llmClient, this.configLoader, this.fileManager, this.documentService);
    this.deriveService = new DeriveService(this.configLoader, this.fileManager, llmClient);
  }

  getConfig(): DDXConfig {
    return this.configLoader.load();
  }

  documentExists(documentType: string): boolean {
    return this.documentService.documentExists(documentType);
  }

  readDocument(documentType: string): string | null {
    return this.documentService.readDocument(documentType);
  }

  async createDocument(documentType: string, message?: string): Promise<CreateResult> {
    const result = await this.conversationService.createDocument(documentType, message);

    let consistencyCheck: CheckResult | undefined;
    if (result.documentWritten) {
      try {
        consistencyCheck = await this.checkDocument(documentType);
      } catch {
        // Skip if upstream docs not ready
      }
    }

    return {
      response: result.response,
      documentWritten: result.documentWritten,
      documentPath: result.documentPath,
      consistencyCheck,
    };
  }

  async continueDocument(documentType: string, input?: string): Promise<ContinueResult> {
    const result = await this.conversationService.continueDocument(documentType, input);

    const isComplete = result.response.toLowerCase().includes('document is complete') ||
                       result.response.toLowerCase().includes('workflow complete');

    let consistencyCheck: CheckResult | undefined;
    if (result.documentWritten) {
      try {
        consistencyCheck = await this.checkDocument(documentType);
      } catch {
        // Skip if upstream docs not ready
      }
    }

    return {
      response: result.response,
      documentWritten: result.documentWritten,
      documentPath: result.documentPath,
      isComplete,
      consistencyCheck,
    };
  }

  async checkDocument(documentType: string): Promise<CheckResult> {
    const docConfig = this.documentService.getDocumentConfig(documentType);
    const result = await this.consistencyService.checkDocument(documentType);

    return {
      documentType,
      documentName: docConfig.name,
      chain: result.chain,
      inconsistencies: result.inconsistencies,
      allConsistent: result.inconsistencies.length === 0,
    };
  }

  async derive(): Promise<DeriveResult> {
    return this.deriveService.derive();
  }

  listDocuments(): ListResult {
    const config = this.configLoader.load();
    const documents: DocumentStatus[] = [];

    for (const [docType, docConfig] of Object.entries(config.documents)) {
      documents.push({
        type: docType,
        name: docConfig.name,
        exists: this.fileManager.fileExists(docConfig.output),
        outputPath: docConfig.output,
        upstream: docConfig.upstream,
        downstream: docConfig.downstream,
      });
    }

    return { documents };
  }
}
