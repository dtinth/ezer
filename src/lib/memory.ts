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
  // TODO: Puzzle-specific fields (title, status, deps) to be added later
}

interface FrontMatter {
  type: string;
  created: string;
}

function parseMemoryFile(id: string, content: string): MemoryEntry {
  const frontMatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!frontMatterMatch) {
    throw new Error(`Invalid memory file format for ${id}`);
  }
  const frontMatter = parseYAML<FrontMatter>(frontMatterMatch[1] ?? "");
  const body = frontMatterMatch[2]?.trim() ?? "";

  return {
    id,
    type: frontMatter?.type as MemoryEntry["type"],
    content: body,
    created: frontMatter?.created ?? "",
  };
}

function serializeMemoryEntry(entry: Omit<MemoryEntry, "id">): string {
  const frontMatter = {
    type: entry.type,
    created: entry.created,
  };
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
