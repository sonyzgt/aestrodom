import type { FileEntry } from "@/lib/projects/filesystem";

/**
 * Context manager: decides which parts of a project Claude sees for a given request.
 *
 * The full project is never sent. For each request we send:
 *  1. project metadata and framework info
 *  2. the file tree (paths + sizes only)
 *  3. a rolling summary of older conversation + the most recent messages
 *  4. the contents of only the files ranked most relevant to the request, within a size budget
 * Claude can pull in anything else on demand with the read_file tool.
 *
 * Everything in here is pure so it can be unit-tested without a database or filesystem.
 */

export const CONTEXT_FILE_BUDGET_CHARS = 60_000;
export const CONTEXT_MAX_FILES = 10;
export const RECENT_MESSAGES = 8;
export const RECENT_MESSAGE_CHARS = 1_500;

const STOPWORDS = new Set(
  "the a an and or but to of in on for with make made change changes add adding remove use using into from this that it its be is are was were more less very please can could would should my me i we our your page site website app application just also some any all new like want need".split(
    " ",
  ),
);

/** Request vocabulary -> words likely to appear in relevant file paths or code. */
const SYNONYMS: Record<string, string[]> = {
  navbar: ["nav", "navbar", "header", "menu"],
  nav: ["nav", "navbar", "header", "menu"],
  menu: ["nav", "navbar", "menu", "header"],
  header: ["header", "nav", "navbar"],
  hero: ["hero", "banner", "headline"],
  footer: ["footer"],
  color: ["css", "theme", "color", "accent"],
  colour: ["css", "theme", "color", "accent"],
  accent: ["css", "theme", "accent", "color"],
  theme: ["css", "theme", "color"],
  font: ["css", "font", "typography"],
  typography: ["css", "font"],
  dark: ["css", "theme"],
  background: ["css", "background", "bg"],
  button: ["button", "cta"],
  cta: ["cta", "button"],
  pricing: ["pricing", "price", "plan"],
  roadmap: ["roadmap", "timeline"],
  tokenomics: ["tokenomics", "token", "supply"],
  faq: ["faq", "question"],
  feature: ["feature", "features"],
  features: ["feature", "features"],
  testimonial: ["testimonial", "review"],
  contact: ["contact", "form"],
  form: ["form", "input"],
  animation: ["motion", "animate", "framer"],
  animated: ["motion", "animate", "framer"],
  cinematic: ["hero", "motion", "animate"],
  responsive: ["css", "app"],
  mobile: ["nav", "css", "responsive"],
  logo: ["logo", "favicon", "brand", "svg"],
  title: ["index.html", "title", "seo"],
  seo: ["index.html", "meta"],
};

export function keywords(request: string): string[] {
  const words = request
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w));
  const out = new Set<string>();
  for (const w of words) {
    out.add(w);
    for (const s of SYNONYMS[w] ?? []) out.add(s);
    if (w.endsWith("s") && w.length > 4) out.add(w.slice(0, -1));
  }
  return [...out].slice(0, 40);
}

export interface ScoredFile {
  path: string;
  score: number;
}

/**
 * Ranks files by relevance. `contentOf` gives (possibly cached) file contents for content matching.
 */
export function rankFiles(files: FileEntry[], request: string, contentOf: (path: string) => string | undefined): ScoredFile[] {
  const kws = keywords(request);
  const wantsStyle = kws.some((k) => ["css", "theme", "color", "font", "background", "accent"].includes(k));
  return files
    .filter((f) => !["package.json", "tsconfig.json", "vite.config.ts"].includes(f.path))
    .map((f) => {
      const p = f.path.toLowerCase();
      let score = 0;
      for (const k of kws) if (p.includes(k)) score += 6;
      const content = contentOf(f.path)?.toLowerCase();
      if (content) {
        for (const k of kws) {
          if (k.length < 4) continue;
          let idx = content.indexOf(k);
          let hits = 0;
          while (idx !== -1 && hits < 5) {
            hits++;
            idx = content.indexOf(k, idx + k.length);
          }
          score += hits;
        }
      }
      // The composition root is almost always needed to place or reorder sections.
      if (p === "src/app.tsx") score += 4;
      if (p === "src/index.css") score += wantsStyle ? 6 : 1;
      if (p.endsWith(".svg") || p.startsWith("public/")) score -= 2;
      return { path: f.path, score };
    })
    .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path));
}

/** Picks files within budget. On a brand-new project (template only) every source file is included. */
export function selectRelevantFiles(
  files: FileEntry[],
  request: string,
  contentOf: (path: string) => string | undefined,
  opts: { budgetChars?: number; maxFiles?: number; isNewProject?: boolean } = {},
): string[] {
  const budget = opts.budgetChars ?? CONTEXT_FILE_BUDGET_CHARS;
  const maxFiles = opts.maxFiles ?? CONTEXT_MAX_FILES;
  const ranked = rankFiles(files, request, contentOf);
  const sizes = new Map(files.map((f) => [f.path, f.size]));
  const picked: string[] = [];
  let used = 0;
  for (const r of ranked) {
    if (picked.length >= maxFiles) break;
    if (!opts.isNewProject && r.score <= 0) continue;
    const size = sizes.get(r.path) ?? 0;
    if (used + size > budget) continue;
    picked.push(r.path);
    used += size;
  }
  return picked;
}

export function formatFileTree(files: FileEntry[]): string {
  return files.map((f) => `${f.path} (${f.size < 1024 ? `${f.size}B` : `${(f.size / 1024).toFixed(1)}KB`})`).join("\n");
}

export interface ContextMessage {
  role: "USER" | "ASSISTANT" | "SYSTEM";
  content: string;
}

export interface BuildContextInput {
  project: { name: string; slug: string; description: string; framework: string; domain: string; deployed: boolean };
  files: FileEntry[];
  relevant: { path: string; content: string }[];
  summary: string;
  recent: ContextMessage[];
  request: string;
}

function escapeTag(s: string) {
  // Prevent file content from closing our wrapper tags early.
  return s.replace(/<\/(file|request|conversation|summary|project|file_tree)>/gi, "<\\/$1>");
}

/** Renders the single user turn that starts an agent run. */
export function renderContext(input: BuildContextInput): string {
  const parts: string[] = [];
  parts.push(
    `<project>\nname: ${input.project.name}\nslug: ${input.project.slug}\nframework: ${input.project.framework} (Vite + React + TypeScript + Tailwind v4)\ndomain: ${input.project.domain}\ndeployed: ${input.project.deployed ? "yes" : "no"}\ndescription: ${escapeTag(input.project.description)}\n</project>`,
  );
  parts.push(`<file_tree>\n${formatFileTree(input.files)}\n</file_tree>`);
  if (input.summary) parts.push(`<summary>\n${escapeTag(input.summary)}\n</summary>`);
  if (input.recent.length) {
    const convo = input.recent
      .map((m) => `${m.role === "USER" ? "User" : m.role === "ASSISTANT" ? "Agent" : "System"}: ${m.content.slice(0, RECENT_MESSAGE_CHARS)}`)
      .join("\n\n");
    parts.push(`<conversation>\n${escapeTag(convo)}\n</conversation>`);
  }
  for (const f of input.relevant) {
    parts.push(`<file path="${f.path}">\n${escapeTag(f.content)}\n</file>`);
  }
  if (input.relevant.length < input.files.length) {
    parts.push("(Only the files above are included. Use read_file for any other file before editing it.)");
  }
  parts.push(`<request>\n${escapeTag(input.request)}\n</request>`);
  return parts.join("\n\n");
}
