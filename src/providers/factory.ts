import type { ProviderConfig, TermwhatConfig } from '../types.js';
import type { AIProvider } from './base.js';
import { OllamaProvider } from './ollama.js';
import { OpenAIProvider } from './openai.js';
import { AnthropicProvider } from './anthropic.js';
import { OpenRouterProvider } from './openrouter.js';

export class AIProviderFactory {
  static create(config: ProviderConfig): AIProvider {
    // Validate and enrich config with environment variables
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

  static createFromAppConfig(appConfig: TermwhatConfig): AIProvider {
    const providerName = appConfig.currentProvider;
    const providerConfig = appConfig.providers[providerName];

    if (!providerConfig) {
      throw new Error(`Provider "${providerName}" not found in configuration`);
    }

    return this.create(providerConfig);
  }

  private static enrichConfig(config: ProviderConfig): ProviderConfig {
    // Allow environment variables to override config
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

  static validateApiKeys(providerType: string): { valid: boolean; error?: string } {
    switch (providerType) {
      case 'ollama':
        // Ollama doesn't require API keys
        return { valid: true };
      case 'openai':
        if (!process.env.TERMWHAT_OPENAI_API_KEY) {
          return {
            valid: false,
            error: 'TERMWHAT_OPENAI_API_KEY environment variable is not set',
          };
        }
        return { valid: true };
      case 'anthropic':
        if (!process.env.TERMWHAT_ANTHROPIC_API_KEY) {
          return {
            valid: false,
            error: 'TERMWHAT_ANTHROPIC_API_KEY environment variable is not set',
          };
        }
        return { valid: true };
      case 'openrouter':
        if (!process.env.TERMWHAT_OPENROUTER_API_KEY) {
          return {
            valid: false,
            error: 'TERMWHAT_OPENROUTER_API_KEY environment variable is not set',
          };
        }
        return { valid: true };
      default:
        return { valid: false, error: `Unknown provider type: ${providerType}` };
    }
  }
}
