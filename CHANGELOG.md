# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [3.0.0] - unreleased/pending

The "actually, Ollama first" release. Not tagged yet — landing here as it
comes together.

### Changed

- **Ollama is now the default provider.** No API key, no cloud dependency,
  no signup form standing between you and a command suggestion — just point
  it at your local (or cloud) Ollama instance and go.
- Model lists are now **discovered dynamically** from the provider instead
  of being hardcoded in the source. New models show up without a
  `termwhat` update.

### Added

- **Ollama cloud support**, for when your laptop would rather not spin its
  fans up for this.

### Fixed

- The OpenRouter provider stubbornly required an unrelated OpenAI API key
  just to start up. It does not need one. It never needed one. Fixed.
- The setup wizard no longer echoes API keys back to your terminal like
  it's proud of them, and now writes syntactically valid `fish` shell
  config instead of something that would make `fish` sit down and cry.

### Removed

- The legacy `src/ollama.ts` client and assorted other dead code that had
  been quietly haunting the codebase since v1.

## [2.0.0] - 2026-01-29

Ladies and gentlemen, welcome to termwhat 2.0.

### Added

- **Multi-provider support**: OpenAI, Anthropic, and OpenRouter, all sitting
  alongside the original Ollama support. Pick your favorite LLM landlord.
- **Brief mode** (`--brief`) — for when you just want the command, not the
  TED talk.

### Fixed

- The JSON response from the model no longer gets cut off like a bad
  haircut halfway through a suggestion.

## [1.0.0] - 2026-01-29

Arrr! The maiden voyage. termwhat sets sail: a fine vessel fer askin' yer
terminal what commands ye be needin'.

### Added

- Initial release: ask a plain-English question, get back a suggested shell
  command powered by Ollama.
- Interactive REPL mode.
- Risk badges on suggested commands, so you know what you're about to (not)
  run before you decide to run it.
- `curl`-based installer, once the "missing curl installer" case was
  solved.
- First-run setup wizard to get you configured fast.
- Documented the shell-alias pro tip for folks who want `termwhat` one
  keystroke away.
