/** Slugs double as DNS labels ({slug}.prismatic.com), so they follow RFC 1123 label rules. */
export const RESERVED_SLUGS = new Set([
  "www", "app", "api", "admin", "dashboard", "preview", "mail", "smtp", "ftp", "static", "assets",
  "cdn", "docs", "status", "blog", "help", "support", "auth", "login", "register", "prismatic", "ns1", "ns2",
]);

export function slugify(input: string): string {
  const base = input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
  return base || "project";
}

export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9](?:[a-z0-9-]{0,46}[a-z0-9])?$/.test(slug) && !slug.includes("--") && !RESERVED_SLUGS.has(slug);
}

/** Returns `base`, `base-2`, `base-3`, ... — the first candidate for which `taken` resolves false. */
export async function uniqueSlug(name: string, taken: (slug: string) => Promise<boolean>): Promise<string> {
  let base = slugify(name);
  if (RESERVED_SLUGS.has(base)) base = `${base}-app`;
  for (let i = 1; i < 1000; i++) {
    const candidate = i === 1 ? base : `${base.slice(0, 44)}-${i}`;
    if (isValidSlug(candidate) && !(await taken(candidate))) return candidate;
  }
  throw new Error("Could not allocate a unique slug");
}
