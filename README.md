# Ecompay

Simple products sold through [Confío Pagos](https://developers.confiopagos.com). The owner creates a
product in `/admin`, pastes its stable URL (`https://<domain>/p/<slug>`) on a button on their website,
and buyers pay through Confío's checkout.

Stack: Next.js 16 (App Router, `proxy.ts`), TypeScript, Tailwind v4, Supabase Postgres (server-side
only, service role), zod, Vitest, pnpm.

## How it works

1. Buyer opens `/p/<slug>` → fills name, WhatsApp mobile (normalized to `+57XXXXXXXXXX`) and the
   product's custom questions.
2. A Server Action validates the form, inserts a `PENDING` order, calls
   `POST /v1/stores/{store}/payments` with `correlationId = idempotency-key = order.id` and
   `redirectUri = APP_URL/p/<slug>/return`, stores the payment id + checkout URL and redirects the buyer.
3. `/p/<slug>/return` ignores the `status` query param: it re-fetches the payment with
   `GET /v1/stores/{store}/payments/{payment}` and updates the order.
4. `POST /api/webhooks/confio` authenticates Confío (`Authorization: Bearer <CONFIO_WEBHOOK_SECRET>`),
   extracts the payment id from `data.name`, and re-fetches the payment before updating the order.
   The body is never trusted.

Paid = Confío `FUNDED`, `APPROVED` or `DELIVERING`. An order is never marked paid if the fetched
amount/currency does not match the order snapshot.

## Code layout

```
src/
  modules/
    products/  domain (schemas, money) · application (use cases) · infrastructure (Supabase repo)
    orders/    domain (order, phone, checkout form) · application (create-checkout, sync, return) · infrastructure
    payments/  domain (PaymentGateway port, status mapping, webhook checksum) · application (webhook) · infrastructure (Confío client)
  server/container.ts   composition root
  app/                  thin routes (public /p, /admin, /api/webhooks/confio)
  components/           container/presentational UI
  env.ts                single zod-validated env (server-only)
supabase/migrations/    schema
```

## Setup

```bash
pnpm install
```

### 1. Supabase

Create a project in the Supabase dashboard, then apply the migration in
`supabase/migrations/20261005000000_init.sql`, either:

- **CLI**: `supabase link --project-ref <ref>` then `supabase db push`, or
- **Dashboard**: paste the file into the SQL editor and run it.

RLS is enabled on every table with **no policies**. Only the service role key (server-side) can
access data. Never expose `SUPABASE_SERVICE_ROLE_KEY` to the browser.

### 2. Secrets with Doppler

`doppler.yaml` points to project `ecompay`, config `dev`.

```bash
doppler login
doppler projects create ecompay          # once
doppler setup                            # uses doppler.yaml
doppler secrets upload .env.example      # or set each key in the dashboard
pnpm dev                                 # = doppler run -- next dev
```

Without Doppler: copy `.env.example` to `.env.local` and run `pnpm dev:raw`.

Variables (see `.env.example`): `CONFIO_API_URL`, `CONFIO_ACCESS_TOKEN`, `CONFIO_STORE_ID`,
`CONFIO_WEBHOOK_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_PASSWORD`,
`SESSION_SECRET` (>= 32 chars), `APP_URL` (no trailing slash).

**Doppler → Vercel**: in Doppler, open the project → *Integrations* → *Vercel*, authorize, and map
Doppler configs to Vercel environments (e.g. `dev` → Development/Preview, `prd` → Production). Doppler
then syncs the secrets into the Vercel project's environment variables; redeploy after changes.

### 3. Confío dev environment

- Ask Confío for a dev access token, and get your store id:
  `curl https://api.dev.confiopagos.com/v1/stores -H "Authorization: Bearer $TOKEN"` →
  use the id from `stores/<id>`.
- Set `CONFIO_API_URL=https://api.dev.confiopagos.com`.
- Ask your Confío account manager to register `https://<domain>/api/webhooks/confio` and the
  `WEBHOOK_KEY` (use the same value as `CONFIO_WEBHOOK_SECRET`) for the `payment.statusChanged` and
  `paymentAttempt.statusChanged` events.
- Test payments: PSE with **Banco Unión Colombiano**, or card `4018810000190011`, CVV `123`, exp `12/34`.
- Webhooks need a public HTTPS URL; locally use a tunnel (e.g. `cloudflared`/`ngrok`) and set
  `APP_URL` to it.

### 4. Embed the button

In `/admin`, open a product and copy either the public URL or the HTML snippet:

```html
<a href="https://<domain>/p/<slug>">Comprar</a>
```

The slug is immutable after creation, so published buttons keep working.

## Scripts

| Command | Description |
| --- | --- |
| `pnpm dev` | Dev server with Doppler secrets |
| `pnpm dev:raw` | Dev server using `.env.local` |
| `pnpm test` | Vitest unit tests |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | `tsc --noEmit` |
| `SKIP_ENV_VALIDATION=1 pnpm build` | Production build without real secrets (CI) |
