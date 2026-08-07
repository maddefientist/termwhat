import { Ollama } from 'ollama';
import type { ConversationMessage, OllamaProviderConfig } from '../types.js';
import { BaseAIProvider, ProviderError, type ChatOptions, type HealthCheckResult } from './base.js';

export const OLLAMA_CLOUD_HOST = 'https://ollama.com';
export const DEFAULT_OLLAMA_LOCAL_MODEL = 'qwen3.5:4b';
export const DEFAULT_OLLAMA_CLOUD_MODEL = 'gpt-oss:120b';

export class OllamaProvider extends BaseAIProvider {
  private config: OllamaProviderConfig;
  private client: Ollama | null = null;

  constructor(config: OllamaProviderConfig) {
    super(config.timeout);
    this.config = {
      ...config,
      host: normalizeOllamaHost(config.host, config.cloud),
      cloud: config.cloud ?? isOllamaCloudHost(config.host),
    };

    try {
      const headers = this.authHeaders();
      this.client = new Ollama({
        host: this.config.host,
        ...(Object.keys(headers).length ? { headers } : {}),
      });
    } catch {
      console.warn('Failed to initialize Ollama client, will use fetch fallback');
      this.client = null;
    }
  }

  getProviderType(): string {
    return this.config.cloud ? 'ollama-cloud' : 'ollama';
  }

  getModelName(): string {
    return this.config.model;
  }

  getConfig(): Record<string, any> {
    return { ...this.config };
  }

  updateConfig(updates: Record<string, any>): void {
    this.config = { ...this.config, ...updates } as OllamaProviderConfig;
    if (updates.host !== undefined) {
      this.config.host = normalizeOllamaHost(this.config.host, this.config.cloud);
      this.config.cloud = this.config.cloud ?? isOllamaCloudHost(this.config.host);
    }
    if (updates.host !== undefined || updates.cloud !== undefined) {
      try {
        const headers = this.authHeaders();
        this.client = new Ollama({
          host: this.config.host,
          ...(Object.keys(headers).length ? { headers } : {}),
        });
      } catch {
        console.warn('Failed to update Ollama client host');
        this.client = null;
      }
    }
    if (updates.timeout) {
      this.timeout = updates.timeout;
    }
  }

  private authHeaders(): Record<string, string> {
    if (!this.config.cloud && !isOllamaCloudHost(this.config.host)) {
      return {};
    }
    const apiKey = process.env.TERMWHAT_OLLAMA_API_KEY;
    if (!apiKey) {
      return {};
    }
    return { Authorization: `Bearer ${apiKey}` };
  }

  private requireCloudKey(): void {
    if ((this.config.cloud || isOllamaCloudHost(this.config.host)) && !process.env.TERMWHAT_OLLAMA_API_KEY) {
      // listModels/tags work without auth on cloud; chat does not
    }
  }

  async healthCheck(): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      const response = await this.fetchWithTimeout(
        `${this.config.host}/api/tags`,
        { method: 'GET', headers: this.authHeaders() },
        5000
      );

      if (!response.ok) {
        return {
          healthy: false,
          error: `HTTP ${response.status}: ${response.statusText}`,
          status: response.status,
        };
      }

      const data = (await response.json()) as { models?: Array<{ name: string }> };
      const models = data.models?.map((m) => m.name) || [];
      const responseTime = Date.now() - startTime;

      return { healthy: true, models, responseTime };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { healthy: false, error: message };
    }
  }

  async listModels(): Promise<string[]> {
    try {
      const response = await this.fetchWithTimeout(
        `${this.config.host}/api/tags`,
        { method: 'GET', headers: this.authHeaders() },
        10000
      );

      if (!response.ok) {
        // Degrade gracefully — never throw into REPL
        console.warn(
          `Failed to list Ollama models (HTTP ${response.status}): ${response.statusText}`
        );
        return [];
      }

      const data = (await response.json()) as { models?: Array<{ name: string }> };
      return data.models?.map((m) => m.name) || [];
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.warn(`Failed to list Ollama models: ${message}`);
      return [];
    }
  }

  async chat(messages: ConversationMessage[], _options?: ChatOptions): Promise<string> {
    if ((this.config.cloud || isOllamaCloudHost(this.config.host)) && !process.env.TERMWHAT_OLLAMA_API_KEY) {
      throw new ProviderError(
        'TERMWHAT_OLLAMA_API_KEY environment variable is not set (required for Ollama cloud chat)',
        401
      );
    }

    const { controller, timeoutId } = this.createAbortController();

    try {
      if (this.client) {
        return await this.chatWithLibrary(messages, controller.signal);
      }
      return await this.chatWithFetch(messages, controller.signal);
    } catch (error) {
      if (error instanceof ProviderError) throw error;
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Request timed out after ${this.timeout}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private async chatWithLibrary(
    messages: ConversationMessage[],
    signal?: AbortSignal
  ): Promise<string> {
    if (!this.client) {
      throw new Error('Ollama client not initialized');
    }

    this.requireCloudKey();

    const formattedMessages = messages.map((m) => ({ role: m.role, content: m.content }));

    const response = await this.client.chat({
      model: this.config.model,
      messages: formattedMessages,
      format: 'json',
      stream: false,
      options: {
        temperature: 0.7,
        num_predict: 2048,
      },
    });

    if (signal?.aborted) {
      throw new Error('Request aborted');
    }

    return response.message.content;
  }

  private async chatWithFetch(
    messages: ConversationMessage[],
    signal?: AbortSignal
  ): Promise<string> {
    const response = await fetch(`${this.config.host}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.authHeaders(),
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        format: 'json',
        stream: false,
        options: {
          temperature: 0.7,
          num_predict: 2048,
        },
      }),
      signal,
    });

    if (!response.ok) {
      throw new ProviderError(
        `Ollama API error: ${response.status} ${response.statusText}`,
        response.status
      );
    }

    const data = (await response.json()) as { message?: { content?: string } };
    return data.message?.content || '';
  }
}

export function isOllamaCloudHost(host: string | undefined): boolean {
  if (!host) return false;
  try {
    const u = new URL(host);
    return u.hostname === 'ollama.com' || u.hostname === 'www.ollama.com';
  } catch {
    return host.includes('ollama.com');
  }
}

export function normalizeOllamaHost(host: string, cloud?: boolean): string {
  if (cloud && (!host || host.includes('localhost') || host.includes('127.0.0.1'))) {
    return OLLAMA_CLOUD_HOST;
  }
  return host.replace(/\/+$/, '');
}
