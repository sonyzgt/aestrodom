"use client";

import { useRef, useState } from "react";
import { ImageUp, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";

const ACCEPT = "image/png,image/jpeg,image/gif,image/webp";
const MAX_MB = 2;

/** Converts an ipfs:// URI to a gateway URL for display only. */
function displayUrl(value: string) {
  return value.startsWith("ipfs://") ? `https://gateway.pinata.cloud/ipfs/${value.slice(7)}` : value;
}

/**
 * Token logo picker: choose an image from your device, it is pinned to IPFS through the server
 * (Pinata), and the resulting IPFS reference becomes the token's on-chain logo.
 */
export function LogoUpload({ projectId, value, onChange }: { projectId: string; value: string; onChange: (v: string) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  async function upload(file: File) {
    setError(null);
    if (!ACCEPT.split(",").includes(file.type)) return setError("Use a PNG, JPG, GIF or WebP image.");
    if (file.size > MAX_MB * 1024 * 1024) return setError(`Image must be ${MAX_MB} MB or smaller.`);
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/projects/${projectId}/token/logo`, { method: "POST", body: form });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error ?? "Upload failed.");
      onChange(d.logo);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const f = e.dataTransfer.files?.[0];
          if (f) upload(f);
        }}
        className={cn("flex items-center gap-4 border border-dashed p-3 transition-colors", dragging ? "border-fg" : "border-border-strong")}
      >
        <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden border border-border bg-inset">
          {uploading ? (
            <Loader2 className="size-5 animate-spin text-muted" />
          ) : value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={displayUrl(value)} alt="Token logo" className="size-full object-cover" />
          ) : (
            <ImageUp className="size-5 text-subtle" />
          )}
        </div>
        <div className="min-w-0 flex-1 text-[13px]">
          {value ? (
            <>
              <div className="truncate font-mono text-[12px] text-fg" title={value}>{value}</div>
              <div className="mt-1 text-muted">Pinned to IPFS</div>
            </>
          ) : (
            <div className="text-muted">{uploading ? "Uploading to IPFS…" : "Drop an image here, or choose a file. PNG, JPG, GIF or WebP, up to 2 MB."}</div>
          )}
          <div className="mt-2 flex gap-3">
            <button type="button" onClick={() => input.current?.click()} disabled={uploading} className="link text-fg disabled:opacity-50">
              {value ? "Replace image" : "Choose image"}
            </button>
            {value && !uploading && (
              <button type="button" onClick={() => onChange("")} className="flex items-center gap-1 text-muted hover:text-fg">
                <X className="size-3.5" /> Remove
              </button>
            )}
          </div>
        </div>
        <input
          ref={input}
          type="file"
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) upload(f);
          }}
        />
      </div>
      {error && <p className="mt-2 text-[13px] text-danger">{error}</p>}
    </div>
  );
}
