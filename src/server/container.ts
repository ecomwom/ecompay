import "server-only";

import { getEnv } from "@/env";
import { getSupabase } from "@/lib/supabase/server";
import { SupabaseLoginAttemptRepository } from "@/modules/auth/infrastructure/supabase-login-attempt-repository";
import { SupabaseOrderRepository } from "@/modules/orders/infrastructure/supabase-order-repository";
import { ConfioGateway } from "@/modules/payments/infrastructure/confio-gateway";
import { SupabaseProductRepository } from "@/modules/products/infrastructure/supabase-product-repository";

/** Composition root: wires infrastructure adapters into use cases (lazy, per call). */
export function getContainer() {
  const env = getEnv();
  const db = getSupabase();
  return {
    env,
    products: new SupabaseProductRepository(db),
    orders: new SupabaseOrderRepository(db),
    loginAttempts: new SupabaseLoginAttemptRepository(db),
    gateway: new ConfioGateway({
      baseUrl: env.CONFIO_API_URL,
      accessToken: env.CONFIO_ACCESS_TOKEN,
      storeId: env.CONFIO_STORE_ID,
    }),
  };
}
