# termwhat

Stop googling "how to [insert command here]" and just ask your terminal instead.

This is a CLI that uses Ollama to suggest terminal commands in plain English. It runs locally, keeps your data private, and won't execute anything without your permission.

## Why?

Because I got tired of:
- Searching Stack Overflow for the same commands
- Forgetting obscure flags for `tar`, `find`, `lsof`, etc.
- Wondering if that random internet command is safe to run

Now I just type `termwhat "kill process on port 3000"` and get safe suggestions with explanations.

## Install

Requires Node.js 20+ and [Ollama](https://ollama.ai/) running locally.

```bash
git clone https://github.com/maddefientist/termwhat.git
cd termwhat
./install.sh
```

The installer will ask if you want to install globally. Say yes to use `termwhat` from anywhere.

On first run, it'll ask for your Ollama URL (defaults to `http://localhost:11434`).

Or use Docker:

```bash
docker-compose up -d
```

## Usage

**One-shot queries** (just ask):
```bash
termwhat command to kill all processes on port 3000
termwhat how do I find large files
termwhat compress this folder
termwhat --copy check disk usage  # copies command to clipboard
```

**Interactive mode**:
```bash
termwhat
```

This drops you into a REPL where you can have a conversation. Type `/help` for commands, `/exit` to quit.

**REPL commands**:
- `/model [name]` - switch models (default: llama3.2)
- `/host [url]` - change Ollama host
- `/history` - see conversation
- `/clear` - reset conversation
- `/doctor` - check if everything's working

## Configuration

**First run setup:**

On first use, termwhat asks for your Ollama URL and preferred model. Settings are saved to `~/.termwhatrc`.

**Change settings anytime:**
```bash
termwhat setup
```

**Override per-query:**
```bash
termwhat --host http://192.168.1.100:11434 --model llama3.1 "your question"
```

**All options:**
- `-H, --host <url>` - Ollama host
- `-m, --model <name>` - model to use
- `-j, --json` - raw JSON output
- `-c, --copy` - copy first command to clipboard
- `--doctor` - run diagnostics

**Config file location:** `~/.termwhatrc`

## Docker

The compose file includes both termwhat and Ollama:

```bash
docker-compose up -d
docker exec -it termwhat node dist/index.js
```

To use an external Ollama instance, edit `.env`:
```bash
cp .env.example .env
# Change TERMWHAT_OLLAMA_HOST
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
npm start
```

## Examples

```bash
> npm start

> how do I find files modified in the last 24 hours?

Find Recently Modified Files

Commands:

1. Find files modified in last 24 hours [LOW]
   find . -type f -mtime -1
   Searches current directory for files modified within 24 hours

2. With human-readable details [LOW]
   find . -type f -mtime -1 -ls
   Shows detailed info including size and permissions

> /exit
```

## Troubleshooting

**Ollama won't connect:**
```bash
npm start -- --doctor
```

This checks your connection and tells you what's wrong.

**Model not found:**
```bash
ollama pull llama3.2
```

**Clipboard not working (Linux):**
```bash
sudo apt-get install xclip
```

## How it works

1. You ask a question in plain English
2. termwhat sends it to your local Ollama instance
3. The LLM returns structured JSON with commands, explanations, and risk levels
4. termwhat formats and displays it nicely
5. You copy/paste commands manually (it never executes anything)

Commands are tagged as LOW, MEDIUM, or HIGH risk. Destructive stuff like `rm -rf` gets flagged.

## Development

```bash
npm run dev          # watch mode
npm run build        # compile TypeScript
npm test             # run tests
```

Project structure:
```
src/
├── index.ts       # CLI entry point
├── ollama.ts      # Ollama API client
├── render.ts      # terminal output formatting
├── repl.ts        # interactive mode
├── doctor.ts      # health checks
└── types.ts       # TypeScript interfaces
```

## Security

- Never executes commands automatically
- All LLM output is validated and sanitized
- Works offline (no external APIs)
- Only copies to clipboard with explicit `--copy` flag

## License

MIT

---

Built because I kept forgetting how to use `lsof` and `netstat`.
