import {
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  ExternalHyperlink,
} from "docx";
import type { CvTemplate } from "../cv-template";
import { ACCENT_COLOR, TEXT_GRAY } from "./shared";

/**
 * minimal — a single-column, typography-driven template. No stat table,
 * no colored boxes: name, bio, a thin rule, then compact linear sections.
 * Reads cleanly on screen and in print, and is extremely ATS-friendly.
 */
export const minimalTemplate: CvTemplate = {
  id: "minimal",
  name: "Minimal",

  renderHeader(model, _t) {
    const out: Paragraph[] = [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({ text: model.header.name, bold: true, size: 52, color: "1A1A1A" }),
        ],
        spacing: { after: 80 },
      }),
    ];

    if (model.header.bio) {
      out.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({ text: model.header.bio, italics: true, size: 22, color: TEXT_GRAY }),
          ],
          spacing: { after: 120 },
        })
      );
    }

    out.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({ text: model.header.contacts.join("   ·   "), size: 18, color: TEXT_GRAY }),
        ],
        spacing: { after: 200 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: ACCENT_COLOR, space: 6 } },
      })
    );

    return out;
  },

  renderStats(model, t) {
    // Minimal template folds the four stats into a single centered line —
    // no table, just "repos · stars · forks · years".
    const statText = [
      `${model.stats.repos} ${t.repositories.toLowerCase()}`,
      `${model.stats.stars} ${t.stars.toLowerCase()}`,
      `${model.stats.forks} ${t.forkLabel}`,
      `${model.stats.years} ${t.years.toLowerCase()}`,
    ].join("   ·   ");

    return [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: statText, size: 20, color: ACCENT_COLOR, bold: true })],
        spacing: { after: 240 },
      }),
    ];
  },

  renderLanguages(model, t) {
    if (model.languages.length === 0) return [];

    return [
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun({ text: t.topLanguages, color: "1A1A1A" })],
        spacing: { before: 200, after: 100 },
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: model.languages.map((l) => `${l.name} (${l.percent}%)`).join("   ·   "),
            size: 20,
            color: TEXT_GRAY,
          }),
        ],
        spacing: { after: 200 },
      }),
    ];
  },

  renderProjects(model, t) {
    const out: Paragraph[] = [
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun({ text: t.featuredProjects, color: "1A1A1A" })],
        spacing: { before: 200, after: 140 },
      }),
    ];

    for (const project of model.projects) {
      const tags = [project.language, ...(project.topics || [])].filter(Boolean).join("  ·  ");

      out.push(
        new Paragraph({
          children: [
            new ExternalHyperlink({
              link: project.url,
              children: [
                new TextRun({ text: project.name, bold: true, size: 24, color: ACCENT_COLOR }),
              ],
            }),
            new TextRun({
              text: `   ★ ${project.stars}   ${project.forks} ${t.forkLabel}`,
              size: 16,
              color: TEXT_GRAY,
            }),
          ],
          spacing: { before: 120, after: 20 },
        })
      );

      out.push(
        new Paragraph({
          children: [
            new TextRun({ text: project.description || t.noDescription, size: 20, color: TEXT_GRAY }),
          ],
          spacing: { after: tags ? 20 : 60 },
        })
      );

      if (tags) {
        out.push(
          new Paragraph({
            children: [new TextRun({ text: tags, size: 16, italics: true, color: "888888" })],
            spacing: { after: 60 },
          })
        );
      }
    }

    return out;
  },

  renderFooter(model, t) {
    return [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 320 },
        border: { top: { style: BorderStyle.SINGLE, size: 2, color: "DDDDDD", space: 8 } },
        children: [new TextRun({ text: t.generatedBy, size: 14, italics: true, color: "AAAAAA" })],
      }),
    ];
  },
};


