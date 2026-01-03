# ezer

A robot companion CLI for AI agents. Maintains context and memory across sessions using git-backed storage.

## Install

```bash
bun install
```

## Usage

Run at the start of each session to load context and instructions:

```bash
./bin/ezer
```

This displays your current state (open puzzles, notes) along with all available commands and best practices for working effectively.

Check state without instructions:

```bash
ezer status
```

## How It Works

- Stores all data in `.ezer/memory/` as markdown files with YAML frontmatter
- Uses git to sync memory across sessions and branches
- Generates unique IDs from project directory name + base32 random string
- No external dependencies or backend required

## Design

**Memory entries:** Each `.ezer/memory/ez-xxxxx.md` file is a memory entry (note, puzzle, or feedback).

**Puzzle dependencies:** Child puzzles store `blocks: parent-id` (not parent storing child list). This minimizes merge conflicts when parallel branches create sub-puzzles.

**Note limits:** Total note content is limited to 30,000 bytes (soft warning) and 32,768 bytes (hard limit).

## Development

Type checking:

```bash
bun run typecheck
```
