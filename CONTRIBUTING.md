# Contributing to termwhat

Thanks for considering a contribution! `termwhat` is a small, focused CLI, and
contributions of all sizes are welcome — typo fixes, bug reports, new
providers, docs improvements.

## Requirements

- **Node.js 20+** (see `.nvmrc`). If you use `nvm`, just run `nvm use`.
- npm (ships with Node).

## Getting set up

```bash
git clone https://github.com/maddefientist/termwhat.git
cd termwhat
npm install
npm run build
npm test
npm run lint
```

- `npm run build` compiles TypeScript (`src/`) to `dist/` via `tsc`.
- `npm run dev` runs the CLI directly from source with `tsx`, no build step
  needed while iterating.
- `npm test` runs the test suite against the compiled output in `dist/`.
- `npm run lint` runs ESLint over `src/`.

## Project layout

```
src/
├── index.ts           # CLI entry point (argument parsing, command wiring)
├── repl.ts             # interactive REPL mode
├── config.ts           # config file handling + first-run setup wizard
├── prompt.ts            # the system prompt sent to the LLM
├── render.ts            # output formatting (risk badges, command rendering)
├── doctor.ts             # `termwhat --doctor` diagnostics
└── providers/
    ├── base.ts          # the AIProvider interface every provider implements
    ├── factory.ts        # provider selection/instantiation
    ├── index.ts          # provider exports
    ├── ollama.ts          # Ollama (local + cloud) provider
    ├── openai.ts           # OpenAI provider
    ├── anthropic.ts         # Anthropic provider
    └── openrouter.ts        # OpenRouter provider
```

## Adding a new AI provider

1. Create `src/providers/<name>.ts` implementing the `AIProvider` interface
   defined in `src/providers/base.ts`.
2. Register the new provider in `src/providers/factory.ts` so it can be
   selected by name/config.
3. Export it from `src/providers/index.ts`.
4. Add any new config fields your provider needs to `src/config.ts`, and make
   sure the setup wizard can collect them without ever echoing secrets back
   to the terminal.
5. Add tests, and update `README.md`-adjacent docs if the provider needs
   special setup (API key env var, base URL, etc.) — but note that
   `README.md` changes for this repo are currently owned by a separate
   branding pass; coordinate before editing it.

## The one hard rule: termwhat never executes commands

`termwhat` **only suggests** shell commands — it never runs them, pipes them
to a shell, or executes them on the user's behalf, no matter how confident
the model is or how the user phrases the request. This is a safety
invariant, not a style preference. Any change that causes a suggested
command to be executed automatically (directly, via `exec`, via a spawned
shell, via clipboard-and-auto-paste, etc.) will be rejected regardless of
how convenient it seems.

## Commit and PR conventions

- Commit messages should describe *what* changed and, ideally, *why*. This
  project's history has a playful streak in its commit messages — feel free
  to have fun, but keep the actual description of the change clear.
- Keep PRs focused: one logical change per PR is easier to review than a
  grab-bag.
- Reference the issue you're fixing/addressing, if one exists.
- Before opening a PR, make sure `npm run build`, `npm test`, and
  `npm run lint` all pass locally.
- Fill out the PR template — it's short on purpose.

## Reporting bugs / requesting features

Please use the issue templates. For bug reports, include the output of
`termwhat --doctor` (redact any API keys or hostnames first).

## Security issues

Do not open a public issue for security vulnerabilities — see
[`SECURITY.md`](./SECURITY.md) for how to report privately.
