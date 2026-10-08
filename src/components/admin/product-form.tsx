import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, inputClass } from "@/components/ui/field";

import type { ProductFormState } from "./product-form-state";

export type ProductFormDefaults = {
  name: string;
  slug: string;
  description: string;
  price: string;
  imageUrl: string;
  paymentType: "PRODUCT" | "SERVICE";
};

type ProductFormProps = {
  mode: "create" | "edit";
  defaults: ProductFormDefaults;
  state: ProductFormState;
  pending: boolean;
  action: (formData: FormData) => void;
};

/** Presentational product form (create / edit). */
export function ProductForm({ mode, defaults, state, pending, action }: ProductFormProps) {
  const errors = state.fieldErrors ?? {};
  const values = { ...defaults, ...state.values } as ProductFormDefaults;

  return (
    <form action={action} className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}

      <Field id="name" label="Nombre" required error={errors.name}>
        <input id="name" name="name" required maxLength={120} defaultValue={values.name} className={inputClass} />
      </Field>

      <Field
        id="slug"
        label="Enlace (slug)"
        error={errors.slug}
        hint={mode === "create" ? "Se usa en la URL pública /p/<enlace>. Si lo dejas vacío se genera a partir del nombre. No se puede cambiar después." : "El enlace no se puede cambiar para no romper los botones ya publicados."}
      >
        <input
          id="slug"
          name="slug"
          maxLength={64}
          pattern="[a-z0-9]+(-[a-z0-9]+)*"
          defaultValue={values.slug}
          disabled={mode === "edit"}
          className={inputClass}
        />
      </Field>

      <Field id="description" label="Descripción" required error={errors.description} hint="Mínimo 24 caracteres (requisito de Confío).">
        <textarea id="description" name="description" required minLength={24} maxLength={2000} rows={5} defaultValue={values.description} className={inputClass} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="price" label="Precio (COP)" required error={errors.price ?? errors.priceCents} hint="En pesos, sin decimales. Mínimo $10.000.">
          <input id="price" name="price" inputMode="numeric" required defaultValue={values.price} className={inputClass} />
        </Field>
        <Field id="paymentType" label="Tipo" required error={errors.paymentType}>
          <select id="paymentType" name="paymentType" defaultValue={values.paymentType} className={inputClass}>
            <option value="PRODUCT">Producto físico</option>
            <option value="SERVICE">Servicio</option>
          </select>
        </Field>
      </div>

      <Field id="imageUrl" label="URL de la imagen" error={errors.imageUrl} hint="URL pública (https). Obligatoria para productos físicos.">
        <input id="imageUrl" name="imageUrl" type="url" defaultValue={values.imageUrl} className={inputClass} />
      </Field>

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando…" : mode === "create" ? "Crear producto" : "Guardar cambios"}
        </Button>
      </div>
    </form>
  );
}
