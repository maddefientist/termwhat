import OpenAI from 'openai';
import type { ConversationMessage, OpenAIProviderConfig } from '../types.js';
import { BaseAIProvider, type ChatOptions, type HealthCheckResult } from './base.js';

export class OpenAIProvider extends BaseAIProvider {
  protected config: OpenAIProviderConfig;
  protected client: OpenAI;
  protected baseUrl: string;

  constructor(config: OpenAIProviderConfig) {
    super(config.timeout);
    this.config = config;
    this.baseUrl = config.baseUrl || 'https://api.openai.com/v1';

    const apiKey = process.env.TERMWHAT_OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('TERMWHAT_OPENAI_API_KEY environment variable is not set');
    }

    this.client = new OpenAI({
      apiKey,
      baseURL: this.baseUrl,
      organization: config.organization,
      timeout: config.timeout,
    });
  }

  getProviderType(): string {
    return 'openai';
  }

  getModelName(): string {
    return this.config.model;
  }

  getConfig(): Record<string, any> {
    return { ...this.config };
  }

  updateConfig(updates: Record<string, any>): void {
    this.config = { ...this.config, ...updates } as OpenAIProviderConfig;
    if (updates.timeout) {
      this.timeout = updates.timeout;
    }
  }

  async healthCheck(): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      const models = await this.client.models.list();
      const modelNames = [];
      for await (const model of models) {
        modelNames.push(model.id);
      }

      const responseTime = Date.now() - startTime;
      return { healthy: true, models: modelNames, responseTime };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { healthy: false, error: message };
    }
  }

  async listModels(): Promise<string[]> {
    try {
      const models = await this.client.models.list();
      const modelNames = [];
      for await (const model of models) {
        modelNames.push(model.id);
      }
      return modelNames;
    } catch (error) {
      throw new Error(`Failed to list models: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async chat(messages: ConversationMessage[], options?: ChatOptions): Promise<string> {
    const onChunk = options?.onChunk;

    try {
      if (onChunk) {
        // Streaming mode
        const stream = await this.client.chat.completions.create({
          model: this.config.model,
          messages: messages.map(m => ({ role: m.role, content: m.content })),
          temperature: 0.7,
          response_format: { type: 'json_object' },
          stream: true,
        });

        let fullResponse = '';
        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content || '';
          if (content) {
            fullResponse += content;
            onChunk(content);
          }
        }

        return fullResponse;
      } else {
        // Non-streaming mode
        const response = await this.client.chat.completions.create({
          model: this.config.model,
          messages: messages.map(m => ({ role: m.role, content: m.content })),
          temperature: 0.7,
          response_format: { type: 'json_object' },
          stream: false,
        });

        return response.choices[0]?.message?.content || '';
      }
    } catch (error) {
      throw new Error(`OpenAI API error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
