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

const packageJson = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf-8'));

/**
 * Shape of the two shipped binaries.
 *
 * `termwhat` explains itself; `term` is the same tool in a hurry. They are two
 * entry files over this one module rather than one binary sniffing its own
 * name from argv[1] — on Windows npm installs .cmd shims that invoke the
 * target script directly, so the invoked name is not reliably observable.
 */
export interface CliVariant {
  /** Binary name, used in --help and error messages. */
  name: string;
  /** Suppress explanations by default (the `term` binary). */
  briefByDefault: boolean;
  description: string;
}

export const TERMWHAT_VARIANT: CliVariant = {
  name: 'termwhat',
  briefByDefault: false,
  description: 'AI-powered terminal command suggestions with multi-provider support',
};

export const TERM_VARIANT: CliVariant = {
  name: 'term',
  briefByDefault: true,
  description: 'termwhat, in a hurry — prints the command only (use --full for the explanation)',
};

export function runCli(variant: CliVariant = TERMWHAT_VARIANT): void {
  const program = new Command();

  program.name(variant.name).description(variant.description).version(packageJson.version);

  program
    .command('setup')
    .description('Configure termwhat settings')
    .action(async () => {
      await runSetup(false);
      process.exit(0);
    });

  const main = program
    .argument('[question...]', 'Question to ask (if omitted, enters REPL mode)')
    .option(
      '-p, --provider <type>',
      'Provider to use (ollama, ollama-cloud, openai, anthropic, openrouter)'
    )
    .option('-H, --host <url>', 'Ollama host URL (backward compatible)')
    .option('-m, --model <name>', 'Model to use')
    .option('-j, --json', 'Output raw JSON')
    .option('-c, --copy', 'Copy primary command to clipboard')
    .option('--doctor', 'Run connectivity diagnostics');

  // Each variant only advertises the flag that can actually change its output.
  if (variant.briefByDefault) {
    main.option('-f, --full', 'Full mode: include explanations, pitfalls and verification');
  } else {
    main.option('-b, --brief', 'Brief mode: output only the command(s)');
  }

  main.action(async (questionParts: string[], options) => {
    const brief = variant.briefByDefault ? !options.full : !!options.brief;

    if (!configExists()) {
      console.log('👋 Welcome to termwhat!\n');
      console.log('Looks like this is your first time running termwhat.');
      console.log("Let's set up your configuration.\n");
      await runSetup(false);
      console.log('Setup complete! You can now use termwhat.\n');
    }

    const config = loadConfig();

    let providerConfig = getProviderConfig(config, options.provider);

    if (options.host && providerConfig.provider === 'ollama') {
      providerConfig = { ...providerConfig, host: options.host };
    }
    if (options.model) {
      providerConfig = { ...providerConfig, model: options.model };
    }

    let provider: AIProvider;
    try {
      provider = AIProviderFactory.create(providerConfig);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Error: ${message}`);
      console.error('\nRun "termwhat setup" to configure providers.');
      process.exit(1);
    }

    if (options.doctor) {
      await runDoctor(provider);
      return;
    }

    const question = questionParts.join(' ').trim();

    if (!question) {
      await startRepl(provider, config);
      return;
    }

    await handleOneShotQuery(question, provider, { ...options, brief });
  });

  program.parse();
}

async function handleOneShotQuery(
  question: string,
  provider: AIProvider,
  options: { json?: boolean; copy?: boolean; brief?: boolean }
): Promise<void> {
  try {
    const messages = [
      { role: 'system' as const, content: SYSTEM_PROMPT },
      { role: 'user' as const, content: question },
    ];

    const response = await provider.chat(messages);

    if (options.json) {
      console.log(response);
      return;
    }

    const output = renderResponse(response, options.brief);
    console.log(output);

    if (options.copy) {
      let parsed: TermwhatResponse;
      try {
        parsed = JSON.parse(response);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error(`✗ Failed to parse response JSON for clipboard copy: ${message}\n`);
        return;
      }

      try {
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
