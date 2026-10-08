import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/lib/auth/admin";

import { logoutAction } from "./actions";

export const metadata: Metadata = { title: "Administración", robots: { index: false } };

export default async function AdminPanelLayout({ children }: LayoutProps<"/admin">) {
  await requireAdmin();

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 p-4">
          <Link href="/admin" className="text-lg font-semibold">
            Ecompay · Admin
          </Link>
          <form action={logoutAction}>
            <Button type="submit" variant="secondary">
              Cerrar sesión
            </Button>
          </form>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 p-4 py-8">{children}</main>
    </div>
  );
}
