#!/usr/bin/env node

import { Command } from 'commander';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { AIProviderFactory } from './providers/index.js';
import type { AIProvider } from './providers/index.js';
import { SYSTEM_PROMPT } from './prompt.js';
import { renderResponse } from './render.js';
import { copyToClipboard } from './clipboard.js';
import { runDoctor } from './doctor.js';
import { startRepl } from './repl.js';
import { loadConfig, runSetup, configExists, getProviderConfig } from './config.js';
import type { TermwhatResponse } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read package.json for version
const packageJson = JSON.parse(
  readFileSync(join(__dirname, '../package.json'), 'utf-8')
);

const program = new Command();

program
  .name('termwhat')
  .description('AI-powered terminal command suggestions with multi-provider support')
  .version(packageJson.version);

// Setup command
program
  .command('setup')
  .description('Configure termwhat settings')
  .action(async () => {
    await runSetup(false);
    process.exit(0);
  });

// Main command
program
  .argument('[question...]', 'Question to ask (if omitted, enters REPL mode)')
  .option('-p, --provider <type>', 'Provider to use (ollama, openai, anthropic, openrouter)')
  .option('-H, --host <url>', 'Ollama host URL (backward compatible)')
  .option('-m, --model <name>', 'Model to use')
  .option('-j, --json', 'Output raw JSON')
  .option('-c, --copy', 'Copy primary command to clipboard')
  .option('--doctor', 'Run connectivity diagnostics')
  .action(async (questionParts: string[], options) => {
    // Check for first-time setup
    if (!configExists()) {
      console.log('👋 Welcome to termwhat!\n');
      console.log('Looks like this is your first time running termwhat.');
      console.log('Let\'s set up your configuration.\n');
      await runSetup(false);
      console.log('Setup complete! You can now use termwhat.\n');
    }

    // Load config
    const config = loadConfig();

    // Get provider config with environment variable overrides
    let providerConfig = getProviderConfig(config, options.provider);

    // Apply CLI options (highest priority)
    if (options.host && providerConfig.provider === 'ollama') {
      providerConfig = { ...providerConfig, host: options.host };
    }
    if (options.model) {
      providerConfig = { ...providerConfig, model: options.model };
    }

    // Create provider instance
    let provider: AIProvider;
    try {
      provider = AIProviderFactory.create(providerConfig);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Error: ${message}`);
      console.error('\nRun "termwhat setup" to configure providers.');
      process.exit(1);
    }

    // Run doctor mode
    if (options.doctor) {
      await runDoctor(provider);
      return;
    }

    const question = questionParts.join(' ').trim();

    // If no question provided, enter REPL mode
    if (!question) {
      await startRepl(provider, config);
      return;
    }

    // One-shot mode
    await handleOneShotQuery(question, provider, options);
  });

async function handleOneShotQuery(
  question: string,
  provider: AIProvider,
  options: { json?: boolean; copy?: boolean }
): Promise<void> {
  try {
    const messages = [
      { role: 'system' as const, content: SYSTEM_PROMPT },
      { role: 'user' as const, content: question },
    ];

    const response = await provider.chat(messages);

    // JSON output mode
    if (options.json) {
      console.log(response);
      return;
    }

    // Pretty print
    const output = renderResponse(response);
    console.log(output);

    // Copy to clipboard if requested
    if (options.copy) {
      try {
        const parsed: TermwhatResponse = JSON.parse(response);
        if (parsed.commands && parsed.commands.length > 0) {
          const primaryCommand = parsed.commands[0].command;
          await copyToClipboard(primaryCommand);
          console.log(`✓ Copied to clipboard: ${primaryCommand}\n`);
        } else {
          console.error('⚠ No commands found to copy\n');
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error(`✗ Failed to copy to clipboard: ${message}\n`);
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Error: ${message}`);
    process.exit(1);
  }
}

program.parse();
