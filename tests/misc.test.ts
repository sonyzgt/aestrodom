import { describe, expect, it } from "vitest";
import { createMemoryLimiter } from "@/lib/rate-limit";
import { redact } from "@/lib/logger";
import { parseBuildOutput } from "@/lib/runtime/build";
import { parseToolInput } from "@/lib/ai/tools";
import { planLimits } from "@/lib/plans";

describe("rate limiter", () => {
  it("blocks after the limit within a window", async () => {
    const limit = createMemoryLimiter();
    const opts = { limit: 3, windowSec: 60 };
    const results = [];
    for (let i = 0; i < 5; i++) results.push((await limit("k", opts)).ok);
    expect(results).toEqual([true, true, true, false, false]);
    expect((await limit("other", opts)).ok).toBe(true);
  });
});

describe("log redaction", () => {
  it("never logs secrets", () => {
    const out = JSON.stringify(
      redact({
        userId: "u1",
        password: "hunter2",
        apiKey: "x",
        privateKey: "0xabc",
        mnemonic: "word word",
        nested: { authorization: "Bearer t", note: "key sk-ant-api03-abcdefghijklmnop and postgresql://u:p@h/db" },
        transactionHash: "0x" + "a".repeat(64),
      }),
    );
    expect(out).not.toContain("hunter2");
    expect(out).not.toContain("sk-ant-api03");
    expect(out).not.toContain("u:p@h");
    expect(out).not.toContain("Bearer t");
    expect(out).not.toContain("word word");
    expect(out).toContain("u1");
    expect(out).toContain("a".repeat(64)); // tx hashes are fine to log
  });
});

describe("build output protocol", () => {
  it("parses steps, errors and completion", () => {
    const out = [
      JSON.stringify({ kind: "step", message: "Type-checking" }),
      "some warning",
      JSON.stringify({ kind: "error", message: "src/App.tsx(3,1): error TS2304" }),
    ].join("\n");
    expect(parseBuildOutput(out)).toEqual({ steps: ["Type-checking"], errors: ["src/App.tsx(3,1): error TS2304"], done: false });
    expect(parseBuildOutput(JSON.stringify({ kind: "done", message: "ok" })).done).toBe(true);
  });
});

describe("structured Claude operations are validated", () => {
  it("rejects unknown tools and malformed inputs", () => {
    expect(parseToolInput("exec_shell", { cmd: "rm -rf /" }).ok).toBe(false);
    expect(parseToolInput("write_file", { path: "src/a.tsx" }).ok).toBe(false);
    expect(parseToolInput("write_file", { path: "src/a.tsx", content: "x", extra: 1 }).ok).toBe(false);
    expect(parseToolInput("write_file", { path: "src/a.tsx", content: "x".repeat(600 * 1024) }).ok).toBe(false);
    expect(parseToolInput("write_file", { path: "src/a.tsx", content: "ok" }).ok).toBe(true);
    expect(parseToolInput("rename_file", { from: "a.ts", to: "b.ts" }).ok).toBe(true);
  });
});

describe("plans", () => {
  it("reads limits from env with sane defaults", () => {
    process.env.MAX_PROJECTS_PER_USER = "7";
    expect(planLimits("FREE").maxProjects).toBe(7);
    expect(planLimits("FREE").maxAiRequestsPerDay).toBe(20);
    expect(planLimits("PRO").maxProjects).toBe(50);
    delete process.env.MAX_PROJECTS_PER_USER;
  });
});
