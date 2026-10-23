import { expect, it } from "vitest";

import { FakePaymentGateway, InMemoryOrderRepository } from "@/test/fakes";

import { syncPendingOrders } from "./sync-pending-orders";

const ids = [
  "11111111-1111-4111-8111-111111111111",
  "22222222-2222-4222-8222-222222222222",
  "33333333-3333-4333-8333-333333333333",
];

it("marks pending orders paid when Confío already holds the funds", async () => {
  const orders = new InMemoryOrderRepository();
  const gateway = new FakePaymentGateway();
  const paymentIds: string[] = [];
  for (const id of ids) {
    await orders.create({ id, productId: "p1", buyerFirstName: "Ana", buyerPhone: "+573215786325", answers: [], amountCents: 7_900_000 });
    const payment = await gateway.createPayment({
      idempotencyKey: id,
      correlationId: id,
      amountCents: 7_900_000,
      currencyCode: "COP",
      title: "Evento",
      description: "Evento virtual para emprendedores",
      buyer: { firstName: "Ana", phoneNumber: "+573215786325" },
      paymentType: "SERVICE",
      redirectUri: "https://x/return",
    });
    paymentIds.push(payment.id);
    await orders.applyPayment(id, { confioPaymentId: payment.id, confioStatus: "AWAITING_PAYMENT", status: "PENDING" });
  }
  gateway.setStatus(paymentIds[0], "FUNDED");
  gateway.setStatus(paymentIds[1], "EXPIRED");

  const result = await syncPendingOrders({ orders, gateway }, 2);

  expect(result).toEqual({ checked: 3, newlyPaid: 1, failed: 0 });
  expect((await orders.findById(ids[0]))?.status).toBe("PAID");
  expect((await orders.findById(ids[1]))?.status).toBe("EXPIRED");
  expect((await orders.findById(ids[2]))?.status).toBe("PENDING");

  // Paid orders are not re-fetched on the next run.
  gateway.fetched.length = 0;
  await syncPendingOrders({ orders, gateway });
  expect(gateway.fetched).toEqual([paymentIds[2]]);
});
