import type { SkillId } from "@/lib/skills";

export interface BuilderProject {
  id: string;
  name: string;
  slug: string;
  description: string;
  status: "CREATING" | "READY" | "BUILDING" | "DEPLOYED" | "ERROR";
  previewUrl: string | null;
  deploymentUrl: string | null;
  domain: string;
  logoUrl: string | null;
  skills: SkillId[];
}

export interface ChatActivity {
  id: string;
  label: string;
  status: "running" | "done" | "error";
}

export interface ChatMessage {
  id: string;
  role: "USER" | "ASSISTANT";
  content: string;
  activity?: ChatActivity[];
  build?: { status: "running" | "ok" | "failed" | "unavailable"; attempt?: number };
  status?: string;
  error?: boolean;
  pending?: boolean;
}

export type AgentEvent =
  | { type: "status"; message: string }
  | { type: "text"; delta: string }
  | { type: "tool"; id: string; name: string; status: "running" | "done" | "error"; label?: string }
  | { type: "build"; status: "running" | "ok" | "failed" | "unavailable"; attempt?: number; errors?: string }
  | { type: "preview"; url: string | null }
  | { type: "done"; messageId: string; summary: string; buildOk: boolean | null }
  | { type: "error"; message: string };

export const TOOL_LABELS: Record<string, string> = {
  list_files: "Inspecting project",
  read_file: "Reading file",
  write_file: "Writing file",
  edit_file: "Editing file",
  delete_file: "Deleting file",
  rename_file: "Renaming file",
  run_build: "Building application",
};
