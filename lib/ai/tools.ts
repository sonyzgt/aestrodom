import "server-only";
import { z } from "zod";
import type { BetaTool } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import * as fsx from "@/lib/projects/filesystem";
import { PathError, assertWritablePath, normalizeProjectPath } from "@/lib/projects/paths";
import { formatFileTree } from "./context";

/**
 * The structured operations Claude may perform. Every tool input is validated with Zod and every
 * path is normalized/confined by the filesystem layer before anything touches disk; Claude output
 * is never executed or applied blindly.
 */
export type FileOperation =
  | { type: "write"; path: string; created: boolean }
  | { type: "edit"; path: string }
  | { type: "delete"; path: string }
  | { type: "rename"; from: string; to: string };

const schemas = {
  list_files: z.object({}).strict(),
  read_file: z.object({ path: z.string().min(1).max(200) }).strict(),
  write_file: z.object({ path: z.string().min(1).max(200), content: z.string().max(512 * 1024) }).strict(),
  edit_file: z
    .object({
      path: z.string().min(1).max(200),
      old_string: z.string().min(1).max(200_000),
      new_string: z.string().max(200_000),
      replace_all: z.boolean().optional(),
    })
    .strict(),
  delete_file: z.object({ path: z.string().min(1).max(200) }).strict(),
  rename_file: z.object({ from: z.string().min(1).max(200), to: z.string().min(1).max(200) }).strict(),
  run_build: z.object({}).strict(),
};

export type ToolName = keyof typeof schemas;

const pathProp = { type: "string", description: "Project-relative POSIX path, e.g. src/components/Hero.tsx" } as const;

export const TOOL_DEFINITIONS: BetaTool[] = [
  {
    name: "list_files",
    description: "List every file in the project with its size.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "read_file",
    description: "Read the full contents of one project file.",
    input_schema: { type: "object", properties: { path: pathProp }, required: ["path"], additionalProperties: false },
  },
  {
    name: "write_file",
    description:
      "Create a file or replace its entire contents. Parent directories are created automatically. Use for new files or near-total rewrites; prefer edit_file for targeted changes.",
    eager_input_streaming: true,
    input_schema: {
      type: "object",
      properties: { path: pathProp, content: { type: "string", description: "Complete file contents" } },
      required: ["path", "content"],
      additionalProperties: false,
    },
  },
  {
    name: "edit_file",
    description:
      "Replace an exact, unique snippet of an existing file. old_string must match the current file exactly (including whitespace) and occur once unless replace_all is true.",
    eager_input_streaming: true,
    input_schema: {
      type: "object",
      properties: {
        path: pathProp,
        old_string: { type: "string" },
        new_string: { type: "string" },
        replace_all: { type: "boolean" },
      },
      required: ["path", "old_string", "new_string"],
      additionalProperties: false,
    },
  },
  {
    name: "delete_file",
    description: "Delete a project file.",
    input_schema: { type: "object", properties: { path: pathProp }, required: ["path"], additionalProperties: false },
  },
  {
    name: "rename_file",
    description: "Move or rename a project file. Update imports that reference it separately.",
    input_schema: {
      type: "object",
      properties: { from: pathProp, to: pathProp },
      required: ["from", "to"],
      additionalProperties: false,
    },
  },
  {
    name: "run_build",
    description:
      "Type-check and build the project in its sandbox, refreshing the live preview on success. Returns compiler/bundler errors on failure.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
];

export interface ToolContext {
  projectId: string;
  maxProjectSizeBytes: number;
  runBuild: () => Promise<{ ok: boolean; errors: string }>;
}

export interface ToolOutcome {
  content: string;
  isError: boolean;
  operation?: FileOperation;
  /** Short human label for the chat activity feed. */
  label: string;
  built?: { ok: boolean };
}

export function parseToolInput(name: string, input: unknown): { ok: true; name: ToolName; data: unknown } | { ok: false; error: string } {
  if (!(name in schemas)) return { ok: false, error: `Unknown tool: ${name}` };
  const parsed = schemas[name as ToolName].safeParse(input);
  if (!parsed.success) return { ok: false, error: `INVALID_INPUT: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}` };
  return { ok: true, name: name as ToolName, data: parsed.data };
}

export async function executeTool(name: string, input: unknown, ctx: ToolContext): Promise<ToolOutcome> {
  const parsed = parseToolInput(name, input);
  if (!parsed.ok) return { content: parsed.error, isError: true, label: `Rejected ${name}` };
  try {
    switch (parsed.name) {
      case "list_files": {
        const files = await fsx.listFiles(ctx.projectId);
        return { content: formatFileTree(files) || "(empty)", isError: false, label: "Inspected project files" };
      }
      case "read_file": {
        const { path } = parsed.data as z.infer<typeof schemas.read_file>;
        const p = normalizeProjectPath(path);
        if (!(await fsx.exists(ctx.projectId, p))) return { content: `File not found: ${p}`, isError: true, label: `Read ${p}` };
        return { content: await fsx.readFile(ctx.projectId, p), isError: false, label: `Read ${p}` };
      }
      case "write_file": {
        const { path, content } = parsed.data as z.infer<typeof schemas.write_file>;
        const res = await fsx.writeFile(ctx.projectId, path, content, { maxProjectSizeBytes: ctx.maxProjectSizeBytes });
        return {
          content: `${res.created ? "Created" : "Wrote"} ${res.path} (${Buffer.byteLength(content)} bytes)`,
          isError: false,
          operation: { type: "write", path: res.path, created: res.created },
          label: `${res.created ? "Created" : "Updated"} ${res.path}`,
        };
      }
      case "edit_file": {
        const { path, old_string, new_string, replace_all } = parsed.data as z.infer<typeof schemas.edit_file>;
        const p = assertWritablePath(path);
        if (!(await fsx.exists(ctx.projectId, p))) return { content: `File not found: ${p}`, isError: true, label: `Edit ${p}` };
        const current = await fsx.readFile(ctx.projectId, p);
        const count = current.split(old_string).length - 1;
        if (count === 0) return { content: `old_string not found in ${p}. Read the file and retry with an exact snippet.`, isError: true, label: `Edit ${p}` };
        if (count > 1 && !replace_all) return { content: `old_string occurs ${count} times in ${p}; add surrounding context or set replace_all.`, isError: true, label: `Edit ${p}` };
        const next = replace_all ? current.split(old_string).join(new_string) : current.replace(old_string, () => new_string);
        await fsx.writeFile(ctx.projectId, p, next, { maxProjectSizeBytes: ctx.maxProjectSizeBytes });
        return { content: `Edited ${p} (${replace_all ? count : 1} replacement${count > 1 && replace_all ? "s" : ""})`, isError: false, operation: { type: "edit", path: p }, label: `Edited ${p}` };
      }
      case "delete_file": {
        const { path } = parsed.data as z.infer<typeof schemas.delete_file>;
        const p = assertWritablePath(path);
        if (!(await fsx.exists(ctx.projectId, p))) return { content: `File not found: ${p}`, isError: true, label: `Delete ${p}` };
        await fsx.deleteFile(ctx.projectId, p);
        return { content: `Deleted ${p}`, isError: false, operation: { type: "delete", path: p }, label: `Deleted ${p}` };
      }
      case "rename_file": {
        const { from, to } = parsed.data as z.infer<typeof schemas.rename_file>;
        const src = assertWritablePath(from);
        const dst = assertWritablePath(to);
        if (!(await fsx.exists(ctx.projectId, src))) return { content: `File not found: ${src}`, isError: true, label: `Rename ${src}` };
        await fsx.renameFile(ctx.projectId, src, dst);
        return { content: `Renamed ${src} -> ${dst}`, isError: false, operation: { type: "rename", from: src, to: dst }, label: `Renamed ${src} → ${dst}` };
      }
      case "run_build": {
        const res = await ctx.runBuild();
        return {
          content: res.ok ? "Build succeeded. The preview has been updated." : `Build failed:\n${res.errors.slice(0, 8000)}`,
          isError: !res.ok,
          label: res.ok ? "Build succeeded" : "Build failed",
          built: { ok: res.ok },
        };
      }
    }
  } catch (err) {
    if (err instanceof PathError) return { content: err.message, isError: true, label: `Rejected ${name}` };
    throw err;
  }
}
