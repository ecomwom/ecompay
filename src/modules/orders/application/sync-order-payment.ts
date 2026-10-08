import type { Order } from "@/modules/orders/domain/order";
import type { OrderRepository } from "@/modules/orders/domain/ports";
import { mapConfioStatus, type PaymentGateway } from "@/modules/payments/domain/payment";
import { isUuid } from "@/lib/uuid";

export type SyncOrderPaymentDeps = {
  orders: OrderRepository;
  gateway: Pick<PaymentGateway, "getPayment">;
  logger?: Pick<Console, "warn">;
};

export type SyncOrderPaymentResult =
  | { ok: true; order: Order }
  | { ok: false; reason: "order_not_found" | "mismatch" };

/**
 * Source of truth for payment state: always re-fetches the payment from Confío
 * (never trusts redirect query params or webhook bodies) and updates the order.
 */
export async function syncOrderPayment(
  paymentId: string,
  deps: SyncOrderPaymentDeps,
): Promise<SyncOrderPaymentResult> {
  const payment = await deps.gateway.getPayment(paymentId);

  const byCorrelation =
    isUuid(payment.correlationId)
      ? await deps.orders.findById(payment.correlationId)
      : null;
  const order = byCorrelation ?? (await deps.orders.findByPaymentId(payment.id));
  if (!order) return { ok: false, reason: "order_not_found" };

  // The payment must belong to this order and match the amount we charged.
  const paymentMismatch = order.confioPaymentId !== null && order.confioPaymentId !== payment.id;
  const amountMismatch =
    payment.amountCents !== order.amountCents || payment.currencyCode !== order.currency;
  if (paymentMismatch || amountMismatch) {
    deps.logger?.warn("[payments] Confío payment does not match order", {
      orderId: order.id,
      paymentId: payment.id,
      paymentMismatch,
      amountMismatch,
    });
    return { ok: false, reason: "mismatch" };
  }

  const updated = await deps.orders.applyPayment(order.id, {
    confioPaymentId: payment.id,
    confioStatus: payment.status,
    status: mapConfioStatus(payment.status) ?? order.status,
  });
  return { ok: true, order: updated };
}
