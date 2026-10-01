// Loose team-name matching, e.g. "Bridlington" vs "Bridlington RUFC".
// Used for the ladder highlight, "Around the league" de-duplication and
// putting a competition's featured club first.

export function normTeam(name: string): string {
  return name.toLowerCase().replace(/\b(rufc|rfc|rugby( union)?( football)? club)\b/g, "").replace(/[^a-z0-9]/g, "");
}

export function sameTeam(a: string, b: string): boolean {
  const x = normTeam(a);
  const y = normTeam(b);
  return x.length > 0 && y.length > 0 && (x.includes(y) || y.includes(x));
}

/**
 * The club a competition features (features.featured_club + short_label), or
 * null when the flag is off — callers then keep their existing order.
 */
export function featuredClubName(
  features: Record<string, unknown> | null | undefined,
  shortLabel: string | null | undefined
): string | null {
  return features?.featured_club === true && shortLabel?.trim() ? shortLabel.trim() : null;
}

/** Stable reorder: items involving the featured club first, the rest unchanged. */
export function featuredClubFirst<T>(items: T[], teamNames: (item: T) => string[], club: string | null): T[] {
  if (!club) return items;
  const isClub = (item: T) => teamNames(item).some((n) => sameTeam(n, club));
  return [...items.filter(isClub), ...items.filter((item) => !isClub(item))];
}
