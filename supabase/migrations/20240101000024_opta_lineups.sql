CREATE TABLE IF NOT EXISTS opta_lineups (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  fixture_id uuid REFERENCES fixtures(id),
  opta_game_id text NOT NULL,
  opta_team_id integer NOT NULL,
  opta_player_id integer,
  player_name text NOT NULL,
  first_name text,
  last_name text,
  shirt_number integer,
  position text,
  is_captain boolean DEFAULT false,
  is_substitute boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(opta_game_id, opta_team_id, opta_player_id)
);

ALTER TABLE opta_lineups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access on opta_lineups"
  ON opta_lineups FOR SELECT USING (true);
