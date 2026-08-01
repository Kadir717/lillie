# LILLIE — GitHub'ından 30 saniyede CV üret

LILLIE, GitHub profilinizi job-ready bir CV'ye dönüştüren bir SaaS uygulamasıdır.
GitHub ile giriş yapın; public repo'larınız, dilleriniz ve aktivite veriniz
otomatik çekilir ve profesyonel görünümlü bir CV üretilir.

## Özellikler

- GitHub OAuth ile giriş (CSRF korumalı) + httpOnly JWT session (7 gün)
- **11 dil** (Arapça RTL dahil) · **3 şablon** (classic_professional, developer_card, minimal)
- Canlı React CV önizleme, anlık dil/şablon değişimi — tercihler kalıcıdır
- `.docx` indirme + tarayıcı print-to-PDF (`/print`)
- Birden fazla CV profili, versiyon geçmişi + karşılaştırma, paylaşım linki + QR kod
- GitHub Insights: repo sağlığı, katkı analizi, en iyi repo, skill tespiti, achievements, README incelemesi
- ATS skoru · iş takibi/eşleştirme/cover letter · mülakat hazırlığı · portfolyo üretici
- Kullanım + büyüme analitiği · Free/Pro/Premium entitlement altyapısı (provider-bağımsız)
- AI katmanı hazır ama UI'a bağlı değil (CTO kararı — prop-driven kalacak)

## Teknoloji

- Next.js 15 (App Router) + TypeScript + Tailwind CSS
- Prisma + Neon PostgreSQL (yerelde SQLite'e geçmek için tek satır `DATABASE_URL`)
- GitHub OAuth · JWT (HS256, httpOnly, SameSite)
- Vitest (26 unit test) · ESLint flat config (`npm run lint` 0 hata)

## Yerelde çalıştırma

```bash
npm install
cp .env.example .env.local
# .env.local içindeki değerleri doldur (aşağıdaki adımlara bak)
npx prisma generate
npx prisma db push          # şemayı veritabanına uygula
npm run dev
```

`http://localhost:3000` adresinde açılır.

## 1. GitHub OAuth App oluşturma (zorunlu adım)

LILLIE'nin GitHub'a "Continue with GitHub" yapabilmesi için bir OAuth App
kaydı gerekiyor. Bu işlemi SEN yapmalısın çünkü kendi GitHub hesabından
yetkilendirme istiyor:

1. GitHub → sağ üstte profil fotoğrafı → **Settings**
2. Sol menü en altta → **Developer settings**
3. **OAuth Apps** → **New OAuth App**
4. Formu doldur:
   - **Application name:** `LILLIE` (veya `LILLIE Dev` lokal test için)
   - **Homepage URL:** `http://localhost:3000` (lokalde), prod'da gerçek domain
   - **Authorization callback URL:** `http://localhost:3000/api/auth/callback`
5. **Register application** tıkla
6. Açılan sayfada **Client ID** görünür → kopyala
7. **Generate a new client secret** → çıkan secret'i kopyala (bir daha gösterilmez!)

Bu ikisini `.env.local` dosyasına yapıştır:

```
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
```

**Önemli:** Prod'a deploy ettiğinde (Vercel'e) ayrıca bir **ikinci OAuth App**
oluşturman gerekecek — çünkü callback URL'i prod domain'ine göre değişecek
(`https://lillie.vercel.app/api/auth/callback` gibi). Lokal ve prod için ayrı
OAuth App kullanmak standart pratiktir. İstenen scope'lar en az yetki ilkesine
göre: `read:user public_repo`.

## 2. SESSION_SECRET üretme

Terminal'de:

```bash
openssl rand -hex 32
```

Çıkan string'i `.env.local`'deki `SESSION_SECRET`'e yapıştır.
**Production'da SESSION_SECRET tanımlı değilse uygulama başlamaz** (fail-fast).

## 3. Veritabanı (Prisma + Neon PostgreSQL)

1. [neon.tech](https://neon.tech) üzerinden ücretsiz bir proje oluştur.
2. Connection string'i `.env.local`'e yaz:

```
DATABASE_URL=postgresql://user:pass@host/db?sslmode=require
```

3. Şemayı uygula: `npx prisma db push`

## 4. AI servisleri (opsiyonel)

AI araçları (`/api/ai/[tool]` — resume review, ATS, rewrite, skill
recommendation, skill gap, career coach, roadmap, learning) provider-agnostik
bir katman üzerinden çalışır. `AI_API_KEY` tanımlı değilse bu uçlar 503 döner
ve uygulama normal şekilde çalışmaya devam eder.

```
AI_API_KEY=...              # zorunlu (AI açılacaksa)
AI_PROVIDER=openai|gemini   # opsiyonel, varsayılan: openai
AI_MODEL=gpt-4o-mini        # opsiyonel, provider'a göre değişir
AI_BASE_URL=https://api.openai.com/v1  # opsiyonel (openai-compatible uçlar için)
```

- `openai`: OpenAI-compatible Chat Completions (`AI_BASE_URL` ile OpenRouter,
  Together, Groq gibi uyumlu sağlayıcılar da kullanılabilir).
- `gemini`: Google Gemini REST API.

UI henüz bu uçlara bağlı değil (CTO kararı — prop-driven kalacak).

## 5. Doğrulama komutları

```bash
npm test                  # 26 unit test (Vitest)
npm run lint              # ESLint — 0 hata/uyarı olmalı
npm run build             # prisma generate + production build
npx prisma validate       # şema doğrulama
```

## 6. Vercel'e deploy

```bash
vercel --prod
```

Vercel'de **Settings → Environment Variables**'a ekle:

- Zorunlu: `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GITHUB_REDIRECT_URI`,
  `SESSION_SECRET`, `DATABASE_URL`
- Opsiyonel: `NEXT_PUBLIC_APP_URL`, `AI_API_KEY`, `AI_PROVIDER`, `AI_MODEL`,
  `AI_BASE_URL`, `ANALYTICS_SALT`, `BILLING_PROVIDER`

`GITHUB_REDIRECT_URI` ve `NEXT_PUBLIC_APP_URL`'i gerçek Vercel domain'in ile
güncelle, sonra prod OAuth App'inin callback URL'ini de buna göre ayarla.
Tam kontrol listesi: `docs/DEPLOYMENT.md`.

## Proje yapısı

```
src/
  app/
    page.tsx                  → Landing page
    dashboard/page.tsx        → Login sonrası CV önizleme + analitik
    settings/page.tsx         → Ayarlar (tema, dil, GitHub bağlantısı)
    print/page.tsx            → PDF yazdırma görünümü
    r/[token]/page.tsx        → Paylaşılan CV (public)
    api/
      auth/*                  → login / callback / logout
      profiles*               → CV profilleri CRUD + versiyon + paylaşım
      generate-cv             → .docx üretimi
      cv-model · ats-score · github/insights · analytics
      jobs* · interview* · portfolio* · ai/[tool] · billing/*
  lib/
    auth.ts                   → session/OAuth
    github.ts                 → GitHub API agregasyonu
    cv-model.ts · cv-builder.ts · cv-strings.ts
    env.ts · db.ts · validate.ts · rate-limit.ts
    templates/ · analytics/ · jobs/ · interview/ · portfolio/ · ai/ · billing/
  components/
    CvPreviewPanel · ProfileSelector · DownloadButton · VersionHistory · ShareResume · ai/*
  middleware.ts               → rate limiting
prisma/schema.prisma          → User, CvProfile, CvVersion, Job, AnalyticsEvent, GithubSnapshot
docs/                         → STATUS, ROADMAP, FEATURES, TECH_DEBT, ARCHITECTURE, RELEASE_NOTES, DEPLOYMENT
```

## Sırada ne var

Güncel yol haritası `docs/ROADMAP.md`'de. Öncelikler:

- Gerçek bir ödeme sağlayıcısı bağlamak (`BillingProvider` arayüzü hazır —
  Stripe varsayılmaz, kurucu Özbekistan'da olduğu için provider seçimi açık)
- Premium şablonlar + ATS skoru UI widget'ı
- DeveloperProfile entegrasyonu + AI Insights kartlarının gerçek veriye bağlanması
- İş / mülakat / portfolyo / analitik bölümleri için dashboard UI'ları
