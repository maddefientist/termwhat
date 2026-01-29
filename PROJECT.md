# termwhat - Project Context

## What

`termwhat` is a production-ready CLI tool that answers "what terminal command should I use for X?" by querying a local Ollama LLM instance. It provides structured, safe command suggestions with risk levels and explanations.

## Why

- Quickly discover terminal commands without searching documentation
- Get safe, validated suggestions with risk warnings
- Privacy-first: runs entirely on local infrastructure via Ollama
- Network-accessible across home lab environment

## Stack

- **Runtime:** Node.js 20+ (LTS)
- **Language:** TypeScript (strict mode)
- **LLM Backend:** Ollama (local)
- **CLI Framework:** Commander.js
- **Deployment:** Docker + Docker Compose

## Architecture

```
┌─────────────┐
│   termwhat  │  CLI (REPL or one-shot)
└──────┬──────┘
       │
       │ HTTP/JSON
       │
┌──────▼──────┐
│   Ollama    │  LLM inference engine
│   Server    │  (llama3.2 or custom model)
└─────────────┘
```

### Components

- **src/index.ts** - CLI entry point, argument parsing
- **src/ollama.ts** - Ollama client with library + fetch fallback
- **src/prompt.ts** - System prompt defining response schema
- **src/render.ts** - ANSI terminal output formatting
- **src/repl.ts** - Interactive REPL mode
- **src/doctor.ts** - Health check diagnostics
- **src/clipboard.ts** - Cross-platform clipboard support
- **src/types.ts** - TypeScript interfaces

## Structure

```
termwhat/
├── src/               # TypeScript source
├── dist/              # Compiled JS (generated)
├── Dockerfile         # Multi-stage build
├── docker-compose.yml # Compose with Ollama service
├── package.json       # Dependencies & scripts
├── tsconfig.json      # TypeScript config (strict)
└── README.md          # User documentation
```

## How to Run

### Local Development

```bash
npm install          # Install dependencies
npm run build        # Compile TypeScript
npm start            # Run REPL mode
npm start "question" # One-shot query
npm run dev          # Watch mode with tsx
```

### Docker

```bash
docker-compose up -d              # Start services
docker exec -it termwhat node dist/index.js  # Interactive
docker-compose run --rm termwhat node dist/index.js "question"
```

### Configuration

Environment variables (priority order):
1. CLI flags (`--host`, `--model`)
2. Environment variables (`TERMWHAT_OLLAMA_HOST`, `TERMWHAT_MODEL`)
3. Defaults (Docker: `http://ollama:11434`, Local: `http://localhost:11434`)

## Security Constraints

1. **Never executes commands** - Only suggests, never runs
2. **LLM output validation** - All JSON responses parsed/validated
3. **No secrets in logs** - Sensitive data redacted
4. **No arbitrary code execution** - JSON parsing only, no eval()
5. **Clipboard is opt-in** - Only with explicit `--copy` flag

## Response Schema

```typescript
interface TermwhatResponse {
  title: string;
  os_assumptions: string[];
  commands: CommandSuggestion[];
  pitfalls: string[];
  verification_steps: string[];
}

interface CommandSuggestion {
  label: string;
  command: string;
  explanation: string;
  risk_level: 'low' | 'medium' | 'high';
}
```

## Deployment Targets

- **Primary:** Docker container on home network
- **Access:** Network-accessible via LAN
- **Ollama Location:** Can be local or remote (configurable)

## Current Status

- ✅ Phase 1-10 complete
- ✅ All files generated
- ✅ TypeScript compiles successfully
- ✅ CLI interface working (--help, --version)
- ⏳ Needs Ollama instance to test full functionality
- ⏳ Docker images not yet built

## Next Steps

1. Test with running Ollama instance
2. Validate response parsing and rendering
3. Test REPL mode interactivity
4. Build and test Docker image
5. Deploy to home network
6. Test with remote Ollama on LAN

## Notes

- Model default: `llama3.2` (balanced performance/speed)
- Supports streaming responses (currently collected but not displayed mid-stream)
- Conversation history limited to last 10 turns in REPL
- Cross-platform clipboard: macOS (pbcopy), Linux (xclip/xsel), Windows (clip)
