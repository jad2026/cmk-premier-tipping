-- Materialized view: pre-aggregated player stats per season
-- Refresh after each round: REFRESH MATERIALIZED VIEW CONCURRENTLY player_season_stats;

CREATE MATERIALIZED VIEW IF NOT EXISTS player_season_stats AS
SELECT
  ps.opta_player_id,
  ps.player_name,
  ps.opta_team_id,
  ps.position,
  CASE
    WHEN CAST(ps.opta_game_id AS integer) BETWEEN 946625 AND 946701 THEN '2025'
    ELSE '2026'
  END AS season,
  COUNT(DISTINCT ps.opta_game_id) AS games,
  COALESCE(SUM((ps.stats->>'Tries')::int), 0) + COALESCE(SUM((ps.stats->>'tries')::int), 0) AS tries,
  COALESCE(SUM((ps.stats->>'Tackles')::int), 0) + COALESCE(SUM((ps.stats->>'tackles')::int), 0) + COALESCE(SUM((ps.stats->>'TacklesMade')::int), 0) + COALESCE(SUM((ps.stats->>'tackles_made')::int), 0) AS tackles,
  COALESCE(SUM((ps.stats->>'MetresRun')::int), 0) + COALESCE(SUM((ps.stats->>'metres_run')::int), 0) + COALESCE(SUM((ps.stats->>'Metres')::int), 0) + COALESCE(SUM((ps.stats->>'metres')::int), 0) AS metres,
  COALESCE(SUM((ps.stats->>'CleanBreaks')::int), 0) + COALESCE(SUM((ps.stats->>'clean_breaks')::int), 0) + COALESCE(SUM((ps.stats->>'LineBreaks')::int), 0) + COALESCE(SUM((ps.stats->>'line_breaks')::int), 0) AS clean_breaks,
  COALESCE(SUM((ps.stats->>'DefendersBeaten')::int), 0) + COALESCE(SUM((ps.stats->>'defenders_beaten')::int), 0) AS defenders_beaten,
  COALESCE(SUM((ps.stats->>'DominantTackles')::int), 0) + COALESCE(SUM((ps.stats->>'dominant_tackles')::int), 0) AS dominant_tackles,
  COALESCE(SUM((ps.stats->>'TackleTurnover')::int), 0) + COALESCE(SUM((ps.stats->>'tackle_turnover')::int), 0) + COALESCE(SUM((ps.stats->>'TurnoverWon')::int), 0) + COALESCE(SUM((ps.stats->>'turnover_won')::int), 0) AS tackle_turnover,
  COALESCE(SUM((ps.stats->>'MissedTackles')::int), 0) + COALESCE(SUM((ps.stats->>'missed_tackles')::int), 0) AS missed_tackles,
  COALESCE(SUM((ps.stats->>'KickPenaltyGood')::int), 0) + COALESCE(SUM((ps.stats->>'kick_penalty_good')::int), 0) + COALESCE(SUM((ps.stats->>'PenaltyGoals')::int), 0) + COALESCE(SUM((ps.stats->>'penalty_goals')::int), 0) AS kick_penalty_good,
  COALESCE(SUM((ps.stats->>'ConversionGoals')::int), 0) + COALESCE(SUM((ps.stats->>'conversion_goals')::int), 0) + COALESCE(SUM((ps.stats->>'Conversions')::int), 0) + COALESCE(SUM((ps.stats->>'conversions')::int), 0) AS conversion_goals,
  COALESCE(SUM((ps.stats->>'KickMetres')::int), 0) + COALESCE(SUM((ps.stats->>'kick_metres')::int), 0) + COALESCE(SUM((ps.stats->>'KickingMetres')::int), 0) + COALESCE(SUM((ps.stats->>'kicking_metres')::int), 0) AS kick_metres,
  COALESCE(SUM((ps.stats->>'KicksFromHand')::int), 0) + COALESCE(SUM((ps.stats->>'kicks_from_hand')::int), 0) AS kicks_from_hand,
  COALESCE(SUM((ps.stats->>'LineoutsWon')::int), 0) + COALESCE(SUM((ps.stats->>'lineouts_won')::int), 0) AS lineouts_won,
  COALESCE(SUM((ps.stats->>'CarriesMetres')::int), 0) + COALESCE(SUM((ps.stats->>'carries_metres')::int), 0) AS carries_metres,
  COALESCE(SUM((ps.stats->>'Offload')::int), 0) + COALESCE(SUM((ps.stats->>'offload')::int), 0) + COALESCE(SUM((ps.stats->>'Offloads')::int), 0) + COALESCE(SUM((ps.stats->>'offloads')::int), 0) AS offload,
  COALESCE(SUM((ps.stats->>'LineBreakAssists')::int), 0) + COALESCE(SUM((ps.stats->>'line_break_assists')::int), 0) AS line_break_assists,
  COALESCE(SUM((ps.stats->>'Points')::int), 0) + COALESCE(SUM((ps.stats->>'points')::int), 0) AS points,
  COALESCE(SUM((ps.stats->>'PenaltiesConceded')::int), 0) + COALESCE(SUM((ps.stats->>'penalties_conceded')::int), 0) AS penalties_conceded,
  COALESCE(SUM((ps.stats->>'TurnoversConceded')::int), 0) + COALESCE(SUM((ps.stats->>'turnovers_conceded')::int), 0) AS turnovers_conceded,
  COALESCE(SUM((ps.stats->>'HandlingErrors')::int), 0) + COALESCE(SUM((ps.stats->>'handling_errors')::int), 0) + COALESCE(SUM((ps.stats->>'HandlingError')::int), 0) + COALESCE(SUM((ps.stats->>'handling_error')::int), 0) AS handling_errors,
  COALESCE(SUM((ps.stats->>'TryAssists')::int), 0) + COALESCE(SUM((ps.stats->>'try_assists')::int), 0) AS try_assists,
  COALESCE(SUM((ps.stats->>'Runs')::int), 0) + COALESCE(SUM((ps.stats->>'runs')::int), 0) + COALESCE(SUM((ps.stats->>'Carries')::int), 0) + COALESCE(SUM((ps.stats->>'carries')::int), 0) AS runs,
  COALESCE(SUM((ps.stats->>'Kicks')::int), 0) + COALESCE(SUM((ps.stats->>'kicks')::int), 0) AS kicks,
  COALESCE(SUM((ps.stats->>'ScrumsWonOutright')::int), 0) + COALESCE(SUM((ps.stats->>'scrums_won_outright')::int), 0) + COALESCE(SUM((ps.stats->>'ScrumWon')::int), 0) + COALESCE(SUM((ps.stats->>'scrum_won')::int), 0) AS scrums_won_outright,
  COALESCE(SUM((ps.stats->>'MinutesPlayedTotal')::int), 0) + COALESCE(SUM((ps.stats->>'minutes_played_total')::int), 0) + COALESCE(SUM((ps.stats->>'MinutesPlayed')::int), 0) + COALESCE(SUM((ps.stats->>'minutes_played')::int), 0) AS minutes_played_total
FROM opta_player_stats ps
GROUP BY ps.opta_player_id, ps.player_name, ps.opta_team_id, ps.position,
  CASE WHEN CAST(ps.opta_game_id AS integer) BETWEEN 946625 AND 946701 THEN '2025' ELSE '2026' END;

CREATE UNIQUE INDEX IF NOT EXISTS idx_player_season_stats_pk
  ON player_season_stats (opta_player_id, season);

CREATE INDEX IF NOT EXISTS idx_player_season_stats_season
  ON player_season_stats (season);

CREATE INDEX IF NOT EXISTS idx_player_season_stats_team
  ON player_season_stats (opta_team_id, season);
