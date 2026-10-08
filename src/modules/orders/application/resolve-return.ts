import { buyerOutcome, type BuyerOutcome, type Order } from "@/modules/orders/domain/order";
import type { OrderRepository } from "@/modules/orders/domain/ports";
import { extractPaymentId, type PaymentGateway } from "@/modules/payments/domain/payment";

import { syncOrderPayment } from "./sync-order-payment";
import { isUuid } from "@/lib/uuid";

export type ResolveReturnInput = {
  productId: string;
  /** Untrusted query params appended by Confío to redirectUri. */
  paymentId?: string;
  correlationId?: string;
};

export type ResolveReturnResult = { outcome: BuyerOutcome | "unknown"; order: Order | null };

export type ResolveReturnDeps = {
  orders: OrderRepository;
  gateway: Pick<PaymentGateway, "getPayment">;
  logger?: Pick<Console, "warn" | "error">;
};

/**
 * Handles the buyer coming back from Confío. Query params are only used to locate the
 * payment; the status shown always comes from a server-side GET to Confío.
 */
export async function resolveReturn(
  input: ResolveReturnInput,
  deps: ResolveReturnDeps,
): Promise<ResolveReturnResult> {
  let paymentId = extractPaymentId(input.paymentId);
  let fallbackOrder: Order | null = null;

  if (!paymentId && isUuid(input.correlationId)) {
    fallbackOrder = await deps.orders.findById(input.correlationId);
    paymentId = fallbackOrder?.confioPaymentId ?? null;
  }
  if (!paymentId) return { outcome: "unknown", order: null };

  try {
    const synced = await syncOrderPayment(paymentId, deps);
    if (!synced.ok || synced.order.productId !== input.productId) {
      return { outcome: "unknown", order: null };
    }
    return { outcome: buyerOutcome(synced.order.status), order: synced.order };
  } catch (error) {
    deps.logger?.error("[return] could not confirm payment with Confío", { paymentId, error });
    // Confío unavailable: never assume success; the webhook will update the order later.
    const order = fallbackOrder?.productId === input.productId ? fallbackOrder : null;
    return { outcome: order?.status === "PAID" ? "success" : "pending", order };
  }
}
