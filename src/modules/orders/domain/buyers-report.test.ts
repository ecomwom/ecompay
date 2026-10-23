import { describe, expect, it } from "vitest";

import { buyerEmail, extraQuestionLabels, isEmailQuestion, summarizeOrders, toBuyerRow } from "./buyers-report";
import type { Order } from "./order";

function order(overrides: Partial<Order>): Order {
  return {
    id: "o1",
    productId: "p1",
    buyerFirstName: "Ana",
    buyerPhone: "+573215786325",
    answers: [],
    amountCents: 5_000_000,
    currency: "COP",
    confioPaymentId: null,
    confioStatus: null,
    checkoutUrl: null,
    status: "PAID",
    createdAt: "2026-10-20T15:00:00Z",
    updatedAt: "2026-10-20T15:00:00Z",
    ...overrides,
  };
}

describe("isEmailQuestion", () => {
  it("recognizes common email labels", () => {
    for (const label of ["Correo electrónico", "CORREO", "Email", "Tu e-mail", "E-mail de contacto"]) {
      expect(isEmailQuestion(label)).toBe(true);
    }
    expect(isEmailQuestion("¿Dónde estás hoy en tu camino emprendedor?")).toBe(false);
  });
});

describe("buyerEmail", () => {
  it("returns the trimmed, lowercased email answer", () => {
    const o = order({ answers: [{ questionId: "q", label: "Correo electrónico", value: "  Ana@Mail.com " }] });
    expect(buyerEmail(o)).toBe("ana@mail.com");
  });

  it("returns null when not asked or blank", () => {
    expect(buyerEmail(order({}))).toBeNull();
    expect(buyerEmail(order({ answers: [{ questionId: "q", label: "Correo", value: null }] }))).toBeNull();
  });
});

describe("summarizeOrders", () => {
  it("totals paid orders and counts distinct paid emails", () => {
    const email = (value: string) => [{ questionId: "q", label: "Correo", value }];
    const summary = summarizeOrders([
      order({ id: "1", answers: email("a@x.co") }),
      order({ id: "2", answers: email("A@x.co") }),
      order({ id: "3", answers: email("b@x.co"), amountCents: 2_000_000 }),
      order({ id: "4", status: "PENDING", answers: email("c@x.co") }),
      order({ id: "5", status: "FAILED" }),
    ]);
    expect(summary).toEqual({ paidCount: 3, paidAmountCents: 12_000_000, pendingCount: 1, paidEmailCount: 2 });
  });
});

describe("buyer rows", () => {
  it("separates the email from the other answers", () => {
    const o = order({
      answers: [
        { questionId: "a", label: "Etapa", value: "Empezando" },
        { questionId: "b", label: "Correo electrónico", value: "ana@mail.com" },
      ],
    });
    expect(extraQuestionLabels([o])).toEqual(["Etapa"]);
    const row = toBuyerRow(o, "Evento");
    expect(row.email).toBe("ana@mail.com");
    expect(row.answers).toEqual({ Etapa: "Empezando" });
  });
});
