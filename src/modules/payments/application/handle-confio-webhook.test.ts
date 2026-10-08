import { beforeEach, describe, expect, it } from "vitest";

import { sha256HexUpper } from "@/lib/crypto";
import { syncOrderPayment } from "@/modules/orders/application/sync-order-payment";
import { FakePaymentGateway, InMemoryOrderRepository } from "@/test/fakes";

import { handleConfioWebhook, type HandleWebhookDeps, type WebhookRequest } from "./handle-confio-webhook";

const SECRET = "test-webhook-secret-123456";
const ORDER_ID = "33333333-3333-4333-8333-333333333333";

function request(body: unknown, overrides: Partial<WebhookRequest> = {}): WebhookRequest {
  return {
    authorization: `Bearer ${SECRET}`,
    secretHeader: null,
    secretQuery: null,
    checksumHeader: null,
    rawBody: typeof body === "string" ? body : JSON.stringify(body),
    ...overrides,
  };
}

describe("handleConfioWebhook", () => {
  let orders: InMemoryOrderRepository;
  let gateway: FakePaymentGateway;
  let deps: HandleWebhookDeps;
  let paymentId: string;

  beforeEach(async () => {
    orders = new InMemoryOrderRepository();
    gateway = new FakePaymentGateway();
    await orders.create({
      id: ORDER_ID,
      productId: "p1",
      buyerFirstName: "Juan",
      buyerPhone: "+573053568988",
      answers: [],
      amountCents: 8_000_000,
    });
    const payment = await gateway.createPayment({
      idempotencyKey: ORDER_ID,
      correlationId: ORDER_ID,
      amountCents: 8_000_000,
      currencyCode: "COP",
      title: "Memorias",
      description: "Dual channel de memoria ram de 16gb",
      buyer: { firstName: "Juan", phoneNumber: "+573053568988" },
      paymentType: "PRODUCT",
      redirectUri: "https://x/return",
    });
    paymentId = payment.id;
    await orders.applyPayment(ORDER_ID, { confioPaymentId: paymentId, confioStatus: "AWAITING_PAYMENT", status: "PENDING" });

    deps = {
      webhookSecret: SECRET,
      syncPayment: (id) => syncOrderPayment(id, { orders, gateway }),
    };
  });

  const event = (status: string, overrides: Record<string, unknown> = {}) => ({
    event: "payment.statusChanged",
    data: {
      name: `stores/STORE1/payments/${paymentId}`,
      status,
      amountCents: 1_000_000,
      correlationId: ORDER_ID,
      ...overrides,
    },
    timestamp: 1757553509,
  });

  it("rejects requests without the shared secret", async () => {
    const result = await handleConfioWebhook(request(event("FUNDED"), { authorization: null }), deps);
    expect(result.status).toBe(401);
    expect(gateway.fetched).toEqual([]);
  });

  it("rejects requests with a wrong secret", async () => {
    const result = await handleConfioWebhook(request(event("FUNDED"), { authorization: "Bearer nope" }), deps);
    expect(result.status).toBe(401);
  });

  it("accepts the secret through header or query param as well", async () => {
    const viaHeader = await handleConfioWebhook(
      request(event("FUNDED"), { authorization: null, secretHeader: SECRET }),
      deps,
    );
    const viaQuery = await handleConfioWebhook(
      request(event("FUNDED"), { authorization: null, secretQuery: SECRET }),
      deps,
    );
    expect(viaHeader.status).toBe(200);
    expect(viaQuery.status).toBe(200);
  });

  it("does NOT trust the body status: it re-fetches the payment from Confío", async () => {
    // Body claims FUNDED, but Confío still says AWAITING_PAYMENT.
    const result = await handleConfioWebhook(request(event("FUNDED")), deps);

    expect(result.status).toBe(200);
    expect(gateway.fetched).toEqual([paymentId]);
    expect(orders.orders.get(ORDER_ID)?.status).toBe("PENDING");
  });

  it("updates the order with the status reported by Confío's API", async () => {
    gateway.setStatus(paymentId, "FUNDED");
    await handleConfioWebhook(request(event("FAILED")), deps);
    expect(orders.orders.get(ORDER_ID)).toMatchObject({ status: "PAID", confioStatus: "FUNDED" });
  });

  it("ignores the body correlationId and amount (uses the fetched payment)", async () => {
    gateway.setStatus(paymentId, "APPROVED");
    await handleConfioWebhook(
      request(event("APPROVED", { correlationId: "44444444-4444-4444-8444-444444444444", amountCents: 1 })),
      deps,
    );
    expect(orders.orders.get(ORDER_ID)?.status).toBe("PAID");
  });

  it("refuses to mark as paid when the fetched amount does not match the order", async () => {
    const payment = gateway.payments.get(paymentId)!;
    gateway.payments.set(paymentId, { ...payment, status: "FUNDED", amountCents: 1_000_000 });
    const result = await handleConfioWebhook(request(event("FUNDED")), deps);
    expect(result.body).toMatchObject({ synced: false });
    expect(orders.orders.get(ORDER_ID)?.status).toBe("PENDING");
  });

  it("resolves the payment id from paymentAttempt events", async () => {
    gateway.setStatus(paymentId, "FUNDED");
    await handleConfioWebhook(
      request({
        event: "paymentAttempt.statusChanged",
        data: { name: `stores/STORE1/payments/${paymentId}/attempts/A1`, status: "SUCCEEDED" },
      }),
      deps,
    );
    expect(gateway.fetched).toEqual([paymentId]);
    expect(orders.orders.get(ORDER_ID)?.status).toBe("PAID");
  });

  it("ignores unrelated events and rejects malformed bodies", async () => {
    expect((await handleConfioWebhook(request({ event: "subscription.subscriptionStatusChanged", data: {} }), deps)).status).toBe(200);
    expect((await handleConfioWebhook(request("not json"), deps)).status).toBe(400);
    expect((await handleConfioWebhook(request({ event: "payment.statusChanged", data: { name: "../../x" } }), deps)).status).toBe(400);
    expect(gateway.fetched).toEqual([]);
  });

  it("returns 502 so Confío retries when the API lookup fails", async () => {
    const result = await handleConfioWebhook(
      request(event("FUNDED", { name: "stores/STORE1/payments/UNKNOWN" })),
      deps,
    );
    expect(result.status).toBe(502);
  });

  it("still processes events whose checksum does not match (logged, not enforced yet)", async () => {
    const warnings: unknown[] = [];
    gateway.setStatus(paymentId, "FUNDED");
    const body = { ...event("FUNDED"), signature: { properties: ["name", "status"], checksum: "DEADBEEF" } };
    const result = await handleConfioWebhook(request(body), { ...deps, logger: { warn: (...a) => warnings.push(a), error: () => {} } });
    expect(result.status).toBe(200);
    expect(warnings).toHaveLength(1);
  });

  it("accepts a valid documented checksum without warnings", async () => {
    const warnings: unknown[] = [];
    const base = event("FUNDED");
    const checksum = sha256HexUpper(`${base.data.name}${base.data.status}${base.timestamp}${SECRET}`);
    const body = { ...base, signature: { properties: ["name", "status"], checksum } };
    await handleConfioWebhook(request(body), { ...deps, logger: { warn: (...a) => warnings.push(a), error: () => {} } });
    expect(warnings).toHaveLength(0);
  });
});
