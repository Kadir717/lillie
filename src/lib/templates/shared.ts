import { TableCell, Paragraph, TextRun, AlignmentType, BorderStyle, WidthType, ShadingType } from "docx";

export const PAGE_WIDTH = 12240;
export const PAGE_HEIGHT = 15840;
export const MARGIN = 1080;
export const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

export const ACCENT_COLOR = "2E5E8C";
export const TEXT_GRAY = "444444";

/**
 * Shared stat-box cell used by templates that render a 4-column stats table.
 * Kept here so both templates don't redefine identical table-cell styling.
 */
export function statBoxCell(label: string, value: string | number) {
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

export const docStyles = {
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
};

export const pageSection = {
    page: {
        size: { width: PAGE_WIDTH, height: PAGE_HEIGHT },
        margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN },
    },
};