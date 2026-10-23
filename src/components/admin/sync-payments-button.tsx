"use client";

import { useActionState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export type SyncPaymentsState = { error?: string; success?: string };

type SyncPaymentsButtonProps = {
  sync: (state: SyncPaymentsState) => Promise<SyncPaymentsState>;
};

export function SyncPaymentsButton({ sync }: SyncPaymentsButtonProps) {
  const [state, action, pending] = useActionState(sync, {});
  return (
    <form action={action} className="flex flex-col items-end gap-2">
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "Sincronizando…" : "Sincronizar con Confío"}
      </Button>
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}
    </form>
  );
}
