/**
 * Document Service - Handles document operations
 */

import { ConfigLoader } from '../config';
import { FileManager } from '../file-manager';
import { DocumentConfig } from '../types';

export class DocumentService {
  private configLoader: ConfigLoader;
  private fileManager: FileManager;

  constructor(configLoader: ConfigLoader, fileManager: FileManager) {
    this.configLoader = configLoader;
    this.fileManager = fileManager;
  }

  /**
   * Get document configuration by type
   */
  getDocumentConfig(documentType: string): DocumentConfig {
    return this.configLoader.getDocumentConfig(documentType);
  }

  /**
   * Check if a document exists
   */
  documentExists(documentType: string): boolean {
    const docConfig = this.getDocumentConfig(documentType);
    return this.fileManager.fileExists(docConfig.output);
  }

  /**
   * Load upstream documents for a given document type
   */
  loadUpstreamDocuments(upstreamTypes: string[]): string {
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

  /**
   * Build system prompt for document creation/continuation
   */
  buildSystemPrompt(
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

  /**
   * Extract and write document from LLM response
   * Returns true if a document was successfully extracted and written
   */
  extractAndWriteDocument(response: string, outputPath: string): boolean {
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

  /**
   * Read document content
   */
  readDocument(documentType: string): string | null {
    const docConfig = this.getDocumentConfig(documentType);
    return this.fileManager.readFileIfExists(docConfig.output);
  }

  /**
   * Load prompt content for a document type
   */
  loadPrompt(documentType: string): string {
    const docConfig = this.getDocumentConfig(documentType);
    return this.fileManager.readFile(docConfig.prompt);
  }

  /**
   * Load template content for a document type
   */
  loadTemplate(documentType: string): string {
    const docConfig = this.getDocumentConfig(documentType);
    return this.fileManager.readFile(docConfig.template);
  }

  /**
   * Build document chain showing upstream and downstream relationships
   */
  buildDocumentChain(currentDocType: string): string[] {
    const config = this.configLoader.load();
    const currentConfig = config.documents[currentDocType];
    const chain: string[] = [];

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
      if (docConfig && docConfig.downstream && docConfig.downstream.length > 0) {
        for (const downType of docConfig.downstream) {
          if (!chain.includes(downType)) {
            chain.push(downType);
            addDownstream(downType);
          }
        }
      }
    };
    addDownstream(currentDocType);

    return chain;
  }
}
