/**
 * Company keyword extraction for job descriptions.
 *
 * Deterministic, dictionary-based: a job description is scanned against a
 * curated map of tech terms grouped by category (frontend, backend, mobile,
 * data, devops, ai, testing, tools). This powers job matching, ATS
 * optimization and the "keyword coverage" view.
 *
 * No AI — the AI layer stays dormant until production approval.
 */

import type { JobKeywordHit } from "./types";

/**
 * term → category. Terms are matched case-insensitively against the job
 * description. Multi-word terms are matched as substrings, so "machine
 * learning" is found inside "ML / machine learning pipelines".
 */
const JOB_KEYWORDS: Record<string, string> = {
  // ── Languages ──────────────────────────────────────────────────
  typescript: "language",
  javascript: "language",
  python: "language",
  java: "language",
  go: "language",
  golang: "language",
  rust: "language",
  csharp: "language",
  "c#": "language",
  "c++": "language",
  php: "language",
  ruby: "language",
  kotlin: "language",
  swift: "language",
  dart: "language",
  sql: "language",
  graphql: "language",
  shell: "language",
  bash: "language",
  // ── Frontend ───────────────────────────────────────────────────
  react: "frontend",
  "next.js": "frontend",
  nextjs: "frontend",
  vue: "frontend",
  angular: "frontend",
  svelte: "frontend",
  tailwind: "frontend",
  html: "frontend",
  css: "frontend",
  redux: "frontend",
  webpack: "frontend",
  "frontend": "frontend",
  "front-end": "frontend",
  // ── Backend ────────────────────────────────────────────────────
  "node.js": "backend",
  nodejs: "backend",
  express: "backend",
  fastapi: "backend",
  django: "backend",
  flask: "backend",
  "spring boot": "backend",
  spring: "backend",
  "rails": "backend",
  "laravel": "backend",
  rest: "backend",
  "rest api": "backend",
  api: "backend",
  apis: "backend",
  microservices: "backend",
  grpc: "backend",
  backend: "backend",
  "back-end": "backend",
  // ── Mobile ─────────────────────────────────────────────────────
  "react native": "mobile",
  flutter: "mobile",
  ios: "mobile",
  android: "mobile",
  mobile: "mobile",
  // ── Data ───────────────────────────────────────────────────────
  postgresql: "data",
  postgres: "data",
  mysql: "data",
  mongodb: "data",
  redis: "data",
  sqlite: "data",
  elasticsearch: "data",
  "data engineering": "data",
  "data pipeline": "data",
  etl: "data",
  spark: "data",
  hadoop: "data",
  pandas: "data",
  numpy: "data",
  snowflake: "data",
  bigquery: "data",
  database: "data",
  // ── DevOps / cloud ─────────────────────────────────────────────
  docker: "devops",
  kubernetes: "devops",
  k8s: "devops",
  terraform: "devops",
  ansible: "devops",
  jenkins: "devops",
  "github actions": "devops",
  "ci/cd": "devops",
  aws: "devops",
  azure: "devops",
  "google cloud": "devops",
  gcp: "devops",
  linux: "devops",
  nginx: "devops",
  serverless: "devops",
  devops: "devops",
  monitoring: "devops",
  prometheus: "devops",
  grafana: "devops",
  cloud: "devops",
  // ── AI / ML ────────────────────────────────────────────────────
  "machine learning": "ai",
  ml: "ai",
  "deep learning": "ai",
  nlp: "ai",
  "natural language processing": "ai",
  "computer vision": "ai",
  tensorflow: "ai",
  pytorch: "ai",
  "large language model": "ai",
  llm: "ai",
  generative: "ai",
  openai: "ai",
  "data science": "ai",
  // ── Testing ────────────────────────────────────────────────────
  testing: "testing",
  jest: "testing",
  cypress: "testing",
  playwright: "testing",
  "unit test": "testing",
  "integration test": "testing",
  tdd: "testing",
  // ── Tools / process ────────────────────────────────────────────
  git: "tools",
  agile: "tools",
  scrum: "tools",
  jira: "tools",
  postman: "tools",
  figma: "tools",
  // ── Soft skills / concepts ─────────────────────────────────────
  leadership: "soft",
  collaboration: "soft",
  communication: "soft",
  "problem solving": "soft",
  mentorship: "soft",
  "open source": "soft",
};

/** Stable sort order for categories shown in the UI. */
export const KEYWORD_CATEGORY_ORDER = [
  "language",
  "frontend",
  "backend",
  "mobile",
  "data",
  "devops",
  "ai",
  "testing",
  "tools",
  "soft",
];

/**
 * Builds a word-boundary-aware regex for a dictionary term.
 *
 * Terms ending in a word character get a TRAILING `\b` so short terms do
 * not false-positive inside longer words ("go" must not match "Google",
 * "git" must not match "GitHub", "api" must not match "Apigee"). Terms
 * ending in a non-word character ("c#", "c++") cannot use a trailing
 * boundary, so they anchor on the leading boundary only.
 */
function termRegex(term: string, flags: string): RegExp {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const last = term[term.length - 1] ?? "";
  const trailing = /\w/.test(last) ? "\\b" : "";
  return new RegExp(`\\b${escaped}${trailing}`, flags);
}

/**
 * Scans a job description and returns every detected keyword with counts,
 * sorted by category then frequency.
 */
export function extractCompanyKeywords(description: string): JobKeywordHit[] {
  if (!description) return [];
  const lower = description.toLowerCase();

  const hits: Record<string, JobKeywordHit> = {};
  for (const [term, category] of Object.entries(JOB_KEYWORDS)) {
    const match = lower.match(termRegex(term, "i"));
    if (!match) continue;

    const count = (lower.match(termRegex(term, "gi")) ?? []).length;

    const key = term.toLowerCase();
    if (!hits[key]) {
      hits[key] = { term, category, count };
    }
  }

  return Object.values(hits).sort((a, b) => {
    const catDiff =
      KEYWORD_CATEGORY_ORDER.indexOf(a.category) -
      KEYWORD_CATEGORY_ORDER.indexOf(b.category);
    if (catDiff !== 0) return catDiff;
    return b.count - a.count;
  });
}


