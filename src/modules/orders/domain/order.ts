export const ORDER_STATUSES = [
  "PENDING",
  "PAID",
  "UNDER_REVIEW",
  "DISPUTED",
  "REFUNDED",
  "EXPIRED",
  "CANCELED",
  "FAILED",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export type OrderAnswer = {
  questionId: string;
  label: string;
  value: string | number | null;
};

export type Order = {
  id: string;
  productId: string;
  buyerFirstName: string;
  buyerPhone: string;
  answers: OrderAnswer[];
  amountCents: number;
  currency: "COP";
  confioPaymentId: string | null;
  confioStatus: string | null;
  checkoutUrl: string | null;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
};

export type NewOrder = Pick<
  Order,
  "id" | "productId" | "buyerFirstName" | "buyerPhone" | "answers" | "amountCents"
> & {
  /** One-time token from the checkout form; unique across orders. */
  checkoutToken?: string;
};

/** What the buyer sees on the return page. */
export type BuyerOutcome = "success" | "pending" | "failed";

export function buyerOutcome(status: OrderStatus): BuyerOutcome {
  switch (status) {
    case "PAID":
      return "success";
    case "PENDING":
    case "UNDER_REVIEW":
      return "pending";
    default:
      return "failed";
  }
}

/**
 * Guards against stale gateway snapshots regressing an order: a PAID order may only
 * move to REFUNDED, DISPUTED or UNDER_REVIEW, and REFUNDED is terminal.
 */
export function canTransitionOrderStatus(from: OrderStatus, to: OrderStatus): boolean {
  if (from === to) return true;
  if (from === "PAID") return to === "REFUNDED" || to === "DISPUTED" || to === "UNDER_REVIEW";
  if (from === "REFUNDED") return false;
  return true;
}
