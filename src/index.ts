#!/usr/bin/env node

import { Command } from 'commander';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { OllamaClient } from './ollama.js';
import { SYSTEM_PROMPT } from './prompt.js';
import { renderResponse } from './render.js';
import { copyToClipboard } from './clipboard.js';
import { runDoctor } from './doctor.js';
import { startRepl } from './repl.js';
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
  .description('AI-powered terminal command suggestions via Ollama')
  .version(packageJson.version)
  .argument('[question...]', 'Question to ask (if omitted, enters REPL mode)')
  .option('-H, --host <url>', 'Ollama host URL')
  .option('-m, --model <name>', 'Model to use', 'llama3.2')
  .option('-j, --json', 'Output raw JSON')
  .option('-c, --copy', 'Copy primary command to clipboard')
  .option('--doctor', 'Run connectivity diagnostics')
  .action(async (questionParts: string[], options) => {
    const client = new OllamaClient({
      host: options.host,
      model: options.model,
    });

    // Run doctor mode
    if (options.doctor) {
      await runDoctor(client);
      return;
    }

    const question = questionParts.join(' ').trim();

    // If no question provided, enter REPL mode
    if (!question) {
      await startRepl(client);
      return;
    }

    // One-shot mode
    await handleOneShotQuery(question, client, options);
  });

async function handleOneShotQuery(
  question: string,
  client: OllamaClient,
  options: { json?: boolean; copy?: boolean }
): Promise<void> {
  try {
    const messages = [
      { role: 'system' as const, content: SYSTEM_PROMPT },
      { role: 'user' as const, content: question },
    ];

    const response = await client.chat(messages);

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
