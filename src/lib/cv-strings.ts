/**
 * CV locale strings — moved verbatim from old cv-builder.ts.
 * Each CvTemplate receives this object via the `t` param.
 */

export type CvLocale = "en" | "tr" | "de" | "fr" | "es" | "pt" | "ja" | "ko" | "zh" | "ru" | "ar";

const STRINGS: Record<CvLocale, Record<string, string>> = {
    en: {
        topLanguages: "Top Languages", featuredProjects: "Featured Projects",
        stats: "Activity Summary", repositories: "Public Repositories",
        stars: "Stars Earned", forks: "Forks", years: "Years Active",
        noDescription: "No description provided.", generatedBy: "Generated with LILLIE - lillie.dev", forkLabel: "forks",
    },
    tr: {
        topLanguages: "En Cok Kullanilan Diller", featuredProjects: "One Cikan Projeler",
        stats: "Aktivite Ozeti", repositories: "Genel Depo Sayisi",
        stars: "Kazanilan Yildiz", forks: "Fork Sayisi", years: "Aktif Yil",
        noDescription: "Aciklama bulunmuyor.", generatedBy: "LILLIE ile olusturuldu - lillie.dev", forkLabel: "fork",
    },
    de: {
        topLanguages: "Meist verwendete Sprachen", featuredProjects: "Ausgewaehlte Projekte",
        stats: "Aktivitaetsuebersicht", repositories: "Oeffentliche Repositories",
        stars: "Erhaltene Sterne", forks: "Forks", years: "Aktive Jahre",
        noDescription: "Keine Beschreibung vorhanden.", generatedBy: "Erstellt mit LILLIE - lillie.dev", forkLabel: "Forks",
    },
    fr: {
        topLanguages: "Langages principaux", featuredProjects: "Projets en vedette",
        stats: "Resume d'activite", repositories: "Depots publics",
        stars: "Etoiles obtenues", forks: "Forks", years: "Annees actives",
        noDescription: "Aucune description fournie.", generatedBy: "Genere avec LILLIE - lillie.dev", forkLabel: "forks",
    },
    es: {
        topLanguages: "Lenguajes principales", featuredProjects: "Proyectos destacados",
        stats: "Resumen de actividad", repositories: "Repositorios publicos",
        stars: "Estrellas obtenidas", forks: "Forks", years: "Anos activos",
        noDescription: "Sin descripcion.", generatedBy: "Generado con LILLIE - lillie.dev", forkLabel: "forks",
    },
    pt: {
        topLanguages: "Principais linguagens", featuredProjects: "Projetos em destaque",
        stats: "Resumo de atividade", repositories: "Repositorios publicos",
        stars: "Estrelas recebidas", forks: "Forks", years: "Anos ativos",
        noDescription: "Sem descricao.", generatedBy: "Gerado com LILLIE - lillie.dev", forkLabel: "forks",
    },
    ja: {
        topLanguages: "よく使う言語", featuredProjects: "注目プロジェクト",
        stats: "アクティビティ概要", repositories: "公開リポジトリ",
        stars: "獲得スター", forks: "フォーク数", years: "活動年数",
        noDescription: "説明はありません。", generatedBy: "LILLIEで生成 - lillie.dev", forkLabel: "フォーク",
    },
    ko: {
        topLanguages: "주요 사용 언어", featuredProjects: "주요 프로젝트",
        stats: "활동 요약", repositories: "공개 저장소",
        stars: "획득한 별", forks: "포크 수", years: "활동 연수",
        noDescription: "설명이 없습니다.", generatedBy: "LILLIE로 생성됨 - lillie.dev", forkLabel: "포크",
    },
    zh: {
        topLanguages: "常用语言", featuredProjects: "精选项目",
        stats: "活动摘要", repositories: "公开仓库",
        stars: "获得的星标", forks: "Fork 数", years: "活跃年数",
        noDescription: "暂无描述。", generatedBy: "由 LILLIE 生成 - lillie.dev", forkLabel: "Fork",
    },
    ru: {
        topLanguages: "Основные языки", featuredProjects: "Избранные проекты",
        stats: "Сводка активности", repositories: "Публичные репозитории",
        stars: "Полученные звёзды", forks: "Форки", years: "Лет активности",
        noDescription: "Описание отсутствует.", generatedBy: "Создано с LILLIE - lillie.dev", forkLabel: "форков",
    },
    ar: {
        topLanguages: "أبرز اللغات", featuredProjects: "المشاريع المميزة",
        stats: "ملخص النشاط", repositories: "المستودعات العامة",
        stars: "النجوم المكتسبة", forks: "التفريعات", years: "سنوات النشاط",
        noDescription: "لا يوجد وصف.", generatedBy: "تم الإنشاء بواسطة LILLIE - lillie.dev", forkLabel: "تفريعة",
    },
};

export type CvStrings = Record<string, string>;

export function getStrings(locale: CvLocale): CvStrings {
    return STRINGS[locale];
}