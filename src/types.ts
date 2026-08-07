export interface CommandSuggestion {
  label: string;
  command: string;
  explanation: string;
  risk_level: 'low' | 'medium' | 'high';
}

/**
 * The prompt asks for plain strings here, but models frequently return richer
 * objects (e.g. `{command, description}`). The renderer normalizes both, so the
 * type reflects what actually arrives rather than what we asked for.
 */
export type NoteEntry = string | Record<string, unknown>;

export interface TermwhatResponse {
  title: string;
  os_assumptions: string[];
  commands: CommandSuggestion[];
  pitfalls: NoteEntry[];
  verification_steps: NoteEntry[];
}

export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

// Provider-specific configs
export interface OllamaProviderConfig {
  provider: 'ollama';
  host: string;
  model: string;
  timeout: number;
  /** When true, talk to Ollama cloud (https://ollama.com) with Bearer auth */
  cloud?: boolean;
}

export interface OpenAIProviderConfig {
  provider: 'openai';
  model: string;
  timeout: number;
  baseUrl?: string;
  organization?: string;
}

export interface AnthropicProviderConfig {
  provider: 'anthropic';
  model: string;
  timeout: number;
}

export interface OpenRouterProviderConfig {
  provider: 'openrouter';
  model: string;
  timeout: number;
  siteUrl?: string;
  appName?: string;
}

export type ProviderConfig =
  | OllamaProviderConfig
  | OpenAIProviderConfig
  | AnthropicProviderConfig
  | OpenRouterProviderConfig;

// Multi-provider app configuration
export interface TermwhatConfig {
  currentProvider: string;
  providers: {
    [key: string]: ProviderConfig;
  };
}
