# LILLIE — Deployment Checklist (v1.0)

Target: **Vercel** (hosting) + **Neon PostgreSQL** (database). Works identically
on any Node 18+/Next.js host (Railway, Fly.io, a VPS).

## 1. Pre-flight (local)

```bash
npm install
npx prisma generate
npx prisma validate       # schema is valid
npx prisma db push        # apply schema (idempotent)
npm run lint              # must be: No ESLint warnings or errors
npm test                  # must be: 26 passed
npm run build             # must succeed; check the route table
npm run dev               # smoke test: login → dashboard → preview → download
```

## 2. Environment variables (Vercel → Settings → Environment Variables)

**Required — production:**

| Variable | Notes |
|---|---|
| `GITHUB_CLIENT_ID` | Prod OAuth App client id |
| `GITHUB_CLIENT_SECRET` | Prod OAuth App secret (never commit) |
| `GITHUB_REDIRECT_URI` | `https://<your-domain>/api/auth/callback` |
| `SESSION_SECRET` | `openssl rand -hex 32` |
| `DATABASE_URL` | Neon PostgreSQL connection string (`?sslmode=require`) |

**Optional:**

| Variable | Notes |
|---|---|
| `NEXT_PUBLIC_APP_URL` | Canonical domain — share links, sitemap, redirects |
| `AI_API_KEY` / `AI_PROVIDER` / `AI_MODEL` / `AI_BASE_URL` | AI tools; unset → routes return 503 |
| `ANALYTICS_SALT` | Strong random string for visitor hashing |
| `BILLING_PROVIDER` | Billing; unset → checkout/portal return 503 |

> Add them to **Production** and **Preview** environments as appropriate.
> Preview deployments need their own OAuth App callback URL or the auth flow
> will fail against the preview domain.

## 3. GitHub OAuth App

- Create a **separate** OAuth App for production (callback URLs differ per domain).
- Authorization callback URL must exactly match `GITHUB_REDIRECT_URI`.
- Scopes: `read:user public_repo` (least privilege; `repo:status` intentionally removed).

## 4. Deploy

```bash
vercel --prod
# or: push to GitHub → Vercel auto-deploys from main
```

## 5. Post-deploy smoke test

- [ ] Landing page loads; OG/meta present (`/robots.txt`, `/sitemap.xml`, `/icon.svg` respond)
- [ ] Sign in with GitHub completes the full OAuth round trip
- [ ] Dashboard shows GitHub data + analytics (no console errors)
- [ ] Locale/template switching persists after refresh
- [ ] Download CV (.docx) and Download PDF work
- [ ] Create/rename/delete a profile; save a version; compare; share + open `/r/[token]`
- [ ] `curl -I https://<domain>/` shows security headers (nosniff, frame-ancestors, CSP in prod)
- [ ] `npm run build` locally passes with the same env values (CI parity)

## 6. Security checklist (production)

- `SESSION_SECRET` set (app fails fast without it) — never the dev fallback
- CSP header active (production build) — verify no blocked resources in DevTools
- Only `read:user public_repo` scopes requested
- Rate limits in place on all `/api/*` routes
- No secrets in client bundles (server-only modules: `src/lib/env.ts`, `src/lib/auth.ts`, `src/lib/db.ts`)

## 7. Future (post-launch) ops notes

- **Migrate lint off `next lint`** before the Next.js 16 upgrade — use the ESLint CLI
  (`npx eslint .`). `next lint` is deprecated (removal in Next 16).
- **Billing:** when a provider is wired, set `BILLING_PROVIDER` + provider
  credentials and exempt `/api/billing/webhook` from the IP rate limiter
  (provider webhooks share IPs — see `src/middleware.ts`).
- **Rate limiting at scale:** swap `InMemoryRateLimiter` for a Redis/Upstash
  limiter behind the same `check()` interface.
- **CSP hardening:** move to a nonce-based CSP when a nonce middleware is added
  (today `script-src 'unsafe-inline'` is required for the RSC bootstrap).
