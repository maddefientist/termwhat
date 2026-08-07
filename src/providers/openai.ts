import OpenAI from 'openai';
import type { ConversationMessage, OpenAIProviderConfig } from '../types.js';
import {
  BaseAIProvider,
  ProviderError,
  pickDefaultModel,
  type ChatOptions,
  type HealthCheckResult,
} from './base.js';

/** Conservative fallback when live discovery is unavailable.
 *  Prefer runtime resolution via client.models.list(). */
export const OPENAI_FALLBACK_MODEL = 'gpt-4o';

export interface OpenAIClientInit {
  /** Explicit API key — when set, TERMWHAT_OPENAI_API_KEY is not read */
  apiKey?: string;
  defaultHeaders?: Record<string, string>;
  /** Error message if no key is found */
  missingKeyError?: string;
}

export class OpenAIProvider extends BaseAIProvider {
  protected config: OpenAIProviderConfig;
  protected client: OpenAI;
  protected baseUrl: string;

  constructor(config: OpenAIProviderConfig, init: OpenAIClientInit = {}) {
    super(config.timeout);
    this.config = config;
    this.baseUrl = config.baseUrl || 'https://api.openai.com/v1';

    const apiKey =
      init.apiKey !== undefined ? init.apiKey : process.env.TERMWHAT_OPENAI_API_KEY;

    if (!apiKey) {
      throw new Error(
        init.missingKeyError ||
          'TERMWHAT_OPENAI_API_KEY environment variable is not set'
      );
    }

    this.client = new OpenAI({
      apiKey,
      baseURL: this.baseUrl,
      organization: config.organization,
      timeout: config.timeout,
      defaultHeaders: init.defaultHeaders,
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
      const modelNames: string[] = [];
      for await (const model of models) {
        modelNames.push(model.id);
      }

      const responseTime = Date.now() - startTime;
      return { healthy: true, models: modelNames, responseTime };
    } catch (error) {
      return this.toHealthError(error);
    }
  }

  async listModels(): Promise<string[]> {
    try {
      const models = await this.client.models.list();
      const modelNames: string[] = [];
      for await (const model of models) {
        modelNames.push(model.id);
      }
      return modelNames;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.warn(`Failed to list OpenAI models: ${message}`);
      return [];
    }
  }

  /** Resolve a sensible default model from the live catalog. */
  async resolveDefaultModel(): Promise<string> {
    const models = await this.listModels();
    return pickDefaultModel(
      models,
      [
        /^gpt-5(\.\d+)?$/i,
        /^gpt-5/i,
        /^gpt-4o$/i,
        /^gpt-4\.1$/i,
        /^o3$/i,
      ],
      OPENAI_FALLBACK_MODEL
    );
  }

  async chat(messages: ConversationMessage[], _options?: ChatOptions): Promise<string> {
    try {
      const response = await this.client.chat.completions.create({
        model: this.config.model,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        temperature: 0.7,
        response_format: { type: 'json_object' },
        stream: false,
      });

      return response.choices[0]?.message?.content || '';
    } catch (error) {
      throw this.toProviderError(error, 'OpenAI');
    }
  }

  protected toHealthError(error: unknown): HealthCheckResult {
    const status = extractStatus(error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { healthy: false, error: message, status };
  }

  protected toProviderError(error: unknown, label: string): ProviderError {
    const status = extractStatus(error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new ProviderError(`${label} API error: ${message}`, status);
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
