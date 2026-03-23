/**
 * Claude API client wrapper
 */

import Anthropic from '@anthropic-ai/sdk';
import { LLMConfig } from '../types';

export class LLMClient {
  private client: Anthropic;
  private config: LLMConfig;

  constructor(apiKey: string, config: LLMConfig) {
    if (!apiKey) {
      throw new Error(
        'ANTHROPIC_API_KEY not found. Please set it in your .env file or environment variables.'
      );
    }

    this.client = new Anthropic({ apiKey });
    this.config = config;
  }

  async sendMessage(systemPrompt: string, userMessage: string): Promise<string> {
    try {
      const response = await this.client.messages.create({
        model: this.config.model,
        max_tokens: this.config.max_tokens,
        temperature: this.config.temperature,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: userMessage,
          },
        ],
      });

      // Extract text from response
      const textContent = response.content.find((block) => block.type === 'text');
      if (!textContent || textContent.type !== 'text') {
        throw new Error('No text content in Claude response');
      }

      return textContent.text;
    } catch (error) {
      if (error instanceof Anthropic.APIError) {
        throw new Error(`Claude API error: ${error.message}`);
      }
      throw error;
    }
  }

  async sendMessageWithContext(
    systemPrompt: string,
    context: Array<{ role: 'user' | 'assistant'; content: string }>
  ): Promise<string> {
    try {
      const response = await this.client.messages.create({
        model: this.config.model,
        max_tokens: this.config.max_tokens,
        temperature: this.config.temperature,
        system: systemPrompt,
        messages: context.map((msg) => ({
          role: msg.role,
          content: msg.content,
        })),
      });

      const textContent = response.content.find((block) => block.type === 'text');
      if (!textContent || textContent.type !== 'text') {
        throw new Error('No text content in Claude response');
      }

      return textContent.text;
    } catch (error) {
      if (error instanceof Anthropic.APIError) {
        throw new Error(`Claude API error: ${error.message}`);
      }
      throw error;
    }
  }
}
