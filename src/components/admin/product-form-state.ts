export type ProductFormState = {
  error?: string;
  success?: string;
  fieldErrors?: Record<string, string>;
  values?: Record<string, string>;
};

export const initialProductFormState: ProductFormState = {};
