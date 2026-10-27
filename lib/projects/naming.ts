/** Best-effort project name from a prompt: `... called Arrow ...` -> `Arrow`. */
export function inferProjectName(prompt: string): string {
  const named = prompt.match(/\b(?:called|named|name it|titled)\s+["“']?([A-Za-z0-9][\w .&'-]{0,40}?)["”']?(?=[.,;:!?\n]|\s+(?:with|that|using|for|and|which)\b|$)/i);
  if (named?.[1]) return named[1].trim().replace(/\s+/g, " ");
  const kind = prompt.match(/\b(?:build|create|make|design)\s+(?:me\s+)?(?:an?|the)?\s*([a-z0-9 -]{3,40}?)(?:\s+(?:for|with|that|using)\b|[.,\n]|$)/i);
  const words = (kind?.[1] ?? prompt).trim().split(/\s+/).slice(0, 3);
  const title = words.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
  return title.slice(0, 40) || "Untitled";
}
