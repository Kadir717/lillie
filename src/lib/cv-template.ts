import type { Paragraph, Table } from "docx";
import type { CvModel } from "./cv-model";
import type { CvStrings } from "./cv-strings";

/**
 * CvTemplate — the contract every CV design must implement.
 * Templates own ALL layout/styling decisions. They are the only files
 * allowed to import from "docx" besides the render engine assembly step.
 */
export type CvTemplate = {
    id: string;
    name: string;

    renderHeader(model: CvModel, t: CvStrings): (Paragraph | Table)[];
    renderStats(model: CvModel, t: CvStrings): Paragraph | Table | (Paragraph | Table)[];
    renderLanguages(model: CvModel, t: CvStrings): (Paragraph | Table)[];
    renderProjects(model: CvModel, t: CvStrings): (Paragraph | Table)[];
    renderFooter(model: CvModel, t: CvStrings): (Paragraph | Table)[];
};