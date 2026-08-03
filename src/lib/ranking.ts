/**
 * Dense-rank a pre-sorted (descending) array of scores.
 * Ties share the same rank; the next distinct score gets rank = prevRank + 1.
 * This is the ranking method used on the site leaderboard.
 */
export function rankByScore(sortedScores: number[]): number[] {
  const ranks: number[] = [];
  let rank = 0;
  let prevScore = -1;
  for (const score of sortedScores) {
    if (score !== prevScore) {
      rank++;
      prevScore = score;
    }
    ranks.push(rank);
  }
  return ranks;
}
