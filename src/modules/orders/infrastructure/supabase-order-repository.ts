import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { canTransitionOrderStatus } from "@/modules/orders/domain/order";
import type { NewOrder, Order, OrderAnswer, OrderStatus } from "@/modules/orders/domain/order";
import { CheckoutTokenConflictError, type OrderRepository, type PaymentSnapshot } from "@/modules/orders/domain/ports";

type OrderRow = {
  id: string;
  product_id: string;
  buyer_first_name: string;
  buyer_phone: string;
  answers: unknown;
  amount_cents: number | string;
  currency: "COP";
  confio_payment_id: string | null;
  confio_status: string | null;
  checkout_url: string | null;
  status: OrderStatus;
  created_at: string;
  updated_at: string;
};

const ORDER_COLUMNS =
  "id, product_id, buyer_first_name, buyer_phone, answers, amount_cents, currency, confio_payment_id, confio_status, checkout_url, status, created_at, updated_at";

function toOrder(row: OrderRow): Order {
  return {
    id: row.id,
    productId: row.product_id,
    buyerFirstName: row.buyer_first_name,
    buyerPhone: row.buyer_phone,
    answers: Array.isArray(row.answers) ? (row.answers as OrderAnswer[]) : [],
    amountCents: Number(row.amount_cents),
    currency: row.currency,
    confioPaymentId: row.confio_payment_id,
    confioStatus: row.confio_status,
    checkoutUrl: row.checkout_url,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class SupabaseOrderRepository implements OrderRepository {
  constructor(private readonly db: SupabaseClient) {}

  async create(order: NewOrder): Promise<Order> {
    const { data, error } = await this.db
      .from("orders")
      .insert({
        id: order.id,
        product_id: order.productId,
        buyer_first_name: order.buyerFirstName,
        buyer_phone: order.buyerPhone,
        answers: order.answers,
        amount_cents: order.amountCents,
        status: "PENDING",
        checkout_token: order.checkoutToken ?? null,
      })
      .select(ORDER_COLUMNS)
      .single();
    if (error?.code === "23505" && error.message.includes("checkout_token")) {
      throw new CheckoutTokenConflictError(error.message);
    }
    if (error) throw error;
    return toOrder(data as OrderRow);
  }

  async findById(id: string): Promise<Order | null> {
    return this.findOne("id", id);
  }

  async findByPaymentId(confioPaymentId: string): Promise<Order | null> {
    return this.findOne("confio_payment_id", confioPaymentId);
  }

  async findByCheckoutToken(checkoutToken: string): Promise<Order | null> {
    return this.findOne("checkout_token", checkoutToken);
  }

  async listByProduct(productId: string): Promise<Order[]> {
    const { data, error } = await this.db
      .from("orders")
      .select(ORDER_COLUMNS)
      .eq("product_id", productId)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw error;
    return (data as OrderRow[]).map(toOrder);
  }

  /**
   * Compare-and-set on `status` so a stale snapshot never regresses the order (see
   * canTransitionOrderStatus); retries once on a concurrent change. When the status
   * write is skipped, only backfills payment id / checkout url if still null.
   */
  async applyPayment(orderId: string, snapshot: PaymentSnapshot): Promise<Order> {
    for (let attempt = 0; ; attempt++) {
      const current = await this.findById(orderId);
      if (!current) throw new Error(`Order ${orderId} not found`);
      const allowed = attempt < 2 && canTransitionOrderStatus(current.status, snapshot.status);
      const patch = allowed
        ? {
            confio_payment_id: snapshot.confioPaymentId,
            confio_status: snapshot.confioStatus,
            status: snapshot.status,
            ...(snapshot.checkoutUrl ? { checkout_url: snapshot.checkoutUrl } : {}),
          }
        : {
            ...(current.confioPaymentId ? {} : { confio_payment_id: snapshot.confioPaymentId }),
            ...(current.checkoutUrl || !snapshot.checkoutUrl ? {} : { checkout_url: snapshot.checkoutUrl }),
          };
      if (Object.keys(patch).length === 0) return current;
      const { data, error } = await this.db
        .from("orders")
        .update(patch)
        .eq("id", orderId)
        .eq("status", current.status)
        .select(ORDER_COLUMNS)
        .maybeSingle();
      if (error) throw error;
      if (data) return toOrder(data as OrderRow);
      if (!allowed) return current;
    }
  }

  async markFailed(orderId: string): Promise<void> {
    const { error } = await this.db
      .from("orders")
      .update({ status: "FAILED" })
      .eq("id", orderId)
      .is("confio_payment_id", null);
    if (error) throw error;
  }

  private async findOne(column: "id" | "confio_payment_id" | "checkout_token", value: string): Promise<Order | null> {
    const { data, error } = await this.db
      .from("orders")
      .select(ORDER_COLUMNS)
      .eq(column, value)
      .maybeSingle();
    if (error) throw error;
    return data ? toOrder(data as OrderRow) : null;
  }
}
