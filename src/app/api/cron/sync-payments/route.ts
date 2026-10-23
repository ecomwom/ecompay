import { NextResponse, type NextRequest } from "next/server";

import { safeEqual } from "@/lib/crypto";
import { syncPendingOrders } from "@/modules/orders/application/sync-pending-orders";
import { getContainer } from "@/server/container";

export const dynamic = "force-dynamic";

/**
 * Scheduled safety net (Supabase pg_cron, see migrations): re-syncs open orders with
 * Confío. Authenticated with `Authorization: Bearer <CRON_SECRET>`.
 */
export async function POST(request: NextRequest) {
  const { env, orders, gateway } = getContainer();
  const token = /^Bearer\s+(.+)$/i.exec(request.headers.get("authorization") ?? "")?.[1]?.trim();
  if (!env.CRON_SECRET || !token || !safeEqual(token, env.CRON_SECRET)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await syncPendingOrders({ orders, gateway, logger: console });
  if (result.newlyPaid > 0 || result.failed > 0) console.info("[cron] sync-payments", result);
  return NextResponse.json(result);
}
