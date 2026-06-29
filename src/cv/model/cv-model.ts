/**
 * This module intentionally does NOT redefine CvModel.
 * The production CvModel (and mapGithubToCvModel) already lives in
 * src/lib/cv-model.ts and is the single source of truth for both the
 * DOCX renderer and this React preview system.
 *
 * Re-exporting here just gives the cv/ React subsystem a stable import
 * path without creating a second, divergent type definition.
 */
export type { CvModel } from "@/lib/cv-model";
export { mapGithubToCvModel } from "@/lib/cv-model";

/**
 * CvStrings/CvLocale also stay centralized in src/lib/cv-strings.ts.
 * Both the DOCX templates and the React templates read from the exact
 * same STRINGS table, so adding/editing a translation only happens once.
 */
export type { CvLocale, CvStrings } from "@/lib/cv-strings";
export { getStrings } from "@/lib/cv-strings";
