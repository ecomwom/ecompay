import { NextResponse, type NextRequest } from "next/server";

import { syncOrderPayment } from "@/modules/orders/application/sync-order-payment";
import { sha256HexUpper } from "@/lib/crypto";
import { handleConfioWebhook } from "@/modules/payments/application/handle-confio-webhook";
import { verifyConfioChecksum } from "@/modules/payments/domain/webhook-signature";
import { getContainer } from "@/server/container";

export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 64 * 1024;

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  if (rawBody.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "payload_too_large" }, { status: 413 });
  }

  const container = getContainer();
  const result = await handleConfioWebhook(
    {
      authorization: request.headers.get("authorization"),
      secretHeader: request.headers.get("x-webhook-secret"),
      secretQuery: request.nextUrl.searchParams.get("secret"),
      checksumHeader: request.headers.get("x-confio-checksum"),
      rawBody,
    },
    {
      webhookSecret: container.env.CONFIO_WEBHOOK_SECRET,
      syncPayment: (paymentId) =>
        syncOrderPayment(paymentId, {
          orders: container.orders,
          gateway: container.gateway,
          logger: console,
        }),
      logger: console,
    },
  );

  if (result.status === 401) {
    // Diagnostics only, never secret values: which auth channels Confío used, token lengths,
    // 8-char SHA-256 fingerprints, and whether the body checksum matches our key.
    const authorization = request.headers.get("authorization");
    const token = authorization?.replace(/^Bearer\s+/i, "").trim() ?? null;
    const payload = safeParse(rawBody);
    console.warn("[webhook] unauthorized Confío request", {
      headerNames: [...request.headers.keys()].sort(),
      authScheme: authorization?.split(" ")[0] ?? null,
      queryKeys: [...request.nextUrl.searchParams.keys()],
      bodyKeys: payload && typeof payload === "object" ? Object.keys(payload) : null,
      tokenLength: token?.length ?? null,
      expectedLength: container.env.CONFIO_WEBHOOK_SECRET.length,
      tokenFingerprint: token ? fingerprint(token) : null,
      expectedFingerprint: fingerprint(container.env.CONFIO_WEBHOOK_SECRET),
      tokenIsApiAccessToken: token === container.env.CONFIO_ACCESS_TOKEN,
      checksumWithOurKey:
        payload && typeof payload === "object"
          ? verifyConfioChecksum(
              payload as Parameters<typeof verifyConfioChecksum>[0],
              request.headers.get("x-confio-checksum"),
              container.env.CONFIO_WEBHOOK_SECRET,
            )
          : null,
    });
  }

  return NextResponse.json(result.body, { status: result.status });
}

function safeParse(rawBody: string): unknown {
  try {
    return JSON.parse(rawBody);
  } catch {
    return null;
  }
}

function fingerprint(value: string): string {
  return sha256HexUpper(value).slice(0, 8);
}
