import * as readline from 'readline';
import type { AIProvider } from './providers/index.js';
import { AIProviderFactory } from './providers/index.js';
import { SYSTEM_PROMPT } from './prompt.js';
import { renderResponse, renderSpinner } from './render.js';
import { runDoctor } from './doctor.js';
import { saveConfig } from './config.js';
import type { ConversationMessage, TermwhatConfig } from './types.js';

const MAX_HISTORY = 10;

interface ReplState {
  provider: AIProvider;
  config: TermwhatConfig;
  currentProviderName: string;
}

export async function startRepl(initialProvider: AIProvider, config: TermwhatConfig): Promise<void> {
  const conversationHistory: ConversationMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
  ];

  const state: ReplState = {
    provider: initialProvider,
    config,
    currentProviderName: config.currentProvider,
  };

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: getPrompt(state.provider),
  });

  console.log('');
  console.log('Welcome to termwhat REPL mode!');
  console.log('Type /help for available commands, /exit to quit.');
  console.log('');

  rl.prompt();

  rl.on('line', async (line) => {
    const input = line.trim();

    if (!input) {
      rl.prompt();
      return;
    }

    // Handle REPL commands
    if (input.startsWith('/')) {
      await handleCommand(input, state, conversationHistory, rl);
      rl.setPrompt(getPrompt(state.provider));
      rl.prompt();
      return;
    }

    // Regular question - query provider
    await handleQuestion(input, state.provider, conversationHistory, false);
    rl.prompt();
  });

  rl.on('close', () => {
    console.log('\nGoodbye!');
    process.exit(0);
  });

  // Handle Ctrl+C gracefully
  rl.on('SIGINT', () => {
    console.log('\n(Use /exit or press Ctrl+C again to quit)');
    rl.prompt();
  });
}

function getPrompt(provider: AIProvider): string {
  const providerType = provider.getProviderType();
  const model = provider.getModelName();
  return `[${providerType}:${model}]> `;
}

async function handleCommand(
  command: string,
  state: ReplState,
  history: ConversationMessage[],
  rl: readline.Interface
): Promise<void> {
  const parts = command.slice(1).split(/\s+/);
  const cmd = parts[0].toLowerCase();
  const args = parts.slice(1);

  switch (cmd) {
    case 'help':
      showHelp();
      break;

    case 'exit':
    case 'quit':
      rl.close();
      break;

    case 'term':
      // Brief mode - just output the command
      if (args.length === 0) {
        console.log('Usage: /term <question>');
        console.log('Example: /term how to list running processes');
      } else {
        const question = args.join(' ');
        await handleQuestion(question, state.provider, history, true);
      }
      break;

    case 'provider':
      if (args.length === 0) {
        console.log(`Current provider: ${state.currentProviderName}`);
        console.log('\nAvailable providers:');
        Object.keys(state.config.providers).forEach(name => {
          const p = state.config.providers[name];
          const marker = name === state.currentProviderName ? ' (current)' : '';
          console.log(`  • ${name} (${p.provider}, model: ${p.model})${marker}`);
        });
      } else if (args[0] === 'list') {
        console.log('Available providers:');
        Object.keys(state.config.providers).forEach(name => {
          const p = state.config.providers[name];
          const marker = name === state.currentProviderName ? ' (current)' : '';
          console.log(`  • ${name} (${p.provider}, model: ${p.model})${marker}`);
        });
      } else {
        const newProviderName = args[0];
        if (!state.config.providers[newProviderName]) {
          console.log(`Error: Provider "${newProviderName}" not found.`);
          console.log('Run "/provider list" to see available providers.');
          break;
        }

        try {
          const newProviderConfig = state.config.providers[newProviderName];
          const newProvider = AIProviderFactory.create(newProviderConfig);
          state.provider = newProvider;
          state.currentProviderName = newProviderName;
          state.config.currentProvider = newProviderName;
          saveConfig(state.config);
          console.log(`Provider set to: ${newProviderName} (${newProviderConfig.provider}, model: ${newProviderConfig.model})`);
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown error';
          console.error(`Error switching provider: ${message}`);
        }
      }
      break;

    case 'models':
      try {
        console.log('Fetching available models...');
        const models = await state.provider.listModels();
        console.log('\nAvailable models:');
        models.forEach(model => {
          const marker = model === state.provider.getModelName() ? ' (current)' : '';
          console.log(`  • ${model}${marker}`);
        });
        console.log('');
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error(`Error listing models: ${message}`);
      }
      break;

    case 'model':
      if (args.length === 0) {
        console.log(`Current model: ${state.provider.getModelName()}`);
      } else {
        const newModel = args[0];
        state.provider.updateConfig({ model: newModel });

        // Update config file
        const providerConfig = state.config.providers[state.currentProviderName];
        if (providerConfig) {
          providerConfig.model = newModel;
          saveConfig(state.config);
        }

        console.log(`Model set to: ${newModel}`);
      }
      break;

    case 'host':
      if (state.provider.getProviderType() !== 'ollama') {
        console.log('The /host command is only available for the Ollama provider.');
        break;
      }

      if (args.length === 0) {
        const config = state.provider.getConfig();
        console.log(`Current host: ${config.host}`);
      } else {
        const newHost = args[0];
        state.provider.updateConfig({ host: newHost });

        // Update config file
        const providerConfig = state.config.providers[state.currentProviderName];
        if (providerConfig && providerConfig.provider === 'ollama') {
          providerConfig.host = newHost;
          saveConfig(state.config);
        }

        console.log(`Host set to: ${newHost}`);
      }
      break;

    case 'history':
      showHistory(history);
      break;

    case 'clear':
      // Keep only the system prompt
      history.length = 1;
      console.log('Conversation history cleared.');
      break;

    case 'doctor':
      await runDoctor(state.provider);
      break;

    default:
      console.log(`Unknown command: /${cmd}`);
      console.log('Type /help for available commands.');
  }
}

async function handleQuestion(
  question: string,
  provider: AIProvider,
  history: ConversationMessage[],
  brief: boolean = false
): Promise<void> {
  // Add user message to history
  history.push({ role: 'user', content: question });

  // Trim history to keep only last MAX_HISTORY turns (excluding system prompt)
  while (history.length > MAX_HISTORY * 2 + 1) {
    history.splice(1, 2); // Remove oldest user+assistant pair
  }

  const stopSpinner = renderSpinner('Thinking...');
  let rawResponse = '';

  try {
    rawResponse = await provider.chat(history, {
      onChunk: (chunk) => {
        // We collect chunks but don't display them in streaming mode
        // to avoid JSON parsing issues mid-stream
      }
    });

    stopSpinner();

    // Add assistant response to history
    history.push({ role: 'assistant', content: rawResponse });

    // Render the response (brief or full)
    const output = renderResponse(rawResponse, brief);
    console.log(output);
  } catch (error) {
    stopSpinner();
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`\nError: ${message}\n`);
  }
}

function showHelp(): void {
  console.log('');
  console.log('Available commands:');
  console.log('  /help                   Show this help message');
  console.log('  /exit, /quit            Exit REPL mode');
  console.log('  /term <question>        Brief mode: output only the command');
  console.log('  /provider [name]        Show or switch provider');
  console.log('  /provider list          List all available providers');
  console.log('  /model [name]           Show or set the model');
  console.log('  /models                 List available models for current provider');
  console.log('  /host [url]             Show or set the Ollama host (Ollama only)');
  console.log('  /history                Show conversation history');
  console.log('  /clear                  Clear conversation context');
  console.log('  /doctor                 Run health check diagnostics');
  console.log('');
  console.log('Any other input will be treated as a question.');
  console.log('');
}

function showHistory(history: ConversationMessage[]): void {
  console.log('');
  console.log('Conversation history:');
  console.log('─'.repeat(60));

  history.forEach((msg, index) => {
    if (msg.role === 'system') {
      console.log(`[${index}] SYSTEM: <system prompt>`);
    } else {
      const preview = msg.content.slice(0, 100);
      const suffix = msg.content.length > 100 ? '...' : '';
      console.log(`[${index}] ${msg.role.toUpperCase()}: ${preview}${suffix}`);
    }
  });

  console.log('─'.repeat(60));
  console.log('');
}
