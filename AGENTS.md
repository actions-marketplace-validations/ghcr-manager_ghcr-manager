# AI Agent Playbook

Audience: AI coding agents working in this repo.

## Ground rules

- Markdown: wrap near ~120 chars.
- Keep [README.md](README.md) user-only.
- KISS: default to minimal changes; avoid optional parameters/configs or extra result objects unless explicitly requested.
- Visibility first: new modules default to private (`_`); keep constants private unless used outside the module.
- Do not invent new public APIs or config fields unless explicitly requested.
- Do not print `git diff` output or patch hunks in normal progress updates unless explicitly requested.
- Summarize code changes briefly and rely on commit hashes, file paths, and test results instead.
- For all Python commands, use a virtualenv:
  `python -m venv .venv && source .venv/bin/activate && pip install -r requirements-dev.txt`.
- Disabling linters via comments is a last resort; fix first and only suppress with explicit approval.

## Linting and tests

- Lint: `source .venv/bin/activate && ./scripts/lint.sh`
