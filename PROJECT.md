# termwhat - Project Context

## What

`termwhat` is a production-ready CLI tool that answers "what terminal command should I use for X?" by querying AI providers (Ollama, OpenAI, Anthropic, OpenRouter). It provides structured, safe command suggestions with risk levels and explanations.

## Why

- Quickly discover terminal commands without searching documentation
- Get safe, validated suggestions with risk warnings
- Flexible: Ollama-first (local or Ollama cloud), with OpenAI/Anthropic/OpenRouter as options
- Privacy-first by default: with local Ollama, no question ever leaves the machine
- Works against a remote Ollama host when you'd rather not run the model locally

## Stack

- **Runtime:** Node.js 20+ (LTS)
- **Language:** TypeScript (strict mode)
- **AI Providers:** Ollama (local), OpenAI, Anthropic, OpenRouter
- **CLI Framework:** Commander.js
- **Deployment:** Docker + Docker Compose

## Architecture

```
┌─────────────┐
│   termwhat  │  CLI (REPL or one-shot)
└──────┬──────┘
       │
       │ Provider Abstraction Layer
       │
       ├──────┬──────┬──────┬───────┐
       │      │      │      │       │
    Ollama OpenAI Anthropic OpenRouter
     (local) (cloud) (cloud)  (cloud)
```

### Components

- **src/index.ts** - CLI entry point, argument parsing
- **src/providers/** - Provider abstraction layer
  - **base.ts** - AIProvider interface and base class
  - **ollama.ts** - Ollama provider (local LLM)
  - **openai.ts** - OpenAI provider (GPT models)
  - **anthropic.ts** - Anthropic provider (Claude models)
  - **openrouter.ts** - OpenRouter provider (multi-model access)
  - **factory.ts** - Provider instantiation factory
- **src/config.ts** - Multi-provider configuration with migration
- **src/prompt.ts** - System prompt defining response schema
- **src/render.ts** - ANSI terminal output formatting
- **src/repl.ts** - Interactive REPL mode with provider switching
- **src/doctor.ts** - Provider-agnostic health check diagnostics
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

Configuration file: `~/.termwhatrc` (multi-provider JSON format)

Environment variables:
- `TERMWHAT_PROVIDER` - Override current provider
- `TERMWHAT_MODEL` - Override model for any provider
- `TERMWHAT_OLLAMA_HOST` - Ollama host (backward compatible)
- `TERMWHAT_OPENAI_API_KEY` - OpenAI API key (required for OpenAI)
- `TERMWHAT_ANTHROPIC_API_KEY` - Anthropic API key (required for Anthropic)
- `TERMWHAT_OPENROUTER_API_KEY` - OpenRouter API key (required for OpenRouter)

Priority order:
1. CLI flags (`--provider`, `--host`, `--model`)
2. Environment variables
3. Config file `~/.termwhatrc`
4. Defaults

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

## Distribution

- **Primary:** npm (`npm install -g termwhat`)
- **Alternatives:** curl installer, from source, Docker Compose (bundles Ollama)
- **Ollama Location:** local, remote host, or Ollama cloud (configurable)

## Current Status (3.0.0)

- ✅ Ollama-first defaults; Ollama cloud supported
- ✅ Model lists discovered dynamically per provider — no hardcoded lists
- ✅ Provider abstraction layer with factory pattern
- ✅ Automatic config migration; corrupt configs backed up rather than overwritten
- ✅ Setup wizard with masked key entry and correct fish/bash/zsh syntax
- ✅ REPL with provider/model/host switching
- ✅ Provider-agnostic health checks (`--doctor`)
- ✅ 25 hermetic `node:test` tests; ESLint v9 flat config; CI on Node 20/22
- ✅ MIT licensed with full community docs
- ⏳ Not yet published to npm (needs `NPM_TOKEN` repo secret)

## Next Steps

1. Set the `NPM_TOKEN` repository secret, then tag `v3.0.0` to publish
2. Set the GitHub repo description and topics
3. Triage open Dependabot PRs (TypeScript 7 and ESLint 10 are majors — deliberate calls)
4. Consider a demo GIF/asciinema cast for the README

## Notes

- Model defaults: `qwen3.5:4b` local, `gpt-oss:120b` on Ollama cloud
- Supports streaming responses (currently collected but not displayed mid-stream)
- Conversation history limited to last 10 turns in REPL
- Cross-platform clipboard: macOS (pbcopy), Linux (xclip/xsel), Windows (clip)
