/**
 * Consistency Service - Handles document consistency checking
 */

import { LLMClient } from '../llm-client';
import { ConfigLoader } from '../config';
import { FileManager } from '../file-manager';
import { DocumentService } from './document-service';
import { ConsistencyIssue, ConsistencyCheckResult } from '../types';

export class ConsistencyService {
  private llmClient: LLMClient;
  private configLoader: ConfigLoader;
  private fileManager: FileManager;
  private documentService: DocumentService;

  constructor(
    llmClient: LLMClient,
    configLoader: ConfigLoader,
    fileManager: FileManager,
    documentService: DocumentService
  ) {
    this.llmClient = llmClient;
    this.configLoader = configLoader;
    this.fileManager = fileManager;
    this.documentService = documentService;
  }

  /**
   * Check document consistency with upstream and downstream documents
   */
  async checkDocument(documentType: string): Promise<ConsistencyCheckResult> {
    const docConfig = this.documentService.getDocumentConfig(documentType);

    if (!this.documentService.documentExists(documentType)) {
      throw new Error(`Document not found: ${docConfig.output}`);
    }

    const currentDocument = this.documentService.readDocument(documentType);
    if (!currentDocument) {
      throw new Error(`Could not read document: ${docConfig.output}`);
    }

    const inconsistencies: ConsistencyIssue[] = [];

    // Check upstream consistency
    if (docConfig.upstream.length > 0) {
      for (const upstreamType of docConfig.upstream) {
        const result = await this.checkUpstreamConsistency(documentType, currentDocument, upstreamType);
        if (result) {
          inconsistencies.push(result);
        }
      }
    }

    // Check downstream consistency
    if (docConfig.downstream.length > 0) {
      for (const downstreamType of docConfig.downstream) {
        const result = await this.checkDownstreamConsistency(documentType, currentDocument, downstreamType);
        if (result) {
          inconsistencies.push(result);
        }
      }
    }

    // Build document chain
    const chain = this.documentService.buildDocumentChain(documentType);

    return {
      documentType,
      inconsistencies,
      chain,
    };
  }

  /**
   * Check consistency with an upstream document
   */
  private async checkUpstreamConsistency(
    documentType: string,
    currentDocument: string,
    upstreamType: string
  ): Promise<ConsistencyIssue | null> {
    const config = this.configLoader.load();
    const currentConfig = config.documents[documentType];
    const upstreamConfig = config.documents[upstreamType];

    if (!this.fileManager.fileExists(upstreamConfig.output)) {
      return null; // Skip if upstream doesn't exist
    }

    const upstreamDocument = this.fileManager.readFile(upstreamConfig.output);

    // Load templates for context
    const upstreamTemplate = this.fileManager.readFile(upstreamConfig.template);
    const currentTemplate = this.fileManager.readFile(currentConfig.template);

    const systemPrompt =
      'You are a document consistency analyzer. Your job is to find CONTRADICTIONS, not missing information.\n\n' +
      'CRITICAL PRINCIPLE: Downstream documents having MORE DETAIL about the same topic is EXPECTED and CORRECT.\n' +
      'Example: Upstream says "dog owners" → Downstream says "dog owners in Seattle who walk daily" = GOOD (adds detail)\n' +
      'Example: Upstream says "dog owners" → Downstream says "cat owners" = BAD (contradiction)\n\n' +
      'UPSTREAM DOCUMENT TEMPLATE:\n' +
      `${upstreamTemplate}\n\n` +
      'CURRENT DOCUMENT TEMPLATE:\n' +
      `${currentTemplate}\n\n` +
      'Understanding these templates, you can see what each document type is supposed to contain.\n\n' +
      'ONLY REPORT CONTRADICTIONS:\n' +
      '- Different target users (e.g., upstream says "dog owners", current says "cat owners")\n' +
      '- Different problems being solved\n' +
      '- Conflicting constraints or requirements\n' +
      '- Solutions that don\'t address the upstream problem\n\n' +
      'DO NOT REPORT (these are EXPECTED):\n' +
      '- More detail about the same topic (e.g., upstream: "weather app", downstream: "hyper-local weather app with hourly forecasts")\n' +
      '- Quantifying vague statements (e.g., upstream: "reduce time", downstream: "reduce by 50%")\n' +
      '- Information added in current that isn\'t in upstream (downstream documents naturally expand)\n' +
      '- Solutions or timelines in current when upstream only has problems (that\'s the document hierarchy)\n\n' +
      'OUTPUT FORMAT: When reporting contradictions, use this format:\n' +
      '- Brief description of the issue\n' +
      '  UPSTREAM: [quote from upstream document]\n' +
      '  CURRENT: [quote from current document]\n';

    const userMessage =
      `UPSTREAM DOCUMENT (${upstreamConfig.name}):\n${upstreamDocument}\n\n` +
      `CURRENT DOCUMENT (${currentConfig.name}):\n${currentDocument}\n\n` +
      'Are there any CONTRADICTIONS? Focus only on conflicts, not additions. If no contradictions exist, respond with "No inconsistencies found."';

    const response = await this.llmClient.sendMessage(systemPrompt, userMessage);

    if (response.toLowerCase().includes('no inconsistencies')) {
      return null; // No inconsistencies found
    }

    return {
      docType: upstreamType,
      docName: upstreamConfig.name,
      direction: 'upstream',
      issues: response,
    };
  }

  /**
   * Check consistency with a downstream document
   */
  private async checkDownstreamConsistency(
    documentType: string,
    currentDocument: string,
    downstreamType: string
  ): Promise<ConsistencyIssue | null> {
    const config = this.configLoader.load();
    const currentConfig = config.documents[documentType];
    const downstreamConfig = config.documents[downstreamType];

    if (!this.fileManager.fileExists(downstreamConfig.output)) {
      return null; // Skip if downstream doesn't exist
    }

    const downstreamDocument = this.fileManager.readFile(downstreamConfig.output);

    // Load templates for context
    const currentTemplate = this.fileManager.readFile(currentConfig.template);
    const downstreamTemplate = this.fileManager.readFile(downstreamConfig.template);

    const systemPrompt =
      'You are a document consistency analyzer checking if downstream documents properly implement upstream requirements.\n\n' +
      'CRITICAL PRINCIPLE: Downstream documents having MORE DETAIL about the same topic is EXPECTED and CORRECT.\n' +
      'Example: Current says "mobile app" → Downstream says "iOS and Android native apps with offline support" = GOOD (adds detail)\n' +
      'Example: Current says "mobile app" → Downstream says "web-only application" = BAD (contradiction)\n\n' +
      'CURRENT DOCUMENT TEMPLATE:\n' +
      `${currentTemplate}\n\n` +
      'DOWNSTREAM DOCUMENT TEMPLATE:\n' +
      `${downstreamTemplate}\n\n` +
      'Understanding these templates, you can see what each document type should contain.\n\n' +
      'REPORT THESE ISSUES:\n' +
      '- Core requirements from current that are completely missing in downstream\n' +
      '- Downstream contradicts current (e.g., current says "mobile app", downstream designs web-only)\n' +
      '- Downstream solves a different problem than current specifies\n' +
      '- Critical constraints from current are violated in downstream\n\n' +
      'DO NOT REPORT (these are EXPECTED):\n' +
      '- Downstream having MORE detail about same topic (e.g., current: "fast", downstream: "< 100ms response time")\n' +
      '- Downstream elaborating on requirements (e.g., current: "user auth", downstream: "OAuth2 + SSO + MFA")\n' +
      '- Downstream adding implementation details not in current (that\'s the purpose of elaboration)\n' +
      '- Downstream not being complete yet (in-progress work is acceptable)\n\n' +
      'OUTPUT FORMAT: When reporting issues, use this format:\n' +
      '- Brief description of the issue\n' +
      '  CURRENT: [quote from current document]\n' +
      '  DOWNSTREAM: [quote from downstream document or "Missing"]\n';

    const userMessage =
      `CURRENT DOCUMENT (${currentConfig.name}):\n${currentDocument}\n\n` +
      `DOWNSTREAM DOCUMENT (${downstreamConfig.name}):\n${downstreamDocument}\n\n` +
      'Are there any critical requirements MISSING or CONTRADICTED in the downstream document? If no significant issues, respond with "No inconsistencies found."';

    const response = await this.llmClient.sendMessage(systemPrompt, userMessage);

    if (response.toLowerCase().includes('no inconsistencies')) {
      return null; // No inconsistencies found
    }

    return {
      docType: downstreamType,
      docName: downstreamConfig.name,
      direction: 'downstream',
      issues: response,
    };
  }
}
