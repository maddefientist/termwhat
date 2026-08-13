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
    const timeout = envTimeout() ?? config.timeout;

    switch (config.provider) {
      case 'ollama':
        return {
          ...config,
          timeout,
          host: process.env.TERMWHAT_OLLAMA_HOST || config.host,
          model: process.env.TERMWHAT_MODEL || config.model,
        };
      case 'openai':
      case 'anthropic':
      case 'openrouter':
        return {
          ...config,
          timeout,
          model: process.env.TERMWHAT_MODEL || config.model,
        };
      default:
        return config;
    }
  }
}

/**
 * `TERMWHAT_TIMEOUT` (milliseconds) was documented in .env.example long before
 * anything read it. It reads it now. Garbage and non-positive values are
 * ignored with a warning rather than silently disabling the timeout.
 */
function envTimeout(): number | undefined {
  const raw = process.env.TERMWHAT_TIMEOUT;
  if (raw === undefined || raw.trim() === '') return undefined;

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    console.warn(`Ignoring invalid TERMWHAT_TIMEOUT "${raw}" (expected a positive number of ms)`);
    return undefined;
  }

  return parsed;
}
