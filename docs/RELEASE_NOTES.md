# LILLIE — Release Notes

## v1.0.0 — Launch

**Product:** Turn a GitHub profile into a polished, job-ready CV in ~30 seconds.
Next.js 15 App Router monolith · Prisma + Neon PostgreSQL · GitHub OAuth · JWT sessions.

### What shipped

**Core experience**
- GitHub OAuth (CSRF-protected) → stateless JWT session (httpOnly, 7-day)
- GitHub data aggregation → `CvModel` (single source of truth) → DOCX download
- Live React CV preview with instant locale/template switching
- 11 locales incl. Arabic RTL · 3 templates (classic_professional, developer_card, minimal)

**Resume engine**
- Multiple named CV profiles (CRUD + ownership verification)
- Immutable version history + side-by-side comparison + restore
- Public share links with unguessable tokens + QR codes
- Print-to-PDF (`/print`) — browser save-as-PDF, A4 CSS

**Career toolkits (deterministic, no AI)**
- GitHub Insights + explainable analytics (health scores, best repos, skills, achievements, README review, tech stack radar)
- ATS score (deterministic)
- Job tracking, matching, ATS optimization, company resume, cover letter, internship mode
- Interview questions, mock sessions, evaluation engine, recruiter feedback, salary estimation
- Portfolio generator: bios, About, LinkedIn copy, 5 themes, JSON/Markdown/HTML export

**AI layer (dormant, provider-agnostic)**
- 8 tools behind `POST /api/ai/[tool]` (resume review, ATS, rewrite, skill rec, skill gap, career coach, roadmap, learning)
- Plain-fetch providers (OpenAI-compatible + Gemini), zero new deps; UI not wired (CTO decision)

**Platform**
- Usage + growth analytics (`AnalyticsEvent`, `GithubSnapshot`, `GET /api/analytics`) — fire-and-forget, privacy-safe visitor hashing
- Provider-independent billing/entitlements foundation: plans catalog (free/pro/premium), usage limits, premium-template gate, 5 `/api/billing/*` routes (checkout/webhook 503 until a provider is wired)
- Rate limiting middleware (auth 20/min, generate-cv 10/min, ai 10/min, interview/portfolio/billing 20/min, default 60/min)
- Security headers + production CSP, SEO metadata (OG/Twitter/robots/sitemap/icon), `.env.example`
- Test suite: 26 targeted unit tests (validation, entitlements, plans, XSS sanitizer) via Vitest
- ESLint flat config — `npm run lint` runs non-interactively (0 warnings/errors)

### Known limitations (documented)
- No payment provider wired yet (checkout/portal return 503) — founder in Uzbekistan, provider TBD
- Rate limiter is per-instance (best-effort on multi-instance deploys; Redis is the documented upgrade path)
- No server-side PDF renderer (print-to-PDF covers it); headless renderer is the future path
- GitHub aggregate is re-fetched per data route (no cross-request cache by design — no Redis)
- Tests cover pure logic only; API/route integration tests not yet added

### Commands
```bash
npm install
npx prisma generate
npx prisma db push        # apply schema to the database
npm run dev               # local
npm test                  # 26 unit tests
npm run lint              # ESLint (flat config)
npm run build             # prisma generate + production build
```

### Environment variables
See `.env.example`. Required in production: `GITHUB_CLIENT_ID`,
`GITHUB_CLIENT_SECRET`, `GITHUB_REDIRECT_URI`, `SESSION_SECRET`,
`DATABASE_URL`. Optional: `NEXT_PUBLIC_APP_URL`, `AI_API_KEY`,
`AI_PROVIDER`, `AI_MODEL`, `AI_BASE_URL`, `ANALYTICS_SALT`,
`BILLING_PROVIDER`.
