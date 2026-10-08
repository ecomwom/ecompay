import Link from "next/link";

import { ProductFormContainer } from "@/components/admin/product-form-container";
import { requireAdmin } from "@/lib/auth/admin";

import { createProductAction } from "../../actions";

export default async function NewProductPage() {
  await requireAdmin();
  return (
    <>
      <Link href="/admin" className="text-sm text-slate-500 hover:underline">
        ← Productos
      </Link>
      <h1 className="text-2xl font-semibold">Nuevo producto</h1>
      <ProductFormContainer
        mode="create"
        defaults={{ name: "", slug: "", description: "", price: "", imageUrl: "", paymentType: "PRODUCT" }}
        submit={createProductAction}
      />
    </>
  );
}
