import { defineCommand, runMain } from "citty";
import {
  createNote,
  createPuzzle,
  listMemoryEntries,
  updatePuzzleStatus,
} from "./lib/memory.ts";

async function renderState(): Promise<string> {
  const entries = await listMemoryEntries();

  if (entries.length === 0) {
    return "No memory entries yet.";
  }

  const notes = entries.filter((e) => e.type === "note");
  const puzzles = entries.filter((e) => e.type === "puzzle");
  const openPuzzles = puzzles.filter((p) => p.status === "open");

  const lines: string[] = [];

  if (openPuzzles.length > 0) {
    lines.push("### Open Puzzles");
    for (const puzzle of openPuzzles) {
      const blocksInfo = puzzle.blocks ? ` (blocks ${puzzle.blocks})` : "";
      lines.push(`- ${puzzle.id}: ${puzzle.title}${blocksInfo}`);
    }
  }

  if (notes.length > 0) {
    if (lines.length > 0) lines.push("");
    lines.push("### Notes");
    for (const note of notes) {
      lines.push(`- ${note.id}: ${note.content}`);
    }
  }

  return lines.join("\n");
}

async function getPrimingText(): Promise<string> {
  const state = await renderState();

  return `=== EZER ===
I am ezer, a robot companion for AI agents. I help you maintain
context and memory across sessions.

## Current State

${state}

## Commands

### Notes
Record decisions, discoveries, or context for future sessions.

  ezer note create --content "..."              # create note
  ezer note update --id ez-xxxxx --content "..."  # update note
  ezer note delete --id ez-xxxxx                # delete entry
  ezer note replace --ids ez-a,ez-b --content "..."  # replace many with one
  ezer note list                                # list all notes

Good notes: decisions made, patterns discovered, important file locations.

### Puzzles
Mark unknowns you can't resolve now. Don't get stuck - note it and move on.

  ezer puzzle create --title "..."                  # create puzzle
  ezer puzzle create --title "..." --blocks ez-x   # this puzzle blocks ez-x
  ezer puzzle close --id ez-xxxxx               # mark resolved
  ezer puzzle reopen --id ez-xxxxx              # reopen puzzle
  ezer puzzle list                              # list all puzzles
  ezer puzzle list --ready                      # puzzles with deps resolved
  ezer puzzle list --blocked                    # puzzles with open deps
  ezer puzzle tree --id ez-xxxxx                # show dependency tree

### Memory Management
When notes accumulate, consolidate related ones:

  ezer note replace --ids ez-a,ez-b --content "combined insight"

### Feedback
Help improve ezer:

  ezer feedback create --content "..."          # suggest improvements

### Other
  ezer status                                   # show state without instructions

## How to Work

### Work in Small, Verifiable Increments
- Implement the smallest useful slice first, not the full solution
- Test and commit before moving to the next piece
- Run verifiable outputs (tests, typecheck, build) before every commit
- Avoid premature abstractions - only write code when it's actually needed

### Use Puzzles to Break Down Work
- When you hit an unknown or complexity, create a puzzle instead of getting stuck
- Break large tasks into smaller puzzles with dependencies
- Don't work on too many things at once - focus on one puzzle at a time
- Close puzzles from the bottom up (resolve dependencies first)
- Puzzles are for things you CAN'T solve now; notes are for things you LEARNED

### Leave Notes for Future Sessions
- Document decisions and their rationale (why, not just what)
- Record discoveries: patterns found, gotchas encountered, file locations
- Update or consolidate notes to keep context focused and relevant

### Remember
- Run \`ezer\` at session start to load context
- Commit \`.ezer/\` to git - this is how memory persists and syncs across branches
- You are the agent - ezer only stores and retrieves, you do the thinking
`;
}

const main = defineCommand({
  meta: {
    name: "ezer",
    description: "A robot companion for AI agents",
  },
  subCommands: {
    status: defineCommand({
      meta: {
        name: "status",
        description: "Show current state without instructions",
      },
      async run() {
        const state = await renderState();
        console.log("=== EZER ===");
        console.log("");
        console.log(state);
      },
    }),
    note: defineCommand({
      meta: {
        name: "note",
        description: "Manage notes",
      },
      subCommands: {
        create: defineCommand({
          meta: {
            name: "create",
            description: "Create a new note",
          },
          args: {
            content: {
              type: "string",
              description: "Note content",
              required: true,
            },
          },
          async run({ args }) {
            const content = args["content"];
            if (typeof content !== "string") {
              console.error("Error: --content is required");
              process.exit(1);
            }
            const entry = await createNote(content);
            console.log(`Created ${entry.id}`);
          },
        }),
        update: defineCommand({
          meta: {
            name: "update",
            description: "Update an existing note",
          },
          args: {
            id: {
              type: "string",
              description: "Note ID",
              required: true,
            },
            content: {
              type: "string",
              description: "New content",
              required: true,
            },
          },
          run({ args }) {
            // TODO: Implement update
            console.log(`TODO: Update note ${args["id"]} with: ${args["content"]}`);
          },
        }),
        delete: defineCommand({
          meta: {
            name: "delete",
            description: "Delete a note",
          },
          args: {
            id: {
              type: "string",
              description: "Note ID",
              required: true,
            },
          },
          run({ args }) {
            // TODO: Implement delete
            console.log(`TODO: Delete note ${args["id"]}`);
          },
        }),
        replace: defineCommand({
          meta: {
            name: "replace",
            description: "Replace multiple notes with one",
          },
          args: {
            ids: {
              type: "string",
              description: "Comma-separated list of note IDs to replace",
              required: true,
            },
            content: {
              type: "string",
              description: "New consolidated content",
              required: true,
            },
          },
          run({ args }) {
            // TODO: Implement replace
            console.log(`TODO: Replace notes ${args["ids"]} with: ${args["content"]}`);
          },
        }),
        list: defineCommand({
          meta: {
            name: "list",
            description: "List all notes",
          },
          run() {
            // TODO: Implement list
            console.log("TODO: List all notes");
          },
        }),
      },
    }),
    puzzle: defineCommand({
      meta: {
        name: "puzzle",
        description: "Manage puzzles",
      },
      subCommands: {
        create: defineCommand({
          meta: {
            name: "create",
            description: "Create a new puzzle",
          },
          args: {
            title: {
              type: "string",
              description: "Puzzle title",
              required: true,
            },
            description: {
              type: "string",
              description: "Puzzle description",
            },
            blocks: {
              type: "string",
              description: "ID of puzzle that this new puzzle blocks",
            },
          },
          async run({ args }) {
            const title = args["title"];
            if (typeof title !== "string") {
              console.error("Error: --title is required");
              process.exit(1);
            }
            const description = args["description"] as string | undefined;
            const blocks = args["blocks"] as string | undefined;
            const entry = await createPuzzle(title, description, blocks);
            console.log(`Created ${entry.id}`);
            if (blocks) {
              console.log(`  Blocks: ${blocks}`);
            }
          },
        }),
        close: defineCommand({
          meta: {
            name: "close",
            description: "Close a puzzle",
          },
          args: {
            id: {
              type: "string",
              description: "Puzzle ID",
              required: true,
            },
          },
          async run({ args }) {
            const id = args["id"];
            if (typeof id !== "string") {
              console.error("Error: --id is required");
              process.exit(1);
            }
            await updatePuzzleStatus(id, "closed");
            console.log(`Closed ${id}`);
          },
        }),
        reopen: defineCommand({
          meta: {
            name: "reopen",
            description: "Reopen a puzzle",
          },
          args: {
            id: {
              type: "string",
              description: "Puzzle ID",
              required: true,
            },
          },
          async run({ args }) {
            const id = args["id"];
            if (typeof id !== "string") {
              console.error("Error: --id is required");
              process.exit(1);
            }
            await updatePuzzleStatus(id, "open");
            console.log(`Reopened ${id}`);
          },
        }),
        list: defineCommand({
          meta: {
            name: "list",
            description: "List puzzles",
          },
          args: {
            ready: {
              type: "boolean",
              description: "Show only puzzles with all deps resolved",
            },
            blocked: {
              type: "boolean",
              description: "Show only puzzles with unresolved deps",
            },
          },
          run({ args }) {
            // TODO: Implement puzzle list
            if (args["ready"]) {
              console.log("TODO: List ready puzzles");
            } else if (args["blocked"]) {
              console.log("TODO: List blocked puzzles");
            } else {
              console.log("TODO: List all puzzles");
            }
          },
        }),
        tree: defineCommand({
          meta: {
            name: "tree",
            description: "Show puzzle dependency tree",
          },
          args: {
            id: {
              type: "string",
              description: "Puzzle ID",
              required: true,
            },
          },
          run({ args }) {
            // TODO: Implement puzzle tree
            console.log(`TODO: Show tree for puzzle ${args["id"]}`);
          },
        }),
      },
    }),
    feedback: defineCommand({
      meta: {
        name: "feedback",
        description: "Manage feedback",
      },
      subCommands: {
        create: defineCommand({
          meta: {
            name: "create",
            description: "Create feedback for ezer developers",
          },
          args: {
            content: {
              type: "string",
              description: "Feedback content",
              required: true,
            },
          },
          run({ args }) {
            // TODO: Implement feedback create
            console.log(`TODO: Create feedback: ${args["content"]}`);
          },
        }),
      },
    }),
  },
});

// If no subcommand provided, show priming text
const args = process.argv.slice(2);
if (args.length === 0 || args[0]?.startsWith("-")) {
  getPrimingText().then((text) => console.log(text));
} else {
  runMain(main);
}
