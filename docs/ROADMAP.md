# LILLIE — Roadmap

> Last updated: Full-Repo Audit (v1.0 prep)

## Completed

- **Backend foundation** — Security (SESSION_SECRET fail-fast, env validation),
  input validation, Prisma persistence, `/api/profile` preferences API.
- **Sprint 2** — Preference persistence, API validation hardening, error
  handling, code quality.
- **Sprint 3** — Multiple CV profiles, GitHub Insights, ATS score API, modern
  dashboard, export improvements, settings page, deployment prep (Neon).
- **Sprint 4** — AI Insights UI shell (prop-driven placeholder cards),
  `/api/ai/profile` placeholder endpoint.
- **Sprint 5** — Dashboard data-flow refactor (single GitHub fetch, props).
- **Sprint 1** — Production hardening: rate limiting middleware, `/docs/`
  documentation set, ARCHITECTURE.md sync.
- **Resume Engine** — PDF export, resume versions/history/comparison,
  public share links + QR, `minimal` template, snapshot XSS hardening.
- **GitHub Analytics** — Deterministic explainable analytics:
  repo health score, contribution analysis, best-repo detection, README
  review, description generator, profile review, achievements, tech stack
  radar, skill detection. Deduplicated insights computation.
- **AI Sprint** — Reusable AI service layer `src/lib/ai/*`:
  provider-agnostic (OpenAI-compatible + Gemini via plain fetch), prompts
  separated from logic (`prompts.ts`), 8 tools registered in
  `services.ts` and exposed via `POST /api/ai/[tool]` (resume review, ATS,
  rewrite, skill recommendation, skill gap, career coach, roadmap,
  learning). UI intentionally not wired yet (CTO: keep prop-driven).
- **Job Sprint** — Deterministic job-search toolkit: `Job` Prisma
  model + `/api/jobs*` (tracking CRUD, match with caching, company resume
  download reusing `buildCvDocumentFromModel`, cover letter, internship
  mode). No AI — the AI layer stays dormant until production approval.
- **Interview Sprint** — Deterministic interview-prep toolkit
  reusing CvModel + GitHub analytics: `src/lib/interview/*` (question
  banks + generator, evaluation engine, salary estimator, feedback,
  mock-session assembler) + `/api/interview/*` (questions, mock, evaluate,
  salary, feedback). No schema changes, no AI.
- **Portfolio Sprint** — Deterministic portfolio toolkit
  reusing CvModel + GitHub analytics: `src/lib/portfolio/*` (bios,
  about, hero, shared project/skill ranking, 5 themes, LinkedIn
  optimization, JSON/HTML/Markdown export builders, central loader) +
  `/api/portfolio/*` (bundle, bio, linkedin, website, export). HTML
  export reuses the `sanitize-model` URL scheme whitelist. No schema
  changes, no AI.
- **Analytics Sprint** — Usage + growth analytics layer:
  `AnalyticsEvent` + `GithubSnapshot` Prisma models, `src/lib/analytics/*`
  (types, fire-and-forget event trackers, daily growth upsert, report
  aggregator), `GET /api/analytics` returning chart-ready overview,
  30-day event series, per-profile resume rollup, download breakdown by
  locale/template, export history, GitHub growth, and a performance
  report with notes. Events hooked into generate-cv, /r/[token] (salted
  visitor hash), portfolio export/website, share route and the dashboard
  (daily snapshot) — never fatal to product flows.
- **Full-Repo Audit Sprint (current)** — v1.0 preparation: security
  headers + production CSP, full SEO metadata (OG/Twitter, robots,
  sitemap, icon, viewport), `next/image` for avatars (CLS fix),
  `eslint.config.mjs` flat config (unblocks `npm run lint`, 0
  warnings/errors), Vitest + 26 unit tests, version 1.0.0,
  `.env.example`, dead-code cleanup (`cv-builder.ts.bak`, 30+ build
  artifacts), fixed a `<a>`→`<Link>` build error surfaced by the new
  lint. Added `docs/RELEASE_NOTES.md` + `docs/DEPLOYMENT.md`.
- **Monetization Sprint** — Provider-independent
  entitlements foundation: `User` billing fields (plan, planStatus,
  planExpiresAt, billingProvider, billingCustomerId,
  billingSubscriptionId, role), `src/lib/billing/*` (plan catalog
  free/pro/premium, pure entitlements resolver + centralized
  `getUserEntitlements`, noop `BillingProvider` behind an interface,
  DB-counted usage limits, empty premium-template registry), five
  `/api/billing/*` routes, `BILLING_LIMITER` middleware, and
  enforcement at every boundary (profile/job caps, premium template
  gate on POST/PATCH/share/generate-cv, monthly export cap). No
  provider SDK; Stripe deliberately not assumed (founder in
  Uzbekistan). Checkout/portal return 503 until a provider is wired.

## Next (Sprint 6+)

0. **Ship v1.0** — follow `docs/DEPLOYMENT.md`; smoke-test OAuth,
   dashboard, downloads, versions, sharing, analytics, billing 503s.
1. **Wire a real payment provider** — implement the `BillingProvider`
   interface (e.g. Lemon Squeezy / Paddle / a gateway available in
   Uzbekistan), set `BILLING_PROVIDER`, map webhook events onto
   User.plan/planStatus/planExpiresAt, and exempt `/api/billing/webhook`
   from the IP limiter (provider webhooks share IPs). UI: pricing page +
   upgrade buttons driven by `/api/billing/plans`.
2. **Premium templates** — add the first premium template id to
   `PREMIUM_TEMPLATES` (and `VALID_TEMPLATES`); gate
   `POST /api/profiles/[id]/versions` too (documented gate point).
3. **ATS Score UI widget** — connect existing `/api/ats-score` (or the new
   AI `/api/ai/ats`) to the dashboard.
4. **DeveloperProfile integration** — expose Claude's canonical model via a new
   `/api/developer-profile` route; wire AI Insights cards to real data (skills
   and achievements from Claude's model will replace/augment the deterministic
   versions when ready).
5. **AI UI wiring** — once Claude exposes data, connect `src/components/ai/*`
   cards to the new `POST /api/ai/*` tools (per-feature loading/error states
   already exist in the shell).
6. **Tests** — targeted tests for validation, auth, and the most dangerous
   backend paths (now includes `sanitize-model`, `github-analytics`, version
   ownership, share token handling, the AI parse/shape guards, the job
   matching/keyword logic, and the billing entitlements/limit resolvers).
7. **Job UI** — dashboard section for the new `/api/jobs*` endpoints (job
   list, match score, keyword coverage, cover letter view, company resume
   download, internship toggle).
8. **Interview UI** — mock-interview flow (question cards, answer box,
   per-answer evaluation, final recruiter-feedback report, salary card)
   wired to `/api/interview/*`.
9. **Interview question bank expansion** — more per-language/role questions
   and STAR prompts; the generator is data-driven, so adding templates is
   additive.
10. **Portfolio UI** — dashboard section wired to `/api/portfolio/*` (bio
    variant picker, theme selector, LinkedIn copy, personal-website export
    buttons).
11. **Portfolio deployment** — one-click static export for Vercel/Netlify
    (the HTML export is already self-contained; a full site generator with
    routing is a possible later enhancement).
12. **Analytics UI / charts** — dashboard section wired to
    `GET /api/analytics` (view/download cards, 30-day event chart,
    per-profile table, growth line chart, export history, performance
    notes). The data layer (`SeriesPoint[]` / `GrowthPoint[]`) is already
    chart-ready.
13. **Analytics enhancements** — referrer grouping, per-visitor session
    buckets, country/UA dimension (privacy-safe aggregates only), and a
    dedicated `ANALYTICS_SALT` requirement in production for stronger
    visitor hashing.

## Future product features (not yet scheduled)

- Work experience / education / skills data models (manual entry UI)
- Job-specific CV builder with experience/project selection
- AI-assisted CV improvements, professional summary, skill gap analysis
- GitHub profile badge
- Resume tailoring (AI-assisted)
- Free / Pro / Premium entitlements + usage limits — **implemented** (Monetization Sprint); pricing UI + real provider pending
- Payments (provider TBD — founder in Uzbekistan; Stripe not assumed)
- Public dashboard with opt-in aggregated stats
- Server-side PDF rendering (headless browser) for high-fidelity print control
- Distributed rate limiting (Redis/Upstash) if abuse becomes a problem
- Account deletion

## Architecture commitments

- Keep Next.js monolith. No microservices, no separate backend.
- No Redis / queues / workers until a demonstrated need.
- CvModel stays the single source of truth for preview + DOCX; job-optimized
  resumes are REORDERED CvModels fed through the same render engine
  (`buildCvDocumentFromModel`), never a second generation path.
- Dashboard calls `src/lib/` directly; API routes remain for external consumers.
