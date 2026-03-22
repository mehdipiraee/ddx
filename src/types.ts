/**
 * Core type definitions for DDX
 */

export interface DocumentConfig {
  name: string;
  prompt: string;
  template: string;
  output: string;
  upstream: string[];
  downstream: string[];
}

export interface LLMConfig {
  model: string;
  max_tokens: number;
  temperature: number;
}

export interface WorkflowConfig {
  state_dir: string;
  state_file: string;
}

export interface DDXConfig {
  documents: Record<string, DocumentConfig>;
  llm: LLMConfig;
  workflow: WorkflowConfig;
}

export interface WorkflowState {
  documentType: string;
  step: string;
  context: Record<string, any>;
  timestamp: string;
}

export interface StateManager {
  load(documentType: string): WorkflowState | null;
  save(state: WorkflowState): void;
  clear(documentType: string): void;
}

// Service layer types
export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface DocumentResult {
  response: string;
  documentWritten: boolean;
  documentPath?: string;
}

export interface ConsistencyIssue {
  docType: string;
  docName: string;
  direction: 'upstream' | 'downstream';
  issues: string;
}

export interface ConsistencyCheckResult {
  documentType: string;
  inconsistencies: ConsistencyIssue[];
  chain: string[];
}
