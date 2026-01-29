import Anthropic from '@anthropic-ai/sdk';
import type { ConversationMessage, AnthropicProviderConfig } from '../types.js';
import { BaseAIProvider, type ChatOptions, type HealthCheckResult } from './base.js';

export class AnthropicProvider extends BaseAIProvider {
  private config: AnthropicProviderConfig;
  private client: Anthropic;

  constructor(config: AnthropicProviderConfig) {
    super(config.timeout);
    this.config = config;

    const apiKey = process.env.TERMWHAT_ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('TERMWHAT_ANTHROPIC_API_KEY environment variable is not set');
    }

    this.client = new Anthropic({
      apiKey,
      timeout: config.timeout,
    });
  }

  getProviderType(): string {
    return 'anthropic';
  }

  getModelName(): string {
    return this.config.model;
  }

  getConfig(): Record<string, any> {
    return { ...this.config };
  }

  updateConfig(updates: Record<string, any>): void {
    this.config = { ...this.config, ...updates } as AnthropicProviderConfig;
    if (updates.timeout) {
      this.timeout = updates.timeout;
    }
  }

  async healthCheck(): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      // Anthropic doesn't have a dedicated health check endpoint
      // We'll do a minimal API call to verify connectivity
      const response = await this.client.messages.create({
        model: this.config.model,
        max_tokens: 1,
        messages: [{ role: 'user', content: 'test' }],
      });

      const responseTime = Date.now() - startTime;

      // Claude models are well-known
      const knownModels = [
        'claude-3-5-sonnet-20241022',
        'claude-3-opus-20240229',
        'claude-3-sonnet-20240229',
        'claude-3-haiku-20240307',
      ];

      return { healthy: true, models: knownModels, responseTime };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { healthy: false, error: message };
    }
  }

  async listModels(): Promise<string[]> {
    // Anthropic doesn't provide a models list endpoint
    // Return known Claude models
    return [
      'claude-3-5-sonnet-20241022',
      'claude-3-opus-20240229',
      'claude-3-sonnet-20240229',
      'claude-3-haiku-20240307',
    ];
  }

  async chat(messages: ConversationMessage[], options?: ChatOptions): Promise<string> {
    const onChunk = options?.onChunk;

    // Anthropic requires system messages to be separate
    const systemMessages = messages.filter(m => m.role === 'system');
    const conversationMessages = messages.filter(m => m.role !== 'system');

    const systemPrompt = systemMessages.map(m => m.content).join('\n\n');

    try {
      if (onChunk) {
        // Streaming mode
        const stream = await this.client.messages.stream({
          model: this.config.model,
          max_tokens: 4096,
          system: systemPrompt || undefined,
          messages: conversationMessages.map(m => ({
            role: m.role as 'user' | 'assistant',
            content: m.content,
          })),
          temperature: 0.7,
        });

        let fullResponse = '';
        for await (const chunk of stream) {
          if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
            const content = chunk.delta.text;
            fullResponse += content;
            onChunk(content);
          }
        }

        return fullResponse;
      } else {
        // Non-streaming mode
        const response = await this.client.messages.create({
          model: this.config.model,
          max_tokens: 4096,
          system: systemPrompt || undefined,
          messages: conversationMessages.map(m => ({
            role: m.role as 'user' | 'assistant',
            content: m.content,
          })),
          temperature: 0.7,
        });

        const textBlock = response.content.find(block => block.type === 'text');
        return textBlock && textBlock.type === 'text' ? textBlock.text : '';
      }
    } catch (error) {
      throw new Error(`Anthropic API error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
