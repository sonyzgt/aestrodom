import { NextResponse } from "next/server";
import { ApiError, enforceRateLimit, requireProject, requireUser, route } from "@/lib/api";
import { PinataError, ipfsGatewayUrl, pinFile, pinataConfigured, sniffImage } from "@/lib/storage/pinata";
import { addLog } from "@/lib/projects/logs";
import { log, errorMessage } from "@/lib/logger";

export const runtime = "nodejs";

const MAX_BYTES = Math.round(Number(process.env.TOKEN_LOGO_MAX_MB || 2) * 1024 * 1024);

/**
 * POST /api/projects/:id/token/logo (multipart, field "file")
 * Pins the token logo to IPFS via Pinata and returns its ipfs:// URI for the launch params.
 */
export const POST = route<{ id: string }>(async (req, { params }) => {
  const user = await requireUser();
  const project = await requireProject((await params).id, user.id);
  await enforceRateLimit(`token:logo:${user.id}`, { limit: 10, windowSec: 600 });
  if (!pinataConfigured()) throw new ApiError(503, "Image uploads are not configured on this server.");

  const declared = Number(req.headers.get("content-length") || 0);
  if (declared > MAX_BYTES + 64 * 1024) throw new ApiError(413, `Image must be ${MAX_BYTES / 1024 / 1024} MB or smaller.`);

  let file: File | null = null;
  try {
    const form = await req.formData();
    const f = form.get("file");
    file = f instanceof File ? f : null;
  } catch {
    throw new ApiError(400, "Upload an image file.");
  }
  if (!file || file.size === 0) throw new ApiError(400, "Upload an image file.");
  if (file.size > MAX_BYTES) throw new ApiError(413, `Image must be ${MAX_BYTES / 1024 / 1024} MB or smaller.`);

  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = sniffImage(bytes);
  if (!kind) throw new ApiError(415, "Use a PNG, JPG, GIF or WebP image.");

  try {
    const { cid } = await pinFile(bytes, `${project.slug}-logo.${kind.ext}`, kind.mime, { project: project.id });
    await addLog(project.id, "TOKEN", "INFO", `Token logo pinned to IPFS: ${cid}`);
    log.info("token.logo.pinned", { userId: user.id, projectId: project.id, cid, bytes: bytes.byteLength });
    // ipfs:// is the format the Pons V2 docs use for TokenParams.logo; the gateway URL is for display.
    return NextResponse.json({ cid, logo: `ipfs://${cid}`, gatewayUrl: ipfsGatewayUrl(cid) });
  } catch (err) {
    log.error("token.logo.pin_failed", { projectId: project.id, error: errorMessage(err) });
    throw new ApiError(502, err instanceof PinataError ? err.message : "Could not upload the image. Try again.");
  }
});
