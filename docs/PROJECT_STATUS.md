# LILLIE — Project Status

> Last updated: Full-Repo Audit (v1.0 prep)

## Summary

LILLIE is a Next.js 15 App Router monolith: GitHub OAuth → JWT session → GitHub
data aggregation → CvModel → DOCX generation + React preview. Persistence via
Prisma + Neon PostgreSQL. The product is in production with real users.

## Overall status: PRODUCTION-READY CORE, SAFE TO SHIP

| Area | Status | Notes |
|------|--------|-------|
| GitHub OAuth | ✅ Done | CSRF state, httpOnly cookie, 7-day JWT session |
| JWT sessions | ✅ Done | HS256, secure cookie flags, no DB session store (documented trade-off) |
| Input validation | ✅ Done | `validate.ts` — locale/template/title validated at every boundary |
| Error handling | ✅ Done | Typed GitHub errors → 400/401/404/409/429/500/502 |
| Env validation | ✅ Done | `env.ts` — fails fast in production when secrets missing |
| Persistence | ✅ Done | Prisma + Neon PostgreSQL, `User` + `CvProfile` models |
| CV generation | ✅ Done | DOCX (2 templates, 11 locales), React preview, Arabic RTL |
| Multiple CV profiles | ✅ Done | CRUD + ownership verification + dashboard selector |
| GitHub Insights | ✅ Done | Contribution summary, repo health, languages, maturity |
| GitHub Analytics (deep) | ✅ Done (GA Sprint) | Health scores, best repos, contribution analysis, tech stack radar, skills, achievements, profile review, README review, description generator |
| Explainability layer | ✅ Done (GA Sprint) | Every score ships a human-readable explanation; shared `github-analytics.ts` |
| Analytics computation dedup | ✅ Done (GA Sprint) | `computeInsights` duplication removed — dashboard + `/api/github/insights` share one module |
| ATS score | ✅ Done (API) | `/api/ats-score` — UI widget not yet built |
| AI Insights UI shell | ✅ Done | Prop-driven placeholder cards, no AI wired |
| Rate limiting | ✅ Done (Sprint 1) | In-memory middleware: auth 20/min, generate-cv 10/min, others 60/min |
| Dashboard data flow | ✅ Done | Single GitHub fetch on load, passed to client as props |
| Documentation | ✅ Done | `/docs/*` created, `ARCHITECTURE.md` updated |
| PDF export | ✅ Done (Resume Engine) | `/print` route → browser print-to-PDF, `@page A4` CSS |
| Resume history / versions | ✅ Done (Resume Engine) | `CvVersion` model + `/api/profiles/[id]/versions*` |
| Resume comparison | ✅ Done (Resume Engine) | `src/lib/cv-compare.ts` + UI in `VersionHistory` |
| Public resume link + QR | ✅ Done (Resume Engine) | `/r/[token]` page + `/api/profiles/[id]/share` + QR |
| Minimal template | ✅ Done (Resume Engine) | DOCX + React, 3rd template, registered + validated |
| Snapshot XSS sanitization | ✅ Done (Resume Engine) | `src/lib/sanitize-model.ts` on share/versions writes |
| Job Tracking | ✅ Done (Job Sprint) | `Job` model + `/api/jobs` CRUD (status/priority/dates) |
| Company Keyword Extraction | ✅ Done (Job Sprint) | `src/lib/jobs/keywords.ts` — ~130 terms, category-sorted, boundary-aware |
| Job Matching | ✅ Done (Job Sprint) | `POST /api/jobs/[id]/match` — 0-100 fit, keyword/language/project signals, cached |
| Resume Optimization | ✅ Done (Job Sprint) | `/api/jobs/[id]/resume` — reordered CvModel for the job (same shape) |
| ATS Optimization | ✅ Done (Job Sprint) | Job-specific ATS breakdown in match payload |
| Cover Letter Generator | ✅ Done (Job Sprint) | Deterministic template, `/api/jobs/[id]/cover-letter` |
| Company Resume Generator | ✅ Done (Job Sprint) | `/api/jobs/[id]/resume/download` — reuses `buildCvDocumentFromModel` |
| Internship Mode | ✅ Done (Job Sprint) | `?mode=internship` — learning-first reorder + advice |
| Interview Questions | ✅ Done (Interview Sprint) | Profile-aware generation from skills + languages |
| Technical Questions | ✅ Done (Interview Sprint) | ~30-question bank keyed by skill/language |
| Behavioral Questions | ✅ Done (Interview Sprint) | 8 STAR-based questions, always included |
| Mock Interview | ✅ Done (Interview Sprint) | `/api/interview/mock` — session + instructions + pacing |
| Evaluation Engine | ✅ Done (Interview Sprint) | `/api/interview/evaluate` — keyword + STAR scoring |
| Recruiter Feedback | ✅ Done (Interview Sprint) | `/api/interview/feedback` — readiness score + per-category |
| Salary Estimation | ✅ Done (Interview Sprint) | `/api/interview/salary` — role/experience/location, disclaimer |
| Question Generator | ✅ Done (Interview Sprint) | `src/lib/interview/questions.ts` — deterministic |
| Portfolio Generator | ✅ Done (Portfolio Sprint) | `src/lib/portfolio/*` + `/api/portfolio` — bios, about, hero, skills, projects, achievements |
| Personal Website | ✅ Done (Portfolio Sprint) | `/api/portfolio/website` + `/api/portfolio/export?format=html` — self-contained HTML |
| LinkedIn Optimization | ✅ Done (Portfolio Sprint) | `/api/portfolio/linkedin` — headline, about, skills, featured, tips |
| Bio Generator | ✅ Done (Portfolio Sprint) | 3 tone variants, `/api/portfolio/bio` |
| About Generator | ✅ Done (Portfolio Sprint) | long-form About from profile + analytics |
| Portfolio Themes | ✅ Done (Portfolio Sprint) | 5 themes + `validateTheme` at every boundary |
| Portfolio Export | ✅ Done (Portfolio Sprint) | json / markdown / html downloads |
| Portfolio HTML hardening | ✅ Done (Portfolio Sprint) | `safeUrl` scheme whitelist (same rule as `sanitize-model`) on all href/src |
| Resume Analytics | ✅ Done (Analytics Sprint) | per-profile views/downloads/last-viewed (`AnalyticsEvent`) |
| Visitor Analytics | ✅ Done (Analytics Sprint) | public resume views + salted visitor hash (privacy-safe uniques) |
| Download Analytics | ✅ Done (Analytics Sprint) | `/api/generate-cv` → `cv_download` events, locale/template breakdown |
| GitHub Growth | ✅ Done (Analytics Sprint) | daily `GithubSnapshot` (stars/repos/forks/followers), dashboard upsert |
| Export History | ✅ Done (Analytics Sprint) | portfolio exports + website generations, recent list |
| Dashboard Analytics | ✅ Done (Analytics Sprint) | `GET /api/analytics` — overview, 30-day series, breakdowns |
| Charts (data layer) | ✅ Done (Analytics Sprint) | chart-ready `SeriesPoint[]` / `GrowthPoint[]` payloads |
| Performance Reports | ✅ Done (Analytics Sprint) | top profile, best day, growth deltas, notes |
| Analytics event hooks | ✅ Done (Analytics Sprint) | generate-cv, /r/[token], portfolio export/website, share, dashboard — all fire-and-forget, never fatal |
| Plan catalog (Free/Pro/Premium) | ✅ Done (Monetization Sprint) | `src/lib/billing/plans.ts` — limits: profiles, jobs, monthly exports, premium templates, AI credits (reserved) |
| Entitlements resolver | ✅ Done (Monetization Sprint) | `src/lib/billing/entitlements.ts` — plan/status/expiry → feature flags; falls back to free; `getUserEntitlements` centralizes the row fetch |
| Provider-independent billing | ✅ Done (Monetization Sprint) | `src/lib/billing/provider.ts` — `BillingProvider` interface + noop; no provider SDK, no hardcoded provider (Uzbekistan constraint) |
| Usage limits + enforcement | ✅ Done (Monetization Sprint) | `src/lib/billing/usage.ts` — profiles/jobs caps, monthly export cap (DB counts); enforced in profiles/jobs/portfolio routes (403) |
| Premium template gate | ✅ Done (Monetization Sprint) | `templateAllowed` at every template-accepting boundary (POST, PATCH, share, generate-cv); set empty today, wired for the future |
| Billing API routes | ✅ Done (Monetization Sprint) | `/api/billing/plans`, `/entitlements`, `/checkout`, `/portal`, `/webhook` — checkout/webhook return 503/200 until a provider is wired |
| Billing rate limiting | ✅ Done (Monetization Sprint) | `/api/billing/*` 20 req/min in middleware (webhook exemption noted for when a provider ships) |
| Tests | ✅ Done (Audit Sprint) | Vitest — 26 unit tests (validate, entitlements, plans, sanitize-model); `npm test` |
| ESLint | ✅ Done (Audit Sprint) | `eslint.config.mjs` flat config — `npm run lint` runs non-interactively, 0 warnings/errors |
| Security headers | ✅ Done (Audit Sprint) | nosniff, Referrer-Policy, X-Frame-Options DENY, Permissions-Policy, production-only CSP |
| SEO | ✅ Done (Audit Sprint) | OG/Twitter metadata, `robots.ts`, `sitemap.ts`, `icon.svg`, viewport/themeColor |
| `.env.example` | ✅ Done (Audit Sprint) | All required/optional vars with placeholders (postgres URL) |
| ATS UI widget | ❌ Not started | API exists, dashboard widget missing |
| AI layer | ✅ API (AI Sprint) | Reusable service layer `src/lib/ai/*` — 8 tools, prompts separated, provider-agnostic (OpenAI-compatible + Gemini), zero new deps. UI intentionally not wired (CTO) |
| AI rate limiting | ✅ Live | `/api/ai/*` 10 req/min in `src/middleware.ts` |

## Recent milestones

- **Full-Repo Audit Sprint (this)** — v1.0 preparation: security headers +
  production-only CSP in `next.config.ts`; full SEO metadata (OG/Twitter,
  `robots.ts`, `sitemap.ts`, `icon.svg`, viewport); avatar images moved to
  `next/image` (CLS fix); `eslint.config.mjs` flat config unblocking
  `npm run lint` (0 warnings); Vitest + 26 targeted unit tests; version
  bump to 1.0.0; `.env.example`; dead-code cleanup (30+ build-artifact
  `.txt` files, `cv-builder.ts.bak`); fixed a `<a>`→`<Link>` build error
  and unused-variable warnings the new lint surfaced. Docs:
  `RELEASE_NOTES.md`, `DEPLOYMENT.md` added.
- **Monetization Sprint** — Provider-independent entitlements
  foundation: `User.plan/planStatus/planExpiresAt/billingProvider/…/role`
  Prisma fields, `src/lib/billing/*` (plan catalog free/pro/premium,
  pure entitlements resolver + centralized row fetch, noop billing
  provider behind a `BillingProvider` interface, DB-counted usage limits,
  empty premium-template registry), five `/api/billing/*` routes
  (plans, entitlements, checkout, portal, webhook), middleware
  `BILLING_LIMITER`, and enforcement at every boundary (profile/job
  caps → 403, premium template gate on POST/PATCH/share/generate-cv,
  monthly export cap on portfolio routes). No provider SDK, no
  hardcoded payment provider — Stripe deliberately not assumed
  (founder in Uzbekistan). Checkout/portal return 503 until
  `BILLING_PROVIDER` is set and a provider is registered.
- **Analytics Sprint** — Usage + growth analytics layer: `AnalyticsEvent`
  + `GithubSnapshot` Prisma models, `src/lib/analytics/*` (events, growth,
  report), `GET /api/analytics` (chart-ready overview, 30-day series,
  per-profile rollup, download breakdown by locale/template, export history,
  GitHub growth, performance notes). Events hooked into generate-cv,
  /r/[token] (salted visitor hash), portfolio export/website, share route,
  and the dashboard (daily snapshot) — all fire-and-forget, never fatal.
  Public resume views are attributed to the owner via the token lookup;
  visitor identity stays anonymous.
- **Portfolio Sprint** — Deterministic portfolio toolkit reusing
  CvModel + GitHub analytics: `src/lib/portfolio/*` (bio variants, About,
  hero, shared project/skill ranking via `generator-shared.ts`, 5 themes,
  LinkedIn optimization, JSON/HTML/Markdown export builders, central
  `loadPortfolioSource` loader) + `/api/portfolio/*` (bundle, bio, linkedin,
  website, export). HTML export applies the `sanitize-model` URL scheme
  whitelist. No schema changes, no AI (layer stays dormant).
- **Interview Sprint** — Deterministic interview-prep toolkit reusing
  CvModel + GitHub analytics: profile-aware question generation (technical +
  behavioral + system-design), mock sessions, answer evaluation engine
  (keyword + STAR scoring), recruiter feedback, salary estimation. No schema
  changes, no AI (layer stays dormant).
- **Job Sprint** — Deterministic job-search toolkit integrated with the
  Resume Engine: `Job` Prisma model + `/api/jobs*` routes (tracking, matching,
  ATS, resume optimization, company resume download, cover letter, internship
  mode). Reuses `buildCvDocumentFromModel` — no duplicated generation. No AI
  (layer stays dormant until production approval).
- **AI Sprint** — Reusable AI service layer: `src/lib/ai/*` with
  provider abstraction (OpenAI-compatible + Gemini via plain `fetch`, zero
  new dependencies), all prompts isolated in `src/lib/ai/prompts.ts`,
  business logic in `src/lib/ai/services.ts` (8 tools: resume review, ATS,
  rewrite, skill recommendation, skill gap, career coach, roadmap, learning),
  registry-driven `POST /api/ai/[tool]`. UI stays prop-driven per CTO.
- **GitHub Analytics** — Deterministic, explainable analytics: repo
  health score, contribution analysis, best-repo detection, README review,
  description generator, profile review, achievements, tech stack radar,
  skill detection. Deduplicated `computeInsights` into `github-analytics.ts`.
- **Resume Engine** — PDF export, resume history/versions/comparison,
  public share links with QR codes, `minimal` template, snapshot XSS hardening.
- **Sprint 1** — Rate limiting middleware, `/docs/` documentation set.
- **Sprint 5** — Dashboard data-flow refactor: eliminated duplicate GitHub
  fetches (server fetches once, passes `initialModel` / `initialData` props).
- **Sprint 4** — AI Insights placeholder UI + `/api/ai/profile`.
- **Sprint 3** — Multiple CV profiles, GitHub Insights, ATS API, settings page,
  modern dashboard, export filename improvements.
- **Sprint 2** — Preference persistence, API validation hardening, DB layer.
- **Backend foundation** — SESSION_SECRET fail-fast, env validation, input
  validation, Prisma + User model, `/api/profile`.
