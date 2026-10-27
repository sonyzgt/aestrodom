/**
 * Pure path validation for project files. Every path that enters the system
 * (from Claude, from the API, from a template) passes through `normalizeProjectPath`.
 *
 * Accepted paths are POSIX-style, relative, inside the project root, and use a
 * conservative character set. Anything else is rejected, never "fixed up" into
 * something that might resolve elsewhere.
 */
export class PathError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PathError";
  }
}

export const MAX_PATH_LENGTH = 200;
export const MAX_FILE_BYTES = 512 * 1024;
export const MAX_FILES_PER_PROJECT = 400;

/** Directories/files Claude and users may never write: build output, deps, VCS, platform files. */
const FORBIDDEN_PREFIXES = ["node_modules/", "dist/", ".git/", ".prismatic/", ".env"];
/** Platform-managed files: readable, but the toolchain is fixed by the runtime image. */
export const PROTECTED_FILES = new Set(["package.json", "vite.config.ts", "tsconfig.json"]);

const ALLOWED_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".css", ".html", ".json", ".md", ".txt", ".svg",
  ".webmanifest", ".xml",
]);

export function normalizeProjectPath(input: string): string {
  if (typeof input !== "string") throw new PathError("Path must be a string");
  if (input.length === 0 || input.length > MAX_PATH_LENGTH) throw new PathError("Invalid path length");
  if (/[\0-\x1f\\]/.test(input)) throw new PathError("Path contains forbidden characters");
  if (input.startsWith("/") || /^[a-zA-Z]:/.test(input) || input.startsWith("~")) {
    throw new PathError("Absolute paths are not allowed");
  }
  let p = input.replace(/^\.\//, "");
  const segments = p.split("/");
  for (const seg of segments) {
    if (seg === "" || seg === "." || seg === "..") throw new PathError("Path traversal is not allowed");
    if (!/^[A-Za-z0-9._@\-\[\]()+]+$/.test(seg)) throw new PathError(`Invalid path segment: ${seg}`);
  }
  p = segments.join("/");
  const lower = p.toLowerCase();
  for (const prefix of FORBIDDEN_PREFIXES) {
    if (lower === prefix.replace(/\/$/, "") || lower.startsWith(prefix)) throw new PathError(`Path is reserved: ${p}`);
  }
  return p;
}

export function assertWritablePath(input: string): string {
  const p = normalizeProjectPath(input);
  if (PROTECTED_FILES.has(p)) throw new PathError(`${p} is managed by Aestrodom and cannot be modified`);
  const dot = p.lastIndexOf(".");
  const ext = dot >= 0 ? p.slice(dot).toLowerCase() : "";
  if (!ALLOWED_EXTENSIONS.has(ext)) throw new PathError(`File type not allowed: ${ext || "(none)"}`);
  return p;
}
