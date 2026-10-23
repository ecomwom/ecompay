import type { OrderStatus } from "@/modules/orders/domain/order";

import { syncOrderPayment, type SyncOrderPaymentDeps } from "./sync-order-payment";

/** Statuses that Confío may still move forward (e.g. a buyer paid but never came back). */
const OPEN_STATUSES: ReadonlySet<OrderStatus> = new Set(["PENDING", "UNDER_REVIEW"]);

export type SyncPendingOrdersResult = {
  checked: number;
  /** Orders whose status changed to PAID. */
  newlyPaid: number;
  failed: number;
};

/**
 * Re-fetches every open order's payment from Confío and updates it. Safety net for
 * webhooks that never arrived (or were rejected) and buyers who closed the tab after paying.
 */
export async function syncPendingOrders(
  deps: SyncOrderPaymentDeps & { logger?: Pick<Console, "warn" | "error"> },
  concurrency = 5,
): Promise<SyncPendingOrdersResult> {
  const open = (await deps.orders.list()).filter((o) => OPEN_STATUSES.has(o.status) && o.confioPaymentId);
  const result: SyncPendingOrdersResult = { checked: open.length, newlyPaid: 0, failed: 0 };

  let next = 0;
  async function worker() {
    while (next < open.length) {
      const order = open[next++];
      try {
        const synced = await syncOrderPayment(order.confioPaymentId!, deps);
        if (!synced.ok) result.failed++;
        else if (synced.order.status === "PAID") result.newlyPaid++;
      } catch (error) {
        result.failed++;
        deps.logger?.error("[sync] failed to sync order", { orderId: order.id, error });
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, open.length) }, worker));
  return result;
}
