<div align="center">

```
 ┌─┐┌─┐┬─┐┌┬┐┬ ┬┬ ┬┌─┐┌┬┐
 ├┤ ├┤ ├┬┘│││├─┤├─┤├─┤ │
 ┴  └─┘┴└─┴ ┴┴ ┴┴ ┴┴ ┴ ┴
```

# termwhat

**Stop googling "how to [insert command here]" and just ask your terminal instead.**

[![CI](https://github.com/maddefientist/termwhat/actions/workflows/ci.yml/badge.svg)](https://github.com/maddefientist/termwhat/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/termwhat.svg)](https://www.npmjs.com/package/termwhat)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![node](https://img.shields.io/badge/node-%3E%3D20-brightgreen.svg)](https://nodejs.org)

</div>

Ask in plain English, get back the actual command — with an explanation, a risk badge, and the
pitfalls nobody mentions until after you've hit enter.

**termwhat never runs anything.** It suggests. You decide. That's the whole contract.

```console
$ termwhat kill whatever is squatting on port 3000

Kill process using port 3000

Assumptions:
  • Linux/macOS or Windows with appropriate tools available

Commands:

1. Find process using port 3000 [LOW]
   lsof -i :3000 || netstat -tlnp | grep :3000 || ss -tlnp | grep :3000
   Identifies the PID(s) of process(es) currently listening on port 3000.

2. Gracefully kill process [LOW]
   kill -15 <PID>
   Sends SIGTERM for graceful shutdown. Wait 5 seconds for process to close cleanly.

3. Force kill if needed [HIGH]
   kill -9 <PID>
   Forcibly terminate the process if graceful shutdown fails. Only use after waiting.

⚠️  Pitfalls:
  • Running kill without confirming the PID first - could kill the wrong process
  • Using kill -9 without waiting - may cause data loss in long-running services

Verification:
  • Run 'lsof -i :3000' again to confirm the port is free
```

<sub>Real output, lightly trimmed for length. Ollama + `qwen3.5:4b`, running locally.</sub>

## Why

Because the alternative is opening a browser, scrolling past three blogspam preambles, and then
pasting a command you don't fully understand into a root shell. This is faster and shows its work.

## Install

**Requires Node.js 20+.**

```bash
npm install -g termwhat
```

<details>
<summary>Other ways in</summary>

```bash
# one-line installer
curl -fsSL https://raw.githubusercontent.com/maddefientist/termwhat/main/install.sh | bash

# from source
git clone https://github.com/maddefientist/termwhat.git
cd termwhat && ./install.sh

# docker (bundles Ollama)
git clone https://github.com/maddefientist/termwhat.git
cd termwhat && docker compose up -d
```

</details>

First run walks you through picking a provider. No config file to hand-write.

## Providers

termwhat is **Ollama-first** — the default path costs nothing, needs no account, and never sends
your questions anywhere. The cloud providers are there if you want them.

| Provider | Key needed | Notes |
| --- | --- | --- |
| **Ollama (local)** ⭐ | none | Default. Runs on your machine. Ships with `qwen3.5:4b`. |
| **Ollama (cloud)** | `TERMWHAT_OLLAMA_API_KEY` | Big models, no GPU. Defaults to `gpt-oss:120b`. |
| OpenAI | `TERMWHAT_OPENAI_API_KEY` | |
| Anthropic | `TERMWHAT_ANTHROPIC_API_KEY` | |
| OpenRouter | `TERMWHAT_OPENROUTER_API_KEY` | One key, many models. |

Model lists are fetched live from whichever provider you're on, so new models show up without
waiting for a termwhat release. Run `/models` in the REPL to see what's available to you.

```bash
# fastest possible start, assuming ollama is already running
ollama pull qwen3.5:4b
termwhat "recursively find files over 100MB"
```

## Usage

```bash
termwhat <your question>          # one-shot
termwhat                          # no question drops you into the REPL
termwhat setup                    # reconfigure
```

| Flag | What it does |
| --- | --- |
| `-p, --provider <name>` | `ollama`, `ollama-cloud`, `openai`, `anthropic`, `openrouter` |
| `-m, --model <name>` | Override the model for this run |
| `-H, --host <url>` | Point at a different Ollama host |
| `-b, --brief` | Just the command. No explanation, no TED talk. |
| `-j, --json` | Raw JSON, for piping |
| `-c, --copy` | Copy the primary command to your clipboard |
| `--doctor` | Diagnose connectivity, auth, and model availability |

### REPL

Run `termwhat` with no arguments. Prompt shows `[provider:model]>`.

| Command | |
| --- | --- |
| `/help` | Show commands |
| `/provider [name]` | Show or switch provider (`/provider` alone lists them) |
| `/models` | List models available from the current provider |
| `/model <name>` | Switch model |
| `/host <url>` | Point at a different Ollama host |
| `/term <question>` | Ask without leaving the REPL |
| `/history` | Recent turns |
| `/doctor` | Run diagnostics |
| `/clear` | Clear the screen |
| `/exit` | Leave |

### Pro tip

```bash
alias what='termwhat'
what how do I squash the last 3 commits
```

## Configuration

Config lives at `~/.termwhatrc`. Environment variables win over the config file, and CLI flags
win over both.

| Variable | |
| --- | --- |
| `TERMWHAT_PROVIDER` | Default provider |
| `TERMWHAT_MODEL` | Default model |
| `TERMWHAT_OLLAMA_HOST` | Ollama host (default `http://localhost:11434`) |
| `TERMWHAT_*_API_KEY` | Per-provider keys — see the provider table above |

`NO_COLOR` is respected.

## Safety

- **termwhat never executes a suggested command.** Nothing in the codebase shells out with model
  output. The only process it spawns is your clipboard utility, and only when you pass `--copy`.
- Every suggestion carries a **LOW / MEDIUM / HIGH** risk badge and a pitfalls section.
- API keys are read from environment variables. The setup wizard can append an export line to your
  shell config for you — it masks the key as you type and never echoes it back.
- Suggestions come from a language model, which means they are sometimes confidently wrong. Read
  before you run. That is the entire reason the explanations are there.

## Troubleshooting

Start with `termwhat --doctor`. It checks reachability, authentication, and whether your chosen
model actually exists on the provider, then tells you what to do about it.

## Contributing

Issues and PRs welcome — see [CONTRIBUTING.md](CONTRIBUTING.md). Adding a provider is roughly
"implement one interface, register it in the factory." Security reports go through
[SECURITY.md](SECURITY.md), not the public issue tracker.

## License

MIT — see [LICENSE](LICENSE).

---

Built because I kept forgetting how to use `lsof` and `netstat`.
