import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, inputClass } from "@/components/ui/field";
import { answerFieldName } from "@/modules/orders/domain/checkout-form";
import type { ProductQuestion } from "@/modules/products/domain/product";

import type { CheckoutState } from "./checkout-state";

type CheckoutFormProps = {
  questions: ProductQuestion[];
  checkoutToken: string;
  state: CheckoutState;
  pending: boolean;
  action: (formData: FormData) => void;
};

/** Presentational: renders the buyer form; state and submission come from the container. */
export function CheckoutForm({ questions, checkoutToken, state, pending, action }: CheckoutFormProps) {
  const errors = state.fieldErrors ?? {};
  const values = state.values ?? {};

  return (
    <form action={action} className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <input type="hidden" name="checkoutToken" value={checkoutToken} />
      <h2 className="text-lg font-semibold text-slate-900">Tus datos</h2>
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}

      <Field id="firstName" label="Nombre" required error={errors.firstName}>
        <input
          id="firstName"
          name="firstName"
          autoComplete="given-name"
          required
          maxLength={80}
          defaultValue={values.firstName}
          aria-invalid={Boolean(errors.firstName)}
          className={inputClass}
        />
      </Field>

      <Field
        id="phoneNumber"
        label="Celular (WhatsApp)"
        required
        error={errors.phoneNumber}
        hint="Número colombiano de 10 dígitos, por ejemplo 321 578 6325."
      >
        <input
          id="phoneNumber"
          name="phoneNumber"
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          required
          defaultValue={values.phoneNumber}
          aria-invalid={Boolean(errors.phoneNumber)}
          className={inputClass}
        />
      </Field>

      {questions.map((question) => {
        const name = answerFieldName(question.id);
        const common = {
          id: name,
          name,
          required: question.required,
          defaultValue: values[name],
          "aria-invalid": Boolean(errors[name]),
          className: inputClass,
        };
        return (
          <Field key={question.id} id={name} label={question.label} required={question.required} error={errors[name]}>
            {question.type === "textarea" ? (
              <textarea rows={4} maxLength={2000} {...common} />
            ) : question.type === "select" ? (
              <select {...common} defaultValue={values[name] ?? ""}>
                <option value="" disabled={question.required}>
                  Selecciona una opción
                </option>
                {question.options.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            ) : question.type === "number" ? (
              <input type="number" inputMode="decimal" step="any" {...common} />
            ) : (
              <input type="text" maxLength={500} {...common} />
            )}
          </Field>
        );
      })}

      <Button type="submit" disabled={pending} className="mt-2 w-full py-3 text-base">
        {pending ? "Procesando…" : "Ir a pagar"}
      </Button>
      <p className="text-center text-xs text-slate-500">
        Serás redirigido a Confío Pagos para completar tu compra de forma segura.
      </p>
    </form>
  );
}
