import { mkdtemp, readFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test, beforeEach } from "bun:test";

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

  const match = create.stdout.match(/Created ([a-z0-9]{2,}-[a-z2-7]{5})/);
  expect(match).not.toBeNull();
  const id = match?.[1];
  if (!id) {
    throw new Error("Note id not parsed from output");
  }

  const list = await runEzer(cwd, ["note", "list"]);
  expect(list.exitCode).toBe(0);
  expect(list.stdout).toContain(id);
  expect(list.stdout).toContain("hello world");

  const files = await readdir(join(cwd, ".ezer", "memory"));
  expect(files).toContain(`${id}.md`);
  const fileContent = await readFile(join(cwd, ".ezer", "memory", `${id}.md`), "utf-8");
  expect(fileContent).toContain("hello world");
});
