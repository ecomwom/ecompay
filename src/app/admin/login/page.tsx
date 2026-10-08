import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { isAdmin } from "@/lib/auth/admin";

import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Administración", robots: { index: false } };

export default async function LoginPage() {
  if (await isAdmin()) redirect("/admin");
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 p-6">
      <h1 className="text-2xl font-semibold">Panel de administración</h1>
      <LoginForm />
    </main>
  );
}
