import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { fetchGithubAggregate } from "@/lib/github";
import { mapGithubToCvModel } from "@/lib/cv-model";

interface AtsScore {
  overall: number;
  breakdown: {
    contactInfo: number;
    summary: number;
    skills: number;
    experience: number;
    education: number;
    achievements: number;
  };
  strengths: string[];
  weaknesses: string[];
  missingKeywords: string[];
  suggestions: string[];
}

const VALID_ROLES = ["software_engineer", "data_scientist", "devops"] as const;
type RoleSlug = (typeof VALID_ROLES)[number];

const KEYWORDS_BY_ROLE: Record<RoleSlug, string[]> = {
  software_engineer: [
    "full-stack", "backend", "frontend", "api", "database", "testing",
    "agile", "scrum", "git", "ci/cd", "microservices", "cloud",
    "docker", "kubernetes", "rest", "graphql", "typescript", "python",
    "go", "rust", "react", "node.js", "aws", "azure", "devops",
  ],
  data_scientist: [
    "machine learning", "deep learning", "statistics", "python", "r",
    "sql", "tensorflow", "pytorch", "nlp", "computer vision",
    "data pipeline", "etl", "visualization", "a/b testing",
    "pandas", "numpy", "scikit-learn", "spark", "hadoop",
  ],
  devops: [
    "ci/cd", "docker", "kubernetes", "terraform", "ansible",
    "jenkins", "github actions", "monitoring", "logging",
    "aws", "gcp", "azure", "linux", "shell", "prometheus",
    "grafana", "elk", "infrastructure", "security",
  ],
};

function validateRole(value: string | null): RoleSlug | null {
  if (!value) return null;
  return VALID_ROLES.includes(value as RoleSlug) ? (value as RoleSlug) : null;
}

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const rawRole = request.nextUrl.searchParams.get("role");
  const role = validateRole(rawRole) ?? "software_engineer";

  try {
    const data = await fetchGithubAggregate(
      session.githubAccessToken,
      session.githubUsername
    );
    const model = mapGithubToCvModel(data);

    const keywords = KEYWORDS_BY_ROLE[role];

    // ── Build text representation for analysis ────────────────────
    const bioText = model.header.bio || "";
    const allText = [
      bioText,
      model.header.name,
      ...model.header.contacts,
      ...model.languages.map((l) => l.name),
      ...model.projects.map(
        (p) =>
          `${p.name} ${p.description || ""} ${p.language || ""} ${(p.topics || []).join(" ")}`
      ),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    // ── Keyword analysis ──────────────────────────────────────────
    const foundKeywords = keywords.filter((kw) => allText.includes(kw.toLowerCase()));
    const missingKeywords = keywords.filter((kw) => !allText.includes(kw.toLowerCase()));
    const keywordScore = Math.round((foundKeywords.length / Math.max(keywords.length, 1)) * 100);

    // ── Section scores ────────────────────────────────────────────
    const contactInfo = model.header.contacts.length >= 2 ? 90 : model.header.contacts.length === 1 ? 60 : 30;
    const summary = model.header.bio
      ? model.header.bio.length > 100
        ? 80
        : model.header.bio.length > 50
          ? 60
          : 40
      : 10;
    const skills = model.languages.length >= 3
      ? 80
      : model.languages.length >= 1
        ? 50
        : 20;
    const experience = model.projects.length >= 3
      ? 70
      : model.projects.length >= 1
        ? 40
        : 10;
    const education = 0; // Not available from GitHub data
    const achievements = model.stats.stars > 10
      ? 50
      : model.stats.stars > 0
        ? 30
        : 10;

    const overall = Math.round((contactInfo + summary + skills + experience + education + achievements) / 6);

    // ── Strengths & weaknesses ────────────────────────────────────
    const strengths: string[] = [];
    const weaknesses: string[] = [];
    const suggestions: string[] = [];

    if (contactInfo >= 80) strengths.push("Good contact information provided");
    else suggestions.push("Add more contact details (location, email, blog)");

    if (summary >= 60) strengths.push("Strong bio/summary section");
    else if (summary > 0) weaknesses.push("Bio could be more detailed");
    else weaknesses.push("No bio or summary — add a brief professional summary");

    if (skills >= 80) strengths.push("Strong language diversity");
    else if (skills > 0) weaknesses.push("Limited language diversity");
    else weaknesses.push("No programming languages detected");

    if (experience >= 70) strengths.push("Good project portfolio");
    else if (experience > 0) weaknesses.push("Few projects shown");
    else weaknesses.push("No projects to showcase");

    if (keywordScore < 50) {
      weaknesses.push(`Only ${foundKeywords.length}/${keywords.length} role-relevant keywords found`);
      suggestions.push(
        `Consider adding these keywords to your bio/project descriptions: ${missingKeywords.slice(0, 8).join(", ")}`
      );
    } else if (keywordScore < 80) {
      suggestions.push(
        `Some relevant keywords missing: ${missingKeywords.slice(0, 5).join(", ")}`
      );
    } else {
      strengths.push(`Strong keyword alignment (${foundKeywords.length}/${keywords.length})`);
    }

    if (achievements < 30) {
      suggestions.push("Highlight starred/notable projects to show impact");
    }

    if (!education) {
      weaknesses.push("Education section is not available from GitHub data");
      suggestions.push("Consider manually adding education details to your CV");
    }

    const result: AtsScore = {
      overall,
      breakdown: { contactInfo, summary, skills, experience, education, achievements },
      strengths,
      weaknesses,
      missingKeywords: missingKeywords.slice(0, 15),
      suggestions,
    };

    return NextResponse.json({ score: result });
  } catch (err: unknown) {
    const error = err as Error & { status?: number };
    if (error.name === "GithubRateLimitError") {
      return NextResponse.json(
        { error: "GitHub API rate limit reached" },
        { status: 429 }
      );
    }
    console.error("ATS score failed:", err);
    return NextResponse.json(
      { error: "Failed to analyze CV" },
      { status: 500 }
    );
  }
}
