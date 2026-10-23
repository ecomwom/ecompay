import type { Order, OrderStatus } from "./order";

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: "Pendiente",
  PAID: "Pagado",
  UNDER_REVIEW: "En revisión",
  DISPUTED: "En disputa",
  REFUNDED: "Reembolsado",
  EXPIRED: "Expirado",
  CANCELED: "Cancelado",
  FAILED: "Fallido",
};

function normalizeLabel(label: string): string {
  return label
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/** The email is asked as a custom question ("Correo electrónico", "Email", "E-mail"...). */
export function isEmailQuestion(label: string): boolean {
  return /\b(correo|e-?mail)\b/.test(normalizeLabel(label));
}

export function buyerEmail(order: Order): string | null {
  const answer = order.answers.find((a) => isEmailQuestion(a.label) && a.value !== null && String(a.value).trim() !== "");
  return answer ? String(answer.value).trim().toLowerCase() : null;
}

export type OrdersSummary = {
  paidCount: number;
  paidAmountCents: number;
  pendingCount: number;
  /** Distinct emails among paid orders. */
  paidEmailCount: number;
};

export function summarizeOrders(orders: Order[]): OrdersSummary {
  const paid = orders.filter((o) => o.status === "PAID");
  const emails = new Set(paid.map(buyerEmail).filter((e): e is string => e !== null));
  return {
    paidCount: paid.length,
    paidAmountCents: paid.reduce((sum, o) => sum + o.amountCents, 0),
    pendingCount: orders.filter((o) => o.status === "PENDING").length,
    paidEmailCount: emails.size,
  };
}

/** Custom question labels (other than email) in first-seen order, used as extra columns. */
export function extraQuestionLabels(orders: Order[]): string[] {
  const labels = new Set<string>();
  for (const order of orders) {
    for (const answer of order.answers) {
      if (!isEmailQuestion(answer.label)) labels.add(answer.label);
    }
  }
  return [...labels];
}

export type BuyerRow = {
  createdAt: string;
  productName: string;
  name: string;
  phone: string;
  email: string | null;
  answers: Record<string, string>;
  status: OrderStatus;
  amountCents: number;
  orderId: string;
  confioPaymentId: string | null;
};

export function toBuyerRow(order: Order, productName: string): BuyerRow {
  const answers: Record<string, string> = {};
  for (const answer of order.answers) {
    if (!isEmailQuestion(answer.label) && answer.value !== null) answers[answer.label] = String(answer.value);
  }
  return {
    createdAt: order.createdAt,
    productName,
    name: order.buyerFirstName,
    phone: order.buyerPhone,
    email: buyerEmail(order),
    answers,
    status: order.status,
    amountCents: order.amountCents,
    orderId: order.id,
    confioPaymentId: order.confioPaymentId,
  };
}
