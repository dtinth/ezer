import { mkdtemp, readFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test, beforeEach } from "bun:test";
import { ID_PATTERN } from "../src/lib/memory.ts";

const BIN_PATH = join(process.cwd(), "bin", "ezer");

async function runEzer(cwd: string, args: string[] = []) {
  const proc = Bun.spawn(["bun", BIN_PATH, ...args], {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  });
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

test("lists ready vs blocked puzzles based on dependencies", async () => {
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

  const ready = await runEzer(cwd, ["puzzle", "list", "--ready"]);
  expect(ready.exitCode).toBe(0);
  const readyLines = parseListLines(ready.stdout);
  expect(readyLines.some((line) => line.startsWith(`${blockerId}:`))).toBe(true);
  expect(readyLines.some((line) => line.startsWith(`${mainId}:`))).toBe(false);

  const blocked = await runEzer(cwd, ["puzzle", "list", "--blocked"]);
  expect(blocked.exitCode).toBe(0);
  const blockedLines = parseListLines(blocked.stdout);
  expect(blockedLines.some((line) => line.startsWith(`${mainId}:`))).toBe(true);
  expect(blockedLines.some((line) => line.startsWith(`${blockerId}:`))).toBe(false);

  const closeBlocker = await runEzer(cwd, ["puzzle", "close", "--id", blockerId]);
  expect(closeBlocker.exitCode).toBe(0);

  const readyAfterClose = await runEzer(cwd, ["puzzle", "list", "--ready"]);
  expect(readyAfterClose.exitCode).toBe(0);
  const readyAfterCloseLines = parseListLines(readyAfterClose.stdout);
  expect(readyAfterCloseLines.some((line) => line.startsWith(`${mainId}:`))).toBe(true);
  expect(readyAfterCloseLines.some((line) => line.startsWith(`${blockerId}:`))).toBe(false);
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
