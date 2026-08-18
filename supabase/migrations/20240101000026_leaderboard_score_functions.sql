-- Aggregated leaderboard scores: replaces fetching every pick row into JS
CREATE OR REPLACE FUNCTION get_leaderboard_scores(comp_id uuid)
RETURNS TABLE (
  user_id uuid,
  correct bigint,
  total bigint,
  manual_correct bigint,
  manual_total bigint,
  manual_resulted bigint,
  margins_correct bigint,
  margin_bonus bigint,
  total_points bigint
) AS $$
  SELECT
    p.user_id,
    COUNT(*) FILTER (WHERE p.is_correct = true),
    COUNT(*),
    COUNT(*) FILTER (WHERE p.auto_picked = false AND p.is_correct = true),
    COUNT(*) FILTER (WHERE p.auto_picked = false),
    COUNT(*) FILTER (WHERE p.auto_picked = false AND p.is_correct IS NOT NULL),
    COUNT(*) FILTER (WHERE p.margin_correct = true),
    COALESCE(SUM(p.margin_bonus), 0),
    COALESCE(SUM(p.points), 0)
  FROM picks p
  JOIN fixtures f ON p.fixture_id = f.id
  JOIN gameweeks g ON f.gameweek_id = g.id
  WHERE g.competition_id = comp_id
  GROUP BY p.user_id;
$$ LANGUAGE sql STABLE;

-- Per-round scores grouped by user and gameweek
CREATE OR REPLACE FUNCTION get_round_scores(comp_id uuid)
RETURNS TABLE (
  user_id uuid,
  gameweek_id uuid,
  correct bigint,
  total bigint,
  score bigint,
  margin_bonus bigint
) AS $$
  SELECT
    p.user_id,
    g.id,
    COUNT(*) FILTER (WHERE p.is_correct = true),
    COUNT(*) FILTER (WHERE p.is_correct IS NOT NULL),
    COALESCE(SUM(p.points), 0),
    COALESCE(SUM(p.margin_bonus), 0)
  FROM picks p
  JOIN fixtures f ON p.fixture_id = f.id
  JOIN gameweeks g ON f.gameweek_id = g.id
  WHERE g.competition_id = comp_id
  GROUP BY p.user_id, g.id;
$$ LANGUAGE sql STABLE;
