import { describe, it, expect } from "vitest";
import { validateLocale, validateTemplate } from "./validate";

describe("validateLocale", () => {
  it("accepts all 11 supported locales", () => {
    for (const loc of ["en", "tr", "de", "fr", "es", "pt", "ja", "ko", "zh", "ru", "ar"]) {
      expect(validateLocale(loc)).toBe(loc);
    }
  });

  it("rejects unknown locales", () => {
    expect(validateLocale("xx")).toBeNull();
    expect(validateLocale("EN")).toBeNull();
    expect(validateLocale("e")).toBeNull();
  });

  it("rejects null/empty input", () => {
    expect(validateLocale(null)).toBeNull();
    expect(validateLocale("")).toBeNull();
  });
});

describe("validateTemplate", () => {
  it("accepts the three registered templates", () => {
    for (const t of ["classic_professional", "developer_card", "minimal"]) {
      expect(validateTemplate(t)).toBe(t);
    }
  });

  it("rejects unknown templates", () => {
    expect(validateTemplate("evil_template")).toBeNull();
    expect(validateTemplate(null)).toBeNull();
    expect(validateTemplate("")).toBeNull();
  });
});
