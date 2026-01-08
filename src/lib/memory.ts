import { mkdir, readdir, readFile, writeFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import { parseYAML, stringifyYAML } from "confbox";

const EZER_DIR = ".ezer";
const MEMORY_DIR = join(EZER_DIR, "memory");
const CONFIG_FILE = join(EZER_DIR, "config.yaml");

// Base32 alphabet (lowercase, no padding)
const BASE32_ALPHABET = "abcdefghijklmnopqrstuvwxyz234567";

export const ID_PATTERN = /^[a-z0-9]{2,}-[a-z2-7]{5}$/;

function generateRandomId(length: number): string {
  let result = "";
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * BASE32_ALPHABET.length);
    result += BASE32_ALPHABET[randomIndex];
  }
  return result;
}

function derivePrefix(dirName: string): string {
  const segments = dirName.split(/[-_]/);
  let prefix = segments.map((s) => s[0] ?? "").join("");
  if (prefix.length < 2) {
    prefix = dirName.slice(0, 2);
  }
  return prefix.toLowerCase();
}

interface Config {
  prefix: string;
}

async function ensureDir(): Promise<void> {
  await mkdir(MEMORY_DIR, { recursive: true });
}

async function loadConfig(): Promise<Config | null> {
  try {
    const content = await readFile(CONFIG_FILE, "utf-8");
    return parseYAML<Config>(content);
  } catch {
    return null;
  }
}

async function saveConfig(config: Config): Promise<void> {
  await mkdir(EZER_DIR, { recursive: true });
  await writeFile(CONFIG_FILE, stringifyYAML(config));
}

async function getOrCreatePrefix(): Promise<string> {
  const config = await loadConfig();
  if (config?.prefix) {
    return config.prefix;
  }
  const cwd = process.cwd();
  const dirName = cwd.split("/").pop() ?? "ez";
  const prefix = derivePrefix(dirName);
  await saveConfig({ prefix });
  return prefix;
}

export async function generateId(): Promise<string> {
  const prefix = await getOrCreatePrefix();
  const random = generateRandomId(5);
  return `${prefix}-${random}`;
}

export interface MemoryEntry {
  id: string;
  type: "note" | "puzzle" | "feedback";
  content: string;
  created: string;
  closedAt?: string;
  // Puzzle-specific fields
  title?: string;
  status?: "open" | "closed";
  blocks?: string[]; // IDs of puzzles this entry blocks (parents depend on this)
}

interface FrontMatter {
  type: string;
  created: string;
  title?: string;
  status?: string;
  blocks?: string | string[];
  closedAt?: string;
}

function normalizeBlocks(blocks: string | string[] | undefined): string[] | undefined {
  if (Array.isArray(blocks)) {
    const ids = blocks
      .filter((id): id is string => typeof id === "string")
      .map((id) => id.trim())
      .filter((id) => id.length > 0 && ID_PATTERN.test(id));
    return ids.length > 0 ? ids : undefined;
  }
  if (typeof blocks === "string") {
    const id = blocks.trim();
    if (id.length > 0 && ID_PATTERN.test(id)) {
      return [id];
    }
  }
  return undefined;
}

export function parseMemoryFile(id: string, content: string): MemoryEntry {
  const frontMatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!frontMatterMatch) {
    throw new Error(`Invalid memory file format for ${id}`);
  }
  const frontMatter = parseYAML<FrontMatter>(frontMatterMatch[1] ?? "");
  const body = frontMatterMatch[2]?.trim() ?? "";

  const entry: MemoryEntry = {
    id,
    type: frontMatter?.type as MemoryEntry["type"],
    content: body,
    created: frontMatter?.created ?? "",
  };
  if (frontMatter?.title !== undefined) {
    entry.title = frontMatter.title;
  }
  if (frontMatter?.status === "open" || frontMatter?.status === "closed") {
    entry.status = frontMatter.status;
  }
  if (typeof frontMatter?.closedAt === "string") {
    entry.closedAt = frontMatter.closedAt;
  }
  const blocks = normalizeBlocks(frontMatter?.blocks);
  if (blocks?.length) {
    entry.blocks = blocks;
  }
  return entry;
}

function getBlocksList(entry: Pick<MemoryEntry, "blocks">): string[] {
  return entry.blocks ?? [];
}

function serializeMemoryEntry(entry: Omit<MemoryEntry, "id">): string {
  const frontMatter: Record<string, unknown> = {
    type: entry.type,
    created: entry.created,
  };
  if (entry.title) {
    frontMatter["title"] = entry.title;
  }
  if (entry.status) {
    frontMatter["status"] = entry.status;
  }
  if (entry.closedAt) {
    frontMatter["closedAt"] = entry.closedAt;
  }
  if (entry.blocks?.length) {
    frontMatter["blocks"] = entry.blocks;
  }
  const yaml = stringifyYAML(frontMatter).trimEnd();
  return `---\n${yaml}\n---\n${entry.content}\n`;
}

const SOFT_LIMIT = 30000;
const HARD_LIMIT = 32768;

function getByteSize(text: string): number {
  return Buffer.byteLength(text, "utf-8");
}

async function getTotalNoteSize(): Promise<number> {
  const entries = await listMemoryEntries("note");
  return entries.reduce((sum, entry) => sum + getByteSize(entry.content), 0);
}

export async function createNote(content: string): Promise<MemoryEntry> {
  const currentTotal = await getTotalNoteSize();
  const contentBytes = getByteSize(content);
  const newTotal = currentTotal + contentBytes;

  // Check hard limit
  if (newTotal > HARD_LIMIT) {
    throw new Error(
      `Cannot add note: total would be ${newTotal} bytes, exceeds hard limit of ${HARD_LIMIT} bytes`
    );
  }

  await ensureDir();
  const id = await generateId();
  const created = new Date().toISOString();

  const entry: MemoryEntry = {
    id,
    type: "note",
    content,
    created,
  };

  const filePath = join(MEMORY_DIR, `${id}.md`);
  await writeFile(filePath, serializeMemoryEntry(entry));

  // Warn if soft limit exceeded
  if (newTotal > SOFT_LIMIT) {
    console.warn(
      `Warning: Total notes size (${newTotal} bytes) exceeds soft limit of ${SOFT_LIMIT} bytes`
    );
    console.warn(
      `Hint: Use 'ezer note replace --ids id1,id2 --content "..."' to consolidate related notes`
    );
  }

  return entry;
}

export async function createFeedback(content: string): Promise<MemoryEntry> {
  await ensureDir();
  const id = await generateId();
  const created = new Date().toISOString();

  const entry: MemoryEntry = {
    id,
    type: "feedback",
    content,
    created,
  };

  const filePath = join(MEMORY_DIR, `${id}.md`);
  await writeFile(filePath, serializeMemoryEntry(entry));
  return entry;
}

/**
 * Create a puzzle.
 * @param title - Puzzle title
 * @param description - Optional description
 * @param blocksId - If provided, this puzzle blocks the specified puzzle
 */
export async function createPuzzle(
  title: string,
  description?: string,
  blocksId?: string
): Promise<MemoryEntry> {
  await ensureDir();
  const id = await generateId();
  const created = new Date().toISOString();

  const entry: MemoryEntry = {
    id,
    type: "puzzle",
    title,
    content: description ?? "",
    created,
    status: "open",
  };
  if (blocksId) {
    entry.blocks = [blocksId];
  }

  const filePath = join(MEMORY_DIR, `${id}.md`);
  await writeFile(filePath, serializeMemoryEntry(entry));
  return entry;
}

export async function updatePuzzleStatus(
  id: string,
  status: "open" | "closed"
): Promise<MemoryEntry> {
  const filePath = join(MEMORY_DIR, `${id}.md`);
  const content = await readFile(filePath, "utf-8");
  const entry = parseMemoryFile(id, content);

  if (entry.type !== "puzzle") {
    throw new Error(`${id} is not a puzzle`);
  }

  entry.status = status;
  if (status === "closed") {
    entry.closedAt = new Date().toISOString();
  } else {
    delete entry.closedAt;
  }
  await writeFile(filePath, serializeMemoryEntry(entry));
  return entry;
}

export async function updatePuzzleBlocks(
  id: string,
  blocksId: string | null,
  action: "set" | "append" | "remove" = "set"
): Promise<MemoryEntry> {
  const filePath = join(MEMORY_DIR, `${id}.md`);
  const content = await readFile(filePath, "utf-8");
  const entry = parseMemoryFile(id, content);

  if (entry.type !== "puzzle") {
    throw new Error(`${id} is not a puzzle`);
  }

  const currentBlocks = getBlocksList(entry);

  if (action === "remove") {
    if (blocksId === null) {
      delete entry.blocks;
    } else {
      const updated = currentBlocks.filter((blockId) => blockId !== blocksId);
      if (updated.length === 0) {
        delete entry.blocks;
      } else {
        entry.blocks = updated;
      }
    }
    await writeFile(filePath, serializeMemoryEntry(entry));
    return entry;
  }

  if (blocksId === null) {
    delete entry.blocks;
  } else {
    // Verify the blocks ID exists and is a puzzle
    const blocksFilePath = join(MEMORY_DIR, `${blocksId}.md`);
    const blocksContent = await readFile(blocksFilePath, "utf-8");
    const blocksEntry = parseMemoryFile(blocksId, blocksContent);
    if (blocksEntry.type !== "puzzle") {
      throw new Error(`${blocksId} is not a puzzle`);
    }

    if (action === "set") {
      entry.blocks = [blocksId];
    } else {
      const set = new Set(currentBlocks);
      set.add(blocksId);
      entry.blocks = Array.from(set);
    }
  }

  await writeFile(filePath, serializeMemoryEntry(entry));
  return entry;
}

export async function listMemoryEntries(
  type?: MemoryEntry["type"]
): Promise<MemoryEntry[]> {
  try {
    const files = await readdir(MEMORY_DIR);
    const entries: MemoryEntry[] = [];

    for (const file of files) {
      if (!file.endsWith(".md")) continue;
      const id = file.replace(/\.md$/, "");
      const filePath = join(MEMORY_DIR, file);
      const content = await readFile(filePath, "utf-8");
      const entry = parseMemoryFile(id, content);
      if (!type || entry.type === type) {
        entries.push(entry);
      }
    }

    // Sort by created date, newest first
    entries.sort(
      (a, b) => new Date(b.created).getTime() - new Date(a.created).getTime()
    );
    return entries;
  } catch {
    return [];
  }
}

export async function updateNote(
  id: string,
  content: string
): Promise<MemoryEntry> {
  const filePath = join(MEMORY_DIR, `${id}.md`);
  const fileContent = await readFile(filePath, "utf-8");
  const entry = parseMemoryFile(id, fileContent);

  if (entry.type !== "note") {
    throw new Error(`${id} is not a note`);
  }

  entry.content = content;
  await writeFile(filePath, serializeMemoryEntry(entry));
  return entry;
}

export async function deleteNote(id: string): Promise<void> {
  const filePath = join(MEMORY_DIR, `${id}.md`);
  const fileContent = await readFile(filePath, "utf-8");
  const entry = parseMemoryFile(id, fileContent);

  if (!["note", "puzzle"].includes(entry.type)) {
    throw new Error(`${id} is not a note or puzzle`);
  }

  await unlink(filePath);
}

export async function replaceNotes(
  ids: string[],
  content: string
): Promise<MemoryEntry> {
  // Validate all IDs are notes
  for (const id of ids) {
    const filePath = join(MEMORY_DIR, `${id}.md`);
    const fileContent = await readFile(filePath, "utf-8");
    const entry = parseMemoryFile(id, fileContent);
    if (entry.type !== "note") {
      throw new Error(`${id} is not a note`);
    }
  }

  // Delete old notes
  for (const id of ids) {
    const filePath = join(MEMORY_DIR, `${id}.md`);
    await unlink(filePath);
  }

  // Create new consolidated note
  return createNote(content);
}

export async function clearFeedback(): Promise<number> {
  const entries = await listMemoryEntries("feedback");
  if (entries.length === 0) {
    return 0;
  }
  for (const entry of entries) {
    const filePath = join(MEMORY_DIR, `${entry.id}.md`);
    await unlink(filePath);
  }
  return entries.length;
}

export async function getPuzzleTree(rootId: string): Promise<string[]> {
  const entries = await listMemoryEntries("puzzle");
  const idMap = new Map<string, MemoryEntry>();
  for (const entry of entries) {
    idMap.set(entry.id, entry);
  }

  // Find all puzzles that block the given puzzle (ancestors)
  const ancestors: string[] = [];
  let current = rootId;
  while (current) {
    const puzzle = idMap.get(current);
    if (!puzzle || puzzle.type !== "puzzle") break;
    const [primaryBlock] = getBlocksList(puzzle);
    if (primaryBlock) {
      ancestors.unshift(primaryBlock);
      current = primaryBlock;
    } else {
      break;
    }
  }

  // Find all puzzles that are blocked by the given puzzle (descendants)
  const descendants: string[] = [];
  function findDescendants(puzzleId: string): void {
    for (const [id, puzzle] of idMap) {
      if (getBlocksList(puzzle).includes(puzzleId)) {
        descendants.push(id);
        findDescendants(id);
      }
    }
  }
  findDescendants(rootId);

  return [...ancestors, rootId, ...descendants];
}

export async function renderPuzzleTree(rootId: string): Promise<string> {
  const entries = await listMemoryEntries("puzzle");
  const idMap = new Map<string, MemoryEntry>();
  for (const entry of entries) {
    idMap.set(entry.id, entry);
  }

  const lines: string[] = [];

  // Find ancestors
  const ancestors: Array<{ id: string; puzzle: MemoryEntry }> = [];
  let current = rootId;
  while (current) {
    const puzzle = idMap.get(current);
    if (!puzzle || puzzle.type !== "puzzle") break;
    ancestors.unshift({ id: current, puzzle });
    const [primaryBlock] = getBlocksList(puzzle);
    if (primaryBlock) {
      current = primaryBlock;
    } else {
      break;
    }
  }

  // Find descendants
  function findDescendants(
    puzzleId: string,
    depth: number
  ): Array<{ id: string; puzzle: MemoryEntry; depth: number }> {
    const result: Array<{ id: string; puzzle: MemoryEntry; depth: number }> = [];
    for (const [id, puzzle] of idMap) {
      if (getBlocksList(puzzle).includes(puzzleId)) {
        result.push({ id, puzzle, depth });
        result.push(...findDescendants(id, depth + 1));
      }
    }
    return result;
  }

  const descendants = findDescendants(rootId, 1);

  // Render ancestors
  for (const { id, puzzle } of ancestors) {
    if (id === rootId) continue;
    lines.push(`  ${id}: ${puzzle.title}`);
  }

  // Render root
  const root = idMap.get(rootId);
  if (!root) {
    return `Puzzle ${rootId} not found`;
  }
  lines.push(`→ ${rootId}: ${root.title}`);

  // Render descendants
  for (const { id, puzzle, depth } of descendants) {
    const indent = "  ".repeat(depth);
    lines.push(`${indent}→ ${id}: ${puzzle.title}`);
  }

  return lines.join("\n");
}
