import "server-only";

import { z } from "zod";

import {
  extractPaymentId,
  type CreatePaymentRequest,
  type GatewayPayment,
  type PaymentGateway,
} from "@/modules/payments/domain/payment";

export class ConfioApiError extends Error {
  constructor(
    readonly status: number,
    readonly responseBody: string,
  ) {
    super(`Confío API responded with HTTP ${status}`);
    this.name = "ConfioApiError";
  }
}

const paymentResponseSchema = z.object({
  name: z.string().min(1),
  url: z.string().min(1),
  status: z.string().min(1),
  amountCents: z.coerce.number(),
  currencyCode: z.string(),
  correlationId: z.string().nullish(),
});

type ConfioGatewayConfig = {
  baseUrl: string;
  accessToken: string;
  storeId: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
};

/** Confío Pagos adapter for the PaymentGateway port (https://developers.confiopagos.com). */
export class ConfioGateway implements PaymentGateway {
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly config: ConfioGatewayConfig) {
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  async createPayment(request: CreatePaymentRequest): Promise<GatewayPayment> {
    const { idempotencyKey, ...body } = request;
    return this.call(`/v1/stores/${encodeURIComponent(this.config.storeId)}/payments`, {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": idempotencyKey },
      body: JSON.stringify(body),
    });
  }

  async getPayment(paymentId: string): Promise<GatewayPayment> {
    return this.call(
      `/v1/stores/${encodeURIComponent(this.config.storeId)}/payments/${encodeURIComponent(paymentId)}`,
      { method: "GET" },
    );
  }

  private async call(path: string, init: RequestInit): Promise<GatewayPayment> {
    const response = await this.fetchImpl(`${this.config.baseUrl}${path}`, {
      ...init,
      headers: {
        accept: "application/json",
        authorization: `Bearer ${this.config.accessToken}`,
        ...init.headers,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(this.config.timeoutMs ?? 15_000),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new ConfioApiError(response.status, text.slice(0, 1000));
    }

    const payment = paymentResponseSchema.parse(await response.json());
    const id = extractPaymentId(payment.name);
    if (!id) throw new Error(`Unexpected Confío payment name: ${payment.name}`);

    return {
      name: payment.name,
      id,
      url: payment.url,
      status: payment.status,
      amountCents: payment.amountCents,
      currencyCode: payment.currencyCode,
      correlationId: payment.correlationId ?? null,
    };
  }
}
