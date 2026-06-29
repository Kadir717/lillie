import {
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
import type { CvTemplate } from "../cv-template";
import { CONTENT_WIDTH, ACCENT_COLOR, statBoxCell } from "./shared";

const DARK_BG = "1A1A2E";
const CARD_BG = "F0F4FA";
const CREAM_TEXT = "E8E8F0";

/**
 * developer_card — GitHub-focused design. Stats lead the page, repos are
 * rendered as bordered "cards" rather than plain paragraphs, and a dark
 * accent header evokes a GitHub profile / terminal aesthetic.
 */
export const developerCardTemplate: CvTemplate = {
  id: "developer_card",
  name: "Developer Card",

  renderHeader(model, t) {
    return [
      new Paragraph({
        shading: { fill: DARK_BG, type: ShadingType.CLEAR },
        spacing: { after: 0 },
        children: [
          new TextRun({ text: `  ${model.header.name}`, bold: true, size: 52, color: "FFFFFF" }),
        ],
      }),
      ...(model.header.bio
        ? [
            new Paragraph({
              shading: { fill: DARK_BG, type: ShadingType.CLEAR },
              spacing: { after: 0 },
              children: [new TextRun({ text: `  ${model.header.bio}`, italics: true, size: 22, color: CREAM_TEXT })],
            }),
          ]
        : []),
      new Paragraph({
        shading: { fill: DARK_BG, type: ShadingType.CLEAR },
        spacing: { after: 240 },
        children: [
          new TextRun({ text: `  ${model.header.contacts.join("  -  ")}  `, size: 18, color: CREAM_TEXT }),
        ],
      }),
    ];
  },

  renderStats(model, t) {
    // Stats lead immediately under the header with no heading label —
    // the numbers themselves are the visual hook for this template.
    return new Table({
      width: { size: CONTENT_WIDTH, type: WidthType.DXA },
      columnWidths: [CONTENT_WIDTH / 4, CONTENT_WIDTH / 4, CONTENT_WIDTH / 4, CONTENT_WIDTH / 4],
      rows: [
        new TableRow({
          children: [
            statBoxCell(t.repositories, model.stats.repos),
            statBoxCell(t.stars, model.stats.stars),
            statBoxCell(t.forks, model.stats.forks),
            statBoxCell(t.years, model.stats.years),
          ],
        }),
      ],
    });
  },

  renderLanguages(model, t) {
    if (model.languages.length === 0) return [];

    const langRow = new TableRow({
      children: model.languages.slice(0, 5).map(
        (l) =>
          new TableCell({
            width: { size: CONTENT_WIDTH / 5, type: WidthType.DXA },
            shading: { fill: CARD_BG, type: ShadingType.CLEAR },
            margins: { top: 80, bottom: 80, left: 60, right: 60 },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: `${l.percent}%`, bold: true, size: 24, color: ACCENT_COLOR })],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: l.name, size: 16, color: "555555" })],
              }),
            ],
          })
      ),
    });

    return [
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun({ text: t.topLanguages })],
        spacing: { before: 280, after: 120 },
      }),
      new Table({
        width: { size: CONTENT_WIDTH, type: WidthType.DXA },
        rows: [langRow],
      }),
    ];
  },

  renderProjects(model, t) {
    const out: (Paragraph | Table)[] = [
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun({ text: t.featuredProjects })],
        spacing: { before: 280, after: 160 },
      }),
    ];

    for (const project of model.projects) {
      const tags = [project.language, ...(project.topics || [])].filter(Boolean).join("  -  ");

      out.push(
        new Table({
          width: { size: CONTENT_WIDTH, type: WidthType.DXA },
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  width: { size: CONTENT_WIDTH, type: WidthType.DXA },
                  shading: { fill: CARD_BG, type: ShadingType.CLEAR },
                  margins: { top: 140, bottom: 140, left: 160, right: 160 },
                  borders: {
                    top: { style: BorderStyle.SINGLE, size: 2, color: ACCENT_COLOR },
                    left: { style: BorderStyle.SINGLE, size: 12, color: ACCENT_COLOR },
                    bottom: { style: BorderStyle.SINGLE, size: 1, color: "DDDDDD" },
                    right: { style: BorderStyle.SINGLE, size: 1, color: "DDDDDD" },
                  },
                  children: [
                    new Paragraph({
                      children: [
                        new ExternalHyperlink({
                          link: project.url,
                          children: [new TextRun({ text: project.name, bold: true, size: 26, color: ACCENT_COLOR })],
                        }),
                        new TextRun({
                          text: `   * ${project.stars}   ${project.forks} ${t.forkLabel}`,
                          size: 18,
                          color: "666666",
                        }),
                      ],
                      spacing: { after: 60 },
                    }),
                    new Paragraph({
                      children: [
                        new TextRun({ text: project.description || t.noDescription, size: 21, color: "333333" }),
                      ],
                      spacing: { after: tags ? 60 : 0 },
                    }),
                    ...(tags
                      ? [
                          new Paragraph({
                            children: [new TextRun({ text: tags, size: 17, italics: true, color: "888888" })],
                          }),
                        ]
                      : []),
                  ],
                }),
              ],
            }),
          ],
        })
      );

      out.push(new Paragraph({ spacing: { after: 120 }, children: [] }));
    }

    return out;
  },

  renderFooter(model, t) {
    return [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 200 },
        shading: { fill: DARK_BG, type: ShadingType.CLEAR },
        children: [new TextRun({ text: `  ${t.generatedBy}  `, size: 16, color: CREAM_TEXT })],
      }),
    ];
  },
};
