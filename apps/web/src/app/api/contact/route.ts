import { callExpress } from "@/lib/auth/express";
import {
  jsonError,
  jsonSuccess,
  readJson,
  untrustedResponse,
} from "@/lib/auth/http";

export const dynamic = "force-dynamic";

const INVALID = "Check the name, phone, email, and message, then try again.";
const UNAVAILABLE = "We could not send your message. Please try again.";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function field(value: unknown, max: number): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > max) {
    return null;
  }
  return trimmed;
}

function parseContact(body: unknown):
  | {
      ok: true;
      value: { name: string; phone: string; email: string; message: string };
    }
  | { ok: false } {
  if (!isRecord(body)) {
    return { ok: false };
  }

  const name = field(body.name, 120);
  const phone = field(body.phone, 30);
  const email = field(body.email, 255);
  const message = field(body.message, 5000);
  if (!name || !phone || phone.length < 3 || !email || !message) {
    return { ok: false };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false };
  }

  return { ok: true, value: { name, phone, email, message } };
}

export async function POST(request: Request) {
  const rejected = untrustedResponse(request);
  if (rejected) {
    return rejected;
  }

  const body = await readJson(request);
  if (body === "invalid") {
    return jsonError(400, INVALID);
  }

  const parsed = parseContact(body);
  if (!parsed.ok) {
    return jsonError(400, INVALID);
  }

  const result = await callExpress("/api/v1/contact", {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
    },
    body: JSON.stringify(parsed.value),
  });

  if (result.kind === "unreachable") {
    return jsonError(503, UNAVAILABLE);
  }
  if (result.kind !== "ok") {
    return jsonError(
      result.status >= 400 && result.status < 500 ? 400 : 502,
      UNAVAILABLE,
    );
  }

  return jsonSuccess(201, { sent: true });
}
