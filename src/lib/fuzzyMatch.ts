/**
 * Fuzzy team-name matcher.
 *
 * Scores a raw input string against a list of candidate strings and returns
 * the best match together with a confidence tier:
 *   "exact"  — normalised exact match (score 100)
 *   "fuzzy"  — close enough to be useful  (score 40–99)
 *   "none"   — no reasonable match found  (score < 40)
 */

function normalise(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9 ]/g, "") // strip punctuation
    .replace(/\s+/g, " ");
}

/** Levenshtein distance (iterative, O(mn) space) */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

function score(input: string, candidate: string): number {
  const ni = normalise(input);
  const nc = normalise(candidate);

  if (ni === nc) return 100;

  // prefix / contains
  if (nc.startsWith(ni) || ni.startsWith(nc)) return 85;
  if (nc.includes(ni) || ni.includes(nc)) return 72;

  // token overlap: how many words match
  const wi = new Set(ni.split(" "));
  const wc = nc.split(" ");
  const shared = wc.filter((w) => wi.has(w)).length;
  const tokenScore = (shared / Math.max(wi.size, wc.length)) * 65;
  if (tokenScore > 0) return tokenScore;

  // Levenshtein fallback — penalise heavily for long distances
  const dist = levenshtein(ni, nc);
  const maxLen = Math.max(ni.length, nc.length);
  const levScore = Math.max(0, (1 - dist / maxLen) * 50);
  return levScore;
}

export type MatchTier = "exact" | "fuzzy" | "none";

export type MatchResult<T> = {
  candidate: T;
  score: number;
  tier: MatchTier;
};

export function bestMatch<T>(
  input: string,
  candidates: T[],
  getLabel: (c: T) => string
): MatchResult<T> | null {
  if (candidates.length === 0) return null;

  let best: MatchResult<T> | null = null;
  for (const c of candidates) {
    const s = score(input, getLabel(c));
    if (!best || s > best.score) {
      const tier: MatchTier = s >= 100 ? "exact" : s >= 40 ? "fuzzy" : "none";
      best = { candidate: c, score: s, tier };
    }
  }
  return best;
}
