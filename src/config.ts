import { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync } from 'fs';
import { homedir } from 'os';
import { join, dirname } from 'path';
import * as readline from 'readline';
import type { TermwhatConfig, ProviderConfig, OllamaProviderConfig } from './types.js';
import { AIProviderFactory } from './providers/index.js';

// Legacy config format (for migration)
interface LegacyConfig {
  ollamaHost?: string;
  model?: string;
  timeout?: number;
}

const CONFIG_PATH = join(homedir(), '.termwhatrc');

function isLegacyConfig(config: any): config is LegacyConfig {
  return (
    config &&
    typeof config === 'object' &&
    !config.currentProvider &&
    (config.ollamaHost !== undefined || config.model !== undefined)
  );
}

function migrateLegacyConfig(legacy: LegacyConfig): TermwhatConfig {
  const isDocker = process.env.DOCKER === 'true' || process.env.NODE_ENV === 'production';
  const defaultHost = isDocker ? 'http://ollama:11434' : 'http://localhost:11434';

  const ollamaConfig: OllamaProviderConfig = {
    provider: 'ollama',
    host: legacy.ollamaHost || defaultHost,
    model: legacy.model || 'llama3.2',
    timeout: legacy.timeout || 60000,
  };

  return {
    currentProvider: 'ollama',
    providers: {
      ollama: ollamaConfig,
    },
  };
}

export function loadConfig(): TermwhatConfig {
  if (!existsSync(CONFIG_PATH)) {
    // Return default Ollama config
    const isDocker = process.env.DOCKER === 'true' || process.env.NODE_ENV === 'production';
    const defaultHost = isDocker ? 'http://ollama:11434' : 'http://localhost:11434';

    return {
      currentProvider: 'ollama',
      providers: {
        ollama: {
          provider: 'ollama',
          host: defaultHost,
          model: 'llama3.2',
          timeout: 60000,
        },
      },
    };
  }

  try {
    const content = readFileSync(CONFIG_PATH, 'utf-8');
    const parsed = JSON.parse(content);

    // Check if migration is needed
    if (isLegacyConfig(parsed)) {
      console.log('📦 Migrating configuration to multi-provider format...');
      const migrated = migrateLegacyConfig(parsed);
      saveConfig(migrated);
      console.log('✓ Configuration migrated successfully\n');
      return migrated;
    }

    return parsed as TermwhatConfig;
  } catch (error) {
    console.warn(`Warning: Failed to load config from ${CONFIG_PATH}`);
    // Return default config
    const isDocker = process.env.DOCKER === 'true' || process.env.NODE_ENV === 'production';
    const defaultHost = isDocker ? 'http://ollama:11434' : 'http://localhost:11434';

    return {
      currentProvider: 'ollama',
      providers: {
        ollama: {
          provider: 'ollama',
          host: defaultHost,
          model: 'llama3.2',
          timeout: 60000,
        },
      },
    };
  }
}

export function saveConfig(config: TermwhatConfig): void {
  try {
    const dir = dirname(CONFIG_PATH);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
  } catch (error) {
    console.error(`Error: Failed to save config to ${CONFIG_PATH}`);
    throw error;
  }
}

export function configExists(): boolean {
  return existsSync(CONFIG_PATH);
}

export function getConfigPath(): string {
  return CONFIG_PATH;
}

function detectShell(): string {
  const shell = process.env.SHELL || '';
  if (shell.includes('zsh')) return 'zsh';
  if (shell.includes('bash')) return 'bash';
  if (shell.includes('fish')) return 'fish';
  return 'bash'; // default
}

function getShellRcPath(): string {
  const shell = detectShell();
  const home = homedir();

  switch (shell) {
    case 'zsh':
      return join(home, '.zshrc');
    case 'fish':
      return join(home, '.config', 'fish', 'config.fish');
    case 'bash':
    default:
      return join(home, '.bashrc');
  }
}

async function setupProviderApiKey(
  rl: readline.Interface,
  providerType: string,
  providerName: string,
  apiUrl: string,
  envVarName: string
): Promise<boolean> {
  const question = (prompt: string): Promise<string> => {
    return new Promise((resolve) => {
      rl.question(prompt, (answer) => resolve(answer.trim()));
    });
  };

  console.log(`\n─────────────────────────────────────`);
  console.log(`Configuring: ${providerType}`);
  console.log(`─────────────────────────────────────\n`);

  console.log(`${providerName} requires an API key from: ${apiUrl}\n`);
  console.log(`I can help you set this up. Your API key will be stored securely`);
  console.log(`as an environment variable (not in the config file).\n`);

  const shellRc = getShellRcPath();
  console.log(`Add this line to your ${shellRc}:`);
  console.log(`  export ${envVarName}="your-api-key-here"\n`);

  const shouldAdd = await question(`Would you like me to add this for you? (you'll paste your API key) [y/n]: `);

  if (shouldAdd.toLowerCase() !== 'y') {
    console.log(`\nSkipping ${providerType} setup. You can set it up later by running:`);
    console.log(`  export ${envVarName}="your-api-key-here"`);
    return false;
  }

  const apiKey = await question(`\nPaste your ${providerName} API key: `);

  if (!apiKey) {
    console.log(`No API key provided. Skipping ${providerType} setup.`);
    return false;
  }

  // Append to shell rc file
  try {
    const exportLine = `\n# termwhat - ${providerName} API key\nexport ${envVarName}="${apiKey}"\n`;
    appendFileSync(shellRc, exportLine, 'utf-8');
    console.log(`✓ Added to ${shellRc}`);

    // Set in current environment
    process.env[envVarName] = apiKey;
    console.log(`✓ Loaded into current session`);

    return true;
  } catch (error) {
    console.error(`Error: Failed to write to ${shellRc}`);
    console.log(`\nPlease manually add this line to your ${shellRc}:`);
    console.log(`  export ${envVarName}="${apiKey}"`);
    return false;
  }
}

export async function runSetup(skipIfExists: boolean = false): Promise<TermwhatConfig> {
  if (skipIfExists && configExists()) {
    return loadConfig();
  }

  console.log('\n🔧 termwhat setup\n');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const question = (prompt: string): Promise<string> => {
    return new Promise((resolve) => {
      rl.question(prompt, (answer) => resolve(answer.trim()));
    });
  };

  try {
    const config: TermwhatConfig = loadConfig();

    // Ask which providers to configure
    console.log('Select providers to configure:');
    const configOllama = await question('  Configure ollama? [Y/n]: ');
    const configOpenAI = await question('  Configure openai? [y/N]: ');
    const configAnthropic = await question('  Configure anthropic? [y/N]: ');
    const configOpenRouter = await question('  Configure openrouter? [y/N]: ');

    // Configure Ollama
    if (configOllama.toLowerCase() !== 'n') {
      console.log(`\n─────────────────────────────────────`);
      console.log(`Configuring: ollama`);
      console.log(`─────────────────────────────────────\n`);

      const existingOllama = config.providers.ollama as OllamaProviderConfig | undefined;
      const defaultHost = existingOllama?.host || 'http://localhost:11434';
      const defaultModel = existingOllama?.model || 'llama3.2';
      const defaultTimeout = existingOllama?.timeout || 60000;

      const hostAnswer = await question(`Ollama host URL [${defaultHost}]: `);
      const modelAnswer = await question(`Default model [${defaultModel}]: `);
      const timeoutAnswer = await question(`Request timeout in ms [${defaultTimeout}]: `);

      config.providers.ollama = {
        provider: 'ollama',
        host: hostAnswer || defaultHost,
        model: modelAnswer || defaultModel,
        timeout: parseInt(timeoutAnswer) || defaultTimeout,
      };

      console.log(`✓ Ollama configured`);
    }

    // Configure OpenAI
    if (configOpenAI.toLowerCase() === 'y') {
      const configured = await setupProviderApiKey(
        rl,
        'openai',
        'OpenAI',
        'https://platform.openai.com/api-keys',
        'TERMWHAT_OPENAI_API_KEY'
      );

      if (configured) {
        const defaultModel = 'gpt-4';
        const modelAnswer = await question(`\nDefault model [${defaultModel}]: `);

        config.providers.openai = {
          provider: 'openai',
          model: modelAnswer || defaultModel,
          timeout: 60000,
        };

        console.log(`✓ OpenAI configured`);
      }
    }

    // Configure Anthropic
    if (configAnthropic.toLowerCase() === 'y') {
      const configured = await setupProviderApiKey(
        rl,
        'anthropic',
        'Anthropic',
        'https://console.anthropic.com/settings/keys',
        'TERMWHAT_ANTHROPIC_API_KEY'
      );

      if (configured) {
        const defaultModel = 'claude-3-5-sonnet-20241022';
        const modelAnswer = await question(`\nDefault model [${defaultModel}]: `);

        config.providers.anthropic = {
          provider: 'anthropic',
          model: modelAnswer || defaultModel,
          timeout: 60000,
        };

        console.log(`✓ Anthropic configured`);
      }
    }

    // Configure OpenRouter
    if (configOpenRouter.toLowerCase() === 'y') {
      const configured = await setupProviderApiKey(
        rl,
        'openrouter',
        'OpenRouter',
        'https://openrouter.ai/keys',
        'TERMWHAT_OPENROUTER_API_KEY'
      );

      if (configured) {
        const defaultModel = 'anthropic/claude-3.5-sonnet';
        const modelAnswer = await question(`\nDefault model [${defaultModel}]: `);

        config.providers.openrouter = {
          provider: 'openrouter',
          model: modelAnswer || defaultModel,
          timeout: 60000,
        };

        console.log(`✓ OpenRouter configured`);
      }
    }

    // Save configuration
    saveConfig(config);

    console.log(`\n─────────────────────────────────────`);
    console.log(`Configuration saved!`);
    console.log(`─────────────────────────────────────\n`);

    // Ask for default provider
    const providers = Object.keys(config.providers);
    if (providers.length > 1) {
      console.log(`Available providers: ${providers.join(', ')}`);
      const defaultProvider = await question(`Default provider [${config.currentProvider}]: `);
      if (defaultProvider && providers.includes(defaultProvider)) {
        config.currentProvider = defaultProvider;
        saveConfig(config);
      }
    }

    console.log(`✓ Default provider set to: ${config.currentProvider}\n`);
    console.log(`Run 'termwhat --doctor' to test connectivity.\n`);

    rl.close();
    return config;
  } catch (error) {
    rl.close();
    throw error;
  }
}

// Helper function to get provider config with environment variable overrides
export function getProviderConfig(config: TermwhatConfig, providerName?: string): ProviderConfig {
  const provider = providerName || process.env.TERMWHAT_PROVIDER || config.currentProvider;
  const providerConfig = config.providers[provider];

  if (!providerConfig) {
    throw new Error(`Provider "${provider}" not found in configuration`);
  }

  // Apply environment variable overrides based on provider type
  if (providerConfig.provider === 'ollama') {
    return {
      ...providerConfig,
      host: process.env.TERMWHAT_OLLAMA_HOST || providerConfig.host,
      model: process.env.TERMWHAT_MODEL || providerConfig.model,
    };
  } else {
    // For OpenAI, Anthropic, OpenRouter
    return {
      ...providerConfig,
      model: process.env.TERMWHAT_MODEL || providerConfig.model,
    };
  }
}
