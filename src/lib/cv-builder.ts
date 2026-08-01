import { Document } from "docx";
import type { GithubAggregateData } from "./github";
import { mapGithubToCvModel } from "./cv-model";
import type { CvModel } from "./cv-model";
import type { CvTemplate } from "./cv-template";
import { getStrings, type CvLocale } from "./cv-strings";
import { docStyles, pageSection } from "./templates/shared";

export type { CvLocale } from "./cv-strings";
export type { CvTemplate } from "./cv-template";
export type { CvModel } from "./cv-model";

/**
 * buildCvDocumentFromModel — render an already-built CvModel.
 *
 * This is the SHARED assembly used by both buildCvDocument (raw GitHub
 * data) and the job-optimized resume flow (job/company-specific CvModel).
 * There is exactly ONE place that turns a CvModel into a docx.Document,
 * so job-optimized resumes reuse the same templates, strings and styles
 * — no duplicated generation logic.
 */
export function buildCvDocumentFromModel(
  model: CvModel,
  locale: CvLocale,
  template: CvTemplate
): Document {
  const t = getStrings(locale);

  const header = template.renderHeader(model, t);
  const stats = template.renderStats(model, t);
  const languages = template.renderLanguages(model, t);
  const projects = template.renderProjects(model, t);
  const footer = template.renderFooter(model, t);

  const statsBlocks = Array.isArray(stats) ? stats : [stats];

  return new Document({
    styles: docStyles,
    sections: [
      {
        properties: pageSection,
        children: [...header, ...statsBlocks, ...languages, ...projects, ...footer],
      },
    ],
  });
}

/**
 * buildCvDocument — render engine entry point for raw GitHub data.
 *
 * Responsibilities ONLY:
 *   1. map raw GitHub data -> CvModel
 *   2. delegate every section's layout to the supplied template
 *   3. assemble the final docx.Document
 *
 * No layout/styling decisions are made here. All visual design lives
 * inside the CvTemplate implementation passed in.
 */
export function buildCvDocument(
  data: GithubAggregateData,
  locale: CvLocale,
  template: CvTemplate
): Document {
  return buildCvDocumentFromModel(mapGithubToCvModel(data), locale, template);
}
