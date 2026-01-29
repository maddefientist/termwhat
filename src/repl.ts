import * as readline from 'readline';
import { OllamaClient } from './ollama.js';
import { SYSTEM_PROMPT } from './prompt.js';
import { renderResponse, renderSpinner } from './render.js';
import { runDoctor } from './doctor.js';
import type { ConversationMessage } from './types.js';

const MAX_HISTORY = 10;

export async function startRepl(client: OllamaClient): Promise<void> {
  const conversationHistory: ConversationMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
  ];

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: '> ',
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
      await handleCommand(input, client, conversationHistory, rl);
      rl.prompt();
      return;
    }

    // Regular question - query Ollama
    await handleQuestion(input, client, conversationHistory);
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

async function handleCommand(
  command: string,
  client: OllamaClient,
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

    case 'model':
      if (args.length === 0) {
        const config = client.getConfig();
        console.log(`Current model: ${config.model}`);
      } else {
        client.updateConfig({ model: args[0] });
        console.log(`Model set to: ${args[0]}`);
      }
      break;

    case 'host':
      if (args.length === 0) {
        const config = client.getConfig();
        console.log(`Current host: ${config.host}`);
      } else {
        client.updateConfig({ host: args[0] });
        console.log(`Host set to: ${args[0]}`);
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
      await runDoctor(client);
      break;

    default:
      console.log(`Unknown command: /${cmd}`);
      console.log('Type /help for available commands.');
  }
}

async function handleQuestion(
  question: string,
  client: OllamaClient,
  history: ConversationMessage[]
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
    rawResponse = await client.chat(history, (chunk) => {
      // We collect chunks but don't display them in streaming mode
      // to avoid JSON parsing issues mid-stream
    });

    stopSpinner();

    // Add assistant response to history
    history.push({ role: 'assistant', content: rawResponse });

    // Render the response
    const output = renderResponse(rawResponse);
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
  console.log('  /help              Show this help message');
  console.log('  /exit, /quit       Exit REPL mode');
  console.log('  /model [name]      Show or set the model');
  console.log('  /host [url]        Show or set the Ollama host');
  console.log('  /history           Show conversation history');
  console.log('  /clear             Clear conversation context');
  console.log('  /doctor            Run health check diagnostics');
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
