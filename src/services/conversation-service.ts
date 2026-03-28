/**
 * Conversation Service - Manages conversation state and LLM interactions
 */

import { LLMClient } from '../infra/llm-client';
import { StateManager } from '../infra/state-manager';
import { WorkflowState, DocumentResult } from '../types';
import { DocumentService } from './document-service';

export class ConversationService {
  private llmClient: LLMClient;
  private stateManager: StateManager;
  private documentService: DocumentService;

  constructor(
    llmClient: LLMClient,
    stateManager: StateManager,
    documentService: DocumentService
  ) {
    this.llmClient = llmClient;
    this.stateManager = stateManager;
    this.documentService = documentService;
  }

  /**
   * Create a new document workflow
   */
  async createDocument(documentType: string, initialMessage?: string): Promise<DocumentResult> {
    const docConfig = this.documentService.getDocumentConfig(documentType);

    // Check if output file already exists
    if (this.documentService.documentExists(documentType)) {
      throw new Error(
        `Document already exists: ${docConfig.output}\n` +
        `Use the REPL ('ddx') or /define skill to update it.`
      );
    }

    // Load prompt and template
    const promptContent = this.documentService.loadPrompt(documentType);
    const templateContent = this.documentService.loadTemplate(documentType);

    // Load upstream documents if any
    const upstreamContext = this.documentService.loadUpstreamDocuments(docConfig.upstream);

    // Build system prompt
    const systemPrompt = this.documentService.buildSystemPrompt(
      promptContent,
      templateContent,
      upstreamContext,
      docConfig.output
    );

    // Initial message to start the workflow
    const userMessage = initialMessage || 'Let\'s begin creating this document. Please start by following the prompt instructions.';

    const response = await this.llmClient.sendMessage(systemPrompt, userMessage);

    // Try to extract and write document if present in response
    const documentWritten = this.documentService.extractAndWriteDocument(response, docConfig.output);

    // Save state
    const state: WorkflowState = {
      documentType,
      step: 'initial',
      context: {
        conversationHistory: [
          { role: 'user', content: userMessage },
          { role: 'assistant', content: response },
        ],
      },
      timestamp: new Date().toISOString(),
    };

    this.stateManager.save(state);

    return {
      response,
      documentWritten,
      documentPath: documentWritten ? docConfig.output : undefined,
    };
  }

  /**
   * Continue an existing document workflow
   */
  async continueDocument(documentType: string, userInput?: string): Promise<DocumentResult> {
    const docConfig = this.documentService.getDocumentConfig(documentType);

    // Load state
    const state = this.stateManager.load(documentType);
    if (!state) {
      throw new Error(
        `No active workflow found for ${documentType}.\n` +
        `Start a new one via the REPL ('ddx') or the corresponding skill.`
      );
    }

    // Load prompt and template
    const promptContent = this.documentService.loadPrompt(documentType);
    const templateContent = this.documentService.loadTemplate(documentType);

    // Load upstream documents if any
    const upstreamContext = this.documentService.loadUpstreamDocuments(docConfig.upstream);

    // Build system prompt
    const systemPrompt = this.documentService.buildSystemPrompt(
      promptContent,
      templateContent,
      upstreamContext,
      docConfig.output
    );

    // Check if output file exists and read it
    const currentDocument = this.documentService.readDocument(documentType);

    // Build user message
    let message = userInput || 'I\'ve reviewed the document.';

    if (currentDocument) {
      message += `\n\nHere is the current state of the document:\n\n${currentDocument}`;
    }

    // Add to conversation history
    const conversationHistory = state.context.conversationHistory || [];
    conversationHistory.push({ role: 'user', content: message });

    const response = await this.llmClient.sendMessageWithContext(
      systemPrompt,
      conversationHistory
    );

    // Try to extract and write document if present in response
    const documentWritten = this.documentService.extractAndWriteDocument(response, docConfig.output);

    // Update state
    conversationHistory.push({ role: 'assistant', content: response });
    state.context.conversationHistory = conversationHistory;
    state.timestamp = new Date().toISOString();

    this.stateManager.save(state);

    // Check if workflow is complete
    const isComplete = response.toLowerCase().includes('document is complete') ||
                       response.toLowerCase().includes('workflow complete');

    if (isComplete) {
      this.stateManager.clear(documentType);
    }

    return {
      response,
      documentWritten,
      documentPath: documentWritten ? docConfig.output : undefined,
    };
  }

  /**
   * Get conversation history for a document
   */
  getConversationHistory(documentType: string): Array<{ role: string; content: string }> {
    const state = this.stateManager.load(documentType);
    if (!state) {
      return [];
    }
    return state.context.conversationHistory || [];
  }

  /**
   * Check if a workflow is active for a document type
   */
  hasActiveWorkflow(documentType: string): boolean {
    return this.stateManager.load(documentType) !== null;
  }

  /**
   * Clear workflow state for a document type
   */
  clearWorkflow(documentType: string): void {
    this.stateManager.clear(documentType);
  }
}
