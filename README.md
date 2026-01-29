# termwhat

Stop googling "how to [insert command here]" and just ask your terminal instead.

Uses AI (Ollama, OpenAI, Anthropic, or OpenRouter) to suggest terminal commands in plain English. Choose local privacy with Ollama or cloud power with GPT-4 or Claude.

## Why?

Because I got tired of:
- Searching Stack Overflow for the same commands
- Forgetting obscure flags for `tar`, `find`, `lsof`, etc.
- Wondering if that random internet command is safe to run

Now I just type `termwhat command to kill process on port 3000` and get safe suggestions with explanations.

## Quick Install

Requires Node.js 20+.

**One-line install:**
```bash
curl -fsSL https://raw.githubusercontent.com/maddefientist/termwhat/main/install.sh | bash
```

**Or with git:**
```bash
git clone https://github.com/maddefientist/termwhat.git
cd termwhat
./install.sh
```

**Or with Docker:**
```bash
git clone https://github.com/maddefientist/termwhat.git
cd termwhat
docker-compose up -d
```

On first run, you'll be asked to configure your preferred AI provider.

## Providers

termwhat supports multiple AI providers:

| Provider | Type | Setup Required |
|----------|------|----------------|
| **Ollama** | Local | Install [Ollama](https://ollama.ai/) |
| **OpenAI** | Cloud | API key from [platform.openai.com](https://platform.openai.com/api-keys) |
| **Anthropic** | Cloud | API key from [console.anthropic.com](https://console.anthropic.com/settings/keys) |
| **OpenRouter** | Cloud | API key from [openrouter.ai](https://openrouter.ai/keys) |

### Provider Setup

**Ollama (local, private):**
```bash
# Install Ollama
curl https://ollama.ai/install.sh | sh

# Pull a model
ollama pull llama3.2

# Run termwhat setup
termwhat setup
```

**OpenAI (cloud):**
```bash
export TERMWHAT_OPENAI_API_KEY="sk-..."
termwhat setup  # select OpenAI
```

**Anthropic (cloud):**
```bash
export TERMWHAT_ANTHROPIC_API_KEY="sk-ant-..."
termwhat setup  # select Anthropic
```

**OpenRouter (cloud, multi-model):**
```bash
export TERMWHAT_OPENROUTER_API_KEY="sk-or-..."
termwhat setup  # select OpenRouter
```

## Usage

**One-shot queries** (just ask):
```bash
termwhat command to kill all processes on port 3000
termwhat how do I find large files
termwhat compress this folder
termwhat --copy check disk usage  # copies command to clipboard
```

**Use a specific provider:**
```bash
termwhat --provider openai "how do I configure nginx"
termwhat --provider anthropic --model claude-3-5-sonnet-20241022 "explain this regex"
```

**Interactive mode**:
```bash
termwhat
```

This drops you into a REPL where you can have a conversation. Type `/help` for commands, `/exit` to quit.

**REPL commands**:
- `/provider [name]` - switch providers (ollama, openai, anthropic, openrouter)
- `/provider list` - list available providers
- `/model [name]` - switch models
- `/models` - list available models for current provider
- `/host [url]` - change Ollama host (Ollama only)
- `/history` - see conversation
- `/clear` - reset conversation
- `/doctor` - check if everything's working

## Configuration

**First run setup:**

On first use, termwhat asks which providers to configure. Settings are saved to `~/.termwhatrc`.

**Change settings anytime:**
```bash
termwhat setup
```

**Override per-query:**
```bash
termwhat --provider openai --model gpt-4 "your question"
termwhat --host http://192.168.1.100:11434 "your question"  # for Ollama
```

**All CLI options:**
- `-p, --provider <type>` - provider to use (ollama, openai, anthropic, openrouter)
- `-H, --host <url>` - Ollama host (backward compatible)
- `-m, --model <name>` - model to use
- `-j, --json` - raw JSON output
- `-c, --copy` - copy first command to clipboard
- `--doctor` - run diagnostics

**Environment variables:**
- `TERMWHAT_PROVIDER` - default provider
- `TERMWHAT_MODEL` - default model
- `TERMWHAT_OLLAMA_HOST` - Ollama host URL
- `TERMWHAT_OPENAI_API_KEY` - OpenAI API key
- `TERMWHAT_ANTHROPIC_API_KEY` - Anthropic API key
- `TERMWHAT_OPENROUTER_API_KEY` - OpenRouter API key

**Config file location:** `~/.termwhatrc`

## Docker

The compose file includes both termwhat and Ollama:

```bash
docker-compose up -d
docker exec -it termwhat node dist/index.js
```

To use an external Ollama instance or cloud providers, edit `.env`:
```bash
cp .env.example .env
# Configure your providers
docker-compose up -d
```

## Remote Ollama

If you're running Ollama on another machine:

**On the Ollama machine:**
```bash
OLLAMA_HOST=0.0.0.0 ollama serve
```

**On your machine:**
```bash
export TERMWHAT_OLLAMA_HOST=http://192.168.1.100:11434
termwhat
```

## Examples

```bash
$ termwhat how do I find files modified in the last 24 hours

Find Recently Modified Files

Commands:

1. Find files modified in last 24 hours [LOW]
   find . -type f -mtime -1
   Searches current directory for files modified within 24 hours

2. With human-readable details [LOW]
   find . -type f -mtime -1 -ls
   Shows detailed info including size and permissions

Verification:
  • Check if file count matches expectations
```

More examples:
```bash
termwhat command to kill all processes on port 3000
termwhat how do I compress a folder into tar.gz
termwhat show me all cloudflare tunnel IPs
termwhat check which process is using most memory
```

## Troubleshooting

**Provider won't connect:**
```bash
termwhat --doctor
```

This checks your connection and tells you what's wrong.

**Model not found (Ollama):**
```bash
ollama pull llama3.2
ollama list  # see installed models
```

**API key issues (cloud providers):**
```bash
# Check if API key is set
echo $TERMWHAT_OPENAI_API_KEY

# Run setup again
termwhat setup
```

**Change configuration:**
```bash
termwhat setup
```

**Clipboard not working (Linux):**
```bash
sudo apt-get install xclip
```

## How it works

1. You ask a question in plain English
2. termwhat sends it to your configured AI provider
3. The LLM returns structured JSON with commands, explanations, and risk levels
4. termwhat formats and displays it nicely
5. You copy/paste commands manually (it never executes anything)

Commands are tagged as LOW, MEDIUM, or HIGH risk. Destructive stuff like `rm -rf` gets flagged.

## Development

```bash
npm install          # install dependencies
npm run dev          # watch mode
npm run build        # compile TypeScript
npm test             # run tests
```

Project structure:
```
src/
├── index.ts       # CLI entry point
├── providers/     # provider abstraction layer
│   ├── base.ts       # AIProvider interface
│   ├── ollama.ts     # Ollama provider
│   ├── openai.ts     # OpenAI provider
│   ├── anthropic.ts  # Anthropic provider
│   ├── openrouter.ts # OpenRouter provider
│   └── factory.ts    # provider factory
├── config.ts      # multi-provider config
├── render.ts      # terminal output formatting
├── repl.ts        # interactive mode
├── doctor.ts      # health checks
└── types.ts       # TypeScript interfaces
```

## Migration from v1

If you're upgrading from termwhat v1 (Ollama-only), your configuration will be automatically migrated on first run. Your Ollama settings will be preserved.

## Security

- Never executes commands automatically
- All LLM output is validated and sanitized
- API keys stored only in environment variables (never in config file)
- Works offline with Ollama (no external APIs)
- Only copies to clipboard with explicit `--copy` flag

## License

MIT

---

Built because I kept forgetting how to use `lsof` and `netstat`. Now with multi-provider support because sometimes you need Claude's reasoning or GPT-4's knowledge.
