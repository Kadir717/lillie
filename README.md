# LILLIE — GitHub'ından 30 saniyede CV üret

## Ne yapıyor?

Kullanıcı GitHub ile giriş yapar, LILLIE onun public repo'larını, dillerini ve
aktivite verisini çekip profesyonel görünümlü bir `.docx` CV üretir. İngilizce
ve Türkçe destekli.

## Yerelde çalıştırma

```bash
npm install
cp .env.example .env.local
# .env.local içindeki GITHUB_CLIENT_ID / SECRET'i doldur (aşağıdaki adıma bak)
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
OAuth App kullanmak standart pratiktir.

## 2. SESSION_SECRET üretme

Terminal'de:

```bash
openssl rand -hex 32
```

Çıkan string'i `.env.local`'deki `SESSION_SECRET`'e yapıştır.

## 3. Vercel'e deploy

```bash
npm install -g vercel
vercel
```

Vercel sorduğunda environment variable'ları (GITHUB_CLIENT_ID,
GITHUB_CLIENT_SECRET, GITHUB_REDIRECT_URI, SESSION_SECRET,
NEXT_PUBLIC_APP_URL) Vercel dashboard'undan **Settings → Environment
Variables** kısmına ekle. `GITHUB_REDIRECT_URI` ve `NEXT_PUBLIC_APP_URL`'i
gerçek Vercel domain'in ile güncelle, sonra prod OAuth App'inin callback
URL'ini de buna göre ayarla.

## Proje yapısı

```
src/
  app/
    page.tsx                  → Landing page
    dashboard/page.tsx        → Login sonrası CV önizleme + indirme
    api/
      auth/login              → GitHub OAuth'a yönlendirir
      auth/callback           → OAuth code'u token'a çevirir, session açar
      auth/logout             → Session'ı kapatır
      generate-cv             → docx dosyasını üretip indirir
  lib/
    auth.ts                   → Session/OAuth yardımcı fonksiyonları
    github.ts                 → GitHub API'den veri çekme
    cv-builder.ts             → docx CV şablonu (EN/TR)
  components/
    DownloadButton.tsx        → Dil seçimi + indirme butonu
```

## Sırada ne var (MVP sonrası)

- README/profil için SVG dashboard kartı (2. özellik)
- Stripe ile "kahve parası" ödeme entegrasyonu (örn. tek seferlik $4.99 ya da
  aylık $2.99 — A/B test edilmeli)
- PDF export seçeneği
- Daha fazla dil (mimari zaten i18n-ready, `cv-builder.ts`'deki `STRINGS`
  objesine yeni dil eklemek yeterli)
