import type { CvModel } from "./cv-model";

/**
 * Resume version comparison — pure, framework-free diff of two CvModel
 * snapshots. Used by the Resume Comparison feature (and nothing else):
 * it never fetches, never writes, and never touches the DOM, so it can
 * run in a client component or a unit test.
 */

export interface VersionDiff {
  /** True when every compared field is identical. */
  identical: boolean;

  header: {
    nameChanged: boolean;
    bioChanged: boolean;
    contactsChanged: boolean;
  };

  stats: {
    reposChanged: boolean;
    starsChanged: boolean;
    forksChanged: boolean;
    yearsChanged: boolean;
  };

  /** Languages that changed percentage or were added/removed (top 5 each). */
  languages: {
    added: string[];
    removed: string[];
    changed: Array<{ name: string; from: number; to: number }>;
  };

  /** Projects by name. */
  projects: {
    added: string[];
    removed: string[];
    renamed: Array<{ from: string; to: string }>;
  };
}

export function compareCvModels(a: CvModel, b: CvModel): VersionDiff {
  const langMapA = new Map(a.languages.map((l) => [l.name, l.percent]));
  const langMapB = new Map(b.languages.map((l) => [l.name, l.percent]));

  const added: string[] = [];
  const removed: string[] = [];
  const changed: Array<{ name: string; from: number; to: number }> = [];

  for (const [name] of langMapB) {
    if (!langMapA.has(name)) added.push(name);
  }
  for (const [name] of langMapA) {
    if (!langMapB.has(name)) removed.push(name);
  }
  for (const [name, percentA] of langMapA) {
    const percentB = langMapB.get(name);
    if (percentB !== undefined && percentB !== percentA) {
      changed.push({ name, from: percentA, to: percentB });
    }
  }

  const projectNameA = new Set(a.projects.map((p) => p.name));
  const projectNameB = new Set(b.projects.map((p) => p.name));

  const projectsAdded = b.projects.filter((p) => !projectNameA.has(p.name)).map((p) => p.name);
  const projectsRemoved = a.projects.filter((p) => !projectNameB.has(p.name)).map((p) => p.name);

  // A project is "renamed" when exactly one old project disappears and one
  // new one appears with a matching URL. Cheap heuristic, good enough for UI.
  const renamed: Array<{ from: string; to: string }> = [];
  const urlB = new Map(b.projects.map((p) => [p.url, p.name]));
  for (const p of a.projects) {
    const match = urlB.get(p.url);
    if (match && match !== p.name) {
      renamed.push({ from: p.name, to: match });
    }
  }

  const identical =
    a.header.name === b.header.name &&
    a.header.bio === b.header.bio &&
    arraysEqual(a.header.contacts, b.header.contacts) &&
    a.stats.repos === b.stats.repos &&
    a.stats.stars === b.stats.stars &&
    a.stats.forks === b.stats.forks &&
    a.stats.years === b.stats.years &&
    added.length === 0 &&
    removed.length === 0 &&
    changed.length === 0 &&
    projectsAdded.length === 0 &&
    projectsRemoved.length === 0 &&
    renamed.length === 0;

  return {
    identical,
    header: {
      nameChanged: a.header.name !== b.header.name,
      bioChanged: a.header.bio !== b.header.bio,
      contactsChanged: !arraysEqual(a.header.contacts, b.header.contacts),
    },
    stats: {
      reposChanged: a.stats.repos !== b.stats.repos,
      starsChanged: a.stats.stars !== b.stats.stars,
      forksChanged: a.stats.forks !== b.stats.forks,
      yearsChanged: a.stats.years !== b.stats.years,
    },
    languages: { added, removed, changed },
    projects: { added: projectsAdded, removed: projectsRemoved, renamed },
  };
}

function arraysEqual(x: string[], y: string[]): boolean {
  if (x.length !== y.length) return false;
  return x.every((v, i) => v === y[i]);
}
