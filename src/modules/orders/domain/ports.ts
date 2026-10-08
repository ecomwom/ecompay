import type { NewOrder, Order, OrderStatus } from "./order";

export type PaymentSnapshot = {
  confioPaymentId: string;
  confioStatus: string;
  status: OrderStatus;
  checkoutUrl?: string;
};

/** Thrown by `create` when another order already uses the same checkout token. */
export class CheckoutTokenConflictError extends Error {
  override name = "CheckoutTokenConflictError";
}

export interface OrderRepository {
  create(order: NewOrder): Promise<Order>;
  findById(id: string): Promise<Order | null>;
  findByCheckoutToken(checkoutToken: string): Promise<Order | null>;
  findByPaymentId(confioPaymentId: string): Promise<Order | null>;
  listByProduct(productId: string): Promise<Order[]>;
  applyPayment(orderId: string, snapshot: PaymentSnapshot): Promise<Order>;
  markFailed(orderId: string): Promise<void>;
}
