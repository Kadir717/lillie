import {
    Paragraph,
    TextRun,
    Table,
    TableRow,
    HeadingLevel,
    AlignmentType,
    BorderStyle,
    WidthType,
    ExternalHyperlink,
} from "docx";
import type { CvTemplate } from "../cv-template";
import { CONTENT_WIDTH, ACCENT_COLOR, TEXT_GRAY, statBoxCell } from "./shared";

/**
 * classic_professional — minimal styling, ATS-friendly, simple linear sections.
 * Designed to read well both visually and when parsed by ATS software
 * (no decorative tables beyond the stat row, no heavy color blocks).
 */
export const classicProfessionalTemplate: CvTemplate = {
    id: "classic_professional",
    name: "Classic Professional",

    renderHeader(model, t) {
        const out: Paragraph[] = [
            new Paragraph({
                children: [new TextRun({ text: model.header.name, bold: true, size: 48, color: "1A1A1A" })],
                spacing: { after: 60 },
            }),
        ];

        if (model.header.bio) {
            out.push(
                new Paragraph({
                    children: [new TextRun({ text: model.header.bio, italics: true, size: 24, color: TEXT_GRAY })],
                    spacing: { after: 120 },
                })
            );
        }

        out.push(
            new Paragraph({
                children: [new TextRun({ text: model.header.contacts.join("  -  "), size: 20, color: TEXT_GRAY })],
                spacing: { after: 240 },
                border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: ACCENT_COLOR, space: 4 } },
            })
        );

        return out;
    },

    renderStats(model, t) {
        return [
            new Paragraph({
                heading: HeadingLevel.HEADING_2,
                children: [new TextRun({ text: t.stats })],
                spacing: { before: 120, after: 120 },
            }),
            new Table({
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
            }),
        ];
    },

    renderLanguages(model, t) {
        if (model.languages.length === 0) return [];

        return [
            new Paragraph({
                heading: HeadingLevel.HEADING_2,
                children: [new TextRun({ text: t.topLanguages })],
                spacing: { before: 280, after: 120 },
            }),
            new Paragraph({
                children: [
                    new TextRun({
                        text: model.languages.map((l) => `${l.name} (${l.percent}%)`).join("   -   "),
                        size: 22,
                        color: TEXT_GRAY,
                    }),
                ],
                spacing: { after: 240 },
            }),
        ];
    },

    renderProjects(model, t) {
        const out: Paragraph[] = [
            new Paragraph({
                heading: HeadingLevel.HEADING_2,
                children: [new TextRun({ text: t.featuredProjects })],
                spacing: { before: 120, after: 160 },
            }),
        ];

        for (const project of model.projects) {
            out.push(
                new Paragraph({
                    children: [
                        new ExternalHyperlink({
                            link: project.url,
                            children: [new TextRun({ text: project.name, bold: true, size: 26, color: ACCENT_COLOR })],
                        }),
                        new TextRun({
                            text: `   * ${project.stars}   ${project.forks} ${t.forkLabel}`,
                            size: 18,
                            color: TEXT_GRAY,
                        }),
                    ],
                    spacing: { before: 160, after: 40 },
                })
            );

            out.push(
                new Paragraph({
                    children: [new TextRun({ text: project.description || t.noDescription, size: 22, color: TEXT_GRAY })],
                    spacing: { after: 40 },
                })
            );

            if (project.language || (project.topics && project.topics.length > 0)) {
                const tags = [project.language, ...(project.topics || [])].filter(Boolean).join("  -  ");
                out.push(
                    new Paragraph({
                        children: [new TextRun({ text: tags, size: 18, italics: true, color: "888888" })],
                        spacing: { after: 80 },
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
                spacing: { before: 400 },
                border: { top: { style: BorderStyle.SINGLE, size: 4, color: "DDDDDD", space: 8 } },
                children: [new TextRun({ text: t.generatedBy, size: 16, italics: true, color: "AAAAAA" })],
            }),
        ];
    },
};