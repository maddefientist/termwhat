import { Ollama } from 'ollama';
import type { OllamaConfig, ConversationMessage } from './types.js';

export class OllamaClient {
  private config: OllamaConfig;
  private client: Ollama | null = null;

  constructor(config: Partial<OllamaConfig> = {}) {
    const isDocker = process.env.DOCKER === 'true' || process.env.NODE_ENV === 'production';
    const defaultHost = isDocker ? 'http://ollama:11434' : 'http://localhost:11434';

    this.config = {
      host: config.host || process.env.TERMWHAT_OLLAMA_HOST || defaultHost,
      model: config.model || process.env.TERMWHAT_MODEL || 'llama3.2',
      timeout: config.timeout || parseInt(process.env.TERMWHAT_TIMEOUT || '60000', 10),
    };

    try {
      this.client = new Ollama({ host: this.config.host });
    } catch (error) {
      console.warn('Failed to initialize Ollama client, will use fetch fallback');
      this.client = null;
    }
  }

  getConfig(): OllamaConfig {
    return { ...this.config };
  }

  updateConfig(updates: Partial<OllamaConfig>): void {
    this.config = { ...this.config, ...updates };
    if (updates.host && this.client) {
      try {
        this.client = new Ollama({ host: this.config.host });
      } catch (error) {
        console.warn('Failed to update Ollama client host');
      }
    }
  }

  async healthCheck(): Promise<{ healthy: boolean; models?: string[]; error?: string; responseTime?: number }> {
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

  async chat(
    messages: ConversationMessage[],
    onChunk?: (chunk: string) => void
  ): Promise<string> {
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), this.config.timeout);

    try {
      // Try using the Ollama library first
      if (this.client) {
        return await this.chatWithLibrary(messages, onChunk, abortController.signal);
      }

      // Fallback to fetch
      return await this.chatWithFetch(messages, onChunk, abortController.signal);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Request timed out after ${this.config.timeout}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private async chatWithLibrary(
    messages: ConversationMessage[],
    onChunk?: (chunk: string) => void,
    signal?: AbortSignal
  ): Promise<string> {
    if (!this.client) {
      throw new Error('Ollama client not initialized');
    }

    const formattedMessages = messages.map(m => ({ role: m.role, content: m.content }));

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
    onChunk?: (chunk: string) => void,
    signal?: AbortSignal
  ): Promise<string> {
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

  private async fetchWithTimeout(
    url: string,
    options: RequestInit,
    timeout: number
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
