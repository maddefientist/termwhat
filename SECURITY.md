# Security Policy

## Supported Versions

`termwhat` is a young project and only actively supports the latest `3.x`
line. Security fixes are made against the current major version; older
releases are not patched.

| Version | Supported          |
| ------- | ------------------ |
| 3.x     | :white_check_mark: |
| < 3.0   | :x:                 |

## Scope

`termwhat` is an LLM-backed CLI that turns natural-language questions into
*suggested* shell commands. It does **not** execute those commands — that
suggestion-only guarantee is a core safety invariant, and any issue that
could cause a suggested command to run automatically (without explicit user
action) is in scope and should be treated as high severity.

`termwhat` also handles provider API keys: it reads them from environment
variables and, during the first-run setup wizard, can write them into the
user's shell rc file. Issues in scope include (non-exhaustively):

- Any path that causes suggested commands to execute without explicit user
  confirmation.
- API keys being logged, echoed to the terminal, written to disk in plaintext
  where they shouldn't be, or leaked to a third party (including to the
  wrong LLM provider).
- Setup wizard shell-rc writes that could corrupt the user's shell config or
  inject unintended shell syntax.
- Any other exposure of user secrets or unexpected code execution.

## Reporting a Vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

Instead, report privately using
[GitHub's private security advisory feature](https://github.com/maddefientist/termwhat/security/advisories/new)
on the repository. This lets us discuss and fix the issue before it's
publicly disclosed.

If you're unable to use GitHub's advisory flow for some reason, you can also
reach out via the contact listed in [`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md).

## What to expect

- We aim to acknowledge new reports within **5 business days**.
- We'll work with you to understand and reproduce the issue, and to agree on
  a disclosure timeline once a fix is available.
- Credit is happily given in the release notes, unless you'd prefer to stay
  anonymous.

Thanks for helping keep termwhat and its users safe.
