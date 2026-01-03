import { defineCommand, runMain } from "citty";

const primingText = `=== EZER ===
I am ezer, a robot companion for AI agents. I help you maintain
context and memory across sessions.

## Current State

No memory entries yet. <!-- TODO: Show actual notes and puzzles here -->

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

  ezer puzzle create --title "..."              # create puzzle
  ezer puzzle create --title "..." --dep ez-x   # create with dependency
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

## Guidelines

1. Run \`ezer\` at session start to load context
2. Leave notes when you make decisions or discover something important
3. Create puzzles for unknowns - don't block on them
4. Update or consolidate notes to keep memory focused
5. You are the agent - ezer only stores and retrieves, you do the thinking
`;

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
      run() {
        // TODO: Show actual notes and puzzles here
        console.log("=== EZER ===");
        console.log("");
        console.log("No memory entries yet.");
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
          run({ args }) {
            console.log(`TODO: Create note with content: ${args["content"]}`);
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
            console.log(`TODO: Replace notes ${args["ids"]} with: ${args["content"]}`);
          },
        }),
        list: defineCommand({
          meta: {
            name: "list",
            description: "List all notes",
          },
          run() {
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
            dep: {
              type: "string",
              description: "ID of puzzle this depends on (blocks)",
            },
          },
          run({ args }) {
            console.log(`TODO: Create puzzle: ${args["title"]}`);
            if (args["description"]) {
              console.log(`  Description: ${args["description"]}`);
            }
            if (args["dep"]) {
              console.log(`  Depends on: ${args["dep"]}`);
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
          run({ args }) {
            console.log(`TODO: Close puzzle ${args["id"]}`);
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
          run({ args }) {
            console.log(`TODO: Reopen puzzle ${args["id"]}`);
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
  console.log(primingText);
} else {
  runMain(main);
}
