import { NextResponse } from "next/server";
import { requireProject, requireUser, route } from "@/lib/api";
import { ensureWorkingCopy, listFiles, readFile } from "@/lib/projects/filesystem";

export const runtime = "nodejs";

/**
 * GET /api/projects/:id/files           -> file tree
 * GET /api/projects/:id/files?path=...  -> one file's contents (read-only code view)
 * Paths are validated and confined to the project root by the filesystem layer.
 */
export const GET = route<{ id: string }>(async (req, { params }) => {
  const user = await requireUser();
  const project = await requireProject((await params).id, user.id);
  await ensureWorkingCopy(project.id);
  const path = new URL(req.url).searchParams.get("path");
  if (path) {
    const content = await readFile(project.id, path);
    return NextResponse.json({ path, content });
  }
  return NextResponse.json({ files: await listFiles(project.id) });
});
