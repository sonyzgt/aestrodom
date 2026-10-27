import "server-only";
import fs from "fs/promises";
import path from "path";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import {
  MAX_FILE_BYTES,
  MAX_FILES_PER_PROJECT,
  PathError,
  assertWritablePath,
  normalizeProjectPath,
} from "./paths";
import { PROJECT_TEMPLATE } from "./template";

export { PathError } from "./paths";

/**
 * Isolated per-project working copies under `${STORAGE_PATH}/projects/{projectId}`.
 *
 * The filesystem is the working copy the build sandbox receives; the ProjectFile
 * table mirrors it so projects survive host loss and can be restored on any node.
 * All functions take a projectId that the caller has already authorized.
 */

const PROJECT_ID_RE = /^[a-z0-9]{20,40}$/;

export function projectsRoot() {
  return path.join(env.storagePath, "projects");
}

export function projectRoot(projectId: string): string {
  if (!PROJECT_ID_RE.test(projectId)) throw new PathError("Invalid project id");
  return path.join(projectsRoot(), projectId);
}

/** Resolve a validated relative path and verify (lexically and via realpath) that it stays inside the root. */
async function resolveInside(projectId: string, relPath: string): Promise<string> {
  const root = projectRoot(projectId);
  const abs = path.resolve(root, ...relPath.split("/"));
  const rel = path.relative(root, abs);
  if (rel === "" || rel.startsWith("..") || path.isAbsolute(rel)) throw new PathError("Path escapes project root");
  // Defend against symlinks planted inside the tree: the nearest existing ancestor must resolve inside root.
  let probe = path.dirname(abs);
  while (probe.length >= root.length) {
    try {
      const real = await fs.realpath(probe);
      const realRoot = await fs.realpath(root);
      const r = path.relative(realRoot, real);
      if (r.startsWith("..") || path.isAbsolute(r)) throw new PathError("Path escapes project root");
      break;
    } catch (err) {
      if (err instanceof PathError) throw err;
      probe = path.dirname(probe);
    }
  }
  return abs;
}

export async function createProject(projectId: string): Promise<void> {
  const root = projectRoot(projectId);
  await fs.mkdir(root, { recursive: true });
  for (const [p, content] of Object.entries(PROJECT_TEMPLATE)) {
    await writeRaw(projectId, normalizeProjectPath(p), content);
  }
  await syncSize(projectId);
}

export async function exists(projectId: string, relPath: string): Promise<boolean> {
  const p = normalizeProjectPath(relPath);
  try {
    const stat = await fs.lstat(await resolveInside(projectId, p));
    return stat.isFile();
  } catch {
    return false;
  }
}

export async function readFile(projectId: string, relPath: string): Promise<string> {
  const p = normalizeProjectPath(relPath);
  const abs = await resolveInside(projectId, p);
  const stat = await fs.lstat(abs);
  if (!stat.isFile()) throw new PathError(`Not a file: ${p}`);
  if (stat.size > MAX_FILE_BYTES) throw new PathError(`File too large: ${p}`);
  return fs.readFile(abs, "utf8");
}

async function writeRaw(projectId: string, p: string, content: string) {
  const abs = await resolveInside(projectId, p);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, content, "utf8");
  await prisma.projectFile.upsert({
    where: { projectId_path: { projectId, path: p } },
    create: { projectId, path: p, content },
    update: { content },
  });
}

export interface WriteLimits {
  maxProjectSizeBytes: number;
}

export async function writeFile(
  projectId: string,
  relPath: string,
  content: string,
  limits?: WriteLimits,
): Promise<{ path: string; created: boolean }> {
  const p = assertWritablePath(relPath);
  if (typeof content !== "string") throw new PathError("Content must be a string");
  const bytes = Buffer.byteLength(content, "utf8");
  if (bytes > MAX_FILE_BYTES) throw new PathError(`File exceeds ${MAX_FILE_BYTES / 1024}KB limit: ${p}`);
  const existed = await exists(projectId, p);
  if (!existed) {
    const files = await listFiles(projectId);
    if (files.length >= MAX_FILES_PER_PROJECT) throw new PathError("Project file limit reached");
  }
  if (limits) {
    const current = await projectSize(projectId);
    if (current + bytes > limits.maxProjectSizeBytes) throw new PathError("Project storage limit reached");
  }
  await writeRaw(projectId, p, content);
  return { path: p, created: !existed };
}

export async function deleteFile(projectId: string, relPath: string): Promise<void> {
  const p = assertWritablePath(relPath);
  const abs = await resolveInside(projectId, p);
  await fs.rm(abs, { force: true });
  await prisma.projectFile.deleteMany({ where: { projectId, path: p } });
  await pruneEmptyDirs(projectId, path.dirname(abs));
}

export async function renameFile(projectId: string, from: string, to: string): Promise<void> {
  const src = assertWritablePath(from);
  const dst = assertWritablePath(to);
  if (await exists(projectId, dst)) throw new PathError(`Destination exists: ${dst}`);
  const absSrc = await resolveInside(projectId, src);
  const absDst = await resolveInside(projectId, dst);
  await fs.mkdir(path.dirname(absDst), { recursive: true });
  await fs.rename(absSrc, absDst);
  await prisma.$transaction([
    prisma.projectFile.deleteMany({ where: { projectId, path: dst } }),
    prisma.projectFile.updateMany({ where: { projectId, path: src }, data: { path: dst } }),
  ]);
  await pruneEmptyDirs(projectId, path.dirname(absSrc));
}

async function pruneEmptyDirs(projectId: string, dir: string) {
  const root = projectRoot(projectId);
  let current = dir;
  while (current.startsWith(root) && current !== root) {
    const entries = await fs.readdir(current).catch(() => null);
    if (!entries || entries.length > 0) break;
    await fs.rmdir(current).catch(() => undefined);
    current = path.dirname(current);
  }
}

export interface FileEntry {
  path: string;
  size: number;
}

/** Lists regular files (never follows symlinks), sorted by path. */
export async function listFiles(projectId: string): Promise<FileEntry[]> {
  const root = projectRoot(projectId);
  const out: FileEntry[] = [];
  async function walk(dir: string) {
    const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
    for (const e of entries) {
      const abs = path.join(dir, e.name);
      const rel = path.relative(root, abs).split(path.sep).join("/");
      if (e.isDirectory()) {
        if (["node_modules", "dist", ".git", ".prismatic"].includes(e.name)) continue;
        await walk(abs);
      } else if (e.isFile()) {
        const stat = await fs.stat(abs);
        out.push({ path: rel, size: stat.size });
      }
    }
  }
  await walk(root);
  return out.sort((a, b) => a.path.localeCompare(b.path));
}

export async function projectSize(projectId: string): Promise<number> {
  const files = await listFiles(projectId);
  return files.reduce((s, f) => s + f.size, 0);
}

export async function syncSize(projectId: string): Promise<number> {
  const size = await projectSize(projectId);
  await prisma.project.update({ where: { id: projectId }, data: { sizeBytes: size } });
  return size;
}

/** Restores the working copy from the database mirror (e.g. on a fresh node). */
export async function restoreFromDatabase(projectId: string): Promise<number> {
  const root = projectRoot(projectId);
  await fs.mkdir(root, { recursive: true });
  const files = await prisma.projectFile.findMany({ where: { projectId } });
  for (const f of files) {
    const p = normalizeProjectPath(f.path);
    const abs = await resolveInside(projectId, p);
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, f.content, "utf8");
  }
  return files.length;
}

export async function ensureWorkingCopy(projectId: string): Promise<void> {
  const root = projectRoot(projectId);
  const present = await fs.stat(root).then(() => true).catch(() => false);
  if (!present) await restoreFromDatabase(projectId);
}

export async function removeProject(projectId: string): Promise<void> {
  await fs.rm(projectRoot(projectId), { recursive: true, force: true });
}

/** Reads every file (used for building the sandbox archive). */
export async function readAllFiles(projectId: string): Promise<{ path: string; content: Buffer }[]> {
  const root = projectRoot(projectId);
  const files = await listFiles(projectId);
  return Promise.all(
    files.map(async (f) => ({ path: f.path, content: await fs.readFile(path.join(root, ...f.path.split("/"))) })),
  );
}
