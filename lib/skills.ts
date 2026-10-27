/** Optional skills a user can switch on per project. The guidance itself lives in lib/ai/skill-prompts.ts. */
export const SKILLS = [
  { id: "gsap", name: "GSAP", description: "Scroll-driven, timeline and text animations with GSAP." },
  { id: "ui-ux-pro-max", name: "UI UX Pro Max", description: "A full design system: distinctive style, palette, type and polished states." },
  { id: "logo-design", name: "Logo Design", description: "A custom SVG logo, favicon and brand mark for the app." },
  { id: "frontend-design", name: "Frontend Design", description: "Bold, memorable interfaces with a clear aesthetic, not generic AI layouts." },
  { id: "shadcn-ui", name: "shadcn/ui", description: "Accessible components in the shadcn/ui style, built on Radix." },
  { id: "web-design-guidelines", name: "Web Design Guidelines", description: "Checks the UI against web best practices: a11y, performance, UX." },
] as const;

export type SkillId = (typeof SKILLS)[number]["id"];

export const SKILL_IDS = SKILLS.map((s) => s.id) as [SkillId, ...SkillId[]];

/** Keeps known ids only, deduplicated, in catalogue order. */
export function normalizeSkills(ids: readonly string[] | null | undefined): SkillId[] {
  const set = new Set(ids ?? []);
  return SKILL_IDS.filter((id) => set.has(id));
}
