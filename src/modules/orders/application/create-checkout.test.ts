import { beforeEach, describe, expect, it } from "vitest";

import { FakePaymentGateway, InMemoryOrderRepository, makeProduct } from "@/test/fakes";

import { createCheckout, nextCheckoutToken, type CreateCheckoutDeps, type CreateCheckoutResult } from "./create-checkout";

const ORDER_ID = "22222222-2222-4222-8222-222222222222";
const TOKEN = "33333333-3333-4333-8333-333333333333";
const FRESH = "66666666-6666-4666-8666-666666666666";
const next = (result: CreateCheckoutResult, submitted: string | undefined = TOKEN) =>
  nextCheckoutToken(result, submitted, () => FRESH);

describe("createCheckout", () => {
  let orders: InMemoryOrderRepository;
  let gateway: FakePaymentGateway;
  let deps: CreateCheckoutDeps;
  /** Fake orders are created at 2026-01-01T00:00:00Z; by default "now" is long after. */
  let now: Date;
  let sleeps: number[];
  let onSleep: (count: number) => Promise<void>;
  const product = makeProduct({
    questions: [
      {
        id: "size",
        productId: "p",
        label: "Talla",
        type: "select",
        required: true,
        options: ["S", "M"],
        position: 0,
      },
    ],
  });

  beforeEach(() => {
    orders = new InMemoryOrderRepository();
    gateway = new FakePaymentGateway();
    now = new Date("2026-01-01T00:05:00Z");
    sleeps = [];
    onSleep = async () => {};
    deps = {
      products: { findBySlug: async (slug) => (slug === product.slug ? product : null) },
      orders,
      gateway,
      appUrl: "https://pagos.example.com",
      newId: () => ORDER_ID,
      now: () => now,
      sleep: async (ms) => {
        sleeps.push(ms);
        await onSleep(sleeps.length);
      },
    };
  });

  const validFields = { firstName: "Julián", phoneNumber: "321 578 6325", q_size: "M" };

  it("creates a pending order and a Confío payment correlated to it", async () => {
    const result = await createCheckout({ slug: product.slug, fields: validFields, checkoutToken: TOKEN }, deps);

    expect(result).toEqual({
      ok: true,
      orderId: ORDER_ID,
      checkoutUrl: "https://checkout.dev.confiopagos.com/p/PAY1",
    });

    expect(gateway.created).toHaveLength(1);
    const request = gateway.created[0];
    expect(request).toMatchObject({
      correlationId: ORDER_ID,
      idempotencyKey: ORDER_ID,
      amountCents: 5_000_000,
      currencyCode: "COP",
      title: product.name,
      description: product.description,
      buyer: { firstName: "Julián", phoneNumber: "+573215786325" },
      mediaAssets: [product.imageUrl],
      paymentType: "PRODUCT",
      redirectUri: "https://pagos.example.com/p/camiseta-negra/return",
    });

    const order = orders.orders.get(ORDER_ID);
    expect(order).toMatchObject({
      status: "PENDING",
      amountCents: 5_000_000,
      confioPaymentId: "PAY1",
      confioStatus: "AWAITING_PAYMENT",
      checkoutUrl: "https://checkout.dev.confiopagos.com/p/PAY1",
      answers: [{ questionId: "size", label: "Talla", value: "M" }],
    });
  });

  it("uses the product price, never anything from the form", async () => {
    await createCheckout(
      { slug: product.slug, fields: { ...validFields, amountCents: "100", price: "1" }, checkoutToken: TOKEN },
      deps,
    );
    expect(gateway.created[0].amountCents).toBe(product.priceCents);
  });

  it("returns field errors without creating an order or payment", async () => {
    const result = await createCheckout(
      { slug: product.slug, fields: { firstName: "", phoneNumber: "123", q_size: "XL" } },
      deps,
    );
    expect(result).toMatchObject({ ok: false, reason: "invalid" });
    if (!result.ok && result.reason === "invalid") {
      expect(Object.keys(result.fieldErrors).sort()).toEqual(["firstName", "phoneNumber", "q_size"]);
    }
    expect(orders.orders.size).toBe(0);
    expect(gateway.created).toHaveLength(0);
  });

  it("returns not_found for unknown or archived products", async () => {
    expect(await createCheckout({ slug: "nope", fields: validFields, checkoutToken: TOKEN }, deps)).toEqual({
      ok: false,
      reason: "not_found",
    });

    const archived = { ...deps, products: { findBySlug: async () => ({ ...product, isActive: false }) } };
    expect(await createCheckout({ slug: product.slug, fields: validFields, checkoutToken: TOKEN }, archived)).toEqual({
      ok: false,
      reason: "not_found",
    });
  });

  const apiError = (status: number) => Object.assign(new Error("x"), { name: "ConfioApiError", status });

  it("marks the order as failed when Confío rejects the payment (4xx)", async () => {
    gateway.createErrors.push(apiError(422));
    const result = await createCheckout({ slug: product.slug, fields: validFields, checkoutToken: TOKEN }, deps);
    expect(result).toEqual({ ok: false, reason: "gateway_error", orderId: ORDER_ID, failed: true });
    expect(next(result)).toBe(FRESH);
    expect(gateway.created).toHaveLength(1);
    expect(orders.orders.get(ORDER_ID)?.status).toBe("FAILED");
  });

  it("retries ambiguous errors once with the same idempotency key, else stays PENDING", async () => {
    gateway.createErrors.push(apiError(503), new Error("timeout"));
    const result = await createCheckout({ slug: product.slug, fields: validFields, checkoutToken: TOKEN }, deps);
    expect(result).toEqual({ ok: false, reason: "gateway_error", orderId: ORDER_ID, failed: false });
    expect(next(result)).toBe(TOKEN);
    expect(gateway.created.map((r) => r.idempotencyKey)).toEqual([ORDER_ID, ORDER_ID]);
    expect(orders.orders.get(ORDER_ID)?.status).toBe("PENDING");
  });

  it("still returns the checkout URL when saving the payment fails", async () => {
    orders.failApply = true;
    const result = await createCheckout({ slug: product.slug, fields: validFields, checkoutToken: TOKEN }, deps);
    expect(result).toMatchObject({ ok: true, checkoutUrl: "https://checkout.dev.confiopagos.com/p/PAY1" });
    expect(orders.orders.get(ORDER_ID)?.status).toBe("PENDING");
  });

  it("omits mediaAssets for services without image", async () => {
    const service = makeProduct({ paymentType: "SERVICE", imageUrl: null });
    await createCheckout(
      { slug: service.slug, fields: validFields, checkoutToken: TOKEN },
      { ...deps, products: { findBySlug: async () => service } },
    );
    expect(gateway.created[0].mediaAssets).toBeUndefined();
    expect(gateway.created[0].paymentType).toBe("SERVICE");
  });

  describe("double submit protection", () => {
    const submit = () => createCheckout({ slug: product.slug, fields: validFields, checkoutToken: TOKEN }, deps);

    it("rejects a missing or malformed checkout token without creating anything", async () => {
      for (const checkoutToken of [undefined, "", "not-a-uuid"]) {
        const result = await createCheckout({ slug: product.slug, fields: validFields, checkoutToken }, deps);
        expect(result).toMatchObject({ ok: false, reason: "invalid", fieldErrors: { form: expect.any(String) } });
        expect(next(result, checkoutToken)).toBe(FRESH);
      }
      expect(orders.orders.size).toBe(0);
      expect(gateway.created).toHaveLength(0);
    });

    it("redirects a repeated submit to the existing checkout without a new order or payment", async () => {
      const first = await submit();
      deps.newId = () => "44444444-4444-4444-8444-444444444444";
      expect(await submit()).toEqual(first);
      expect(orders.orders.size).toBe(1);
      expect(gateway.created).toHaveLength(1);
    });

    it("re-requests the same payment for an old PENDING order without checkout URL", async () => {
      gateway.createErrors.push(apiError(503), apiError(503));
      await submit();
      deps.newId = () => "44444444-4444-4444-8444-444444444444";
      expect(await submit()).toEqual({
        ok: true,
        orderId: ORDER_ID,
        checkoutUrl: "https://checkout.dev.confiopagos.com/p/PAY3",
      });
      expect(gateway.created.map((r) => r.idempotencyKey)).toEqual([ORDER_ID, ORDER_ID, ORDER_ID]);
      expect(gateway.created[2]).toEqual(gateway.created[0]);
      expect(orders.orders.size).toBe(1);
      expect(orders.orders.get(ORDER_ID)?.checkoutUrl).toBe("https://checkout.dev.confiopagos.com/p/PAY3");
      expect(sleeps).toEqual([]);
    });

    it("never pays again when the token's order is already PAID without checkout URL", async () => {
      gateway.createErrors.push(apiError(503), apiError(503));
      await submit();
      orders.orders.set(ORDER_ID, { ...orders.orders.get(ORDER_ID)!, status: "PAID" });
      const result = await submit();
      expect(result).toEqual({ ok: false, reason: "already_registered", orderId: ORDER_ID });
      expect(next(result)).toBe(TOKEN);
      expect(gateway.created).toHaveLength(2);
    });

    describe("while another request with the same token is creating the payment", () => {
      const startInFlightOrder = () =>
        orders.create({
          id: ORDER_ID,
          productId: product.id,
          buyerFirstName: "Julián",
          buyerPhone: "+573215786325",
          answers: [],
          amountCents: product.priceCents,
          checkoutToken: TOKEN,
        });

      beforeEach(async () => {
        await startInFlightOrder();
        now = new Date("2026-01-01T00:00:10Z");
      });

      it("waits for its checkout URL and redirects without a new order or payment", async () => {
        onSleep = async (count) => {
          if (count === 3) {
            await orders.applyPayment(ORDER_ID, {
              confioPaymentId: "PAY1",
              confioStatus: "AWAITING_PAYMENT",
              status: "PENDING",
              checkoutUrl: "https://checkout.dev.confiopagos.com/p/PAY1",
            });
          }
        };
        expect(await submit()).toEqual({
          ok: true,
          orderId: ORDER_ID,
          checkoutUrl: "https://checkout.dev.confiopagos.com/p/PAY1",
        });
        expect(sleeps).toEqual([1000, 1000, 1000]);
        expect(orders.orders.size).toBe(1);
        expect(gateway.created).toHaveLength(0);
      });

      it("returns in_progress and keeps the same token when the URL never appears", async () => {
        const result = await submit();
        expect(result).toEqual({ ok: false, reason: "in_progress", orderId: ORDER_ID });
        expect(next(result)).toBe(TOKEN);
        expect(sleeps).toHaveLength(15);
        expect(gateway.created).toHaveLength(0);
      });

      it("returns in_progress with the same token when re-reading the order fails", async () => {
        const findByCheckoutToken = orders.findByCheckoutToken.bind(orders);
        let calls = 0;
        orders.findByCheckoutToken = async (token) => {
          if (calls++ > 0) throw new Error("db down");
          return findByCheckoutToken(token);
        };
        const result = await submit();
        expect(result).toEqual({ ok: false, reason: "in_progress", orderId: ORDER_ID });
        expect(next(result)).toBe(TOKEN);
      });

      it("stops waiting and issues a fresh token when that request fails", async () => {
        onSleep = async () => orders.markFailed(ORDER_ID);
        const result = await submit();
        expect(result).toEqual({ ok: false, reason: "gateway_error", orderId: ORDER_ID, failed: true });
        expect(next(result)).toBe(FRESH);
        expect(sleeps).toHaveLength(1);
        expect(gateway.created).toHaveLength(0);
      });
    });

    it("issues a fresh token when the existing order FAILED", async () => {
      gateway.createErrors.push(apiError(422));
      await submit();
      now = new Date("2026-01-01T00:00:05Z");
      const result = await submit();
      expect(result).toEqual({ ok: false, reason: "gateway_error", orderId: ORDER_ID, failed: true });
      expect(next(result)).toBe(FRESH);
      expect(sleeps).toEqual([]);
      expect(gateway.created).toHaveLength(1);
    });

    it("keeps the submitted token on validation errors and unknown products", async () => {
      const invalid = await createCheckout({ slug: product.slug, fields: {}, checkoutToken: TOKEN }, deps);
      const notFound = await createCheckout({ slug: "nope", fields: validFields, checkoutToken: TOKEN }, deps);
      expect(next(invalid)).toBe(TOKEN);
      expect(next(notFound)).toBe(TOKEN);
    });

    it("re-reads the winning order when losing the insert race on the token", async () => {
      await submit();
      const findByCheckoutToken = orders.findByCheckoutToken.bind(orders);
      let calls = 0;
      orders.findByCheckoutToken = async (token) => (calls++ === 0 ? null : findByCheckoutToken(token));
      deps.newId = () => "44444444-4444-4444-8444-444444444444";

      expect(await submit()).toMatchObject({ ok: true, orderId: ORDER_ID });
      expect(calls).toBe(2);
      expect(orders.orders.size).toBe(1);
      expect(gateway.created).toHaveLength(1);
    });

    it("does not reuse a token that belongs to another product's order", async () => {
      await submit();
      const other = makeProduct({ id: "55555555-5555-4555-8555-555555555555" });
      const result = await createCheckout(
        { slug: other.slug, fields: validFields, checkoutToken: TOKEN },
        { ...deps, products: { findBySlug: async () => other } },
      );
      expect(result).toMatchObject({ ok: false, reason: "invalid" });
      expect(next(result)).toBe(FRESH);
      expect(gateway.created).toHaveLength(1);
    });
  });
});
