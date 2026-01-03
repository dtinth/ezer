import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parseYAML, stringifyYAML } from "confbox";

const EZER_DIR = ".ezer";
const MEMORY_DIR = join(EZER_DIR, "memory");
const CONFIG_FILE = join(EZER_DIR, "config.yaml");

// Base32 alphabet (lowercase, no padding)
const BASE32_ALPHABET = "abcdefghijklmnopqrstuvwxyz234567";

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
  // Puzzle-specific fields
  title?: string;
  status?: "open" | "closed";
  blocks?: string; // ID of puzzle this blocks (parent depends on this)
}

interface FrontMatter {
  type: string;
  created: string;
  title?: string;
  status?: string;
  blocks?: string;
}

function parseMemoryFile(id: string, content: string): MemoryEntry {
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
  if (frontMatter?.blocks !== undefined) {
    entry.blocks = frontMatter.blocks;
  }
  return entry;
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
  if (entry.blocks) {
    frontMatter["blocks"] = entry.blocks;
  }
  const yaml = stringifyYAML(frontMatter).trimEnd();
  return `---\n${yaml}\n---\n${entry.content}\n`;
}

export async function createNote(content: string): Promise<MemoryEntry> {
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
    entry.blocks = blocksId;
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
