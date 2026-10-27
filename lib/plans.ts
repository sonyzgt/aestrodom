import type { Plan } from "@prisma/client";

export interface PlanLimits {
  maxProjects: number;
  maxAiRequestsPerDay: number;
  maxProjectSizeBytes: number;
  maxAiTokensPerDay: number;
}

function n(name: string, fallback: number) {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

/** Limits are configuration, not code: every number can be overridden by env. */
export function planLimits(plan: Plan): PlanLimits {
  const tokens = n("MAX_AI_TOKENS_PER_DAY", 2_000_000);
  if (plan === "PRO") {
    return {
      maxProjects: n("PRO_MAX_PROJECTS_PER_USER", 50),
      maxAiRequestsPerDay: n("PRO_MAX_AI_REQUESTS_PER_DAY", 500),
      maxProjectSizeBytes: n("PRO_MAX_PROJECT_SIZE_MB", 5120) * 1024 * 1024,
      maxAiTokensPerDay: n("PRO_MAX_AI_TOKENS_PER_DAY", tokens * 10),
    };
  }
  return {
    maxProjects: n("MAX_PROJECTS_PER_USER", 5),
    maxAiRequestsPerDay: n("MAX_AI_REQUESTS_PER_DAY", 20),
    maxProjectSizeBytes: n("MAX_PROJECT_SIZE_MB", 100) * 1024 * 1024,
    maxAiTokensPerDay: tokens,
  };
}
