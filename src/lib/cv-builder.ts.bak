import {
  Document,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  WidthType,
  ShadingType,
  ExternalHyperlink,
} from "docx";
import type { GithubAggregateData } from "./github";

// US Letter, 1" margins (DXA units)
const PAGE_WIDTH = 12240;
const PAGE_HEIGHT = 15840;
const MARGIN = 1080; // 0.75" — slightly tighter than 1" to fit more on one page
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

const ACCENT_COLOR = "2E5E8C"; // muted professional blue
const TEXT_GRAY = "444444";

export type CvLocale = "en" | "tr";

const STRINGS: Record<CvLocale, Record<string, string>> = {
  en: {
    contributionsSince: "On GitHub since",
    topLanguages: "Top Languages",
    featuredProjects: "Featured Projects",
    stats: "Activity Summary",
    repositories: "Public Repositories",
    stars: "Stars Earned",
    forks: "Forks",
    years: "Years Active",
    noDescription: "No description provided.",
    generatedBy: "Generated with LILLIE — lillie.dev",
  },
  tr: {
    contributionsSince: "GitHub'a katılım",
    topLanguages: "En Çok Kullanılan Diller",
    featuredProjects: "Öne Çıkan Projeler",
    stats: "Aktivite Özeti",
    repositories: "Genel Depo Sayısı",
    stars: "Kazanılan Yıldız",
    forks: "Fork Sayısı",
    years: "Aktif Yıl",
    noDescription: "Açıklama bulunmuyor.",
    generatedBy: "LILLIE ile oluşturuldu — lillie.dev",
  },
};

function topLanguagesPercentages(languages: Record<string, number>, max = 5) {
  const total = Object.values(languages).reduce((a, b) => a + b, 0);
  if (total === 0) return [];

  return Object.entries(languages)
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([name, bytes]) => ({
      name,
      percentage: Math.round((bytes / total) * 100),
    }));
}

function statBoxRow(label: string, value: string | number) {
  return new TableCell({
    width: { size: CONTENT_WIDTH / 4, type: WidthType.DXA },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: "DDDDDD" },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: "DDDDDD" },
      left: { style: BorderStyle.SINGLE, size: 1, color: "DDDDDD" },
      right: { style: BorderStyle.SINGLE, size: 1, color: "DDDDDD" },
    },
    shading: { fill: "F4F7FA", type: ShadingType.CLEAR },
    margins: { top: 120, bottom: 120, left: 100, right: 100 },
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: String(value), bold: true, size: 32, color: ACCENT_COLOR })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: label, size: 16, color: TEXT_GRAY })],
      }),
    ],
  });
}

export function buildCvDocument(data: GithubAggregateData, locale: CvLocale = "en"): Document {
  const t = STRINGS[locale];
  const { profile, topRepos, languages, totalStars, totalForks, contributionYears } = data;

  const languagePercentages = topLanguagesPercentages(languages);

  const children: (Paragraph | Table)[] = [];

  // --- Header: name, bio, contact line ---
  children.push(
    new Paragraph({
      children: [
        new TextRun({ text: profile.name || profile.login, bold: true, size: 48, color: "1A1A1A" }),
      ],
      spacing: { after: 60 },
    })
  );

  if (profile.bio) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: profile.bio, italics: true, size: 24, color: TEXT_GRAY })],
        spacing: { after: 120 },
      })
    );
  }

  const contactParts: string[] = [];
  if (profile.location) contactParts.push(profile.location);
  if (profile.email) contactParts.push(profile.email);
  contactParts.push(`github.com/${profile.login}`);
  if (profile.blog) contactParts.push(profile.blog);

  children.push(
    new Paragraph({
      children: [new TextRun({ text: contactParts.join("  •  "), size: 20, color: TEXT_GRAY })],
      spacing: { after: 240 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: ACCENT_COLOR, space: 4 } },
    })
  );

  // --- Activity summary stat boxes ---
  children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      children: [new TextRun({ text: t.stats })],
      spacing: { before: 120, after: 120 },
    })
  );

  children.push(
    new Table({
      width: { size: CONTENT_WIDTH, type: WidthType.DXA },
      columnWidths: [CONTENT_WIDTH / 4, CONTENT_WIDTH / 4, CONTENT_WIDTH / 4, CONTENT_WIDTH / 4],
      rows: [
        new TableRow({
          children: [
            statBoxRow(t.repositories, profile.publicRepos),
            statBoxRow(t.stars, totalStars),
            statBoxRow(t.forks, totalForks),
            statBoxRow(t.years, contributionYears),
          ],
        }),
      ],
    })
  );

  // --- Top languages ---
  if (languagePercentages.length > 0) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun({ text: t.topLanguages })],
        spacing: { before: 280, after: 120 },
      })
    );

    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: languagePercentages.map((l) => `${l.name} (${l.percentage}%)`).join("   ·   "),
            size: 22,
            color: TEXT_GRAY,
          }),
        ],
        spacing: { after: 240 },
      })
    );
  }

  // --- Featured projects ---
  children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      children: [new TextRun({ text: t.featuredProjects })],
      spacing: { before: 120, after: 160 },
    })
  );

  for (const repo of topRepos) {
    children.push(
      new Paragraph({
        children: [
          new ExternalHyperlink({
            link: repo.htmlUrl,
            children: [
              new TextRun({ text: repo.name.split("/").pop() || repo.name, bold: true, size: 26, color: ACCENT_COLOR }),
            ],
          }),
          new TextRun({
            text: `   ★ ${repo.stargazersCount}   ${repo.forksCount} ${locale === "tr" ? "fork" : "forks"}`,
            size: 18,
            color: TEXT_GRAY,
          }),
        ],
        spacing: { before: 160, after: 40 },
      })
    );

    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: repo.description || t.noDescription,
            size: 22,
            color: TEXT_GRAY,
          }),
        ],
        spacing: { after: 40 },
      })
    );

    if (repo.language || repo.topics.length > 0) {
      const tags = [repo.language, ...repo.topics].filter(Boolean).join("  ·  ");
      children.push(
        new Paragraph({
          children: [new TextRun({ text: tags, size: 18, italics: true, color: "888888" })],
          spacing: { after: 80 },
        })
      );
    }
  }

  // --- Footer ---
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 400 },
      border: { top: { style: BorderStyle.SINGLE, size: 4, color: "DDDDDD", space: 8 } },
      children: [new TextRun({ text: t.generatedBy, size: 16, italics: true, color: "AAAAAA" })],
    })
  );

  return new Document({
    styles: {
      default: { document: { run: { font: "Calibri", size: 22 } } },
      paragraphStyles: [
        {
          id: "Heading2",
          name: "Heading 2",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { size: 28, bold: true, font: "Calibri", color: "1A1A1A" },
          paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 1 },
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: PAGE_WIDTH, height: PAGE_HEIGHT },
            margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN },
          },
        },
        children,
      },
    ],
  });
}
