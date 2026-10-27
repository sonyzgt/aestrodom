import { describe, expect, it } from "vitest";
import { PathError, assertWritablePath, normalizeProjectPath } from "@/lib/projects/paths";

describe("project path validation", () => {
  it.each([
    "../secret",
    "../../etc/passwd",
    "../../../root/.ssh/id_rsa",
    "src/../../x.ts",
    "src/./x.ts",
    "/etc/passwd",
    "/root/x",
    "/var/run/docker.sock",
    "C:/Windows/system32",
    "c:\\boot.ini",
    "src\\..\\x.ts",
    "~/x",
    "src//x.ts",
    "",
    "src/x\u0000.ts",
    "node_modules/react/index.js",
    "dist/index.html",
    ".git/config",
    ".env",
    ".env.local",
    ".prismatic/state",
  ])("rejects %j", (p) => {
    expect(() => normalizeProjectPath(p)).toThrow(PathError);
  });

  it.each([
    ["src/App.tsx", "src/App.tsx"],
    ["./src/index.css", "src/index.css"],
    ["public/favicon.svg", "public/favicon.svg"],
    ["src/components/Hero.tsx", "src/components/Hero.tsx"],
  ])("accepts %j", (input, out) => {
    expect(normalizeProjectPath(input)).toBe(out);
  });

  it("rejects overly long paths", () => {
    expect(() => normalizeProjectPath("a/".repeat(150) + "x.ts")).toThrow(PathError);
  });

  it("protects platform-managed toolchain files from writes", () => {
    expect(() => assertWritablePath("package.json")).toThrow(/managed by Aestrodom/);
    expect(() => assertWritablePath("vite.config.ts")).toThrow(PathError);
    expect(() => assertWritablePath("tsconfig.json")).toThrow(PathError);
    expect(normalizeProjectPath("package.json")).toBe("package.json"); // still readable
  });

  it("only allows text source/asset extensions to be written", () => {
    expect(() => assertWritablePath("src/run.sh")).toThrow(/not allowed/);
    expect(() => assertWritablePath("public/x.exe")).toThrow(PathError);
    expect(() => assertWritablePath("Dockerfile")).toThrow(PathError);
    expect(assertWritablePath("src/components/Pricing.tsx")).toBe("src/components/Pricing.tsx");
  });
});
