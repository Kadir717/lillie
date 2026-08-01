# LILLIE — Feature Inventory

> Last updated: Full-Repo Audit (v1.0 prep)

| Feature | Status | Where |
|---------|--------|-------|
| GitHub OAuth login | ✅ Live | `/api/auth/login`, `/api/auth/callback` |
| CSRF state protection | ✅ Live | random state cookie, verified on callback |
| JWT session (7d, httpOnly) | ✅ Live | `src/lib/auth.ts` |
| Logout | ✅ Live | `/api/auth/logout` |
| GitHub data aggregation | ✅ Live | `src/lib/github.ts` |
| CvModel mapping | ✅ Live | `src/lib/cv-model.ts` |
| DOCX generation (3 templates) | ✅ Live | `src/lib/cv-builder.ts`, `src/lib/templates/*` |
| React CV preview (3 templates) | ✅ Live | `src/cv/*` |
| Minimal template (DOCX + React) | ✅ Live | `src/lib/templates/minimal.ts`, `src/cv/templates/react/minimal.tsx` |
| PDF export | ✅ Live | `/print` route → browser print-to-PDF (`@page A4` CSS) |
| Resume versions / history | ✅ Live | `CvVersion` model + `/api/profiles/[id]/versions*` |
| Resume comparison | ✅ Live | `src/lib/cv-compare.ts` + `VersionHistory` UI |
| Public resume link | ✅ Live | `/r/[token]` + `/api/profiles/[id]/share` (unguessable token) |
| QR code for share link | ✅ Live | `ShareResume` component (`qrcode` package) |
| Snapshot XSS sanitization | ✅ Live | `src/lib/sanitize-model.ts` on share/versions writes |
| 11 locales incl. Arabic RTL | ✅ Live | `src/lib/cv-strings.ts` |
| User persistence (Prisma) | ✅ Live | `prisma/schema.prisma` → `User` |
| Multiple CV profiles | ✅ Live | `CvProfile` model + `/api/profiles*` |
| Profile preferences API | ✅ Live | `GET/PATCH /api/profile` |
| Settings page | ✅ Live | `/settings` + `SettingsForm` |
| GitHub Insights | ✅ Live | `/api/github/insights` + sidebar widget |
| Repository health score | ✅ Live | per-repo 0–100 + suggestions (`github-analytics.ts`) |
| Contribution analysis | ✅ Live | avg stars/repo, activity %, top-starred repo |
| Best repository detection | ✅ Live | composite ranking + reasons (🥇🥈🥉) |
| README review | ✅ Live | top-3 READMEs: sections, length, suggestions |
| Project description generator | ✅ Live | deterministic one-liners + keywords |
| GitHub profile review | ✅ Live | 8-checkpoint completeness + suggestions |
| Achievement generator | ✅ Live | 7 deterministic badges (earned/not) |
| Tech stack radar | ✅ Live | language + topic categories with weights |
| Skill detection | ✅ Live | languages (90%) / topics (70%) / bio (50%) |
| Explainability layer | ✅ Live | every score ships a human-readable reason |
| ATS score API | ✅ API only | `/api/ats-score` — no UI yet |
| AI Insights placeholder cards | ✅ Shell | `src/components/ai/*` |
| AI profile endpoint | ⏳ Placeholder | `/api/ai/profile` → `coming_soon` |
| AI service layer | ✅ Live (AI Sprint) | `src/lib/ai/*` — provider-agnostic, prompts separated from logic |
| Resume Review (AI) | ✅ API | `POST /api/ai/resume-review` |
| ATS Score (AI) | ✅ API | `POST /api/ai/ats` — mirrors deterministic `/api/ats-score` contract |
| Resume Rewrite (AI) | ✅ API | `POST /api/ai/rewrite` |
| Skill Recommendation (AI) | ✅ API | `POST /api/ai/skill-recommendation` |
| Skill Gap Analysis (AI) | ✅ API | `POST /api/ai/skill-gap` |
| Career Coach (AI) | ✅ API | `POST /api/ai/career-coach` |
| Roadmap Generator (AI) | ✅ API | `POST /api/ai/roadmap` |
| Learning Recommendations (AI) | ✅ API | `POST /api/ai/learning` |
| AI providers | ✅ OpenA-compatible + Gemini | `src/lib/ai/provider.ts` — plain `fetch`, zero new deps |
| AI rate limiting | ✅ Live | `/api/ai/*` 10 req/min in `src/middleware.ts` |
| AI UI | ❌ Not wired | CTO decision: keep prop-driven until Claude exposes data |
| Rate limiting | ✅ Live (Sprint 1) | `src/middleware.ts` + `src/lib/rate-limit.ts` |
| Dashboard single-fetch data flow | ✅ Live | server component → props |
| Docs (`/docs/*`) | ✅ Live | `PROJECT_STATUS`, `ROADMAP`, `FEATURES`, `TECH_DEBT`, `ARCHITECTURE` |
| Tests | ❌ Missing | — |
| ATS UI widget | ❌ Missing | — |
| Server-side PDF (headless) | ⏳ Planned | print-to-PDF covers the need; puppeteer only if required later |
| Payments / entitlements | ❌ Planned | provider TBD (Uzbekistan constraint) |
| Job Tracking | ✅ Live (Job Sprint) | `Job` model + `/api/jobs` CRUD |
| Company Keyword Extraction | ✅ Live (Job Sprint) | `src/lib/jobs/keywords.ts` |
| Job Matching | ✅ Live (Job Sprint) | `/api/jobs/[id]/match` (0-100, cached) |
| Resume Optimization | ✅ Live (Job Sprint) | `/api/jobs/[id]/resume` — job-reordered CvModel |
| ATS Optimization (job-specific) | ✅ Live (Job Sprint) | in match payload |
| Cover Letter Generator | ✅ Live (Job Sprint) | deterministic, `/api/jobs/[id]/cover-letter` |
| Company Resume Generator | ✅ Live (Job Sprint) | `/api/jobs/[id]/resume/download` (shared DOCX engine) |
| Internship Mode | ✅ Live (Job Sprint) | `?mode=internship` |
| Interview Questions | ✅ Live (Interview Sprint) | `/api/interview/questions` — profile-aware |
| Technical Questions | ✅ Live (Interview Sprint) | skill/language-keyed bank |
| Behavioral Questions | ✅ Live (Interview Sprint) | STAR-based bank |
| Mock Interview | ✅ Live (Interview Sprint) | `/api/interview/mock` |
| Evaluation Engine | ✅ Live (Interview Sprint) | `/api/interview/evaluate` |
| Recruiter Feedback | ✅ Live (Interview Sprint) | `/api/interview/feedback` |
| Salary Estimation | ✅ Live (Interview Sprint) | `/api/interview/salary` |
| Question Generator | ✅ Live (Interview Sprint) | `src/lib/interview/questions.ts` |
| Job UI | ❌ Not built | API complete; dashboard section pending |
| Interview UI | ❌ Not built | API complete; UI pending |
| Portfolio Generator | ✅ Live (Portfolio Sprint) | `src/lib/portfolio/*` + `/api/portfolio` — bios, about, hero, skills, projects, achievements |
| Personal Website | ✅ Live (Portfolio Sprint) | `/api/portfolio/website` — self-contained HTML, `/api/portfolio/export?format=html` |
| LinkedIn Optimization | ✅ Live (Portfolio Sprint) | `/api/portfolio/linkedin` — headline, about, skills, featured, tips |
| Bio Generator | ✅ Live (Portfolio Sprint) | 3 tone variants (concise/professional/creative), `/api/portfolio/bio` |
| About Generator | ✅ Live (Portfolio Sprint) | long-form About from profile + analytics |
| Portfolio Themes | ✅ Live (Portfolio Sprint) | 5 themes (minimal, developer, bold, elegant, sunrise) + `validateTheme` |
| Portfolio Export | ✅ Live (Portfolio Sprint) | `/api/portfolio/export` — json, markdown, html downloads |
| Portfolio UI | ❌ Not built | API complete; dashboard section pending |
| Resume Analytics | ✅ Live (Analytics Sprint) | `AnalyticsEvent` — per-profile views/downloads/last-viewed |
| Visitor Analytics | ✅ Live (Analytics Sprint) | public `/r/[token]` views + salted `visitorHash` (privacy-safe) |
| Download Analytics | ✅ Live (Analytics Sprint) | `cv_download` events with locale/template breakdown |
| GitHub Growth | ✅ Live (Analytics Sprint) | `GithubSnapshot` — daily stars/repos/forks/followers |
| Export History | ✅ Live (Analytics Sprint) | portfolio exports + website generations |
| Dashboard Analytics API | ✅ Live (Analytics Sprint) | `GET /api/analytics` — overview + chart-ready series |
| Charts (data layer) | ✅ Live (Analytics Sprint) | `SeriesPoint[]` / `GrowthPoint[]` payloads for future chart UI |
| Performance Reports | ✅ Live (Analytics Sprint) | top profile, best day, growth deltas, notes |
| Analytics event hooks | ✅ Live (Analytics Sprint) | generate-cv, /r/[token], portfolio export/website, share, dashboard |
| Plans (Free/Pro/Premium) | ✅ Live (Monetization Sprint) | `src/lib/billing/plans.ts` — limits catalog, `getPlan`, `isValidPlanId` |
| Entitlements resolver | ✅ Live (Monetization Sprint) | `src/lib/billing/entitlements.ts` — plan/status/expiry → flags; free fallback |
| Billing provider abstraction | ✅ Live (Monetization Sprint) | `src/lib/billing/provider.ts` — `BillingProvider` + noop; no provider SDK |
| Usage limits (profiles/jobs/exports) | ✅ Live (Monetization Sprint) | `src/lib/billing/usage.ts` — DB counts + `checkLimit` (403 on cap) |
| Premium template gate | ✅ Live (Monetization Sprint) | `templateAllowed` at POST/PATCH/share/generate-cv; empty set today |
| Billing plans API | ✅ Live (Monetization Sprint) | `GET /api/billing/plans` — catalog + `currentPlan` when authed |
| Entitlements + usage API | ✅ Live (Monetization Sprint) | `GET /api/billing/entitlements` |
| Checkout API | ⏳ 503 until provider | `POST /api/billing/checkout` — provider-independent contract |
| Customer portal API | ⏳ 501/503 | `POST /api/billing/portal` — requires configured provider + subscription |
| Webhook API | ✅ Live (noop) | `POST /api/billing/webhook` — 200 until a provider maps events |
| Billing rate limiting | ✅ Live (Monetization Sprint) | `/api/billing/*` 20 req/min |
| Payments (real provider) | ❌ Not wired | provider TBD (Uzbekistan constraint); no provider SDK installed |
| Security headers | ✅ Live (Audit Sprint) | nosniff, Referrer-Policy, X-Frame-Options, Permissions-Policy, prod-only CSP (`next.config.ts`) |
| SEO metadata (OG/Twitter) | ✅ Live (Audit Sprint) | `src/app/layout.tsx` — metadataBase, openGraph, twitter, robots, viewport |
| robots.txt / sitemap.xml / favicon | ✅ Live (Audit Sprint) | `robots.ts`, `sitemap.ts`, `icon.svg` |
| Unit tests | ✅ Live (Audit Sprint) | Vitest — 26 tests across validate, entitlements, plans, sanitize-model |
| ESLint (flat config) | ✅ Live (Audit Sprint) | `eslint.config.mjs` — `npm run lint` non-interactive, 0 warnings/errors |
| Analytics UI / charts | ❌ Not built | API complete; dashboard chart section pending |
| AI analytics (LLM-based) | ⏳ Planned | current analytics are deterministic; Claude's AI layer will enrich later |
