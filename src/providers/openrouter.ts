import OpenAI from 'openai';
import type { OpenRouterProviderConfig } from '../types.js';
import { OpenAIProvider } from './openai.js';

export class OpenRouterProvider extends OpenAIProvider {
  constructor(config: OpenRouterProviderConfig) {
    // Convert OpenRouter config to OpenAI config format
    const openAIConfig = {
      provider: 'openai' as const,
      model: config.model,
      timeout: config.timeout,
      baseUrl: 'https://openrouter.ai/api/v1',
    };

    super(openAIConfig);

    // Override the client with OpenRouter-specific settings
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

    this.client = new OpenAI({
      apiKey,
      baseURL: 'https://openrouter.ai/api/v1',
      defaultHeaders: headers,
      timeout: config.timeout,
    });

    this.baseUrl = 'https://openrouter.ai/api/v1';
  }

  getProviderType(): string {
    return 'openrouter';
  }
}
