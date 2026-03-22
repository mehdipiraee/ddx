/**
 * Workflow orchestration for document creation
 */

import * as chalk from 'chalk';
import { ConfigLoader } from './config';
import { FileManager } from './file-manager';
import { StateManager } from './state-manager';
import { LLMClient } from './llm-client';
import { WorkflowState } from './types';

export class WorkflowEngine {
  private configLoader: ConfigLoader;
  private fileManager: FileManager;
  private stateManager: StateManager;
  private llmClient: LLMClient;

  constructor(
    configLoader: ConfigLoader,
    fileManager: FileManager,
    stateManager: StateManager,
    llmClient: LLMClient
  ) {
    this.configLoader = configLoader;
    this.fileManager = fileManager;
    this.stateManager = stateManager;
    this.llmClient = llmClient;
  }

  async createDocument(documentType: string): Promise<void> {
    const docConfig = this.configLoader.getDocumentConfig(documentType);

    // Check if output file already exists
    if (this.fileManager.fileExists(docConfig.output)) {
      throw new Error(
        `Document already exists: ${docConfig.output}\n` +
        `Use 'ddx continue ${documentType}' to resume editing.`
      );
    }

    // Load prompt and template
    const promptContent = this.fileManager.readFile(docConfig.prompt);
    const templateContent = this.fileManager.readFile(docConfig.template);

    // Load upstream documents if any
    const upstreamContext = this.loadUpstreamDocuments(docConfig.upstream);

    // Build system prompt
    const systemPrompt = this.buildSystemPrompt(
      promptContent,
      templateContent,
      upstreamContext,
      docConfig.output
    );

    // Initial message to start the workflow
    const userMessage = 'Let\'s begin creating this document. Please start by following the prompt instructions.';

    console.log(`\nStarting ${docConfig.name} creation workflow...\n`);

    const response = await this.llmClient.sendMessage(systemPrompt, userMessage);

    console.log(response);
    console.log('\n---\n');

    // Try to extract and write document if present in response
    const documentWritten = this.extractAndWriteDocument(response, docConfig.output);

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

    // Auto-check consistency after create
    if (this.fileManager.fileExists(docConfig.output)) {
      console.log(`\n🔍 Running consistency check...`);
      try {
        await this.checkDocument(documentType);
      } catch (error) {
        // Check might fail if upstream docs don't exist yet - that's okay
        if (error instanceof Error && error.message.includes('not found')) {
          console.log(`  ℹ️  Skipping check: upstream documents not ready yet`);
        } else {
          throw error;
        }
      }
    }

    // Check if document was created
    if (documentWritten || this.fileManager.fileExists(docConfig.output)) {
      console.log(`\n✓ Document created: ${docConfig.output}`);
      console.log(`\nPlease review and edit the document, then run:`);
      console.log(`  ddx continue ${documentType}\n`);
    } else {
      console.log(`\nConversation in progress. When ready to continue, run:`);
      console.log(`  ddx continue ${documentType}\n`);
    }
  }

  async continueDocument(documentType: string, userInput?: string): Promise<void> {
    const docConfig = this.configLoader.getDocumentConfig(documentType);

    // Load state
    const state = this.stateManager.load(documentType);
    if (!state) {
      throw new Error(
        `No active workflow found for ${documentType}.\n` +
        `Run 'ddx create ${documentType}' to start.`
      );
    }

    // Load prompt and template
    const promptContent = this.fileManager.readFile(docConfig.prompt);
    const templateContent = this.fileManager.readFile(docConfig.template);

    // Load upstream documents if any
    const upstreamContext = this.loadUpstreamDocuments(docConfig.upstream);

    // Build system prompt
    const systemPrompt = this.buildSystemPrompt(
      promptContent,
      templateContent,
      upstreamContext,
      docConfig.output
    );

    // Check if output file exists and read it
    const currentDocument = this.fileManager.readFileIfExists(docConfig.output);

    // Build user message
    let message = userInput || 'I\'ve reviewed the document.';

    if (currentDocument) {
      message += `\n\nHere is the current state of the document:\n\n${currentDocument}`;
    }

    // Add to conversation history
    const conversationHistory = state.context.conversationHistory || [];
    conversationHistory.push({ role: 'user', content: message });

    console.log(`\nContinuing ${docConfig.name} workflow...\n`);

    const response = await this.llmClient.sendMessageWithContext(
      systemPrompt,
      conversationHistory
    );

    console.log(response);
    console.log('\n---\n');

    // Try to extract and write document if present in response
    const documentWritten = this.extractAndWriteDocument(response, docConfig.output);

    // Update state
    conversationHistory.push({ role: 'assistant', content: response });
    state.context.conversationHistory = conversationHistory;
    state.timestamp = new Date().toISOString();

    this.stateManager.save(state);

    // Auto-check consistency after every continue
    if (this.fileManager.fileExists(docConfig.output)) {
      console.log(`\n🔍 Running consistency check...`);
      try {
        await this.checkDocument(documentType);
      } catch (error) {
        // Check might fail if upstream docs don't exist yet - that's okay
        if (error instanceof Error && error.message.includes('not found')) {
          console.log(`  ℹ️  Skipping check: upstream documents not ready yet`);
        } else {
          throw error;
        }
      }
    }

    // Check if document was written
    if (documentWritten) {
      console.log(`\n✓ Document created/updated: ${docConfig.output}`);
      console.log(`\nPlease review the document. To continue, run:`);
      console.log(`  ddx continue ${documentType}\n`);
    } else if (response.toLowerCase().includes('document is complete') ||
               response.toLowerCase().includes('workflow complete')) {
      console.log(`\n✓ ${docConfig.name} workflow complete!`);
      if (this.fileManager.fileExists(docConfig.output)) {
        console.log(`\nDocument saved: ${docConfig.output}\n`);
      }
      this.stateManager.clear(documentType);
    } else {
      console.log(`\nTo continue, run:`);
      console.log(`  ddx continue ${documentType}\n`);
    }
  }

  async checkDocument(documentType: string): Promise<void> {
    const docConfig = this.configLoader.getDocumentConfig(documentType);

    if (!this.fileManager.fileExists(docConfig.output)) {
      throw new Error(`Document not found: ${docConfig.output}`);
    }

    const currentDocument = this.fileManager.readFile(docConfig.output);

    console.log(`\nChecking ${docConfig.name} for consistency...\n`);

    // Collect all inconsistencies
    const inconsistencies: Array<{
      docType: string;
      docName: string;
      direction: 'upstream' | 'downstream';
      issues: string;
    }> = [];

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

    // Build and display document hierarchy
    this.displayDocumentHierarchy(documentType, inconsistencies);

    // Display detailed inconsistencies
    if (inconsistencies.length > 0) {
      console.log('\n');
      for (const inconsistency of inconsistencies) {
        this.displayInconsistencyDetails(documentType, inconsistency);
      }
    }

    console.log('');
  }

  private async checkUpstreamConsistency(
    documentType: string,
    currentDocument: string,
    upstreamType: string
  ): Promise<{ docType: string; docName: string; direction: 'upstream' | 'downstream'; issues: string } | null> {
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

  private async checkDownstreamConsistency(
    documentType: string,
    currentDocument: string,
    downstreamType: string
  ): Promise<{ docType: string; docName: string; direction: 'upstream' | 'downstream'; issues: string } | null> {
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

  private loadUpstreamDocuments(upstreamTypes: string[]): string {
    if (upstreamTypes.length === 0) {
      return '';
    }

    const config = this.configLoader.load();
    let context = '\n\nUPSTREAM DOCUMENTS:\n';

    for (const upstreamType of upstreamTypes) {
      const upstreamConfig = config.documents[upstreamType];

      if (!this.fileManager.fileExists(upstreamConfig.output)) {
        throw new Error(
          `Upstream document required but not found: ${upstreamConfig.output}\n` +
          `Please create '${upstreamType}' first using: ddx create ${upstreamType}`
        );
      }

      const content = this.fileManager.readFile(upstreamConfig.output);
      context += `\n### ${upstreamConfig.name} (${upstreamConfig.output}):\n${content}\n`;
    }

    return context;
  }

  private buildSystemPrompt(
    promptContent: string,
    templateContent: string,
    upstreamContext: string,
    outputPath: string
  ): string {
    return (
      `${promptContent}\n\n` +
      `TEMPLATE TO USE:\n${templateContent}\n` +
      `${upstreamContext}\n\n` +
      `IMPORTANT INSTRUCTIONS:\n` +
      `- Follow the prompt instructions carefully\n` +
      `- When you have gathered sufficient information, create the complete document\n` +
      `- Output the FULL document content in markdown format\n` +
      `- Use the template structure above as your guide\n` +
      `- The document will be saved to: ${outputPath}\n` +
      `- When outputting the document, wrap it in a code block like this:\n` +
      `\`\`\`markdown:${outputPath}\n` +
      `[full document content here]\n` +
      `\`\`\`\n\n` +
      `Be concise and professional in your responses.`
    );
  }

  private extractAndWriteDocument(response: string, outputPath: string): boolean {
    // Try to extract document from markdown code block
    const codeBlockRegex = /```(?:markdown)?(?::.*?)?\s*\n([\s\S]*?)\n```/g;
    const matches = [...response.matchAll(codeBlockRegex)];

    if (matches.length > 0) {
      // Use the last code block (most likely to be the complete document)
      const lastMatch = matches[matches.length - 1];
      const documentContent = lastMatch[1].trim();

      if (documentContent.length > 100) { // Sanity check - document should be substantial
        this.fileManager.writeFile(outputPath, documentContent);
        return true;
      }
    }

    return false;
  }

  private colorizeConsistencyResponse(response: string, upstreamName: string, currentName: string): string {
    // Color code the response: UPSTREAM content in blue (original), CURRENT content in red (drift)
    let colorized = response;

    // Replace UPSTREAM: and its content with colored version
    colorized = colorized.replace(/(\s+)UPSTREAM:\s*([^\n]+(?:\n(?!\s+CURRENT:)[^\n]+)*)/g,
      (match, whitespace, content) => {
        return `${whitespace}${chalk.default.bold('UPSTREAM')} ${chalk.default.dim(`(${upstreamName}):`)} ${chalk.default.blue(content.trim())}`;
      });

    // Replace CURRENT: and its content with colored version
    colorized = colorized.replace(/(\s+)CURRENT:\s*([^\n]+(?:\n(?!\s+UPSTREAM:)[^\n]+)*)/g,
      (match, whitespace, content) => {
        return `${whitespace}${chalk.default.bold('CURRENT')} ${chalk.default.dim(`(${currentName}):`)} ${chalk.default.red(content.trim())}`;
      });

    return colorized;
  }

  private colorizeDownstreamResponse(response: string, currentName: string, downstreamName: string): string {
    // Color code the response: CURRENT content in blue (original), DOWNSTREAM content in red (drift/missing)
    let colorized = response;

    // Replace CURRENT: and its content with colored version
    colorized = colorized.replace(/(\s+)CURRENT:\s*([^\n]+(?:\n(?!\s+DOWNSTREAM:)[^\n]+)*)/g,
      (match, whitespace, content) => {
        return `${whitespace}${chalk.default.bold('CURRENT')} ${chalk.default.dim(`(${currentName}):`)} ${chalk.default.blue(content.trim())}`;
      });

    // Replace DOWNSTREAM: and its content with colored version
    colorized = colorized.replace(/(\s+)DOWNSTREAM:\s*([^\n]+(?:\n(?!\s+CURRENT:)[^\n]+)*)/g,
      (match, whitespace, content) => {
        return `${whitespace}${chalk.default.bold('DOWNSTREAM')} ${chalk.default.dim(`(${downstreamName}):`)} ${chalk.default.red(content.trim())}`;
      });

    return colorized;
  }

  private displayDocumentHierarchy(
    currentDocType: string,
    inconsistencies: Array<{ docType: string; docName: string; direction: 'upstream' | 'downstream'; issues: string }>
  ): void {
    const config = this.configLoader.load();
    const currentConfig = config.documents[currentDocType];

    // Build the document chain
    const chain: string[] = [];
    const inconsistentDocs = new Set(inconsistencies.map(i => i.docType));

    // Add upstream documents
    let upstreamTypes = currentConfig.upstream;
    while (upstreamTypes.length > 0) {
      const upstreamType = upstreamTypes[0];
      if (!chain.includes(upstreamType)) {
        chain.unshift(upstreamType);
      }
      upstreamTypes = config.documents[upstreamType]?.upstream || [];
    }

    // Add current document
    chain.push(currentDocType);

    // Add downstream documents
    const addDownstream = (docType: string) => {
      const docConfig = config.documents[docType];
      if (docConfig.downstream && docConfig.downstream.length > 0) {
        for (const downType of docConfig.downstream) {
          if (!chain.includes(downType)) {
            chain.push(downType);
            addDownstream(downType);
          }
        }
      }
    };
    addDownstream(currentDocType);

    // Display the chain
    console.log(chalk.default.bold('Document Chain:'));
    for (const docType of chain) {
      const docConfig = config.documents[docType];
      const isCurrent = docType === currentDocType;
      const hasInconsistency = inconsistentDocs.has(docType);
      const documentExists = this.fileManager.fileExists(docConfig.output);

      let line = `  ${docConfig.name}`;

      if (!documentExists) {
        // Document not found
        line = chalk.default.white(line + ' (document not available)');
      } else if (isCurrent && hasInconsistency) {
        // Current document with inconsistencies
        line = chalk.default.cyan.bold(line) + chalk.default.yellow(' (has inconsistencies) ⚠');
      } else if (isCurrent) {
        // Current document being checked
        line = chalk.default.cyan.bold(line + ' (checking this document)');
      } else if (hasInconsistency) {
        // Other document with inconsistencies
        line = chalk.default.yellow(line + ' (inconsistent)');
      } else {
        // Other document, consistent
        line = chalk.default.green(line + ' (consistent)');
      }

      console.log(line);
    }
  }

  private displayInconsistencyDetails(
    currentDocType: string,
    inconsistency: { docType: string; docName: string; direction: 'upstream' | 'downstream'; issues: string }
  ): void {
    const config = this.configLoader.load();
    const currentConfig = config.documents[currentDocType];

    console.log(chalk.default.yellow.bold(`\n─── ${inconsistency.docName} ───`));

    // Parse and display issues with new color scheme
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
        // Issue description
        inCurrentBlock = false;
        inOtherBlock = false;
        console.log(`\n${chalk.default.white(line)}`);
      } else if (line.trim() && !inCurrentBlock && !inOtherBlock) {
        // Other text
        console.log(chalk.default.white(line));
      } else if (line.trim() && inCurrentBlock) {
        // Continuation of CURRENT block
        console.log(`    ${chalk.default.cyan(line.trim())}`);
      } else if (line.trim() && inOtherBlock) {
        // Continuation of UPSTREAM/DOWNSTREAM block
        console.log(`    ${chalk.default.white(line.trim())}`);
      }
    }
  }
}
