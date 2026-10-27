import { describe, expect, it } from "vitest";
import { isValidSlug, slugify, uniqueSlug } from "@/lib/slug";
import { getProjectDomain, getProjectUrl, slugFromHost } from "@/lib/deployment/domain";
import { inferProjectName } from "@/lib/projects/naming";

describe("slugs", () => {
  it("slugifies names into DNS-safe labels", () => {
    expect(slugify("Arrow")).toBe("arrow");
    expect(slugify("  My Cool App!! ")).toBe("my-cool-app");
    expect(slugify("Café Déjà Vu")).toBe("cafe-deja-vu");
    expect(slugify("***")).toBe("project");
  });

  it("allocates arrow, arrow-2, arrow-3", async () => {
    const taken = new Set(["arrow", "arrow-2"]);
    expect(await uniqueSlug("Arrow", async (s) => taken.has(s))).toBe("arrow-3");
    expect(await uniqueSlug("Nova", async (s) => taken.has(s))).toBe("nova");
  });

  it("never allocates reserved slugs", async () => {
    expect(isValidSlug("www")).toBe(false);
    expect(isValidSlug("api")).toBe(false);
    expect(await uniqueSlug("admin", async () => false)).toBe("admin-app");
  });

  it("validates slug shape", () => {
    expect(isValidSlug("arrow")).toBe(true);
    expect(isValidSlug("arrow-2")).toBe(true);
    expect(isValidSlug("-arrow")).toBe(false);
    expect(isValidSlug("arrow-")).toBe(false);
    expect(isValidSlug("ar--row")).toBe(false);
    expect(isValidSlug("Arrow")).toBe(false);
    expect(isValidSlug("a.b")).toBe(false);
  });
});

describe("domains", () => {
  it("maps slug to {slug}.prismatic.com", () => {
    expect(getProjectDomain("arrow")).toBe("arrow.prismatic.com");
    expect(getProjectUrl("arrow")).toBe("https://arrow.prismatic.com");
  });

  it("extracts single-label slugs from hosts", () => {
    expect(slugFromHost("arrow.prismatic.com")).toBe("arrow");
    expect(slugFromHost("ARROW.prismatic.com:443")).toBe("arrow");
    expect(slugFromHost("prismatic.com")).toBeNull();
    expect(slugFromHost("a.b.prismatic.com")).toBeNull();
    expect(slugFromHost("arrow.evil.com")).toBeNull();
    expect(slugFromHost("arrow.prismatic.com.evil.com")).toBeNull();
  });
});

describe("project name inference", () => {
  it("uses the explicit name", () => {
    expect(inferProjectName("Create a modern crypto landing page called Arrow. Use a black background")).toBe("Arrow");
    expect(inferProjectName('Build a dashboard named "Pulse" with charts')).toBe("Pulse");
  });
  it("falls back to a short title", () => {
    expect(inferProjectName("Build a portfolio for a designer")).toBe("Portfolio");
  });
});
