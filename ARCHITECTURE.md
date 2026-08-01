# LILLIE — Backend Architecture

## Overview

LILLIE is a Next.js 15 App Router monolith. The backend consists of API Route Handlers (`src/app/api/`) and server-side library code (`src/lib/`). There is no separate backend service — the Next.js server handles both rendering and API logic.

## Authentication

- **GitHub OAuth** via `api/auth/login` → `api/auth/callback` → JWT session.
- CSRF protection: random state token stored in httpOnly cookie, verified on callback.
- **Stateless JWT sessions** (HS256, 7-day expiry) stored in httpOnly cookies.
- The JWT payload contains the GitHub access token for server-side API calls without a database lookup.
- Trade-off: sessions cannot be individually revoked server-side. Logout deletes the cookie; the JWT remains valid until expiry. Acceptable at current scale.

## GitHub Scopes

- `read:user` — Read user profile (name, email, avatar, bio)
- `public_repo` — Read public repository metadata (stars, forks, languages)
- `repo:status` was intentionally removed — it grants commit status access to private repos, which LILLIE does not need.

## API Routes

| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `/api/auth/login` | GET | No | Redirect to GitHub OAuth |
| `/api/auth/callback` | GET | No (CSRF) | OAuth callback → session + DB upsert |
| `/api/auth/logout` | POST | No | Destroy session cookie |
| `/api/cv-model` | GET | Yes | Return CvModel JSON (GitHub → model mapping) |
| `/api/generate-cv` | GET | Yes | Generate and download .docx CV |
| `/api/profile` | GET / PATCH | Yes | Read/update user preferences |
| `/api/profiles` | GET / POST | Yes | List / create CV profiles |
| `/api/profiles/[id]` | GET / PATCH / DELETE | Yes | Read / update / delete a CV profile |
| `/api/profiles/[id]/versions` | GET / POST | Yes | List / save immutable resume versions |
| `/api/profiles/[id]/versions/[versionId]` | GET / DELETE | Yes | Fetch snapshot / delete a version |
| `/api/profiles/[id]/share` | GET / POST | Yes | Read / toggle public share state (token + snapshot) |
| `/api/github/insights` | GET | Yes | Extended GitHub statistics |
| `/api/ats-score` | GET | Yes | ATS resume score analysis (deterministic) |
| `/api/jobs` | GET / POST | Yes | List / create tracked jobs |
| `/api/jobs/[id]` | GET / PATCH / DELETE | Yes | Read / update / delete a job (ownership verified) |
| `/api/jobs/[id]/match` | GET | Yes | Compute + cache job match/ATS/keyword analysis |
| `/api/jobs/[id]/resume` | GET | Yes | Job-optimized CvModel (`?mode=standard\|internship`) |
| `/api/jobs/[id]/resume/download` | GET | Yes | Job-optimized .docx (shared render engine) |
| `/api/jobs/[id]/cover-letter` | GET | Yes | Deterministic cover letter |
| `/api/interview/questions` | GET | Yes | Profile-aware interview question set (`?count`, `?role`) |
| `/api/interview/mock` | GET | Yes | Mock interview session + instructions + pacing |
| `/api/interview/evaluate` | POST | Yes | Deterministic answer evaluation (keyword + STAR scoring) |
| `/api/interview/salary` | GET | Yes | Salary estimation (`?role`, `?years`, `?location`, `?currency`) |
| `/api/interview/feedback` | POST | Yes | Aggregated recruiter feedback from evaluated answers |
| `/api/portfolio` | GET | Yes | Full portfolio bundle (`?theme=`) — bios, about, content |
| `/api/portfolio/bio` | GET | Yes | Bio variants + About copy |
| `/api/portfolio/linkedin` | GET | Yes | LinkedIn headline / about / skills / featured / tips |
| `/api/portfolio/website` | GET | Yes | Self-contained HTML personal website (`?theme=`) |
| `/api/portfolio/export` | GET | Yes | Portfolio export download (`?format=json\|html\|markdown`, `?theme=`) |
| `/api/analytics` | GET | Yes | Usage + growth analytics report (chart-ready series) |
| `/api/billing/plans` | GET | No | Public plan catalog (+ `currentPlan` when authenticated) |
| `/api/billing/entitlements` | GET | Yes | Entitlements + current usage against limits |
| `/api/billing/checkout` | POST | Yes | Create provider checkout session (503 until a provider is configured) |
| `/api/billing/portal` | POST | Yes | Provider customer portal (501/503 until a provider is wired) |
| `/api/billing/webhook` | POST | No (signature) | Provider webhook entry — maps lifecycle events onto User plan fields |
| `/api/ai/[tool]` | POST | Yes | AI tools: resume-review, ats, rewrite, skill-recommendation, skill-gap, career-coach, roadmap, learning |
| `/api/ai/profile` | GET | Yes | AI profile analysis — placeholder (`coming_soon`) |
| `/print` | GET | Yes | Print-to-PDF page (browser save-as-PDF) |
| `/r/[token]` | GET | No | Public resume page from an unguessable share token |

All routes validate input, use proper HTTP status codes, and distinguish GitHub upstream errors from internal failures.

## GitHub Analytics

- **Deterministic + explainable.** `src/lib/github-analytics.ts` computes
  repository health scores, contribution analysis, best-repo detection, README
  reviews, generated project descriptions, profile review, achievements, tech
  stack radar and skill detection — all from the ALREADY-FETCHED aggregate.
  Every score carries a human-readable `explanation` (the explainability
  layer).
- **One shared module.** Dashboard and `/api/github/insights` both call
  `computeGithubAnalytics`, so there is no duplicated computation to keep in
  sync.
- **Bounded extra API usage.** `fetchTopReadmes` fetches raw README text for
  the top 3 repos only, with `Promise.allSettled` — a 404 or rate limit
  degrades to `null` instead of failing the request.
- **Rule-based, not AI.** Skill/achievement detection uses deterministic maps
  and confidence tiers (languages 0.9 / topics 0.7 / bio 0.5). Claude's future
  AI layer can supersede these when its contract lands.

## AI Services (`src/lib/ai/*`)

- **Provider-agnostic.** `src/lib/ai/provider.ts` defines an `AiProvider`
  interface with two built-in implementations — OpenAI-compatible Chat
  Completions (default) and Gemini — both via plain `fetch` (zero new
  dependencies). Selected with `AI_PROVIDER=openai|gemini`; requires
  `AI_API_KEY` (routes return **503** when unset).
- **Prompts separated from logic.** ALL prompts live in `src/lib/ai/prompts.ts`
  as pure functions (CV text in → `AiMessage[]` out). Business logic
  (validation, serialization, JSON parsing, shape guards) lives in
  `src/lib/ai/services.ts`. Adding a tool = add a prompt + a service +
  register it in `aiTools`.
- **Eight tools** exposed via `POST /api/ai/[tool]`: resume review, ATS score,
  resume rewrite, skill recommendation, skill gap, career coach, roadmap,
  learning. The body carries the already-fetched CvModel — no server-side
  GitHub round-trip per AI call.
- **Typed errors** (`errors.ts`) map to HTTP statuses: input → 400, provider
  failure → 502, unparseable output → 502, not configured → 503.
- **Not wired to the UI yet** — CTO decision: keep `src/components/ai/*`
  prop-driven until Claude exposes data. `/api/ai/profile` remains a
  placeholder.

## Job Toolkit (`src/lib/jobs/*`)

- **Deterministic and explainable.** Keyword extraction (`keywords.ts`,
  ~130 curated terms, boundary-aware matching), job matching (`analyze.ts`,
  0-100 fit from keyword 60% / language 25% / project 15% signals), ATS
  breakdown, resume optimization, cover letter and internship mode — all
  rule-based, no LLM (the AI layer stays dormant until production approval).
- **Integrates with the Resume Engine, never duplicates it.** Optimization
  and internship mode produce a REORDERED `CvModel` — the same shape the
  renderers consume. `cv-builder.ts` gained a shared
  `buildCvDocumentFromModel(model, locale, template)`; `buildCvDocument`
  delegates to it, and `/api/jobs/[id]/resume/download` uses it too. There
  is exactly one place that turns a CvModel into a `.docx`.
- **Match results are cached** (`matchScore` + `matchJson` on the `Job`
  row) so list/detail views avoid recomputation; `GET /api/jobs/[id]/match`
  refreshes.
- **Persistence.** `Job` model (company, title, url, description, status,
  priority, notes, appliedAt, deadline, cached match) owned by `User`.

## Interview Toolkit (`src/lib/interview/*`)

- **Deterministic and explainable.** No LLM — the AI layer stays dormant
  until production approval. All scoring is rule-based with transparent
  criteria.
- **Question generation** (`questions.ts`): ~30 technical templates keyed by
  language or skill category + 8 STAR-based behavioral questions. Picks by the
  user's top languages and detected skill categories, adds system-design for
  mid/senior, always includes 3 behavioral, caps at 10.
- **Evaluation engine** (`evaluation.ts`): boundary-aware keyword coverage +
  depth/STAR scoring; returns score, strengths, weaknesses, improvements, and
  optional STAR elements for behavioral answers.
- **Salary estimation** (`salary.ts`): transparent role base × experience
  multiplier × location factor, clamped to a realistic range, always ships a
  disclaimer.
- **Recruiter feedback** (`feedback.ts`): aggregates evaluated answers into a
  readiness score with per-category averages, strengths and improvements.
- **Reuses existing data.** Questions and salary draw on the already-fetched
  CvModel + GitHub analytics — no extra GitHub round-trips beyond the one
  shared aggregate.
- **Rate limited.** `/api/interview/*` gets its own 20 req/min budget in
  `src/middleware.ts` (each request touches GitHub).

## Portfolio Toolkit (`src/lib/portfolio/*`)

- **Deterministic and explainable.** No LLM — the AI layer stays dormant
  until production approval. Content is COMPOSED from the single-source-of-
  truth data already fetched for the CV (CvModel + GithubAnalyticsData) —
  best repos, project descriptions, achievements, skills and tech stack come
  from `computeGithubAnalytics`, never re-implemented.
- **One ranking, many surfaces.** `generator-shared.ts` owns `topSkills` and
  `featuredProjects`; both the portfolio generator and the LinkedIn
  optimizer import from it, so a project/skill never ranks differently per
  surface.
- **Generators** (`generator.ts`): three bio tone variants, long-form About,
  full `PortfolioContent` (hero, stats, skills, featured projects,
  achievements, tech stack, profile review).
- **Themes** (`themes.ts`): 5 themed palettes (minimal, developer, bold,
  elegant, sunrise) with colors/fonts/layout/radius; `validateTheme` guards
  every API boundary (invalid → 400).
- **Exports** (`export.ts`): JSON (pretty), Markdown (README-style), and a
  self-contained HTML personal website (inline theme CSS, zero external
  assets). HTML reuses the `sanitize-model` URL scheme whitelist
  (`https?:`) on every `href`/`src` plus HTML-escaping on all text —
  GitHub-supplied content cannot inject markup.
- **Central loader** (`load.ts`): `loadPortfolioSource` fetches aggregate +
  READMEs + analytics + CvModel once; every route calls it instead of
  re-implementing the pipeline.
- **Rate limited.** `/api/portfolio/*` gets its own 20 req/min budget in
  `src/middleware.ts` (each request touches GitHub).

## Analytics (`src/lib/analytics/*`)

- **Event log.** `AnalyticsEvent` (userId?, profileId?, type, metadata,
  salted visitorHash, createdAt) records downloads, public resume views,
  portfolio exports/websites and share toggles. All trackers are
  fire-and-forget with internal try/catch — a DB failure can never break a
  download, render, or export.
- **Growth snapshots.** `GithubSnapshot` (one row per user per UTC day)
  tracks stars/repos/forks/followers; the dashboard upserts today's row
  from data it already fetched (no extra GitHub calls).
- **Report aggregator.** `buildAnalyticsReport(userId)` returns overview
  counts, a zero-filled 30-day event series, per-profile resume rollup,
  download breakdown by locale/template, export history, growth series,
  and a performance summary with notes. Aggregation happens in the DB
  (count/groupBy) — no row-by-row JS over large tables.
- **Privacy.** Visitor analytics use a salted SHA-256 of the IP (never the
  raw IP); `ANALYTICS_SALT` should be set in production. All queries are
  scoped to the session user.
- **Attribution.** Public resume views carry the OWNER's userId (resolved
  from the share-token lookup, not a session) so per-user reports can
  attribute them — the visitor's identity stays anonymous.

## Billing & Entitlements (`src/lib/billing/*`)

- **Provider-independent by design.** `src/lib/billing/provider.ts` defines
  the `BillingProvider` interface (checkout, cancel, webhook parse) plus a
  noop provider. The app NEVER imports a provider SDK and never hardcodes a
  payment provider — Stripe is deliberately not assumed (founder in
  Uzbekistan). A future provider (Lemon Squeezy, Paddle, a local gateway)
  implements 5 methods and registers via `registerBillingProvider`.
- **Mapping is `User → plan → entitlements → limits`, never
  `if (stripePayment) ...`.** `plans.ts` is a static catalog
  (free/pro/premium) with per-plan limits (profiles, jobs, monthly
  exports, premium templates, reserved AI credits). `entitlements.ts`
  resolves a persisted User row into feature flags; canceled/expired or
  malformed plan values fall back to free. Entitlements are resolved fresh
  per request (never baked into the JWT), so webhook-driven plan changes
  take effect immediately.
- **Centralized row fetch.** `getUserEntitlements(githubId)` is the single
  query every route uses to load a user's entitlements — no duplicated
  select shapes across routes.
- **Usage limits** (`usage.ts`): counts are computed in the database
  (profile count, job count, monthly export events). `checkLimit` gates
  NEW creations (403 on cap) — existing data is never deleted or blocked.
  Documented TOCTOU limitation: check-then-create can over-create by one
  under concurrency (DB-level guard is the future hardening).
- **Premium templates** (`templates.ts`): the set is empty today (all
  shipping templates stay free); the gate (`templateAllowed`) is already
  applied at every template-accepting boundary — POST/PATCH profiles,
  share enable, generate-cv — so shipping a premium template is a
  registry entry, not a wiring change.
- **Routes:** `/api/billing/plans` (public catalog), `/entitlements`
  (entitlements + usage), `/checkout` + `/portal` (503 until a provider is
  configured), `/webhook` (noop → 200 until a provider maps events).
  `/api/billing/*` is rate-limited to 20 req/min in middleware; the
  webhook path should be exempted when a real provider ships (its
  webhooks share provider IPs).

## Rate Limiting

- Lightweight in-memory sliding-window rate limiting via `src/middleware.ts` (no Redis).
- Per-IP limits: `/api/auth/*` 20 req/min, `/api/generate-cv` 10 req/min,
  `/api/ai/*` 10 req/min (LLM calls cost money), `/api/interview/*` and
  `/api/portfolio/*` 20 req/min (each call hits GitHub), `/api/billing/*`
  20 req/min (checkout/webhook abuse protection), `/api/analytics`
  uses the default 60 req/min (DB-only), all other `/api/*` 60 req/min.
- Exceeded limits return **429** with a JSON error and `Retry-After` header.
- Limitation: counters are per server instance / edge isolate, so on multi-instance deploys this is best-effort, not a global quota. A Redis-backed limiter (same `check()` interface) is the documented future upgrade path.

## Persistence

- **Prisma + Neon PostgreSQL** for both local development and production.
- Uses a single `postgresql` provider — the same schema and migrations power both environments.

### Database Models

- **User** — Core user record, created/updated on GitHub OAuth login. Stores
  preferences (locale, template) and billing/entitlement fields (`plan`
  free/pro/premium, `planStatus` lifecycle, `planExpiresAt`, optional
  `billingProvider`/`billingCustomerId`/`billingSubscriptionId`, internal
  `role`).
- **AnalyticsEvent** — one row per tracked action (resume_view,
  cv_download, portfolio_export, portfolio_website, profile_share) with
  optional profile link and salted visitor hash for public views.
- **GithubSnapshot** — daily stars/repos/forks/followers per user, one row
  per UTC day, for growth charts.
- **CvProfile** — Named CV configurations owned by a user. Each stores a title, locale, and template. Users can maintain multiple CV variants (e.g., "Software Engineer", "Backend Developer"). Created via the dashboard UI. Also carries the public-share state (`shareEnabled`, unguessable `shareToken`, and a frozen `shareModel` snapshot).
- **CvVersion** — Immutable snapshot of a CV (CvModel JSON + locale/template + optional label) at a point in time. Enables resume history, versioning, and side-by-side comparison.

## Template Architecture

- **Two parallel registries**, kept in sync by contract:
  - `src/lib/templates/*` — DOCX renderers implementing `CvTemplate` (used by `cv-builder.ts`).
  - `src/cv/templates/react/*` — preview renderers implementing `CvReactTemplate` (used by `<CvPreview>`).
- Both consume the **same `CvModel`** and the **same `CvStrings`** table — no second mapping layer.
- **Registering a template** requires four edits: the DOCX file, the React file, `src/lib/templates/index.ts`, and `src/cv/templates/react/index.ts` — plus adding the ID to `VALID_TEMPLATES` in `src/lib/validate.ts` and (optionally) the dashboard's `TEMPLATES` list.
- Current templates: `classic_professional`, `developer_card`, `minimal`.

## Resume Engine (versions, sharing, print)

- **Versions** — `POST /api/profiles/[id]/versions` freezes the current CvModel into a `CvVersion`; list/get/delete via the `/versions*` routes. Comparison uses the pure `src/lib/cv-compare.ts` diff (no framework, no fetch).
- **Sharing** — `POST /api/profiles/[id]/share` snapshots the current model into `CvProfile.shareModel`, generates a 24-byte base64url token, and serves it at `/r/[token]` without any auth or GitHub access. Disabling flips `shareEnabled` and revokes the link.
- **Snapshot sanitization** — every client-submitted model is passed through `src/lib/sanitize-model.ts` (shape validation + URL-scheme whitelist) before being stored, preventing stored-XSS on the public page via `javascript:` URLs.
- **PDF export** — `/print` renders the same `<CvPreview>` full-size and triggers the browser's print dialog (`@page A4` + `@media print` CSS). No server-side PDF library; a headless-browser renderer is the documented future path if fidelity needs grow.

## Key Design Decisions

1. **CvModel is the single source of truth** — both the DOCX renderer and the React preview consume the same type from the same mapping function. No second mapping layer, no parsing of generated .docx files.

2. **Template/locale switching is instant** — CvModel is locale/template agnostic. The client fetches it once and re-renders locally on every selector change.

3. **Preferences survive page refresh** — saved to the database, loaded on dashboard mount, updated via PATCH /api/profile or via profile-specific PATCH /api/profiles/[id].

4. **Non-blocking preference saves** — if the PATCH fails, the UI continues working with the updated state. The preference syncs on next page load.

5. **GitHub access token not stored in DB** — lives only in the JWT session (7-day max). Reduces exposure and simplifies token lifecycle management.

6. **Multiple CV profiles** — Users can create, rename, delete, and switch between named CV configurations. Each profile stores its own locale and template settings. The profile selector is a client component with debounced saves.

7. **GitHub Insights** — Extended statistics (contribution summary, repo health, language distribution, project maturity) are computed server-side from already-fetched aggregate data and returned via a separate endpoint.

8. **ATS Score** — A heuristic analysis of the CV against role-specific keywords. Computes keyword match rate, section scores, strengths, weaknesses, and improvement suggestions.

## Sprint 3 — Multiple CV Profiles

- **Schema**: `CvProfile` model with userId foreign key, unique [userId, title], cascade delete.
- **API**: Full CRUD at `/api/profiles` and `/api/profiles/[id]` with ownership verification.
- **UI**: `ProfileSelector` dropdown component with create/rename/delete actions.
- **Integration**: Dashboard loads profiles and passes them to `CvPreviewPanel`. Locale/template changes are debounced and saved to the selected profile.

## Security Decisions

- Session cookie: httpOnly, secure (production), sameSite=lax, 7-day expiry.
- SESSION_SECRET required in production — missing it throws on startup.
- All user-controlled params (locale, template, title) validated against allowed sets — never trusted directly.
- Profile ownership verified on every mutation (user can only access their own profiles).
- GitHub API errors distinguished by type (auth, rate limit, generic) with appropriate HTTP status codes.
- AI provider output never trusted: JSON replies are shape-validated before
  use, and provider/parse failures surface as 502/503 — never a stack trace.
- Billing is provider-independent: no payment-provider SDK or hardcoded
  provider name anywhere outside `src/lib/billing/provider.ts`; entitlement
  decisions read the `User → plan → entitlements` chain, never provider flags.
- Entitlement gates return 403 with a user-safe message; plan strings from
  the DB are validated (`isValidPlanId`) so stale/malformed values can
  never surface as a plan the user isn't entitled to.

## What Is Intentionally Not Built Yet

- Work experience, education, skills, projects data models
- Job-specific CV builder
- AI-assisted features wired to the UI (service layer + API exist; UI pending
  DeveloperProfile contract from Claude)
- Payments / a real payment provider (entitlements layer is built and
  provider-independent; checkout/portal return 503 until `BILLING_PROVIDER`
  is set and a provider module is registered)
- Analytics
- Redis / caching layer (rate limiting uses in-memory middleware, not Redis)
- Testing infrastructure
- Server-side PDF rendering (headless browser) — print-to-PDF covers current needs
- Account deletion

These will be added incrementally as the product grows.
