import type { ConversationMessage } from '../types.js';

export interface HealthCheckResult {
  healthy: boolean;
  models?: string[];
  error?: string;
  responseTime?: number;
  /** HTTP status when the failure came from an API response (e.g. 401) */
  status?: number;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- intentionally empty marker; kept for future streaming opts and stable call signatures
export interface ChatOptions {
  // intentionally empty — streaming removed in 3.0 (was unused by REPL)
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

/** Error that preserves HTTP status for --doctor and callers */
export class ProviderError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'ProviderError';
    this.status = status;
  }
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

/** Pick a preferred model from a live list; fall back to a conservative constant. */
export function pickDefaultModel(
  models: string[],
  prefer: RegExp[],
  fallback: string
): string {
  if (!models.length) return fallback;
  for (const re of prefer) {
    const match = models.find((m) => re.test(m));
    if (match) return match;
  }
  return models[0] || fallback;
}
