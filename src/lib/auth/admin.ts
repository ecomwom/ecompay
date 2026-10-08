import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getEnv } from "@/env";
import { safeEqual } from "@/lib/crypto";

import {
  createSessionToken,
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  verifySessionToken,
} from "./session";

export async function isAdmin(): Promise<boolean> {
  const store = await cookies();
  return verifySessionToken(store.get(SESSION_COOKIE)?.value, getEnv().SESSION_SECRET);
}

/** Call at the top of every admin page/layout and EVERY admin server action. */
export async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) redirect("/admin/login");
}

export async function startAdminSession(password: string): Promise<boolean> {
  const env = getEnv();
  if (!safeEqual(password, env.ADMIN_PASSWORD)) return false;

  const store = await cookies();
  store.set(SESSION_COOKIE, createSessionToken(env.SESSION_SECRET), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
  return true;
}

export async function endAdminSession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}
