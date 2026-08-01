import type { CvReactTemplate } from "./cv-react-template";
import { colors, typography, spacing } from "../../shared/tokens";

/**
 * developer_card (React) — mirrors src/lib/templates/developer-card.ts.
 * Dark header band, GitHub-profile-like stat row, repos rendered as
 * bordered "cards" with a left accent stripe.
 */
export const developerCardReactTemplate: CvReactTemplate = {
  id: "developer_card",
  name: "Developer Card",

  renderHeader(model, _t) {
    return (
      <div
        style={{
          background: colors.darkBg,
          color: colors.creamText,
          padding: `${spacing.lg}px ${spacing.xl}px`,
          marginBottom: 0,
        }}
      >
        <h1
          style={{
            fontSize: typography.sizes.name + 4,
            fontWeight: typography.weights.bold,
            color: "#FFFFFF",
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
              color: colors.creamText,
              margin: 0,
              marginBottom: spacing.sm,
            }}
          >
            {model.header.bio}
          </p>
        )}

        <p style={{ fontSize: typography.sizes.body - 2, color: colors.creamText, margin: 0, opacity: 0.85 }}>
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
      <section style={{ padding: `${spacing.lg}px ${spacing.xl}px`, paddingBottom: 0 }}>
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

    const shown = model.languages.slice(0, 5);

    return (
      <section style={{ padding: `${spacing.lg}px ${spacing.xl}px`, paddingBottom: 0 }}>
        <h2 style={headingStyle}>{t.topLanguages}</h2>
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${shown.length}, 1fr)`, gap: spacing.sm }}>
          {shown.map((l) => (
            <div
              key={l.name}
              style={{
                background: colors.cardBg,
                borderRadius: 4,
                padding: `${spacing.xs}px ${spacing.xs}px`,
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: typography.sizes.body + 2, fontWeight: typography.weights.bold, color: colors.accent }}>
                {l.percent}%
              </div>
              <div style={{ fontSize: typography.sizes.label, color: "#555555" }}>{l.name}</div>
            </div>
          ))}
        </div>
      </section>
    );
  },

  renderProjects(model, t) {
    return (
      <section style={{ padding: `${spacing.lg}px ${spacing.xl}px`, paddingBottom: 0 }}>
        <h2 style={headingStyle}>{t.featuredProjects}</h2>
        {model.projects.map((project) => {
          const tags = [project.language, ...(project.topics || [])].filter(Boolean).join("  -  ");
          return (
            <div
              key={project.name}
              style={{
                background: colors.cardBg,
                borderLeft: `4px solid ${colors.accent}`,
                borderTop: `1px solid ${colors.accent}`,
                borderRight: `1px solid ${colors.border}`,
                borderBottom: `1px solid ${colors.border}`,
                borderRadius: 4,
                padding: spacing.md,
                marginBottom: spacing.sm,
              }}
            >
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
                <span style={{ fontSize: typography.sizes.body - 2, color: "#666666" }}>
                  {"   * "}
                  {project.stars}
                  {"   "}
                  {project.forks} {t.forkLabel}
                </span>
              </div>
              <p style={{ fontSize: typography.sizes.body - 1, color: "#333333", margin: `${spacing.xs}px 0` }}>
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
          background: colors.darkBg,
          color: colors.creamText,
          textAlign: "center",
          padding: `${spacing.sm}px ${spacing.xl}px`,
          marginTop: spacing.md,
        }}
      >
        <p style={{ fontSize: typography.sizes.footer, margin: 0 }}>{t.generatedBy}</p>
      </div>
    );
  },
};

const headingStyle: React.CSSProperties = {
  fontSize: typography.sizes.heading,
  fontWeight: typography.weights.bold,
  color: colors.darkBg,
  marginTop: 0,
  marginBottom: spacing.sm,
  borderLeft: `4px solid ${colors.accent}`,
  paddingLeft: spacing.sm,
};
