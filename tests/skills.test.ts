import { describe, expect, it } from "vitest";
import { SKILLS, normalizeSkills } from "@/lib/skills";
import { skillPrompts } from "@/lib/ai/skill-prompts";
import { RUNTIME_PACKAGES } from "@/lib/projects/template";

describe("skills", () => {
  it("keeps known ids only, once, in catalogue order", () => {
    expect(normalizeSkills(["logo-design", "nope", "gsap", "gsap"])).toEqual(["gsap", "logo-design"]);
    expect(normalizeSkills(undefined)).toEqual([]);
  });

  it("has guidance for every skill", () => {
    const prompts = skillPrompts(SKILLS.map((s) => s.id));
    expect(prompts).toHaveLength(SKILLS.length);
    for (const p of prompts) expect(p).toMatch(/^## Skill: /);
    expect(skillPrompts([])).toEqual([]);
  });

  it("ships the packages the GSAP and shadcn/ui skills rely on", () => {
    expect(RUNTIME_PACKAGES).toHaveProperty("gsap");
    expect(RUNTIME_PACKAGES).toHaveProperty("@gsap/react");
    for (const pkg of ["radix-ui", "class-variance-authority", "tw-animate-css"]) expect(RUNTIME_PACKAGES).toHaveProperty(pkg);
  });
});
