export interface CommandSuggestion {
  label: string;
  command: string;
  explanation: string;
  risk_level: 'low' | 'medium' | 'high';
}

export interface TermwhatResponse {
  title: string;
  os_assumptions: string[];
  commands: CommandSuggestion[];
  pitfalls: string[];
  verification_steps: string[];
}

export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

// Provider types
export enum ProviderType {
  OLLAMA = 'ollama',
  OPENAI = 'openai',
  ANTHROPIC = 'anthropic',
  OPENROUTER = 'openrouter',
}

// Provider-specific configs
export interface OllamaProviderConfig {
  provider: 'ollama';
  host: string;
  model: string;
  timeout: number;
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

// Legacy config (for migration)
export interface OllamaConfig {
  host: string;
  model: string;
  timeout: number;
}
