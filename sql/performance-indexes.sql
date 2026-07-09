-- Performance indexes identified in audit (2026-07-09)
-- Run in Supabase SQL Editor

-- picks: frequently filtered by is_correct for leaderboard/scoring
CREATE INDEX IF NOT EXISTS idx_picks_is_correct ON picks (is_correct);

-- picks: composite for fixture-scoped correctness queries
CREATE INDEX IF NOT EXISTS idx_picks_fixture_is_correct ON picks (fixture_id, is_correct);

-- fixtures: filtered by result_team_id IS NOT NULL for completed match queries
CREATE INDEX IF NOT EXISTS idx_fixtures_result_team_id ON fixtures (result_team_id);

-- players: filtered by is_active for squad pages
CREATE INDEX IF NOT EXISTS idx_players_is_active ON players (is_active) WHERE is_active = true;
