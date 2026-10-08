import { NextResponse, type NextRequest } from "next/server";

import { syncOrderPayment } from "@/modules/orders/application/sync-order-payment";
import { handleConfioWebhook } from "@/modules/payments/application/handle-confio-webhook";
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

  return NextResponse.json(result.body, { status: result.status });
}
