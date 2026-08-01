# LILLIE — Technical Debt Register

> Last updated: Full-Repo Audit (v1.0 prep)

Priority legend: **HIGH** = fix soon, **MED** = plan for, **LOW** = acceptable now.

## HIGH

1. **Test coverage covers pure logic only.** Vitest covers validation,
   entitlements, plans and the XSS sanitizer (26 tests), but OAuth callback,
   ownership checks, rate limiter and API routes have no integration tests
   yet. Extend as routes stabilize.
   - Affects: whole backend.

2. **ATS score UI missing.** `/api/ats-score` is implemented and validated but
   never surfaced. Dead-ish feature until wired into the dashboard.

3. **No payment provider wired.** The billing layer is complete and
   provider-independent, but checkout/portal return 503 and webhooks are
   noops until `BILLING_PROVIDER` is set and a provider module implements
   `BillingProvider` (5 methods). Feature limits (profile/job caps, monthly
   exports, premium templates) are enforced but every user is `free` until
   then — limits only bite when paid plans actually exist.

4. **Limit enforcement is check-then-create (TOCTOU).** `checkLimit` reads,
   then the caller inserts — two concurrent requests could each pass and
   over-create by one. Documented in `src/lib/billing/usage.ts`; DB-level
   guard (transaction/unique constraint/advisory lock) is the future
   hardening path.

5. **`/api/billing/webhook` is behind the IP rate limiter.** Fine with the
   noop provider; when a real provider ships, its webhooks arrive from
   shared provider IPs and could trip the 20/min limiter — exempt the
   webhook path at that point (noted in `src/middleware.ts`).

6. **`/api/billing/plans` keeps its own small row fetch.** It selects
   plan/status/expiry/role (no `id`), so it doesn't use `getUserEntitlements`
   (which also returns `id`). Defensible; the one remaining duplication.

7. **Premium template registry is empty.** The gate is wired everywhere
   (`templateAllowed`) but no template is premium yet — first premium
   template must also gate `POST /api/profiles/[id]/versions` (documented
   in `src/lib/billing/templates.ts`).

8. **No Prisma migrations — schema changes are applied via `prisma db push`.**
   There is no `prisma/migrations/` directory yet, so there is no auditable
   migration history and no safe path to alter an existing production
   database. Before production launch, adopt `prisma migrate dev` (create the
   initial migration from the current schema, then commit `prisma/migrations/`
   and run `prisma migrate deploy` in production).

## MED

3. **No tests yet for the new resume-engine paths.** Version ownership checks,
   share-token handling, `sanitize-model`, and `cv-compare` diff logic are all
   untested. Targeted tests remain the top un-scheduled item.

4. **`/print` re-fetches GitHub aggregate on every print.** Same as
   `/api/generate-cv` — no cross-request cache (by design, no Redis). Fine at
   current scale; the print route is only hit on explicit user action.

5. **Version restore shows a frozen snapshot; downloads stay live.** Restoring
   a version into the preview does not change what `/api/generate-cv` produces
   (it always fetches fresh GitHub data). The UI shows a note; a full
   snapshot-download path is a future enhancement.

4. **Each API route re-runs `fetchGithubAggregate`.** The dashboard fetches
   once and passes props (good), but each API route (`/api/cv-model`,
   `/api/generate-cv`, `/api/ats-score`, `/api/github/insights`) still performs
   a full GitHub aggregation per call, plus up to 3 README fetches for the
   analytics route. No cross-request cache (by design — no Redis). Acceptable
   while traffic is low; revisit with React `cache()` or a user-scoped TTL
   cache if latency becomes user-visible.
   - Note: the `computeInsights` duplication (old item) was removed in the
     GitHub Analytics sprint — dashboard and `/api/github/insights` now share
     `src/lib/github-analytics.ts`.

5. **Analytics scoring is deterministic, not AI.** Health scores, skill
   confidence, achievements and README reviews are rule-based heuristics with
   hard-coded weights/maps. They are explainable and testable, but Claude's
   future AI layer (DeveloperProfile) may supersede skill/achievement
   detection with learned models. The UI keeps the deterministic version until
   the AI contract lands.

6. **Rate limiter is per-instance only.** In-memory counters don't provide a
   global quota across multiple serverless/edge instances. Best-effort
   protection. Documented in `src/lib/rate-limit.ts`.

7. **Rate limits are per-IP, so shared networks may see 429s.** Users behind
   one NAT/office/campus IP share the same budget (`/api/generate-cv` is the
   tightest at 10/min). Acceptable now; per-user keying via the JWT is the
   future refinement if complaints appear.

## LOW

8. **JWT sessions cannot be revoked server-side.** Logout only deletes the
   client cookie; the JWT stays valid until 7-day expiry. Documented trade-off;
   acceptable at current scale.

9. **`console.error` logging everywhere.** Functional but unstructured. A tiny
   logger with request IDs would help debugging; not blocking.

10. **Client dropdowns (locale/template/profile) use `setTimeout(0)` / document
    click listeners.** Functional but fragile; a ref-based outside-click pattern
    is cleaner. Low risk.

11. **`CvPreviewPanel` fetches `/api/cv-model` only when `initialModel` is not
    provided.** Correct, but the fallback path is now rarely exercised — worth a
    manual smoke test after the Sprint 5 refactor.

12. **Removed in the Audit Sprint** — `cv-builder.ts.bak` and 30+ build-
    artifact `.txt` files were deleted; `.gitignore` now covers `*.bak`/`*.tmp`.

13. **`next lint` is deprecated.** `npm run lint` works today but Next 16 will
    remove it — migrate to the ESLint CLI (`npx eslint .`) before the next
    major upgrade (noted in `docs/DEPLOYMENT.md`).

14. **Analytics README fetches are bounded but uncached.** Top-3 READMEs are
    fetched on every dashboard load / insights call. They are small and few,
    but a short TTL cache (or React `cache()`) could trim latency later.

14. **AI layer: no tests yet.** `src/lib/ai/*` parse guards, error mapping and
    the registry route are untested (JSON shape validation is the riskiest
    path — a misbehaving model could produce unparseable output). Targeted
    tests should cover `extractModel`, `completeJson` fence-stripping, and
    the 503/502 error mapping.

15. **AI providers are unverified against live APIs.** Both providers are
    implemented against documented contracts (OpenAI-compatible Chat
    Completions, Gemini generateContent) but have not been exercised against
    a real endpoint in CI. `AI_API_KEY` is not set locally, so routes return
    503 until configured. Smoke-test both providers once a key is available.

16. **AI output is uncached and per-request costed.** Every `POST /api/ai/*`
    call bills the LLM provider. There is no per-user usage accounting or
    result caching yet — acceptable while AI is not wired to the UI, but a
    prerequisite before shipping AI features to real users (ties into the
    implemented Free/Pro/Premium entitlements).

17. **Job match snapshots can go stale.** `/api/jobs/[id]/match` caches the
    score + analysis on the row; GitHub data changes over time, so a cached
    score may not reflect the latest profile until re-run. Add a
    `matchedAt` timestamp (or re-match on profile updates) if freshness
    becomes user-visible.

18. **`matchJson` duplicates CvModel data.** The cached analysis embeds the
    full optimized CvModel, so the row can be large-ish. Fine at current
    scale; consider storing only the summary + a token/version reference if
    rows grow.

19. **Job features are deterministic, not AI.** Keyword extraction, matching
    and the cover letter are rule-based heuristics (no LLM — AI layer stays
    dormant until production approval). The existing AI tools
    (`/api/ai/*`) can supersede the cover letter/matching later behind the
    same output contracts.

20. **Job keyword dictionary is curated (~130 terms).** Terms missing from
    `JOB_KEYWORDS` are invisible to matching. Reasonable for an MVP;
    expanding the dictionary (or moving to an AI/keyword-embedding approach
    later) is a documented next step.

21. **Interview questions are a curated bank (~38 templates).** Languages
    and skills without a matching template get no tailored question (the
    generator pads with core questions instead). The bank is data-driven —
    adding templates is additive. AI-generated questions (via the dormant
    AI layer) could supersede the bank later behind the same contract.

22. **Salary estimator uses static role tables + location heuristics, not
    live market data.** It is explicitly labeled an indicative guide with a
    disclaimer. If accurate market rates matter, plug a live data source
    (or the AI layer) behind the same `estimateSalary` contract.

23. **Evaluation engine is keyword/STAR heuristic, not semantic.** An
    answer can mention the right keywords while missing the point (or vice
    versa). Deterministic and explainable by design; an AI evaluation would
    be the upgrade path.

24. **Interview routes re-fetch the GitHub aggregate per call.** Same as
    other data routes — no cross-request cache (by design, no Redis).
    Acceptable while traffic is low.

25. **Portfolio routes re-fetch the GitHub aggregate per call.** Same as
    every other data route — no cross-request cache (by design, no Redis).
    The `loadPortfolioSource` loader centralizes the fetch so adding React
    `cache()` later is a one-line change in one place.

26. **Portfolio copy is deterministic, not AI.** Bios, About, headline and
    LinkedIn copy are rule-based templates over detected skills/achievements.
    Explainable and consistent, but the dormant AI layer can supersede them
    later behind the same output contracts (`BioVariant`, `PortfolioContent`).

27. **Portfolio themes are a curated registry (5 themes).** Adding a theme is
    additive (one entry in `PORTFOLIO_THEMES`). No user-defined theming yet;
    a CSS-variable overrides API could be added later.

28. **HTML export is a single self-contained page.** No routing, no assets
    pipeline — correct for "download your site" but not a full static-site
    generator. If users want multi-page portfolios, that is a separate
    (future) builder.

29. **Generated website filename uses `encodeURIComponent`.** Produces
    percent-encoded names (`%20` for spaces) which browsers accept but look
    odd in some download dialogs. Cosmetic; a slugify helper could improve
    it later.

30. **Analytics events are fire-and-forget, so a DB outage silently drops
    them.** By design (analytics must never break downloads/renders), but
    it means the numbers can undercount during DB incidents. Acceptable;
    a local buffer + flush would be the reliability upgrade path.

31. **Unique-visitor estimation is a salted IP hash, not a real identity.
    NAT/campus users share an IP, and the `ANALYTICS_SALT` falls back to a
    known default unless set.** Set `ANALYTICS_SALT` in production for the
    privacy guarantee to hold. No country/UA dimensions yet — adding them
    later is additive (aggregate-only, never raw IPs).

32. **`countByMetadataField` scans all of a user's download rows in JS to
    group by locale/template.** Prisma can't groupBy on a JSON field, so
    this is a pragmatic MVP choice. If download counts grow large, denormalize
    locale/template into indexed columns.

33. **Daily GitHub snapshot only records on dashboard visits.** Growth data
    has a row only for days the user actually opened the dashboard. Fine for
    a trend, but not a complete history; a cron/worker would fill gaps (no
    workers by design yet).
