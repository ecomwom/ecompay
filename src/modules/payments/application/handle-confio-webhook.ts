import { safeEqual } from "@/lib/crypto";
import { extractPaymentId } from "@/modules/payments/domain/payment";
import { verifyConfioChecksum } from "@/modules/payments/domain/webhook-signature";

export type WebhookRequest = {
  authorization: string | null;
  /** Optional alternative channels for the shared secret. */
  secretHeader: string | null;
  secretQuery: string | null;
  checksumHeader: string | null;
  rawBody: string;
};

export type WebhookResponse = { status: number; body: Record<string, unknown> };

export type HandleWebhookDeps = {
  webhookSecret: string;
  /** Re-fetches the payment from Confío and updates the matching order. */
  syncPayment: (paymentId: string) => Promise<{ ok: boolean; reason?: string }>;
  logger?: Pick<Console, "warn" | "error">;
};

const PAYMENT_EVENTS = new Set(["payment.statusChanged", "paymentAttempt.statusChanged"]);

function bearerToken(header: string | null): string | null {
  const match = header ? /^Bearer\s+(.+)$/i.exec(header.trim()) : null;
  return match ? match[1].trim() : null;
}

function isAuthorized(request: WebhookRequest, secret: string): boolean {
  const candidates = [bearerToken(request.authorization), request.secretHeader, request.secretQuery];
  // Evaluate every candidate so timing does not reveal which channel was used.
  return candidates
    .map((candidate) => (candidate ? safeEqual(candidate, secret) : false))
    .some(Boolean);
}

/**
 * Confío webhook handler. The body is treated as an untrusted hint: we only take the
 * payment id from it and re-fetch the payment from the Confío API before updating anything.
 */
export async function handleConfioWebhook(
  request: WebhookRequest,
  deps: HandleWebhookDeps,
): Promise<WebhookResponse> {
  if (!deps.webhookSecret || !isAuthorized(request, deps.webhookSecret)) {
    return { status: 401, body: { error: "unauthorized" } };
  }

  let payload: unknown;
  try {
    payload = JSON.parse(request.rawBody);
  } catch {
    return { status: 400, body: { error: "invalid_json" } };
  }
  if (typeof payload !== "object" || payload === null) {
    return { status: 400, body: { error: "invalid_payload" } };
  }

  const { event, data } = payload as { event?: unknown; data?: { name?: unknown } };
  if (typeof event !== "string" || !PAYMENT_EVENTS.has(event)) {
    return { status: 200, body: { ignored: true } };
  }

  const checksum = verifyConfioChecksum(
    payload as Parameters<typeof verifyConfioChecksum>[0],
    request.checksumHeader,
    deps.webhookSecret,
  );
  if (checksum === "invalid") {
    deps.logger?.warn("[webhook] Confío checksum mismatch (not enforced yet)", { event });
  }

  const paymentId = extractPaymentId(data?.name);
  if (!paymentId) {
    return { status: 400, body: { error: "missing_payment_id" } };
  }

  try {
    const result = await deps.syncPayment(paymentId);
    // Unknown orders are acknowledged so Confío does not retry forever.
    return { status: 200, body: { received: true, synced: result.ok } };
  } catch (error) {
    deps.logger?.error("[webhook] failed to sync payment", { paymentId, error });
    // 5xx so Confío retries later.
    return { status: 502, body: { error: "sync_failed" } };
  }
}
