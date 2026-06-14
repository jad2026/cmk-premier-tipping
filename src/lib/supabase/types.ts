export type Team = {
  id: string;
  name: string;
  short_name: string;
  colour: string;
  logo_url: string | null;
};

export type Gameweek = {
  id: string;
  number: number;
  label: string;
  deadline: string;
  is_open: boolean;
};

export type Fixture = {
  id: string;
  gameweek_id: string;
  home_team_id: string;
  away_team_id: string;
  match_date: string;
  venue: string | null;
  result_team_id: string | null;
  home_team?: Team;
  away_team?: Team;
  result_team?: Team | null;
};

export type Pick = {
  id: string;
  user_id: string;
  fixture_id: string;
  picked_team_id: string;
  is_correct: boolean | null;
  auto_picked: boolean;
  picked_team?: Team;
};

export type Profile = {
  id: string;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  updated_at: string | null;
};

export type SeasonConfig = {
  id: 1;
  season_complete: boolean;
};

export type Season = {
  id: string;
  name: string;
  year: number;
  archived_at: string;
  winner_name: string | null;
  total_participants: number;
  gameweeks_json: unknown;
  fixtures_json: unknown;
  picks_json: unknown;
};

// ---------------------------------------------------------------------------
// Database schema — must satisfy @supabase/supabase-js GenericSchema so that
// the client's insert/update/upsert types resolve correctly.
// Each table needs Row, Insert, Update, AND Relationships (even if empty).
// The schema also needs Views, Functions, Enums, and CompositeTypes sections.
// ---------------------------------------------------------------------------

export type Database = {
  public: {
    Tables: {
      teams: {
        Row: Team;
        Insert: Omit<Team, "id">;
        Update: Partial<Team>;
        Relationships: [];
      };
      gameweeks: {
        Row: Gameweek;
        Insert: Omit<Gameweek, "id">;
        Update: Partial<Gameweek>;
        Relationships: [];
      };
      fixtures: {
        Row: Fixture;
        Insert: Omit<Fixture, "id">;
        Update: Partial<Fixture>;
        Relationships: [];
      };
      picks: {
        Row: Pick;
        Insert: Omit<Pick, "id">;
        Update: Partial<Pick>;
        Relationships: [];
      };
      profiles: {
        Row: Profile;
        Insert: { id: string } & Partial<Omit<Profile, "id">>;
        Update: Partial<Profile>;
        Relationships: [];
      };
      season_config: {
        Row: SeasonConfig;
        Insert: Partial<SeasonConfig>;
        Update: Partial<SeasonConfig>;
        Relationships: [];
      };
      seasons: {
        Row: Season;
        Insert: Omit<Season, "id" | "archived_at"> & { id?: string; archived_at?: string };
        Update: Partial<Season>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      upsert_pick: {
        Args: { p_fixture_id: string; p_picked_team_id: string };
        Returns: undefined;
      };
      auto_fill_missing_picks: {
        Args: { p_gameweek_id: string };
        Returns: number;
      };
      score_fixture_picks: {
        Args: { p_fixture_id: string; p_result_team_id: string | null };
        Returns: number;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
