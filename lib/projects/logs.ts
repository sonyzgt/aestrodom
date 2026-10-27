import "server-only";
import type { LogLevel, LogSource } from "@prisma/client";
import { prisma } from "@/lib/db";
import { redact } from "@/lib/logger";

const MAX_LOG_CHARS = 4000;

/** Appends a line to the project console (build/runtime/deploy logs shown in the builder). */
export async function addLog(projectId: string, source: LogSource, level: LogLevel, message: string) {
  const clean = String(redact(message)).slice(0, MAX_LOG_CHARS);
  await prisma.projectLog.create({ data: { projectId, source, level, message: clean } }).catch(() => undefined);
}

export async function recentLogs(projectId: string, take = 200) {
  const rows = await prisma.projectLog.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    take,
    select: { id: true, source: true, level: true, message: true, createdAt: true },
  });
  return rows.reverse();
}
