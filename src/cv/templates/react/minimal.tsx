import type { CvReactTemplate } from "./cv-react-template";
import { colors, typography, spacing } from "../../shared/tokens";

/**
 * minimal (React) — mirrors src/lib/templates/minimal.ts.
 * Centered header, one-line stat row, thin accent rule, compact linear sections.
 */
export const minimalReactTemplate: CvReactTemplate = {
  id: "minimal",
  name: "Minimal",

  renderHeader(model, _t) {
    return (
      <div
        style={{
          textAlign: "center",
          borderBottom: `2px solid ${colors.accent}`,
          paddingBottom: spacing.md,
          marginBottom: spacing.lg,
        }}
      >
        <h1
          style={{
            fontSize: typography.sizes.name + 4,
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

        <p style={{ fontSize: typography.sizes.body - 2, color: colors.textGray, margin: 0 }}>
          {model.header.contacts.join("   ·   ")}
        </p>
      </div>
    );
  },

  renderStats(model, t) {
    const statText = [
      `${model.stats.repos} ${t.repositories.toLowerCase()}`,
      `${model.stats.stars} ${t.stars.toLowerCase()}`,
      `${model.stats.forks} ${t.forkLabel}`,
      `${model.stats.years} ${t.years.toLowerCase()}`,
    ].join("   ·   ");

    return (
      <section style={{ marginBottom: spacing.lg, textAlign: "center" }}>
        <p
          style={{
            fontSize: typography.sizes.body - 1,
            fontWeight: typography.weights.bold,
            color: colors.accent,
            margin: 0,
          }}
        >
          {statText}
        </p>
      </section>
    );
  },

  renderLanguages(model, t) {
    if (model.languages.length === 0) return null;

    return (
      <section style={{ marginBottom: spacing.lg }}>
        <h2 style={headingStyle}>{t.topLanguages}</h2>
        <p style={{ fontSize: typography.sizes.body, color: colors.textGray, margin: 0 }}>
          {model.languages.map((l) => `${l.name} (${l.percent}%)`).join("   ·   ")}
        </p>
      </section>
    );
  },

  renderProjects(model, t) {
    return (
      <section style={{ marginBottom: spacing.lg }}>
        <h2 style={headingStyle}>{t.featuredProjects}</h2>
        {model.projects.map((project) => {
          const tags = [project.language, ...(project.topics || [])].filter(Boolean).join("  ·  ");
          return (
            <div key={project.name} style={{ marginBottom: spacing.md }}>
              <div>
                <a
                  href={project.url}
                  style={{
                    fontWeight: typography.weights.bold,
                    fontSize: typography.sizes.body + 1,
                    color: colors.accent,
                    textDecoration: "none",
                  }}
                >
                  {project.name}
                </a>
                <span style={{ fontSize: typography.sizes.body - 3, color: colors.textGray }}>
                  {"   ★ "}
                  {project.stars}
                  {"   "}
                  {project.forks} {t.forkLabel}
                </span>
              </div>
              <p style={{ fontSize: typography.sizes.body - 1, color: colors.textGray, margin: `${spacing.xs}px 0` }}>
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
