import type { ReactNode } from "react";
import type { CvModel } from "../../model/cv-model";
import type { CvStrings } from "../../model/cv-model";

/**
 * CvReactTemplate — the React-rendering counterpart to the DOCX CvTemplate
 * (src/lib/cv-template.ts). Same contract shape, same model, same strings.
 *
 * Rules enforced by this contract:
 *   - Pure rendering only: implementations receive CvModel + CvStrings and
 *     return ReactNode. No fetching, no API calls, no side effects.
 *   - Deterministic: same (model, strings) input always produces the same
 *     output tree.
 */
export type CvReactTemplate = {
  id: string;
  name: string;

  renderHeader(model: CvModel, t: CvStrings): ReactNode;
  renderStats(model: CvModel, t: CvStrings): ReactNode;
  renderLanguages(model: CvModel, t: CvStrings): ReactNode;
  renderProjects(model: CvModel, t: CvStrings): ReactNode;
  renderFooter(model: CvModel, t: CvStrings): ReactNode;
};
