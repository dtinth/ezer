# Copilot instructions for this repository

- Run `./bin/ezer` at the start of each session to load context and available commands.
- Use [Bun](https://bun.sh/) for tooling. Install dependencies with `bun install` (Bun is expected on `PATH`).
- Type checking: `bun run typecheck`.
- Tests: `bun test`.
- Prefer the existing CLI entrypoint `./bin/ezer` when interacting with the tool instead of re-implementing commands.
