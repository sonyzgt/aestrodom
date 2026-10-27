/**
 * Structured JSON logger with secret redaction.
 * Callers must never pass secrets on purpose; redaction is a second line of defence.
 */
const SECRET_KEY = /pass(word)?|secret|api[-_]?key|authorization|cookie|private[-_]?key|mnemonic|seed|database[-_]?url|^token$|access[-_]?token|session/i;
const SECRET_VALUES: RegExp[] = [/sk-ant-[A-Za-z0-9_-]{10,}/g, /postgres(ql)?:\/\/[^\s"']+/g, /redis(s)?:\/\/[^\s"']+/g];

export function redact(value: unknown, depth = 0): unknown {
  if (depth > 6) return "[depth]";
  if (typeof value === "string") {
    let out = value;
    for (const re of SECRET_VALUES) out = out.replace(re, "[redacted]");
    return out;
  }
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = SECRET_KEY.test(k) ? "[redacted]" : redact(v, depth + 1);
    }
    return out;
  }
  return value;
}

type Fields = Record<string, unknown>;

function emit(level: "info" | "warn" | "error", event: string, fields: Fields = {}) {
  const line = JSON.stringify({ ts: new Date().toISOString(), level, event, ...(redact(fields) as Fields) });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const log = {
  info: (event: string, fields?: Fields) => emit("info", event, fields),
  warn: (event: string, fields?: Fields) => emit("warn", event, fields),
  error: (event: string, fields?: Fields) => emit("error", event, fields),
};

export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}
