"use client";

import { useActionState } from "react";

import type { ProductQuestion } from "@/modules/products/domain/product";

import { CheckoutForm } from "./checkout-form";
import { initialCheckoutState, type CheckoutState } from "./checkout-state";

type CheckoutFormContainerProps = {
  questions: ProductQuestion[];
  /** One-time token generated on the server for this page render. */
  checkoutToken: string;
  checkout: (state: CheckoutState, formData: FormData) => Promise<CheckoutState>;
};

/** Container: owns the server action state; the form itself is presentational. */
export function CheckoutFormContainer({ questions, checkoutToken, checkout }: CheckoutFormContainerProps) {
  const [state, action, pending] = useActionState(checkout, initialCheckoutState);
  // Every action result carries the token to use next; the prop only seeds the first submit.
  return (
    <CheckoutForm
      questions={questions}
      checkoutToken={state.checkoutToken ?? checkoutToken}
      state={state}
      pending={pending}
      action={action}
    />
  );
}
