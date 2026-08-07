import type { OpenRouterProviderConfig } from '../types.js';
import { OpenAIProvider } from './openai.js';
import { pickDefaultModel } from './base.js';

/** Single source of truth for OpenRouter base URL (was triplicated). */
export const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

/**
 * Conservative fallback when live discovery is unavailable.
 * Verified present on GET https://openrouter.ai/api/v1/models (2026-08).
 */
export const OPENROUTER_FALLBACK_MODEL = 'anthropic/claude-sonnet-5';

export class OpenRouterProvider extends OpenAIProvider {
  constructor(config: OpenRouterProviderConfig) {
    // Resolve OpenRouter key BEFORE super() so the parent never reads TERMWHAT_OPENAI_API_KEY
    const apiKey = process.env.TERMWHAT_OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error('TERMWHAT_OPENROUTER_API_KEY environment variable is not set');
    }

    const headers: Record<string, string> = {};
    if (config.siteUrl) {
      headers['HTTP-Referer'] = config.siteUrl;
    }
    if (config.appName) {
      headers['X-Title'] = config.appName;
    }

    super(
      {
        provider: 'openai',
        model: config.model,
        timeout: config.timeout,
        baseUrl: OPENROUTER_BASE_URL,
      },
      {
        apiKey,
        defaultHeaders: headers,
        missingKeyError: 'TERMWHAT_OPENROUTER_API_KEY environment variable is not set',
      }
    );
  }

  getProviderType(): string {
    return 'openrouter';
  }

  override async resolveDefaultModel(): Promise<string> {
    const models = await this.listModels();
    return pickDefaultModel(
      models,
      [
        /^anthropic\/claude-sonnet-5$/i,
        /^anthropic\/claude-sonnet/i,
        /^anthropic\/claude-opus-5$/i,
        /^anthropic\/claude/i,
        /^openai\/gpt-5/i,
      ],
      OPENROUTER_FALLBACK_MODEL
    );
  }
}
