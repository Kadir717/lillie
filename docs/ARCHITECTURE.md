# LILLIE — Architecture (docs)

> Last updated: Monetization Sprint
>
> The canonical, detailed architecture document lives at the repository root:
> **[`ARCHITECTURE.md`](../ARCHITECTURE.md)**. This file is a short index so the
> `/docs/` set is self-contained; it does not duplicate the root document.

## At a glance

- **Monolith:** Next.js 15 App Router — pages, server components, and API Route
  Handlers in one process. No separate backend service.
- **Auth:** GitHub OAuth (CSRF state) → stateless HS256 JWT in an httpOnly
  cookie (7-day). JWT carries the GitHub access token; user identity persists in
  the database.
- **Persistence:** Prisma + Neon PostgreSQL. Models: `User`, `CvProfile`,
  `CvVersion`.
- **CV pipeline:** `fetchGithubAggregate` → `CvModel` (single source of truth)
  → DOCX renderer **and** React preview from the same type/mapping.
- **Templates:** `classic_professional`, `developer_card`, `minimal` — parallel
  DOCX (`src/lib/templates/*`) + React (`src/cv/templates/react/*`) registries.
- **Resume engine:** immutable versions + comparison (`/api/profiles/[id]/versions*`),
  public share links + QR (`/api/profiles/[id]/share`, `/r/[token]`), print-to-PDF
  (`/print`), and snapshot XSS sanitization (`src/lib/sanitize-model.ts`).
- **GitHub analytics:** deterministic + explainable analytics in
  `src/lib/github-analytics.ts` (health scores, contribution analysis, best
  repos, README review, descriptions, profile review, achievements, tech stack
  radar, skills) — shared by the dashboard and `/api/github/insights`, with a
  bounded top-3 README fetch.
- **AI layer:** provider-agnostic services in `src/lib/ai/*` — prompts
  isolated in `prompts.ts`, business logic in `services.ts` (8 tools),
  plain-`fetch` providers (OpenAI-compatible + Gemini, zero new deps),
  registry-driven `POST /api/ai/[tool]`. UI stays prop-driven (CTO).
- **Job toolkit (deterministic):** `src/lib/jobs/*` — keyword extraction,
  matching, ATS, resume optimization, cover letter, internship mode. Job
  resumes reuse `buildCvDocumentFromModel` (no second generation path).
- **Interview toolkit (deterministic):** `src/lib/interview/*` —
  profile-aware question generation (technical + behavioral + system-design),
  mock sessions, answer evaluation engine (keyword + STAR scoring), recruiter
  feedback, salary estimation. Reuses CvModel + GitHub analytics; no AI.
- **Portfolio toolkit (deterministic):** `src/lib/portfolio/*` — bio
  variants, About, hero, shared project/skill ranking (`generator-shared.ts`),
  5 themes, LinkedIn optimization, JSON/HTML/Markdown export builders, central
  `loadPortfolioSource` loader. HTML export applies the `sanitize-model` URL
  scheme whitelist; no AI.
- **Analytics layer:** `AnalyticsEvent` + `GithubSnapshot` Prisma models,
  `src/lib/analytics/*` (fire-and-forget event trackers, daily growth
  upsert, DB-side report aggregator), `GET /api/analytics` (chart-ready
  series). Events hooked into generate-cv, /r/[token], portfolio
  export/website, share, dashboard — never fatal to product flows.
- **Billing/entitlements (provider-independent):** `src/lib/billing/*` —
  plan catalog (`plans.ts`), pure entitlements resolver + centralized
  row fetch (`entitlements.ts`), noop `BillingProvider` behind an
  interface (`provider.ts`), DB-counted usage limits (`usage.ts`),
  premium-template registry (`templates.ts`). No provider SDK; Stripe
  deliberately not assumed (founder in Uzbekistan).
- **API:** `/api/auth/*`, `/api/cv-model`, `/api/generate-cv`, `/api/profile`,
  `/api/profiles*`, `/api/github/insights`, `/api/ats-score`, `/api/ai/profile`,
  `/api/ai/[tool]` (resume-review, ats, rewrite, skill-recommendation,
  skill-gap, career-coach, roadmap, learning), `/api/jobs*` (tracking,
  match, resume, resume/download, cover-letter), `/api/interview/*`
  (questions, mock, evaluate, salary, feedback), `/api/portfolio/*`
  (bundle, bio, linkedin, website, export), `/api/analytics` (usage +
  growth report), `/api/billing/*` (plans, entitlements, checkout,
  portal, webhook).
- **Rate limiting:** in-memory middleware on `/api/*` (see `src/middleware.ts`);
  `/api/ai/*` gets a tighter 10 req/min budget since LLM calls cost money,
  `/api/interview/*` and `/api/portfolio/*` 20 req/min (each call hits GitHub),
  `/api/billing/*` 20 req/min (checkout/webhook abuse protection),
  `/api/analytics` uses the default 60 req/min (DB-only, no GitHub calls).

## Where things live

| Concern | Location |
|---------|----------|
| Auth / session / OAuth helpers | `src/lib/auth.ts` |
| GitHub aggregation + typed errors | `src/lib/github.ts` |
| CvModel type + mapping | `src/lib/cv-model.ts` |
| DOCX build + templates | `src/lib/cv-builder.ts`, `src/lib/templates/*` |
| React preview + templates | `src/cv/*` |
| i18n strings (11 locales) | `src/lib/cv-strings.ts` |
| Input validation | `src/lib/validate.ts` |
| Env validation | `src/lib/env.ts` |
| Prisma client | `src/lib/db.ts` |
| Rate limiting | `src/middleware.ts`, `src/lib/rate-limit.ts` |
| GitHub analytics (shared) | `src/lib/github-analytics.ts` |
| Analytics panel UI | `src/components/GitHubAnalyticsPanel.tsx` |
| AI types + errors | `src/lib/ai/types.ts`, `src/lib/ai/errors.ts` |
| AI prompts (all, pure) | `src/lib/ai/prompts.ts` |
| AI providers (fetch, no SDK) | `src/lib/ai/provider.ts` |
| AI services + registry | `src/lib/ai/services.ts` |
| AI tools endpoint | `src/app/api/ai/[tool]/route.ts` |
| Job keyword extraction | `src/lib/jobs/keywords.ts` |
| Job analysis (match/ATS/cover letter) | `src/lib/jobs/analyze.ts` |
| Job API routes | `src/app/api/jobs*` |
| Interview questions / evaluation / salary | `src/lib/interview/*` |
| Interview API routes | `src/app/api/interview/*` |
| Portfolio generators + themes + export | `src/lib/portfolio/*` |
| Portfolio API routes | `src/app/api/portfolio/*` |
| Analytics events + growth + report | `src/lib/analytics/*` |
| Analytics API route | `src/app/api/analytics/route.ts` |
| Billing plans / entitlements / provider / usage / templates | `src/lib/billing/*` |
| Billing API routes | `src/app/api/billing/*` |
| API routes | `src/app/api/*` |

See the root `ARCHITECTURE.md` for design decisions, security notes, and the
"not built yet" list.
