import type { CvModel } from "../model/cv-model";
import { getStrings, type CvLocale } from "../model/cv-model";
import { reactTemplates, defaultReactTemplate } from "../templates/react";
import { page, colors, typography } from "../shared/tokens";

export type CvPreviewProps = {
  model: CvModel;
  templateId: string;
  locale: CvLocale;
};

/**
 * CvPreview — pixel-perfect, pure-rendering CV preview.
 *
 * Usage:
 *   <CvPreview model={cvModel} templateId="classic_professional" locale="en" />
 *
 * Architectural guarantees:
 *   - CvModel is the ONLY data input. No fetching, no API calls happen here
 *     or in any CvReactTemplate implementation.
 *   - Deterministic: identical (model, templateId, locale) always renders
 *     the same output tree.
 *   - The DOCX renderer (src/lib/cv-builder.ts) and this component consume
 *     the exact same CvModel and CvStrings — there is no second mapping
 *     layer and no parsing of the generated .docx file.
 */
export function CvPreview({ model, templateId, locale }: CvPreviewProps) {
  const template = reactTemplates[templateId] ?? defaultReactTemplate;
  const t = getStrings(locale);

  return (
    <div
      className="cv-preview-page"
      dir={locale === "ar" ? "rtl" : "ltr"}
      style={{
        width: page.width,
        minHeight: page.minHeight,
        margin: "0 auto",
        background: colors.paper,
        fontFamily: typography.fontFamily,
        boxShadow: "0 8px 30px rgba(0,0,0,0.25)",
        overflow: "hidden",
      }}
    >
      <div style={{ padding: templateId === "developer_card" ? 0 : page.padding }}>
        {template.renderHeader(model, t)}
      </div>
      <div style={{ padding: templateId === "developer_card" ? 0 : `0 ${page.padding}px` }}>
        {template.renderStats(model, t)}
        {template.renderLanguages(model, t)}
        {template.renderProjects(model, t)}
      </div>
      <div>{template.renderFooter(model, t)}</div>

      {/* Print support: forces exact page width and removes screen-only shadow/margin when printing */}
      <style>{`
        @media print {
          .cv-preview-page {
            box-shadow: none !important;
            margin: 0 !important;
            width: 100% !important;
          }
        }
      `}</style>
    </div>
  );
}

export default CvPreview;
