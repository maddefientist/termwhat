import { Ollama } from 'ollama';
import type { ConversationMessage, OllamaProviderConfig } from '../types.js';
import { BaseAIProvider, type ChatOptions, type HealthCheckResult } from './base.js';

export class OllamaProvider extends BaseAIProvider {
  private config: OllamaProviderConfig;
  private client: Ollama | null = null;

  constructor(config: OllamaProviderConfig) {
    super(config.timeout);
    this.config = config;

    try {
      this.client = new Ollama({ host: this.config.host });
    } catch (error) {
      console.warn('Failed to initialize Ollama client, will use fetch fallback');
      this.client = null;
    }
  }

  getProviderType(): string {
    return 'ollama';
  }

  getModelName(): string {
    return this.config.model;
  }

  getConfig(): Record<string, any> {
    return { ...this.config };
  }

  updateConfig(updates: Record<string, any>): void {
    this.config = { ...this.config, ...updates } as OllamaProviderConfig;
    if (updates.host && this.client) {
      try {
        this.client = new Ollama({ host: this.config.host });
      } catch (error) {
        console.warn('Failed to update Ollama client host');
      }
    }
    if (updates.timeout) {
      this.timeout = updates.timeout;
    }
  }

  async healthCheck(): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      const response = await this.fetchWithTimeout(
        `${this.config.host}/api/tags`,
        { method: 'GET' },
        5000
      );

      if (!response.ok) {
        return { healthy: false, error: `HTTP ${response.status}: ${response.statusText}` };
      }

      const data = await response.json();
      const models = data.models?.map((m: any) => m.name) || [];
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
        { method: 'GET' },
        5000
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data.models?.map((m: any) => m.name) || [];
    } catch (error) {
      throw new Error(`Failed to list models: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async chat(messages: ConversationMessage[], options?: ChatOptions): Promise<string> {
    const { controller, timeoutId } = this.createAbortController();

    try {
      // Try using the Ollama library first
      if (this.client) {
        return await this.chatWithLibrary(messages, options, controller.signal);
      }

      // Fallback to fetch
      return await this.chatWithFetch(messages, options, controller.signal);
    } catch (error) {
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
    options?: ChatOptions,
    signal?: AbortSignal
  ): Promise<string> {
    if (!this.client) {
      throw new Error('Ollama client not initialized');
    }

    const formattedMessages = messages.map(m => ({ role: m.role, content: m.content }));
    const onChunk = options?.onChunk;

    // Handle streaming case
    if (onChunk) {
      const response = await this.client.chat({
        model: this.config.model,
        messages: formattedMessages,
        format: 'json',
        stream: true,
        options: {
          temperature: 0.7,
        },
      });

      let fullResponse = '';
      for await (const chunk of response) {
        if (signal?.aborted) {
          throw new Error('Request aborted');
        }

        const content = chunk.message?.content || '';
        fullResponse += content;
        if (content) {
          onChunk(content);
        }
      }

      return fullResponse;
    }

    // Handle non-streaming case
    const response = await this.client.chat({
      model: this.config.model,
      messages: formattedMessages,
      format: 'json',
      stream: false,
      options: {
        temperature: 0.7,
      },
    });

    return response.message.content;
  }

  private async chatWithFetch(
    messages: ConversationMessage[],
    options?: ChatOptions,
    signal?: AbortSignal
  ): Promise<string> {
    const onChunk = options?.onChunk;

    const response = await fetch(`${this.config.host}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.config.model,
        messages: messages.map(m => ({ role: m.role, content: m.content })),
        format: 'json',
        stream: !!onChunk,
        options: { temperature: 0.7 },
      }),
      signal,
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
    }

    if (!onChunk) {
      const data = await response.json();
      return data.message?.content || '';
    }

    // Handle streaming response
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

    const decoder = new TextDecoder();
    let fullResponse = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(line => line.trim());

        for (const line of lines) {
          try {
            const parsed = JSON.parse(line);
            const content = parsed.message?.content || '';
            if (content) {
              fullResponse += content;
              onChunk(content);
            }
          } catch (e) {
            // Skip invalid JSON lines
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    return fullResponse;
  }
}
