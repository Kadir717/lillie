/**
 * Interview question banks + deterministic generator.
 *
 * Questions are selected based on the developer's DETECTED skills (from
 * GitHub analytics), their top languages, and (optionally) a target role.
 * Everything is rule-based — no AI.
 */

import type { CvModel } from "../cv-model";
import type { GithubAnalyticsData } from "../github-analytics";
import type { InterviewQuestion, QuestionType } from "./types";

interface QuestionTemplate {
  id: string;
  type: QuestionType;
  topic: string;
  text: string;
  difficulty: "junior" | "mid" | "senior";
  expectedKeywords: string[];
  hint: string;
  /** Skill category this targets (matches github-analytics categories). */
  skillCategory?: string;
  /** Language name this targets, if language-specific. */
  language?: string;
}

/* ────────────────────────────────────────────────────────────────────
 * Technical question bank (keyed by skill/language)
 * ──────────────────────────────────────────────────────────────────── */

const TECHNICAL_QUESTIONS: QuestionTemplate[] = [
  // ── Core language concepts ─────────────────────────────────────
  {
    id: "t-js-closures",
    type: "technical",
    topic: "JavaScript",
    language: "javascript",
    difficulty: "mid",
    text: "Explain closures in JavaScript. Give a real example of where they are useful.",
    expectedKeywords: ["closure", "function", "scope", "lexical", "state"],
    hint: "Mention lexical scoping and that closures 'remember' their outer scope.",
  },
  {
    id: "t-js-event-loop",
    type: "technical",
    topic: "JavaScript",
    language: "javascript",
    difficulty: "mid",
    text: "How does the JavaScript event loop work? What is the difference between microtasks and macrotasks?",
    expectedKeywords: ["event loop", "microtask", "macrotask", "promise", "callback"],
    hint: "Talk about the call stack, task queue, and how promises defer execution.",
  },
  {
    id: "t-ts-types",
    type: "technical",
    topic: "TypeScript",
    language: "typescript",
    difficulty: "mid",
    text: "Explain the difference between `type` and `interface` in TypeScript, and when you would use each.",
    expectedKeywords: ["type", "interface", "union", "intersection", "extends"],
    hint: "Both can describe shapes; types excel at unions, interfaces at declaration merging.",
  },
  {
    id: "t-py-gil",
    type: "technical",
    topic: "Python",
    language: "python",
    difficulty: "senior",
    text: "What is the GIL in Python and how does it affect concurrency?",
    expectedKeywords: ["gil", "thread", "concurrency", "multiprocessing", "lock"],
    hint: "Mention that only one thread runs Python bytecode at a time; I/O-bound vs CPU-bound.",
  },
  {
    id: "t-go-goroutines",
    type: "technical",
    topic: "Go",
    language: "go",
    difficulty: "mid",
    text: "How do goroutines differ from OS threads, and how would you coordinate them?",
    expectedKeywords: ["goroutine", "channel", "concurrency", "waitgroup", "scheduler"],
    hint: "Goroutines are multiplexed onto threads; channels and WaitGroups coordinate them.",
  },
  {
    id: "t-sql-join",
    type: "technical",
    topic: "SQL",
    language: "sql",
    difficulty: "mid",
    text: "Explain the difference between INNER JOIN, LEFT JOIN, and FULL OUTER JOIN with an example.",
    expectedKeywords: ["join", "inner", "left", "outer", "null"],
    hint: "Focus on which rows are retained when the right side has no match.",
  },
  {
    id: "t-sql-index",
    type: "technical",
    topic: "SQL",
    language: "sql",
    difficulty: "senior",
    text: "When would a query not use an index even though one exists?",
    expectedKeywords: ["index", "selectivity", "sargable", "function", "wildcard"],
    hint: "Leading wildcards, function-wrapped columns, and low selectivity defeat indexes.",
  },
  {
    id: "t-java-memory",
    type: "technical",
    topic: "Java",
    language: "java",
    difficulty: "senior",
    text: "Describe the Java memory model: heap, stack, and garbage collection at a high level.",
    expectedKeywords: ["heap", "stack", "gc", "garbage", "reference"],
    hint: "Objects live on the heap; GC reclaims unreachable objects via reachability.",
  },
  {
    id: "t-rust-ownership",
    type: "technical",
    topic: "Rust",
    language: "rust",
    difficulty: "senior",
    text: "Explain ownership and borrowing in Rust. How does it prevent data races?",
    expectedKeywords: ["ownership", "borrow", "lifetime", "mutable", "compile"],
    hint: "One owner at a time; borrows are checked at compile time — no runtime GC.",
  },
  {
    id: "t-cs-rest",
    type: "technical",
    topic: "REST APIs",
    skillCategory: "backend",
    difficulty: "mid",
    text: "Design a RESTful API for a simple notes app. What endpoints and status codes would you use?",
    expectedKeywords: ["rest", "endpoint", "status", "resource", "http"],
    hint: "Resource-based URLs, proper HTTP verbs, and meaningful status codes.",
  },
  {
    id: "t-cs-cache",
    type: "technical",
    topic: "Caching",
    skillCategory: "backend",
    difficulty: "senior",
    text: "Explain cache invalidation strategies (TTL, LRU, write-through) and when each makes sense.",
    expectedKeywords: ["ttl", "lru", "cache", "invalidation", "stale"],
    hint: "Trade off freshness vs hit rate; know your data's read/write ratio.",
  },
  {
    id: "t-cs-auth",
    type: "technical",
    topic: "Authentication",
    skillCategory: "backend",
    difficulty: "mid",
    text: "Compare session-based auth vs JWT auth. What are the trade-offs?",
    expectedKeywords: ["session", "jwt", "token", "stateless", "revoke"],
    hint: "JWTs are stateless but hard to revoke; sessions are revocable but server-stored.",
  },
  {
    id: "t-fe-react",
    type: "technical",
    topic: "React",
    skillCategory: "frontend",
    difficulty: "mid",
    text: "What causes unnecessary re-renders in React, and how do you prevent them?",
    expectedKeywords: ["render", "memo", "memoization", "state", "props"],
    hint: "Referential equality, React.memo, useMemo/useCallback, and stable keys.",
  },
  {
    id: "t-fe-virtual-dom",
    type: "technical",
    topic: "Frontend",
    skillCategory: "frontend",
    difficulty: "mid",
    text: "Explain the virtual DOM and reconciliation. Why do frameworks bother?",
    expectedKeywords: ["virtual dom", "reconciliation", "diff", "render", "paint"],
    hint: "Minimize expensive real-DOM mutations by diffing in memory first.",
  },
  {
    id: "t-fe-css",
    type: "technical",
    topic: "CSS",
    skillCategory: "frontend",
    difficulty: "junior",
    text: "Explain the CSS box model and the difference between `content-box` and `border-box`.",
    expectedKeywords: ["box model", "padding", "border", "margin", "box-sizing"],
    hint: "Width is computed on content vs including padding/border.",
  },
  {
    id: "t-mob-flutter",
    type: "technical",
    topic: "Flutter",
    skillCategory: "mobile",
    difficulty: "mid",
    text: "How does Flutter render widgets and what is the widget tree?",
    expectedKeywords: ["widget", "element", "render", "tree", "reactive"],
    hint: "Widgets are immutable configs; elements/render objects handle painting.",
  },
  {
    id: "t-mob-native",
    type: "technical",
    topic: "Mobile",
    skillCategory: "mobile",
    difficulty: "mid",
    text: "What is the difference between native, cross-platform, and hybrid mobile development?",
    expectedKeywords: ["native", "cross-platform", "hybrid", "webview", "performance"],
    hint: "Trade off performance/UX against code sharing and team skill.",
  },
  {
    id: "t-data-normalize",
    type: "technical",
    topic: "Databases",
    skillCategory: "data",
    difficulty: "mid",
    text: "Explain database normalization. When might you deliberately denormalize?",
    expectedKeywords: ["normalization", "denormalize", "redundancy", "performance", "read"],
    hint: "Normal forms reduce redundancy; denormalizing helps read-heavy workloads.",
  },
  {
    id: "t-data-model",
    type: "technical",
    topic: "Data Modeling",
    skillCategory: "data",
    difficulty: "senior",
    text: "How would you model a many-to-many relationship in a relational database?",
    expectedKeywords: ["junction", "join table", "foreign key", "composite", "index"],
    hint: "A junction table with two foreign keys is the standard answer.",
  },
  {
    id: "t-dev-docker",
    type: "technical",
    topic: "Docker",
    skillCategory: "devops",
    difficulty: "mid",
    text: "Explain Docker layers and why image size matters.",
    expectedKeywords: ["layer", "image", "container", "cache", "size"],
    hint: "Each instruction creates a layer; caching layers speeds builds.",
  },
  {
    id: "t-dev-k8s",
    type: "technical",
    topic: "Kubernetes",
    skillCategory: "devops",
    difficulty: "senior",
    text: "What is a Kubernetes Pod, and how does it differ from a Deployment?",
    expectedKeywords: ["pod", "deployment", "replica", "container", "orchestration"],
    hint: "Pods are the smallest unit; Deployments manage replica sets declaratively.",
  },
  {
    id: "t-dev-cicd",
    type: "technical",
    topic: "CI/CD",
    skillCategory: "devops",
    difficulty: "mid",
    text: "Design a CI/CD pipeline for a small web app. What stages would you include?",
    expectedKeywords: ["pipeline", "build", "test", "deploy", "ci"],
    hint: "Lint → test → build → stage → deploy, with gates and rollback.",
  },
  {
    id: "t-ai-ml-basics",
    type: "technical",
    topic: "Machine Learning",
    skillCategory: "ai",
    difficulty: "mid",
    text: "Explain the difference between supervised and unsupervised learning with examples.",
    expectedKeywords: ["supervised", "unsupervised", "labels", "clustering", "classification"],
    hint: "Supervised uses labeled data; unsupervised finds structure without labels.",
  },
  {
    id: "t-ai-overfit",
    type: "technical",
    topic: "Machine Learning",
    skillCategory: "ai",
    difficulty: "senior",
    text: "What is overfitting and how do you detect and prevent it?",
    expectedKeywords: ["overfit", "validation", "regularization", "train", "test"],
    hint: "Huge train vs validation gap; regularize, cross-validate, get more data.",
  },
  {
    id: "t-test-unit",
    type: "technical",
    topic: "Testing",
    skillCategory: "testing",
    difficulty: "mid",
    text: "What makes a good unit test? Give characteristics you look for.",
    expectedKeywords: ["unit", "isolated", "deterministic", "fast", "assertion"],
    hint: "Isolated, fast, deterministic, one behavior per test, meaningful asserts.",
  },
  {
    id: "t-tool-git",
    type: "technical",
    topic: "Git",
    skillCategory: "tools",
    difficulty: "junior",
    text: "How would you resolve a merge conflict in Git? Walk through the steps.",
    expectedKeywords: ["merge", "conflict", "branch", "rebase", "resolve"],
    hint: "Identify conflicted files, edit markers, stage, and complete the merge.",
  },
  {
    id: "t-algo-complexity",
    type: "technical",
    topic: "Algorithms",
    difficulty: "mid",
    text: "Explain Big-O notation. Give the complexity of binary search and a hash map lookup.",
    expectedKeywords: ["big-o", "log", "o(1)", "complexity", "search"],
    hint: "Binary search is O(log n); hash lookups are O(1) average.",
  },
  {
    id: "t-sd-rate-limit",
    type: "system-design",
    topic: "System Design",
    difficulty: "senior",
    text: "Design a rate limiter for a public API. What data structures and approaches would you consider?",
    expectedKeywords: ["token bucket", "sliding window", "redis", "distributed", "quota"],
    hint: "Token bucket or sliding window; a shared store for multi-instance accuracy.",
  },
  {
    id: "t-sd-url-shortener",
    type: "system-design",
    topic: "System Design",
    difficulty: "mid",
    text: "Design a URL shortener. How would you store mappings and handle collisions?",
    expectedKeywords: ["hash", "shorten", "redirect", "database", "collision"],
    hint: "Base62 encoding of an ID or a hash; handle 301 redirects and analytics.",
  },
];

/* ────────────────────────────────────────────────────────────────────
 * Behavioral question bank (STAR-based)
 * ──────────────────────────────────────────────────────────────────── */

const BEHAVIORAL_QUESTIONS: QuestionTemplate[] = [
  {
    id: "b-conflict",
    type: "behavioral",
    topic: "Conflict",
    difficulty: "mid",
    text: "Tell me about a time you disagreed with a teammate or stakeholder. How did you resolve it?",
    expectedKeywords: ["situation", "disagreed", "listened", "compromise", "outcome"],
    hint: "Use STAR: Situation, Task, Action, Result — end with the outcome.",
  },
  {
    id: "b-failure",
    type: "behavioral",
    topic: "Failure",
    difficulty: "mid",
    text: "Describe a project that failed or went badly. What did you learn?",
    expectedKeywords: ["failed", "mistake", "learned", "improved", "responsibility"],
    hint: "Own the mistake, show what changed afterwards — no blaming.",
  },
  {
    id: "b-initiative",
    type: "behavioral",
    topic: "Initiative",
    difficulty: "mid",
    text: "Tell me about a time you went beyond your assigned responsibilities.",
    expectedKeywords: ["initiative", "volunteered", "extra", "impact", "recognized"],
    hint: "Pick something concrete with a measurable impact.",
  },
  {
    id: "b-deadline",
    type: "behavioral",
    topic: "Deadlines",
    difficulty: "mid",
    text: "Describe a time you had to deliver under a tight deadline. How did you prioritize?",
    expectedKeywords: ["deadline", "prioritized", "scope", "communicated", "delivered"],
    hint: "Show prioritization and early communication about trade-offs.",
  },
  {
    id: "b-learning",
    type: "behavioral",
    topic: "Learning",
    difficulty: "junior",
    text: "Tell me about a technical skill you taught yourself. How did you approach it?",
    expectedKeywords: ["learned", "self-taught", "resource", "practice", "applied"],
    hint: "Show method: resources, deliberate practice, and where you applied it.",
  },
  {
    id: "b-leadership",
    type: "behavioral",
    topic: "Leadership",
    difficulty: "senior",
    text: "Describe a time you led a team or mentored someone. What was your approach?",
    expectedKeywords: ["led", "mentored", "guided", "delegated", "grown"],
    hint: "Focus on enabling others rather than doing the work yourself.",
  },
  {
    id: "b-feedback",
    type: "behavioral",
    topic: "Feedback",
    difficulty: "mid",
    text: "Tell me about a time you received difficult feedback. How did you respond?",
    expectedKeywords: ["feedback", "criticism", "listened", "changed", "improved"],
    hint: "Show you took it constructively and changed behavior.",
  },
  {
    id: "b-motivation",
    type: "behavioral",
    topic: "Motivation",
    difficulty: "junior",
    text: "What motivates you as a developer, and what kind of work energizes you?",
    expectedKeywords: ["motivate", "passion", "problem", "impact", "learn"],
    hint: "Connect motivation to real experiences, not clichés.",
  },
];

/* ────────────────────────────────────────────────────────────────────
 * Selection helpers
 * ──────────────────────────────────────────────────────────────────── */

/**
 * Maps github-analytics skill categories → question bank categories.
 *
 * NOTE: detectSkills emits "tool" (singular) for topic-derived skills
 * (React, Docker, SQLite …), "language" for language stats, and "concept"
 * for bio keywords — while the question bank uses "tools". Both spellings
 * must map here or framework/tool questions become unreachable.
 */
const SKILL_TO_TOPIC: Record<string, string> = {
  frontend: "frontend",
  backend: "backend",
  mobile: "mobile",
  data: "data",
  devops: "devops",
  ai: "ai",
  testing: "testing",
  tools: "tools",
  tool: "tools", // detectSkills emits singular "tool"
  language: "language",
  concept: "tools",
};

/** Maps a CvModel language name → question template language key. */
function languageKey(lang: string): string {
  return lang.toLowerCase().replace(/[^a-z0-9+#]/g, "");
}

/**
 * Generates a tailored question set for a developer.
 *
 * Strategy (deterministic):
 *   1. Collect skill categories from GitHub analytics (top 6 by confidence).
 *   2. Collect the developer's top languages (top 4 by percent).
 *   3. Prefer questions matching those skills/languages; pad with core
 *      technical, one system-design (mid+), and behavioral questions.
 *
 * @param model   CvModel (for languages + stats)
 * @param analytics GithubAnalyticsData (for detected skills)
 * @param role    Optional role hint (e.g. "software_engineer") — currently
 *                used to tilt difficulty toward senior for senior roles.
 */
export function generateQuestions(
  model: CvModel,
  analytics: GithubAnalyticsData | null,
  role?: string
): InterviewQuestion[] {
  const selected: QuestionTemplate[] = [];
  const usedIds = new Set<string>();

  // ── Skill categories from analytics ────────────────────────────
  const skillTopics = (analytics?.skills ?? [])
    .slice(0, 6)
    .map((s) => SKILL_TO_TOPIC[s.category] ?? s.category)
    .filter(Boolean)
    // Deduplicate so the same category can't consume multiple picks.
    .filter((topic, i, arr) => arr.indexOf(topic) === i);

  // ── Languages from the CvModel ─────────────────────────────────
  const languages = model.languages.slice(0, 4).map((l) => l.name);

  // ── Pick questions matching skills ─────────────────────────────
  const roleIsSenior =
    role === "staff" || role === "principal" || role === "lead" || role === "senior";

  const pick = (template: QuestionTemplate) => {
    if (usedIds.has(template.id)) return;
    usedIds.add(template.id);
    selected.push(template);
  };

  // Match by language first (highest signal).
  for (const lang of languages) {
    const key = languageKey(lang);
    const matches = TECHNICAL_QUESTIONS.filter((q) => q.language === key);
    // Take one per language, prefer mid difficulty.
    const match =
      matches.find((q) => q.difficulty === (roleIsSenior ? "senior" : "mid")) ??
      matches[0];
    if (match) pick(match);
  }

  // Match by skill category.
  const seenCategories = new Set<string>();
  for (const topic of skillTopics) {
    if (seenCategories.has(topic)) continue;
    seenCategories.add(topic);
    const matches = TECHNICAL_QUESTIONS.filter(
      (q) => q.skillCategory === topic
    );
    const match =
      matches.find((q) => q.difficulty === (roleIsSenior ? "senior" : "mid")) ??
      matches[0];
    if (match) pick(match);
  }

  // ── Pad with core topics ───────────────────────────────────────
  for (const q of TECHNICAL_QUESTIONS) {
    if (selected.length >= 8) break;
    if (q.skillCategory) continue; // only generic/core questions as padding
    pick(q);
  }

  // ── Add one system-design question for mid+ profiles ───────────
  const years = model.stats.years;
  if (years >= 2 || selected.length >= 3) {
    const sd = TECHNICAL_QUESTIONS.find(
      (q) => q.type === "system-design" && q.id === "t-sd-url-shortener"
    );
    if (sd) pick(sd);
    if (roleIsSenior || years >= 4) {
      const sd2 = TECHNICAL_QUESTIONS.find((q) => q.id === "t-sd-rate-limit");
      if (sd2) pick(sd2);
    }
  }

  // ── Behavioral questions (always include) ──────────────────────
  pick(BEHAVIORAL_QUESTIONS[1]); // failure
  pick(BEHAVIORAL_QUESTIONS[2]); // initiative
  pick(BEHAVIORAL_QUESTIONS[4]); // learning

  // Cap at 10 questions (mirrors a real interview slot).
  const final = selected.slice(0, 10);

  return final.map((q) => ({
    id: q.id,
    type: q.type,
    topic: q.topic,
    text: q.text,
    difficulty: q.difficulty,
    expectedKeywords: q.expectedKeywords,
    hint: q.hint,
  }));
}

export { TECHNICAL_QUESTIONS, BEHAVIORAL_QUESTIONS };
