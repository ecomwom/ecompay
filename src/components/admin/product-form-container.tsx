"use client";

import { useActionState } from "react";

import { ProductForm, type ProductFormDefaults } from "./product-form";
import { initialProductFormState, type ProductFormState } from "./product-form-state";

type ProductFormContainerProps = {
  mode: "create" | "edit";
  defaults: ProductFormDefaults;
  submit: (state: ProductFormState, formData: FormData) => Promise<ProductFormState>;
};

export function ProductFormContainer({ mode, defaults, submit }: ProductFormContainerProps) {
  const [state, action, pending] = useActionState(submit, initialProductFormState);
  return <ProductForm mode={mode} defaults={defaults} state={state} pending={pending} action={action} />;
}
