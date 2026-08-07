import Anthropic from '@anthropic-ai/sdk';
import type { ConversationMessage, AnthropicProviderConfig } from '../types.js';
import {
  BaseAIProvider,
  ProviderError,
  pickDefaultModel,
  type ChatOptions,
  type HealthCheckResult,
} from './base.js';

/**
 * Conservative fallback when live discovery is unavailable.
 * Prefer runtime resolution via client.models.list() (available in @anthropic-ai/sdk@0.115.0).
 */
export const ANTHROPIC_FALLBACK_MODEL = 'claude-sonnet-4-5';

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
      // Free models-list endpoint — do not burn a billable messages.create call
      const models = await this.listModels();
      const responseTime = Date.now() - startTime;

      if (models.length === 0) {
        // listModels already warned; treat empty as soft-healthy if no throw
        return {
          healthy: true,
          models,
          responseTime,
        };
      }

      return { healthy: true, models, responseTime };
    } catch (error) {
      const status = extractStatus(error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { healthy: false, error: message, status };
    }
  }

  async listModels(): Promise<string[]> {
    try {
      const page = await this.client.models.list();
      const modelNames: string[] = [];
      for await (const model of page) {
        modelNames.push(model.id);
      }
      return modelNames;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.warn(`Failed to list Anthropic models: ${message}`);
      return [];
    }
  }

  /** Resolve a sensible default model from the live catalog. */
  async resolveDefaultModel(): Promise<string> {
    const models = await this.listModels();
    return pickDefaultModel(
      models,
      [
        /^claude-sonnet-4-5/i,
        /^claude-sonnet-4/i,
        /^claude-sonnet/i,
        /^claude-opus-4/i,
        /^claude-3-5-sonnet/i,
      ],
      ANTHROPIC_FALLBACK_MODEL
    );
  }

  async chat(messages: ConversationMessage[], _options?: ChatOptions): Promise<string> {
    const systemMessages = messages.filter((m) => m.role === 'system');
    const conversationMessages = messages.filter((m) => m.role !== 'system');
    const systemPrompt = systemMessages.map((m) => m.content).join('\n\n');

    try {
      const response = await this.client.messages.create({
        model: this.config.model,
        max_tokens: 4096,
        system: systemPrompt || undefined,
        messages: conversationMessages.map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
        temperature: 0.7,
      });

      const textBlock = response.content.find((block) => block.type === 'text');
      return textBlock && textBlock.type === 'text' ? textBlock.text : '';
    } catch (error) {
      const status = extractStatus(error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new ProviderError(`Anthropic API error: ${message}`, status);
    }
  }
}

function extractStatus(error: unknown): number | undefined {
  if (error && typeof error === 'object') {
    const e = error as { status?: number; statusCode?: number };
    if (typeof e.status === 'number') return e.status;
    if (typeof e.statusCode === 'number') return e.statusCode;
  }
  return undefined;
}
