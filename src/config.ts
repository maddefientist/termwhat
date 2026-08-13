import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  appendFileSync,
  copyFileSync,
} from 'fs';
import { homedir } from 'os';
import { join, dirname } from 'path';
import * as readline from 'readline';
import type { TermwhatConfig, ProviderConfig, OllamaProviderConfig } from './types.js';
import {
  DEFAULT_OLLAMA_LOCAL_MODEL,
  DEFAULT_OLLAMA_CLOUD_MODEL,
  OLLAMA_CLOUD_HOST,
  OPENAI_FALLBACK_MODEL,
  ANTHROPIC_FALLBACK_MODEL,
  OPENROUTER_FALLBACK_MODEL,
} from './providers/index.js';

// Legacy config format (for migration)
interface LegacyConfig {
  ollamaHost?: string;
  model?: string;
  timeout?: number;
}

const CONFIG_PATH = join(homedir(), '.termwhatrc');
const CONFIG_BAK_PATH = join(homedir(), '.termwhatrc.bak');

// 120s, not 60s: the default local model has to be paged into memory on first
// use, and a cold load regularly outruns a one-minute budget. Override with
// TERMWHAT_TIMEOUT.
const DEFAULT_TIMEOUT = 120000;
const MIN_TIMEOUT = 1000;
const MAX_TIMEOUT = 600000;

function isLegacyConfig(config: any): config is LegacyConfig {
  return (
    config &&
    typeof config === 'object' &&
    !config.currentProvider &&
    (config.ollamaHost !== undefined || config.model !== undefined)
  );
}

function defaultOllamaHost(): string {
  const isDocker = process.env.DOCKER === 'true' || process.env.NODE_ENV === 'production';
  return isDocker ? 'http://ollama:11434' : 'http://localhost:11434';
}

function buildDefaultConfig(): TermwhatConfig {
  return {
    currentProvider: 'ollama',
    providers: {
      ollama: {
        provider: 'ollama',
        host: defaultOllamaHost(),
        model: DEFAULT_OLLAMA_LOCAL_MODEL,
        timeout: DEFAULT_TIMEOUT,
        cloud: false,
      },
    },
  };
}

function migrateLegacyConfig(legacy: LegacyConfig): TermwhatConfig {
  const ollamaConfig: OllamaProviderConfig = {
    provider: 'ollama',
    host: legacy.ollamaHost || defaultOllamaHost(),
    model: legacy.model || DEFAULT_OLLAMA_LOCAL_MODEL,
    timeout: legacy.timeout || DEFAULT_TIMEOUT,
    cloud: false,
  };

  return {
    currentProvider: 'ollama',
    providers: {
      ollama: ollamaConfig,
    },
  };
}

/** Normalize / migrate a loaded multi-provider config without discarding user choices. */
function migrateModernConfig(parsed: any): TermwhatConfig {
  const config: TermwhatConfig = {
    currentProvider: parsed.currentProvider || 'ollama',
    providers: { ...(parsed.providers || {}) },
  };

  // Ensure each provider entry has required shape; keep host/model/timeout intact
  for (const [name, raw] of Object.entries(config.providers)) {
    const p = raw as any;
    if (!p || typeof p !== 'object') continue;

    if (p.provider === 'ollama' || name === 'ollama' || name === 'ollama-cloud') {
      const isCloud =
        p.cloud === true ||
        name === 'ollama-cloud' ||
        (typeof p.host === 'string' && p.host.includes('ollama.com'));
      config.providers[name] = {
        provider: 'ollama',
        host: p.host || (isCloud ? OLLAMA_CLOUD_HOST : defaultOllamaHost()),
        model: p.model || (isCloud ? DEFAULT_OLLAMA_CLOUD_MODEL : DEFAULT_OLLAMA_LOCAL_MODEL),
        timeout: typeof p.timeout === 'number' ? p.timeout : DEFAULT_TIMEOUT,
        cloud: isCloud,
      } satisfies OllamaProviderConfig;
    } else if (p.provider === 'openai' || name === 'openai') {
      config.providers[name] = {
        provider: 'openai',
        model: p.model || OPENAI_FALLBACK_MODEL,
        timeout: typeof p.timeout === 'number' ? p.timeout : DEFAULT_TIMEOUT,
        baseUrl: p.baseUrl,
        organization: p.organization,
      };
    } else if (p.provider === 'anthropic' || name === 'anthropic') {
      config.providers[name] = {
        provider: 'anthropic',
        model: p.model || ANTHROPIC_FALLBACK_MODEL,
        timeout: typeof p.timeout === 'number' ? p.timeout : DEFAULT_TIMEOUT,
      };
    } else if (p.provider === 'openrouter' || name === 'openrouter') {
      config.providers[name] = {
        provider: 'openrouter',
        model: p.model || OPENROUTER_FALLBACK_MODEL,
        timeout: typeof p.timeout === 'number' ? p.timeout : DEFAULT_TIMEOUT,
        siteUrl: p.siteUrl,
        appName: p.appName,
      };
    }
  }

  // If currentProvider points at nothing, fall back carefully
  if (!config.providers[config.currentProvider]) {
    const keys = Object.keys(config.providers);
    config.currentProvider = keys.includes('ollama') ? 'ollama' : keys[0] || 'ollama';
    if (!config.providers[config.currentProvider]) {
      config.providers.ollama = buildDefaultConfig().providers.ollama;
      config.currentProvider = 'ollama';
    }
  }

  return config;
}

export function loadConfig(): TermwhatConfig {
  if (!existsSync(CONFIG_PATH)) {
    return buildDefaultConfig();
  }

  try {
    const content = readFileSync(CONFIG_PATH, 'utf-8');
    const parsed = JSON.parse(content);

    if (isLegacyConfig(parsed)) {
      console.log('📦 Migrating configuration to multi-provider format...');
      const migrated = migrateLegacyConfig(parsed);
      saveConfig(migrated);
      console.log('✓ Configuration migrated successfully\n');
      return migrated;
    }

    return migrateModernConfig(parsed);
  } catch (_error) {
    // Corrupt file: back up and warn — do not silently overwrite without a trail
    try {
      if (existsSync(CONFIG_PATH)) {
        copyFileSync(CONFIG_PATH, CONFIG_BAK_PATH);
        console.warn(
          `Warning: Failed to load config from ${CONFIG_PATH}. ` +
            `Corrupt file backed up to ${CONFIG_BAK_PATH}. Using defaults.`
        );
      }
    } catch {
      console.warn(`Warning: Failed to load config from ${CONFIG_PATH}. Using defaults.`);
    }
    return buildDefaultConfig();
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
  return 'bash';
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

/** Format an env export line for the user's shell. */
export function formatEnvExport(envVarName: string, value: string, shell?: string): string {
  const s = shell || detectShell();
  if (s === 'fish') {
    // fish uses set -gx, not export
    return `set -gx ${envVarName} ${JSON.stringify(value)}`;
  }
  return `export ${envVarName}=${JSON.stringify(value)}`;
}

/**
 * Read a secret with muted (no-echo) input.
 * Uses readline's muted-input pattern: monkey-patch the output stream so
 * keystrokes are not echoed, while still accepting the line on Enter.
 */
function questionSecret(rl: readline.Interface, prompt: string): Promise<string> {
  return new Promise((resolve) => {
    const output = (rl as unknown as { output?: NodeJS.WritableStream }).output;
    const originalWrite = output?.write?.bind(output);

    if (output && originalWrite) {
      (output as any).write = (chunk: any, ...args: any[]) => {
        // Suppress echo of single printable characters (user keystrokes).
        // Keep multi-char writes (prompt text, ANSI, newlines) intact.
        const s = typeof chunk === 'string' ? chunk : Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk ?? '');
        if (s.length === 1 && s >= ' ' && s !== '\x7f') {
          return true;
        }
        return (originalWrite as (...a: any[]) => any)(chunk, ...args);
      };
    }

    rl.question(prompt, (answer) => {
      if (output && originalWrite) {
        (output as any).write = originalWrite;
      }
      // Ensure the cursor advances after hidden input
      if (output) output.write('\n');
      resolve(answer.trim());
    });
  });
}

function questionPlain(rl: readline.Interface, prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => resolve(answer.trim()));
  });
}

/** Upsert an env export in a shell rc file — replace existing, don't duplicate. */
function upsertShellExport(rcPath: string, envVarName: string, value: string): void {
  const shell = detectShell();
  const newLine = formatEnvExport(envVarName, value, shell);
  const marker = `# termwhat - ${envVarName}`;

  let content = '';
  if (existsSync(rcPath)) {
    content = readFileSync(rcPath, 'utf-8');
  } else {
    const dir = dirname(rcPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }

  // Match prior termwhat-managed block or bare export/set for this var
  const blockRe = new RegExp(
    `(?:^|\\n)# termwhat - ${envVarName}[^\\n]*\\n(?:export\\s+${envVarName}=[^\\n]*|set\\s+-gx\\s+${envVarName}\\s+[^\\n]*)\\n?`,
    'm'
  );
  const bareRe =
    shell === 'fish'
      ? new RegExp(`(?:^|\\n)set\\s+-gx\\s+${envVarName}\\s+[^\\n]*\\n?`, 'm')
      : new RegExp(`(?:^|\\n)export\\s+${envVarName}=[^\\n]*\\n?`, 'm');

  const replacement = `\n${marker}\n${newLine}\n`;

  if (blockRe.test(content)) {
    content = content.replace(blockRe, replacement);
    writeFileSync(rcPath, content, 'utf-8');
  } else if (bareRe.test(content)) {
    content = content.replace(bareRe, replacement);
    writeFileSync(rcPath, content, 'utf-8');
  } else {
    appendFileSync(rcPath, replacement, 'utf-8');
  }
}

async function setupProviderApiKey(
  rl: readline.Interface,
  providerType: string,
  providerName: string,
  apiUrl: string,
  envVarName: string
): Promise<boolean> {
  console.log(`\n─────────────────────────────────────`);
  console.log(`Configuring: ${providerType}`);
  console.log(`─────────────────────────────────────\n`);

  console.log(`${providerName} requires an API key from: ${apiUrl}\n`);
  console.log(`Your API key will be stored as an environment variable (not in the config file).\n`);

  const shellRc = getShellRcPath();
  const shell = detectShell();
  const exampleLine = formatEnvExport(envVarName, 'your-api-key-here', shell);

  console.log(`Example line for your shell (${shell}):`);
  console.log(`  ${exampleLine}\n`);

  const shouldAdd = await questionPlain(
    rl,
    `Add to ${shellRc}? [y]es / [n]o (print only) / [s]kip entirely: `
  );

  const choice = shouldAdd.toLowerCase();

  if (choice === 's' || choice === 'skip') {
    console.log(`\nSkipping ${providerType} setup.`);
    return false;
  }

  if (choice === 'n' || choice === 'no') {
    // Don't touch shell config — user will export themselves
    const apiKey = await questionSecret(rl, `\nPaste your ${providerName} API key (input hidden): `);
    if (!apiKey) {
      console.log(`No API key provided. Skipping ${providerType} setup.`);
      return false;
    }
    process.env[envVarName] = apiKey;
    console.log(`✓ Loaded into current session only`);
    console.log(`\nAdd this to your shell config yourself:`);
    console.log(`  ${formatEnvExport(envVarName, apiKey, shell)}`);
    console.log(`(key not written to disk by termwhat)\n`);
    // Note: we intentionally show the export line here because the user
    // opted into manual setup and needs the exact line — but we do not
    // re-print the bare key on write-failure paths.
    return true;
  }

  // Default: yes — write to rc
  const apiKey = await questionSecret(rl, `\nPaste your ${providerName} API key (input hidden): `);

  if (!apiKey) {
    console.log(`No API key provided. Skipping ${providerType} setup.`);
    return false;
  }

  try {
    upsertShellExport(shellRc, envVarName, apiKey);
    console.log(`✓ Added/updated in ${shellRc}`);
    process.env[envVarName] = apiKey;
    console.log(`✓ Loaded into current session`);
    return true;
  } catch {
    console.error(`Error: Failed to write to ${shellRc}`);
    console.log(`\nPlease manually add this line to your ${shellRc}:`);
    // Never print key material on failure — print a placeholder
    console.log(`  ${formatEnvExport(envVarName, 'YOUR_KEY_HERE', shell)}`);
    return false;
  }
}

/** Parse and bound a timeout string; report invalid input. Rejects 0/NaN/garbage. */
export function parseTimeout(input: string | undefined, fallback: number = DEFAULT_TIMEOUT): number {
  if (input === undefined || input === '') return fallback;
  const trimmed = String(input).trim();
  if (!/^\d+$/.test(trimmed)) {
    console.warn(`Invalid timeout "${input}"; using ${fallback}ms`);
    return fallback;
  }
  const n = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(n)) {
    console.warn(`Invalid timeout "${input}"; using ${fallback}ms`);
    return fallback;
  }
  if (n < MIN_TIMEOUT || n > MAX_TIMEOUT) {
    console.warn(
      `Timeout ${n} out of range [${MIN_TIMEOUT}, ${MAX_TIMEOUT}]; using ${fallback}ms`
    );
    return fallback;
  }
  return n;
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

  const question = (prompt: string): Promise<string> => questionPlain(rl, prompt);

  try {
    const config: TermwhatConfig = loadConfig();

    console.log('Select providers to configure (Ollama-first):\n');
    const configOllamaLocal = await question('  Configure Ollama (local)? [Y/n]: ');
    const configOllamaCloud = await question('  Configure Ollama (cloud)? [y/N]: ');
    const configOpenAI = await question('  Configure openai? [y/N]: ');
    const configAnthropic = await question('  Configure anthropic? [y/N]: ');
    const configOpenRouter = await question('  Configure openrouter? [y/N]: ');

    // Configure Ollama (local)
    if (configOllamaLocal.toLowerCase() !== 'n') {
      console.log(`\n─────────────────────────────────────`);
      console.log(`Configuring: Ollama (local)`);
      console.log(`─────────────────────────────────────\n`);

      const existingOllama = config.providers.ollama as OllamaProviderConfig | undefined;
      const defaultHost =
        existingOllama && !existingOllama.cloud
          ? existingOllama.host
          : 'http://localhost:11434';
      const defaultModel =
        existingOllama && !existingOllama.cloud
          ? existingOllama.model
          : DEFAULT_OLLAMA_LOCAL_MODEL;
      const defaultTimeout = existingOllama?.timeout || DEFAULT_TIMEOUT;

      const hostAnswer = await question(`Ollama host URL [${defaultHost}]: `);
      const modelAnswer = await question(`Default model [${defaultModel}]: `);
      const timeoutAnswer = await question(`Request timeout in ms [${defaultTimeout}]: `);

      const host = hostAnswer || defaultHost;
      // Validate host is a URL
      try {
        new URL(host);
      } catch {
        console.warn(`Warning: "${host}" does not look like a valid URL; saving anyway.`);
      }

      config.providers.ollama = {
        provider: 'ollama',
        host,
        model: modelAnswer || defaultModel,
        timeout: parseTimeout(timeoutAnswer, defaultTimeout),
        cloud: false,
      };

      console.log(`✓ Ollama (local) configured`);
    }

    // Configure Ollama (cloud)
    if (configOllamaCloud.toLowerCase() === 'y') {
      const configured = await setupProviderApiKey(
        rl,
        'ollama-cloud',
        'Ollama Cloud',
        'https://ollama.com/settings/keys',
        'TERMWHAT_OLLAMA_API_KEY'
      );

      if (configured) {
        const existing = config.providers['ollama-cloud'] as OllamaProviderConfig | undefined;
        const defaultModel = existing?.model || DEFAULT_OLLAMA_CLOUD_MODEL;
        const modelAnswer = await question(`\nDefault cloud model [${defaultModel}]: `);

        config.providers['ollama-cloud'] = {
          provider: 'ollama',
          host: OLLAMA_CLOUD_HOST,
          model: modelAnswer || defaultModel,
          timeout: DEFAULT_TIMEOUT,
          cloud: true,
        };

        console.log(`✓ Ollama (cloud) configured`);
      }
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
        let defaultModel = OPENAI_FALLBACK_MODEL;
        try {
          // Live discovery when possible
          const { OpenAIProvider } = await import('./providers/openai.js');
          const tmp = new OpenAIProvider({
            provider: 'openai',
            model: OPENAI_FALLBACK_MODEL,
            timeout: DEFAULT_TIMEOUT,
          });
          defaultModel = await tmp.resolveDefaultModel();
        } catch {
          // keep fallback
        }

        const modelAnswer = await question(`\nDefault model [${defaultModel}]: `);

        config.providers.openai = {
          provider: 'openai',
          model: modelAnswer || defaultModel,
          timeout: DEFAULT_TIMEOUT,
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
        let defaultModel = ANTHROPIC_FALLBACK_MODEL;
        try {
          const { AnthropicProvider } = await import('./providers/anthropic.js');
          const tmp = new AnthropicProvider({
            provider: 'anthropic',
            model: ANTHROPIC_FALLBACK_MODEL,
            timeout: DEFAULT_TIMEOUT,
          });
          defaultModel = await tmp.resolveDefaultModel();
        } catch {
          // keep fallback
        }

        const modelAnswer = await question(`\nDefault model [${defaultModel}]: `);

        config.providers.anthropic = {
          provider: 'anthropic',
          model: modelAnswer || defaultModel,
          timeout: DEFAULT_TIMEOUT,
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
        let defaultModel = OPENROUTER_FALLBACK_MODEL;
        try {
          const { OpenRouterProvider } = await import('./providers/openrouter.js');
          const tmp = new OpenRouterProvider({
            provider: 'openrouter',
            model: OPENROUTER_FALLBACK_MODEL,
            timeout: DEFAULT_TIMEOUT,
          });
          defaultModel = await tmp.resolveDefaultModel();
        } catch {
          // keep fallback
        }

        const modelAnswer = await question(`\nDefault model [${defaultModel}]: `);

        config.providers.openrouter = {
          provider: 'openrouter',
          model: modelAnswer || defaultModel,
          timeout: DEFAULT_TIMEOUT,
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

  if (providerConfig.provider === 'ollama') {
    return {
      ...providerConfig,
      host: process.env.TERMWHAT_OLLAMA_HOST || providerConfig.host,
      model: process.env.TERMWHAT_MODEL || providerConfig.model,
    };
  }

  return {
    ...providerConfig,
    model: process.env.TERMWHAT_MODEL || providerConfig.model,
  };
}
