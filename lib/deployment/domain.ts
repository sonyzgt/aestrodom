/**
 * Project hostnames. Pure functions shared by server code and tests.
 * The base domain comes from PRISMATIC_DOMAIN (default prismatic.com).
 */
export function baseDomain(): string {
  return (process.env.PRISMATIC_DOMAIN || "prismatic.com").toLowerCase();
}

export function previewBaseDomain(): string {
  return (process.env.PRISMATIC_PREVIEW_DOMAIN || `preview.${baseDomain()}`).toLowerCase();
}

/** `arrow` -> `arrow.prismatic.com` */
export function getProjectDomain(slug: string): string {
  return `${slug}.${baseDomain()}`;
}

/** `arrow` -> `https://arrow.prismatic.com` */
export function getProjectUrl(slug: string): string {
  return `https://${getProjectDomain(slug)}`;
}

/** `arrow` -> `arrow.preview.prismatic.com` */
export function getPreviewDomain(slug: string): string {
  return `${slug}.${previewBaseDomain()}`;
}

/**
 * Extracts the project slug from a request host, or null if it is not a single-label project host.
 * `arrow.prismatic.com` -> `arrow`; `prismatic.com` and `a.b.prismatic.com` -> null.
 */
export function slugFromHost(host: string, domain = baseDomain()): string | null {
  const h = host.toLowerCase().replace(/:\d+$/, "").replace(/\.$/, "");
  const suffix = `.${domain}`;
  if (!h.endsWith(suffix)) return null;
  const label = h.slice(0, -suffix.length);
  if (!label || label.includes(".")) return null;
  return label;
}
