import type { ProductRepository } from "@/modules/products/domain/ports";

import { summarizeOrders, toBuyerRow, extraQuestionLabels, type BuyerRow, type OrdersSummary } from "../domain/buyers-report";
import type { OrderRepository } from "../domain/ports";

/** "pagados" shows only PAID orders; "todos" also includes pending/abandoned checkouts. */
export type BuyersScope = "pagados" | "todos";

export function parseBuyersScope(value: unknown): BuyersScope {
  return value === "todos" ? "todos" : "pagados";
}

export type BuyersReport = {
  summary: OrdersSummary;
  rows: BuyerRow[];
  questionLabels: string[];
};

export async function listBuyers(
  { productId, scope }: { productId?: string; scope: BuyersScope },
  deps: { orders: OrderRepository; products: ProductRepository },
): Promise<BuyersReport> {
  const [orders, products] = await Promise.all([deps.orders.list({ productId }), deps.products.list()]);
  const productNames = new Map(products.map((p) => [p.id, p.name]));
  const visible = scope === "todos" ? orders : orders.filter((o) => o.status === "PAID");

  return {
    summary: summarizeOrders(orders),
    rows: visible.map((o) => toBuyerRow(o, productNames.get(o.productId) ?? "")),
    questionLabels: extraQuestionLabels(visible),
  };
}
