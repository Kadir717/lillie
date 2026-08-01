import type { CvReactTemplate } from "./cv-react-template";
import { colors, typography, spacing } from "../../shared/tokens";

/**
 * classic_professional (React) — mirrors src/lib/templates/classic-professional.ts.
 * Minimal styling, linear sections, ATS-friendly reading order.
 */
export const classicProfessionalReactTemplate: CvReactTemplate = {
  id: "classic_professional",
  name: "Classic Professional",

  renderHeader(model, _t) {
    return (
      <div
        style={{
          borderBottom: `2px solid ${colors.accent}`,
          paddingBottom: spacing.md,
          marginBottom: spacing.lg,
        }}
      >
        <h1
          style={{
            fontSize: typography.sizes.name,
            fontWeight: typography.weights.bold,
            color: colors.textPrimary,
            margin: 0,
            marginBottom: spacing.xs,
          }}
        >
          {model.header.name}
        </h1>

        {model.header.bio && (
          <p
            style={{
              fontSize: typography.sizes.bio,
              fontStyle: "italic",
              color: colors.textGray,
              margin: 0,
              marginBottom: spacing.sm,
            }}
          >
            {model.header.bio}
          </p>
        )}

        <p style={{ fontSize: typography.sizes.body - 1, color: colors.textGray, margin: 0 }}>
          {model.header.contacts.join("  -  ")}
        </p>
      </div>
    );
  },

  renderStats(model, t) {
    const items: [string, string | number][] = [
      [t.repositories, model.stats.repos],
      [t.stars, model.stats.stars],
      [t.forks, model.stats.forks],
      [t.years, model.stats.years],
    ];

    return (
      <section style={{ marginBottom: spacing.lg }}>
        <h2 style={headingStyle}>{t.stats}</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: spacing.sm }}>
          {items.map(([label, value]) => (
            <div
              key={label}
              style={{
                background: colors.statBg,
                border: `1px solid ${colors.border}`,
                borderRadius: 4,
                padding: `${spacing.sm}px ${spacing.xs}px`,
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: typography.sizes.statValue, fontWeight: typography.weights.bold, color: colors.accent }}>
                {value}
              </div>
              <div style={{ fontSize: typography.sizes.label, color: colors.textGray, textTransform: "uppercase" }}>
                {label}
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  },

  renderLanguages(model, t) {
    if (model.languages.length === 0) return null;

    return (
      <section style={{ marginBottom: spacing.lg }}>
        <h2 style={headingStyle}>{t.topLanguages}</h2>
        <p style={{ fontSize: typography.sizes.body, color: colors.textGray, margin: 0 }}>
          {model.languages.map((l) => `${l.name} (${l.percent}%)`).join("   -   ")}
        </p>
      </section>
    );
  },

  renderProjects(model, t) {
    return (
      <section style={{ marginBottom: spacing.lg }}>
        <h2 style={headingStyle}>{t.featuredProjects}</h2>
        {model.projects.map((project) => {
          const tags = [project.language, ...(project.topics || [])].filter(Boolean).join("  -  ");
          return (
            <div key={project.name} style={{ marginBottom: spacing.md }}>
              <div>
                <a
                  href={project.url}
                  style={{
                    fontWeight: typography.weights.bold,
                    fontSize: typography.sizes.body + 2,
                    color: colors.accent,
                    textDecoration: "none",
                  }}
                >
                  {project.name}
                </a>
                <span style={{ fontSize: typography.sizes.body - 2, color: colors.textGray }}>
                  {"   * "}
                  {project.stars}
                  {"   "}
                  {project.forks} {t.forkLabel}
                </span>
              </div>
              <p style={{ fontSize: typography.sizes.body, color: colors.textGray, margin: `${spacing.xs}px 0` }}>
                {project.description || t.noDescription}
              </p>
              {tags && (
                <p style={{ fontSize: typography.sizes.body - 3, fontStyle: "italic", color: colors.textMuted, margin: 0 }}>
                  {tags}
                </p>
              )}
            </div>
          );
        })}
      </section>
    );
  },

  renderFooter(model, t) {
    return (
      <div
        style={{
          borderTop: `1px solid ${colors.border}`,
          paddingTop: spacing.sm,
          textAlign: "center",
        }}
      >
        <p style={{ fontSize: typography.sizes.footer, fontStyle: "italic", color: colors.textFaint, margin: 0 }}>
          {t.generatedBy}
        </p>
      </div>
    );
  },
};

const headingStyle: React.CSSProperties = {
  fontSize: typography.sizes.heading,
  fontWeight: typography.weights.bold,
  color: colors.textPrimary,
  marginTop: 0,
  marginBottom: spacing.sm,
};
