"use server";

import { randomUUID } from "node:crypto";

import { redirect } from "next/navigation";

import type { CheckoutState } from "@/components/checkout/checkout-state";
import { createCheckout, nextCheckoutToken } from "@/modules/orders/application/create-checkout";
import { getContainer } from "@/server/container";

export async function checkoutAction(
  slug: string,
  _previous: CheckoutState,
  formData: FormData,
): Promise<CheckoutState> {
  const values: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string" && !key.startsWith("$ACTION")) values[key] = value;
  }

  const container = getContainer();
  const result = await createCheckout(
    { slug, fields: values, checkoutToken: values.checkoutToken },
    {
      products: container.products,
      orders: container.orders,
      gateway: container.gateway,
      appUrl: container.env.APP_URL,
      newId: randomUUID,
      logger: console,
    },
  );

  if (result.ok) redirect(result.checkoutUrl);

  const checkoutToken = nextCheckoutToken(result, values.checkoutToken, randomUUID);

  switch (result.reason) {
    case "not_found":
      return { error: "Este producto ya no está disponible.", values, checkoutToken };
    case "invalid":
      return {
        error: result.fieldErrors.form ?? "Revisa los campos marcados.",
        fieldErrors: result.fieldErrors,
        values,
        checkoutToken,
      };
    case "in_progress":
      return {
        error: "Tu pago se está procesando. Espera unos segundos e intenta de nuevo.",
        values,
        checkoutToken,
      };
    case "already_registered":
      return {
        error: "Este pago ya fue registrado. Revisa tu WhatsApp o contacta al vendedor.",
        values,
        checkoutToken,
      };
    case "gateway_error":
      return {
        error: "No pudimos iniciar el pago en este momento. Intenta de nuevo en unos minutos.",
        values,
        checkoutToken,
      };
  }
}
