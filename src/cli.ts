import { defineCommand, runMain } from "citty";
import {
  createFeedback,
  createNote,
  createPuzzle,
  deleteNote,
  ID_PATTERN,
  listMemoryEntries,
  renderPuzzleTree,
  replaceNotes,
  updateNote,
  updatePuzzleStatus,
} from "./lib/memory.ts";

function escapeXmlAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function escapeXmlContent(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

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
      lines.push(`<note id="${escapeXmlAttr(note.id)}">`);
      lines.push(escapeXmlContent(note.content));
      lines.push("</note>");
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

### Use Puzzles for Work
- Puzzles represent work to be done - things you CAN'T solve now
- Include acceptance criteria in the description so it's clear when done
- Break large tasks into smaller puzzles with \`--blocks\` dependencies
- Focus on one puzzle at a time; close from the bottom up (dependencies first)
- When you hit an unknown or blocker, create a puzzle and move on

### Use Notes for Knowledge
- Notes capture what you LEARNED - decisions, discoveries, patterns
- Document rationale (why, not just what)
- Record gotchas, file locations, architectural insights
- Update or consolidate notes to keep context focused

### Reflect and Wrap Up
- After completing a usable increment, reflect: add notes for learnings
- When human says "reflect" or "wrap up", or session is ending:
  - Create puzzles for any remaining/discovered work
  - Add notes for important learnings from this session
  - Close any puzzles you completed
- Commit \`.ezer/\` changes so next session has context

### Remember
- Run \`ezer\` at session start to load context
- Commit \`.ezer/\` to git - this is how memory persists across sessions/branches
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
          async run({ args }) {
            const id = args["id"];
            const content = args["content"];
            if (typeof id !== "string" || typeof content !== "string") {
              console.error("Error: --id and --content are required");
              process.exit(1);
            }
            try {
              await updateNote(id, content);
              console.log(`Updated ${id}`);
            } catch (error) {
              console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
              process.exit(1);
            }
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
          async run({ args }) {
            const id = args["id"];
            if (typeof id !== "string") {
              console.error("Error: --id is required");
              process.exit(1);
            }
            try {
              await deleteNote(id);
              console.log(`Deleted ${id}`);
            } catch (error) {
              console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
              process.exit(1);
            }
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
          async run({ args }) {
            const ids = args["ids"];
            const content = args["content"];
            if (typeof ids !== "string" || typeof content !== "string") {
              console.error("Error: --ids and --content are required");
              process.exit(1);
            }
            try {
              const idList = ids.split(",").map((id) => id.trim());
              const entry = await replaceNotes(idList, content);
              console.log(`Created ${entry.id} (replaced ${idList.join(", ")})`);
            } catch (error) {
              console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
              process.exit(1);
            }
          },
        }),
        list: defineCommand({
          meta: {
            name: "list",
            description: "List all notes",
          },
          async run() {
            const entries = await listMemoryEntries("note");
            if (entries.length === 0) {
              console.log("No notes.");
              return;
            }
            for (const note of entries) {
              console.log(`${note.id}: ${note.content}`);
            }
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
          async run({ args }) {
            const entries = await listMemoryEntries("puzzle");
            const puzzles = entries.filter((e) => e.status !== "closed");

            // Build a set of open puzzle IDs that can be blocked by others
            const openPuzzleIds = new Set(puzzles.map((p) => p.id));

            // Determine which puzzles are ready (their blockers are closed/don't exist)
            const readyPuzzles = puzzles.filter((puzzle) => {
              if (!puzzle.blocks) return true; // No dependency
              return !openPuzzleIds.has(puzzle.blocks);
            });

            const blockedPuzzles = puzzles.filter((puzzle) => {
              if (!puzzle.blocks) return false;
              return openPuzzleIds.has(puzzle.blocks);
            });

            let toShow = puzzles;
            if (args["ready"]) {
              toShow = readyPuzzles;
            } else if (args["blocked"]) {
              toShow = blockedPuzzles;
            }

            if (toShow.length === 0) {
              console.log("No puzzles.");
              return;
            }

            for (const puzzle of toShow) {
              const blocksInfo = puzzle.blocks ? ` (blocks ${puzzle.blocks})` : "";
              console.log(`${puzzle.id}: ${puzzle.title}${blocksInfo}`);
            }
            console.log(
              'Use "ezer puzzle describe --ids <id1,id2>" to view puzzle details.'
            );
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
          async run({ args }) {
            const id = args["id"];
            if (typeof id !== "string") {
              console.error("Error: --id is required");
              process.exit(1);
            }
            try {
              const tree = await renderPuzzleTree(id);
              console.log(tree);
              console.log(
                '\nUse "ezer puzzle describe --ids <id>" to view puzzle details.'
              );
            } catch (error) {
              console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
              process.exit(1);
            }
          },
        }),
        describe: defineCommand({
          meta: {
            name: "describe",
            description: "Show puzzle descriptions",
          },
          args: {
            ids: {
              type: "string",
              description: "Comma-separated puzzle IDs",
              required: true,
            },
          },
          async run({ args }) {
            const idsArg = args["ids"];
            if (typeof idsArg !== "string") {
              console.error("Error: --ids is required");
              process.exit(1);
            }
            const ids = idsArg
              .split(",")
              .map((id) => id.trim())
              .filter((id) => id.length > 0);
            if (ids.length === 0) {
              console.error("Error: --ids is required");
              process.exit(1);
            }

            const invalidIds = ids.filter((id) => !ID_PATTERN.test(id));
            if (invalidIds.length > 0) {
              console.error(`Error: invalid puzzle id(s): ${invalidIds.join(", ")}`);
              process.exit(1);
            }

            const puzzles = await listMemoryEntries("puzzle");
            const map = new Map(puzzles.map((p) => [p.id, p]));

            const missingIds = ids.filter((id) => !map.has(id));
            if (missingIds.length > 0) {
              console.error(`Error: puzzle(s) not found: ${missingIds.join(", ")}`);
              process.exit(1);
            }

            for (const [index, id] of ids.entries()) {
              const puzzle = map.get(id)!;
              console.log(
                `<puzzle id="${escapeXmlAttr(puzzle.id)}" title="${escapeXmlAttr(
                  puzzle.title ?? ""
                )}">`
              );
              console.log(escapeXmlContent(puzzle.content ?? ""));
              console.log("</puzzle>");
              if (index < ids.length - 1) {
                console.log("");
              }
            }
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
          async run({ args }) {
            const content = args["content"];
            if (typeof content !== "string") {
              console.error("Error: --content is required");
              process.exit(1);
            }
            const entry = await createFeedback(content);
            console.log(`Created ${entry.id}`);
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
