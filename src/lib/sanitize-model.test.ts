import { describe, it, expect } from "vitest";
import { sanitizeShareModel } from "./sanitize-model";

const VALID = {
  header: { name: "Ada Lovelace", bio: "Engineer", contacts: ["ada@example.com"] },
  stats: { repos: 10, stars: 42, forks: 7, years: 3 },
  languages: [{ name: "Rust", percent: 60 }],
  projects: [
    {
      name: "analytical-engine",
      url: "https://github.com/ada/analytical-engine",
      stars: 42,
      forks: 7,
      description: "A distributed scheduler",
      language: "Rust",
      topics: ["rust", "distributed"],
    },
  ],
};

describe("sanitizeShareModel", () => {
  it("passes a clean model through", () => {
    const out = sanitizeShareModel(VALID);
    expect(out).not.toBeNull();
    expect(out!.header.name).toBe("Ada Lovelace");
    expect(out!.projects[0].url).toBe("https://github.com/ada/analytical-engine");
  });

  it("strips javascript: URLs (stored-XSS guard)", () => {
    const evil = {
      ...VALID,
      projects: [{ ...VALID.projects[0], url: "javascript:alert(1)" }],
    };
    const out = sanitizeShareModel(evil);
    expect(out!.projects[0].url).toBe("");
  });

  it("strips data: and other non-http schemes", () => {
    const evil = {
      ...VALID,
      projects: [{ ...VALID.projects[0], url: "data:text/html;base64,PHNjcmlwdD4=" }],
    };
    const out = sanitizeShareModel(evil);
    expect(out!.projects[0].url).toBe("");
  });

  it("rejects null and non-object input", () => {
    expect(sanitizeShareModel(null)).toBeNull();
    expect(sanitizeShareModel("string")).toBeNull();
    expect(sanitizeShareModel([])).toBeNull();
  });

  it("rejects missing header or stats", () => {
    expect(sanitizeShareModel({ header: null, stats: {} })).toBeNull();
    expect(sanitizeShareModel({ header: { name: "X" } })).toBeNull();
  });

  it("caps array lengths", () => {
    const huge = {
      ...VALID,
      languages: Array.from({ length: 100 }, (_, i) => ({ name: `lang${i}`, percent: i })),
      projects: Array.from({ length: 200 }, (_, i) => ({ ...VALID.projects[0], name: `p${i}` })),
    };
    const out = sanitizeShareModel(huge);
    expect(out!.languages.length).toBeLessThanOrEqual(20);
    expect(out!.projects.length).toBeLessThanOrEqual(50);
  });
});
