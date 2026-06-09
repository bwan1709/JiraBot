export interface ParsedPlanItem {
  projectKey: string;
  text: string;
}

const PRESET_COLORS = [
  'blue',
  'green',
  'purple',
  'orange',
  'cyan',
  'magenta',
  'geekblue',
  'gold',
  'lime',
  'volcano',
];

/** Assign a stable Ant Tag color based on the project key string */
export function getProjectColor(key: string): string {
  if (key === 'COMMON') return 'default';
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = key.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % PRESET_COLORS.length;
  return PRESET_COLORS[index];
}

/**
 * Parse the monthly plan title text line-by-line and filter items by user's projects.
 *
 * Each line can start with a project key, e.g. "DMS: Golive" or "[DMS] Golive".
 * Lines that don't match any key are treated as 'COMMON'.
 */
export function parseAndFilterTitle(
  title: string | null | undefined,
  userProjects: string[] | undefined,
  allPlanProjects: string[],
  isAdminOrPm = false
): ParsedPlanItem[] {
  if (!title) return [];

  const lines = title.split('\n');
  const result: ParsedPlanItem[] = [];

  const projKeys = allPlanProjects.map((k) => k.trim().toUpperCase());

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    let matchedKey: string | null = null;
    let cleanText = trimmed;

    for (const key of projKeys) {
      const inlineRegex = new RegExp(
        `^[\\s\\-*•●]*[\\[\\(]?\\s*(${key})\\s*[\\]\\)]?[\\s:：\\-—]*`,
        'i'
      );
      const match = trimmed.match(inlineRegex);
      if (match) {
        matchedKey = key;
        cleanText = trimmed.substring(match[0].length).trim();
        break;
      }
    }

    result.push({
      projectKey: matchedKey || 'COMMON',
      text: cleanText || trimmed,
    });
  }

  if (isAdminOrPm) {
    return result;
  }

  if (!userProjects || userProjects.length === 0) {
    return result;
  }

  const userProjSet = new Set(userProjects.map((p) => p.trim().toUpperCase()));
  return result.filter((item) => {
    if (item.projectKey === 'COMMON') return true;
    return userProjSet.has(item.projectKey);
  });
}

/**
 * Parse the monthly plan description text and filter items by user's projects.
 *
 * The description format is:
 *   ProjectKey:
 *   • Item 1
 *   • Item 2
 *   AnotherKey:
 *   • Item A
 *
 * Lines that match a project key from `allPlanProjects` are treated as section headers.
 * Lines before any header are treated as 'COMMON' (shown to all).
 */
export function parseAndFilterPlan(
  description: string | null | undefined,
  userProjects: string[] | undefined,
  allPlanProjects: string[],
  isAdminOrPm = false
): ParsedPlanItem[] {
  if (!description) return [];

  const lines = description.split('\n');
  const result: ParsedPlanItem[] = [];
  let currentProject = 'COMMON';

  // Normalize project keys to uppercase for matching
  const projKeys = allPlanProjects.map((k) => k.trim().toUpperCase());

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Detect project header lines: e.g. "DMS:" or "DMS" or "• DMS:" or "[DMS]"
    let matchedKey: string | null = null;
    for (const key of projKeys) {
      // Match lines that are essentially just the key (with optional punctuation/bullets)
      const headerRegex = new RegExp(
        `^[\\s\\-*•●]*[\\[\\(]?\\s*${key}\\s*[\\]\\)]?[\\s:：]*$`,
        'i'
      );
      if (headerRegex.test(trimmed)) {
        matchedKey = key;
        break;
      }
    }

    if (matchedKey) {
      currentProject = matchedKey;
      continue; // skip header line itself
    }

    // Strip leading bullet characters for cleaner display
    const cleanText = trimmed.replace(/^[\-*•●\s\d.]+\s*/, '').trim() || trimmed;

    result.push({
      projectKey: currentProject,
      text: cleanText,
    });
  }

  // Admin/PM sees everything
  if (isAdminOrPm) {
    return result;
  }

  // User with no projects assigned sees everything
  if (!userProjects || userProjects.length === 0) {
    return result;
  }

  const userProjSet = new Set(userProjects.map((p) => p.trim().toUpperCase()));
  return result.filter((item) => {
    if (item.projectKey === 'COMMON') return true;
    return userProjSet.has(item.projectKey);
  });
}
