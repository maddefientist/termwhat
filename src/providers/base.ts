import type { ConversationMessage } from '../types.js';

export interface HealthCheckResult {
  healthy: boolean;
  models?: string[];
  error?: string;
  responseTime?: number;
}

export interface ChatOptions {
  stream?: boolean;
  onChunk?: (chunk: string) => void;
}

export interface AIProvider {
  chat(messages: ConversationMessage[], options?: ChatOptions): Promise<string>;
  healthCheck(): Promise<HealthCheckResult>;
  listModels(): Promise<string[]>;
  getConfig(): Record<string, any>;
  updateConfig(updates: Record<string, any>): void;
  getProviderType(): string;
  getModelName(): string;
}

export abstract class BaseAIProvider implements AIProvider {
  protected timeout: number;

  constructor(timeout: number = 60000) {
    this.timeout = timeout;
  }

  abstract chat(messages: ConversationMessage[], options?: ChatOptions): Promise<string>;
  abstract healthCheck(): Promise<HealthCheckResult>;
  abstract listModels(): Promise<string[]>;
  abstract getConfig(): Record<string, any>;
  abstract updateConfig(updates: Record<string, any>): void;
  abstract getProviderType(): string;
  abstract getModelName(): string;

  protected async fetchWithTimeout(
    url: string,
    options: RequestInit,
    timeout?: number
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutMs = timeout ?? this.timeout;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

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

  protected createAbortController(): { controller: AbortController; timeoutId: NodeJS.Timeout } {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);
    return { controller, timeoutId };
  }
}
