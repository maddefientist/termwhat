import type { ProviderConfig } from '../types.js';
import type { AIProvider } from './base.js';
import { OllamaProvider } from './ollama.js';
import { OpenAIProvider } from './openai.js';
import { AnthropicProvider } from './anthropic.js';
import { OpenRouterProvider } from './openrouter.js';

export class AIProviderFactory {
  static create(config: ProviderConfig): AIProvider {
    const enrichedConfig = this.enrichConfig(config);

    switch (enrichedConfig.provider) {
      case 'ollama':
        return new OllamaProvider(enrichedConfig);
      case 'openai':
        return new OpenAIProvider(enrichedConfig);
      case 'anthropic':
        return new AnthropicProvider(enrichedConfig);
      case 'openrouter':
        return new OpenRouterProvider(enrichedConfig);
      default:
        throw new Error(`Unknown provider type: ${(config as any).provider}`);
    }
  }

  private static enrichConfig(config: ProviderConfig): ProviderConfig {
    switch (config.provider) {
      case 'ollama':
        return {
          ...config,
          host: process.env.TERMWHAT_OLLAMA_HOST || config.host,
          model: process.env.TERMWHAT_MODEL || config.model,
        };
      case 'openai':
      case 'anthropic':
      case 'openrouter':
        return {
          ...config,
          model: process.env.TERMWHAT_MODEL || config.model,
        };
      default:
        return config;
    }
  }
}
