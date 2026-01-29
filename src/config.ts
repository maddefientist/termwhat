import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import { join, dirname } from 'path';
import * as readline from 'readline';

export interface Config {
  ollamaHost?: string;
  model?: string;
  timeout?: number;
}

const CONFIG_PATH = join(homedir(), '.termwhatrc');

export function loadConfig(): Config {
  if (!existsSync(CONFIG_PATH)) {
    return {};
  }

  try {
    const content = readFileSync(CONFIG_PATH, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.warn(`Warning: Failed to load config from ${CONFIG_PATH}`);
    return {};
  }
}

export function saveConfig(config: Config): void {
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

export async function runSetup(skipIfExists: boolean = false): Promise<Config> {
  if (skipIfExists && configExists()) {
    return loadConfig();
  }

  console.log('\n🔧 termwhat setup\n');

  if (configExists()) {
    const current = loadConfig();
    console.log('Current configuration:');
    console.log(`  Ollama host: ${current.ollamaHost || 'http://localhost:11434 (default)'}`);
    console.log(`  Model:       ${current.model || 'llama3.2 (default)'}`);
    console.log('');
  }

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
    const existing = loadConfig();

    // Ask for Ollama host
    const defaultHost = existing.ollamaHost || 'http://localhost:11434';
    const hostAnswer = await question(`Ollama host URL [${defaultHost}]: `);
    const ollamaHost = hostAnswer || defaultHost;

    // Ask for model
    const defaultModel = existing.model || 'llama3.2';
    const modelAnswer = await question(`Default model [${defaultModel}]: `);
    const model = modelAnswer || defaultModel;

    // Ask for timeout
    const defaultTimeout = existing.timeout || 60000;
    const timeoutAnswer = await question(`Request timeout in ms [${defaultTimeout}]: `);
    const timeout = parseInt(timeoutAnswer) || defaultTimeout;

    const config: Config = { ollamaHost, model, timeout };

    saveConfig(config);

    console.log('');
    console.log(`✓ Configuration saved to ${CONFIG_PATH}`);
    console.log('');
    console.log('You can change these settings anytime by running:');
    console.log('  termwhat setup');
    console.log('');

    rl.close();
    return config;
  } catch (error) {
    rl.close();
    throw error;
  }
}

export function getConfigPath(): string {
  return CONFIG_PATH;
}
