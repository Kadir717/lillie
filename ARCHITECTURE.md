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
| `/api/github/insights` | GET | Yes | Extended GitHub statistics |
| `/api/ats-score` | GET | Yes | ATS resume score analysis |

All routes validate input, use proper HTTP status codes, and distinguish GitHub upstream errors from internal failures.

## Persistence

- **Prisma + SQLite** for local development.
- **Turso** (SQLite-compatible, edge-hosted) for production Vercel deployment.
- Schema designed for straightforward migration to PostgreSQL.

### Database Models

- **User** — Core user record, created/updated on GitHub OAuth login. Stores preferences (locale, template).
- **CvProfile** — Named CV configurations owned by a user. Each stores a title, locale, and template. Users can maintain multiple CV variants (e.g., "Software Engineer", "Backend Developer"). Created via the dashboard UI.

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

## What Is Intentionally Not Built Yet

- Work experience, education, skills, projects data models
- Job-specific CV builder
- AI-assisted features
- Payments / Stripe / entitlements
- Analytics
- Redis / caching layer
- Rate limiting middleware
- Testing infrastructure
- PDF export (prepared filename conventions for future addition)
- Account deletion

These will be added incrementally as the product grows.
