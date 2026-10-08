"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { startAdminSession } from "@/lib/auth/admin";
import { clientIp, hashClientIp } from "@/lib/auth/client-ip";
import { attemptAdminLogin, type AdminLoginOutcome } from "@/modules/auth/application/attempt-admin-login";
import { getContainer } from "@/server/container";

export type LoginState = { error?: string };

/** Fixed delay on every rejected login, to slow down password guessing. */
const FAILED_LOGIN_DELAY_MS = 500;

const LOGIN_ERRORS: Record<Exclude<AdminLoginOutcome, "ok">, string> = {
  invalid: "Contraseña incorrecta.",
  locked: "Demasiados intentos, espera unos minutos.",
  unavailable: "No pudimos verificar el acceso. Intenta de nuevo en unos minutos.",
};

export async function loginAction(_previous: LoginState, formData: FormData): Promise<LoginState> {
  const password = formData.get("password");
  const container = getContainer();
  const outcome = await attemptAdminLogin(
    {
      ipHash: hashClientIp(clientIp(await headers()), container.env.SESSION_SECRET),
      verifyPassword: async () => typeof password === "string" && (await startAdminSession(password)),
    },
    { attempts: container.loginAttempts, now: () => new Date(), logger: console },
  );
  if (outcome !== "ok") {
    await new Promise((resolve) => setTimeout(resolve, FAILED_LOGIN_DELAY_MS));
    return { error: LOGIN_ERRORS[outcome] };
  }
  redirect("/admin");
}
