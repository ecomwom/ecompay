"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { ProductFormState } from "@/components/admin/product-form-state";
import type { QuestionsState } from "@/components/admin/questions-state";
import { endAdminSession, requireAdmin } from "@/lib/auth/admin";
import {
  createProduct,
  saveProductQuestions,
  updateProduct,
} from "@/modules/products/application/manage-products";
import { getContainer } from "@/server/container";
import { isUuid } from "@/lib/uuid";

function assertId(id: string): void {
  if (!isUuid(id)) throw new Error("Invalid product id");
}

function readProductForm(formData: FormData): Record<string, string> {
  const keys = ["name", "slug", "description", "price", "imageUrl", "paymentType"];
  return Object.fromEntries(keys.map((key) => [key, String(formData.get(key) ?? "")]));
}

export async function createProductAction(
  _previous: ProductFormState,
  formData: FormData,
): Promise<ProductFormState> {
  await requireAdmin();
  const values = readProductForm(formData);
  const result = await createProduct(values, getContainer().products);
  if (!result.ok) return { fieldErrors: result.fieldErrors, values, error: "Revisa los campos marcados." };

  revalidatePath("/admin");
  redirect(`/admin/products/${result.value.id}`);
}

export async function updateProductAction(
  productId: string,
  _previous: ProductFormState,
  formData: FormData,
): Promise<ProductFormState> {
  await requireAdmin();
  assertId(productId);
  const values = readProductForm(formData);
  const result = await updateProduct(productId, values, getContainer().products);
  if (!result.ok) return { fieldErrors: result.fieldErrors, values, error: "Revisa los campos marcados." };

  revalidatePath("/admin");
  revalidatePath(`/admin/products/${productId}`);
  revalidatePath(`/p/${result.value.slug}`);
  return { success: "Cambios guardados.", values };
}

export async function setProductActiveAction(productId: string, isActive: boolean): Promise<void> {
  await requireAdmin();
  assertId(productId);
  await getContainer().products.setActive(productId, isActive);
  revalidatePath("/admin");
  revalidatePath(`/admin/products/${productId}`);
}

export async function saveQuestionsAction(
  productId: string,
  _previous: QuestionsState,
  formData: FormData,
): Promise<QuestionsState> {
  await requireAdmin();
  assertId(productId);

  let questions: unknown;
  try {
    questions = JSON.parse(String(formData.get("questions") ?? "[]"));
  } catch {
    return { error: "No pudimos leer las preguntas." };
  }

  const result = await saveProductQuestions(productId, questions, getContainer().products);
  if (!result.ok) {
    return { error: Object.values(result.fieldErrors)[0] ?? "Revisa las preguntas." };
  }
  revalidatePath(`/admin/products/${productId}`);
  return { success: "Preguntas guardadas." };
}

export async function logoutAction(): Promise<void> {
  await endAdminSession();
  redirect("/admin/login");
}
