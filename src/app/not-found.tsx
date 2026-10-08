import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
      <h1 className="text-2xl font-semibold">Página no encontrada</h1>
      <p className="text-slate-600">El producto que buscas no existe o ya no está disponible.</p>
      <Link href="/" className="text-sm font-medium text-emerald-700 underline">
        Volver al inicio
      </Link>
    </main>
  );
}
