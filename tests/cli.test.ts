import { mkdtemp, readFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test, beforeEach } from "bun:test";
import { ID_PATTERN, parseMemoryFile } from "../src/lib/memory.ts";

const BIN_PATH = join(process.cwd(), "bin", "ezer");

async function runEzer(
  cwd: string,
  args: string[] = [],
  options?: {
    stdin?: string;
  }
) {
  const stdinOption = options?.stdin === undefined ? "inherit" : "pipe";
  const proc = Bun.spawn(["bun", BIN_PATH, ...args], {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
    stdin: stdinOption,
  });
  if (options?.stdin) {
    proc.stdin?.write(options.stdin);
    proc.stdin?.end();
  }
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  return { stdout, stderr, exitCode };
}

function parseCreatedId(output: string): string {
  const idPattern = ID_PATTERN.source.replace(/^\^|\$$/g, "");
  const match = output.match(new RegExp(`Created (${idPattern})`));
  if (!match?.[1]) {
    throw new Error("Id not parsed from output");
  }
  return match[1];
}

/** Extract list entries (lines with IDs) from CLI puzzle list output. */
function parseListLines(stdout: string): string[] {
  return stdout
    .split("\n")
    .filter((line) => line.trim().length > 0 && line.includes(":"));
}

let cwd: string;

beforeEach(async () => {
  cwd = await mkdtemp(join(tmpdir(), "ezer-acceptance-"));
});

test("shows priming text when no command is provided", async () => {
  const result = await runEzer(cwd);

  expect(result.exitCode).toBe(0);
  expect(result.stderr).toBe("");
  expect(result.stdout).toContain("=== EZER ===");
  expect(result.stdout).toContain("Commands");
  expect(result.stdout).toContain("cat <<'EOF' | ezer note create");
});

test("can create and list notes", async () => {
  const create = await runEzer(cwd, ["note", "create", "--content", "hello world"]);
  expect(create.exitCode).toBe(0);
  expect(create.stderr).toBe("");

  const id = parseCreatedId(create.stdout);

  const list = await runEzer(cwd, ["note", "list"]);
  expect(list.exitCode).toBe(0);
  expect(list.stdout).toContain(id);
  expect(list.stdout).toContain("hello world");

  const files = await readdir(join(cwd, ".ezer", "memory"));
  expect(files).toContain(`${id}.md`);
  const fileContent = await readFile(join(cwd, ".ezer", "memory", `${id}.md`), "utf-8");
  expect(fileContent).toContain("hello world");
});

test("can create note from stdin", async () => {
  const noteContent = "line 1\nline 2\n";
  const create = await runEzer(cwd, ["note", "create"], { stdin: noteContent });
  expect(create.exitCode).toBe(0);
  expect(create.stderr).toBe("");

  const id = parseCreatedId(create.stdout);

  const fileContent = await readFile(join(cwd, ".ezer", "memory", `${id}.md`), "utf-8");
  expect(fileContent).toContain(noteContent);
});

test("renders notes as XML in status output", async () => {
  const create = await runEzer(cwd, ["note", "create", "--content", "note xml"]);
  expect(create.exitCode).toBe(0);
  const id = parseCreatedId(create.stdout);

  const status = await runEzer(cwd, ["status"]);
  expect(status.exitCode).toBe(0);
  expect(status.stdout).toContain(`<note id="${id}">`);
  expect(status.stdout).toContain("note xml");
  expect(status.stdout).toContain("</note>");
});

test("describes puzzles in XML and suggests usage from list/tree", async () => {
  const create1 = await runEzer(cwd, [
    "puzzle",
    "create",
    "--title",
    "First puzzle",
    "--description",
    "first details",
  ]);
  const id1 = parseCreatedId(create1.stdout);

  const create2 = await runEzer(cwd, [
    "puzzle",
    "create",
    "--title",
    "Second puzzle",
    "--description",
    "second details",
  ]);
  const id2 = parseCreatedId(create2.stdout);

  const list = await runEzer(cwd, ["puzzle", "list"]);
  expect(list.stdout).toContain(id1);
  expect(list.stdout).toContain(id2);
  expect(list.stdout).toContain(
    'Use "ezer puzzle describe --ids <id1,id2>" to view puzzle details.'
  );

  const describe = await runEzer(cwd, ["puzzle", "describe", "--ids", `${id1},${id2}`]);
  expect(describe.exitCode).toBe(0);
  expect(describe.stdout).toContain(`<puzzle id="${id1}" title="First puzzle">`);
  expect(describe.stdout).toContain("first details");
  expect(describe.stdout).toContain(`<puzzle id="${id2}" title="Second puzzle">`);
  expect(describe.stdout).toContain("second details");

  const tree = await runEzer(cwd, ["puzzle", "tree", "--id", id1]);
  expect(tree.stdout).toContain(id1);
  expect(tree.stdout).toContain('Use "ezer puzzle describe --ids <id>" to view puzzle details.');
});

test("lists puzzles with statuses, including closed filter", async () => {
  const main = await runEzer(cwd, ["puzzle", "create", "--title", "Main task"]);
  const mainId = parseCreatedId(main.stdout);

  const blocker = await runEzer(cwd, [
    "puzzle",
    "create",
    "--title",
    "Blocker task",
    "--blocks",
    mainId,
  ]);
  const blockerId = parseCreatedId(blocker.stdout);

  const readyDefault = await runEzer(cwd, ["puzzle", "list"]);
  expect(readyDefault.exitCode).toBe(0);
  const readyDefaultLines = parseListLines(readyDefault.stdout);
  expect(readyDefaultLines.some((line) => line.startsWith(`${blockerId} [ready]:`))).toBe(true);
  expect(readyDefaultLines.some((line) => line.startsWith(`${mainId} [`))).toBe(false);

  const ready = await runEzer(cwd, ["puzzle", "list", "--ready"]);
  expect(ready.exitCode).toBe(0);
  const readyLines = parseListLines(ready.stdout);
  expect(readyLines.some((line) => line.startsWith(`${blockerId} [ready]:`))).toBe(true);
  expect(readyLines.some((line) => line.startsWith(`${mainId} [`))).toBe(false);

  const blocked = await runEzer(cwd, ["puzzle", "list", "--blocked"]);
  expect(blocked.exitCode).toBe(0);
  const blockedLines = parseListLines(blocked.stdout);
  expect(blockedLines.some((line) => line.startsWith(`${mainId} [blocked]:`))).toBe(true);
  expect(blockedLines.some((line) => line.includes(`blocked by ${blockerId}`))).toBe(true);
  expect(blockedLines.some((line) => line.startsWith(`${blockerId} [`))).toBe(false);

  const closeBlocker = await runEzer(cwd, ["puzzle", "close", "--id", blockerId]);
  expect(closeBlocker.exitCode).toBe(0);

  const readyAfterClose = await runEzer(cwd, ["puzzle", "list", "--ready"]);
  expect(readyAfterClose.exitCode).toBe(0);
  const readyAfterCloseLines = parseListLines(readyAfterClose.stdout);
  expect(readyAfterCloseLines.some((line) => line.startsWith(`${mainId} [ready]:`))).toBe(true);
  expect(readyAfterCloseLines.some((line) => line.includes(blockerId))).toBe(false);

  const closeMain = await runEzer(cwd, ["puzzle", "close", "--id", mainId]);
  expect(closeMain.exitCode).toBe(0);

  const closedList = await runEzer(cwd, ["puzzle", "list", "--closed"]);
  expect(closedList.exitCode).toBe(0);
  const closedLines = parseListLines(closedList.stdout);
  expect(closedLines.some((line) => line.startsWith(`${mainId} [closed]:`))).toBe(true);
  expect(closedLines.some((line) => line.startsWith(`${blockerId} [closed]:`))).toBe(true);
  const closedTimes = closedLines.map(
    (line) => /closed at ([^)]+)\)/.exec(line)?.[1] ?? ""
  );
  expect(closedTimes.every((time) => time.length > 0)).toBe(true);
  const closedTimeValues = closedTimes.map((time) => new Date(time).getTime());
  const sortedClosedTimes = [...closedTimeValues].sort((a, b) => b - a);
  expect(closedTimeValues).toEqual(sortedClosedTimes);
});

test("linking a puzzle to multiple targets retains all block relationships", async () => {
  const main = await runEzer(cwd, ["puzzle", "create", "--title", "Main"]);
  const mainId = parseCreatedId(main.stdout);

  const setup = await runEzer(cwd, ["puzzle", "create", "--title", "Setup"]);
  const setupId = parseCreatedId(setup.stdout);

  const nashville = await runEzer(cwd, ["puzzle", "create", "--title", "Nashville"]);
  const nashvilleId = parseCreatedId(nashville.stdout);

  const queue = await runEzer(cwd, ["puzzle", "create", "--title", "Queue"]);
  const queueId = parseCreatedId(queue.stdout);

  await runEzer(cwd, ["puzzle", "link", "--id", setupId, "--blocks", nashvilleId]);
  await runEzer(cwd, ["puzzle", "link", "--id", setupId, "--blocks", queueId]);
  await runEzer(cwd, ["puzzle", "link", "--id", nashvilleId, "--blocks", mainId]);
  await runEzer(cwd, ["puzzle", "link", "--id", queueId, "--blocks", mainId]);

  const ready = await runEzer(cwd, ["puzzle", "list", "--ready"]);
  const readyLines = parseListLines(ready.stdout);
  expect(readyLines).toHaveLength(1);
  expect(readyLines.some((line) => line.startsWith(`${setupId} [ready]:`))).toBe(true);

  const blocked = await runEzer(cwd, ["puzzle", "list", "--blocked"]);
  const blockedLines = parseListLines(blocked.stdout);

  const nashvilleLine = blockedLines.find((line) => line.startsWith(`${nashvilleId} [blocked]:`));
  expect(nashvilleLine).toBeDefined();
  expect(nashvilleLine).toContain(setupId);

  const queueLine = blockedLines.find((line) => line.startsWith(`${queueId} [blocked]:`));
  expect(queueLine).toBeDefined();
  expect(queueLine).toContain(setupId);

  const mainLine = blockedLines.find((line) => line.startsWith(`${mainId} [blocked]:`));
  expect(mainLine).toBeDefined();
  expect(mainLine).toContain(nashvilleId);
  expect(mainLine).toContain(queueId);

  const setupFile = await readFile(join(cwd, ".ezer", "memory", `${setupId}.md`), "utf-8");
  const setupEntry = parseMemoryFile(setupId, setupFile);
  expect(setupEntry.blocks?.length).toBe(2);
  expect(setupEntry.blocks).toEqual(expect.arrayContaining([nashvilleId, queueId]));
});

test("can link and unlink puzzles with block dependencies", async () => {
  // Create two puzzles
  const main = await runEzer(cwd, ["puzzle", "create", "--title", "Main task"]);
  const mainId = parseCreatedId(main.stdout);

  const blocker = await runEzer(cwd, ["puzzle", "create", "--title", "Blocker task"]);
  const blockerId = parseCreatedId(blocker.stdout);

  // Initially, both should be in ready list
  const readyBefore = await runEzer(cwd, ["puzzle", "list", "--ready"]);
  const readyBeforeLines = parseListLines(readyBefore.stdout);
  expect(readyBeforeLines.some((line) => line.startsWith(`${mainId} [ready]:`))).toBe(true);
  expect(readyBeforeLines.some((line) => line.startsWith(`${blockerId} [ready]:`))).toBe(true);

  // Link blocker to block main
  const link = await runEzer(cwd, ["puzzle", "link", "--id", blockerId, "--blocks", mainId]);
  expect(link.exitCode).toBe(0);
  expect(link.stderr).toBe("");
  expect(link.stdout).toContain(`Linked ${blockerId} to block ${mainId}`);

  // Now main should be blocked, blocker should be ready
  const blockedAfterLink = await runEzer(cwd, ["puzzle", "list", "--blocked"]);
  const blockedAfterLinkLines = parseListLines(blockedAfterLink.stdout);
  expect(blockedAfterLinkLines.some((line) => line.startsWith(`${mainId} [blocked]:`))).toBe(
    true
  );

  const readyAfterLink = await runEzer(cwd, ["puzzle", "list", "--ready"]);
  const readyAfterLinkLines = parseListLines(readyAfterLink.stdout);
  expect(readyAfterLinkLines.some((line) => line.startsWith(`${blockerId} [ready]:`))).toBe(true);
  expect(readyAfterLinkLines.some((line) => line.startsWith(`${mainId} [`))).toBe(false);

  // Unlink the blocker
  const unlink = await runEzer(cwd, ["puzzle", "unlink", "--id", blockerId, "--blocks", mainId]);
  expect(unlink.exitCode).toBe(0);
  expect(unlink.stderr).toBe("");
  expect(unlink.stdout).toContain(`Unlinked ${blockerId} from ${mainId}`);

  // Now both should be ready again
  const readyAfterUnlink = await runEzer(cwd, ["puzzle", "list", "--ready"]);
  const readyAfterUnlinkLines = parseListLines(readyAfterUnlink.stdout);
  expect(readyAfterUnlinkLines.some((line) => line.startsWith(`${mainId} [ready]:`))).toBe(true);
  expect(readyAfterUnlinkLines.some((line) => line.startsWith(`${blockerId} [ready]:`))).toBe(
    true
  );
});

test("can delete a puzzle", async () => {
  const create = await runEzer(cwd, ["puzzle", "create", "--title", "mystery"]);
  expect(create.exitCode).toBe(0);
  expect(create.stderr).toBe("");

  const id = parseCreatedId(create.stdout);

  const remove = await runEzer(cwd, ["puzzle", "delete", "--id", id]);
  expect(remove.exitCode).toBe(0);
  expect(remove.stderr).toBe("");
  expect(remove.stdout).toContain(`Deleted ${id}`);

  const list = await runEzer(cwd, ["puzzle", "list"]);
  expect(list.exitCode).toBe(0);
  expect(list.stdout).toContain("No puzzles.");

  const files = await readdir(join(cwd, ".ezer", "memory"));
  expect(files).not.toContain(`${id}.md`);
});

test("feedback submit builds GitHub issue link containing all feedback", async () => {
  const fb1 = await runEzer(cwd, ["feedback", "create", "--content", "first feedback"]);
  expect(fb1.exitCode).toBe(0);
  const fb2 = await runEzer(cwd, ["feedback", "create", "--content", "second feedback"]);
  expect(fb2.exitCode).toBe(0);

  const submit = await runEzer(cwd, ["feedback", "submit"]);
  expect(submit.exitCode).toBe(0);
  const urlText = submit.stdout.trim();
  const parsed = new URL(urlText);
  expect(parsed.origin + parsed.pathname).toBe("https://github.com/dtinth/ezer/issues/new");
  const body = parsed.searchParams.get("body") ?? "";
  expect(body).toContain("first feedback");
  expect(body).toContain("second feedback");
  const title = parsed.searchParams.get("title") ?? "";
  expect(title).toContain("Feedback from ezer");
});

test("feedback clear removes stored feedback entries", async () => {
  await runEzer(cwd, ["feedback", "create", "--content", "temp feedback"]);

  const before = await readdir(join(cwd, ".ezer", "memory"));
  expect(before.some((file) => file.endsWith(".md"))).toBe(true);

  const clear = await runEzer(cwd, ["feedback", "clear"]);
  expect(clear.exitCode).toBe(0);
  expect(clear.stdout).toContain("Cleared 1 feedback entry.");

  const after = await readdir(join(cwd, ".ezer", "memory"));
  expect(after.some((file) => file.endsWith(".md"))).toBe(false);
});
