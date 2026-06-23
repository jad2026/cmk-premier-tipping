export type Team = {
  id: string;
  name: string;
  short_name: string;
  colour: string;
  logo_url: string | null;
  competition_id: string;
};

export type Gameweek = {
  id: string;
  number: number;
  label: string;
  deadline: string;
  is_open: boolean;
  competition_id: string;
};

export type Fixture = {
  id: string;
  gameweek_id: string;
  home_team_id: string;
  away_team_id: string;
  match_date: string;
  venue: string | null;
  result_team_id: string | null;
  is_draw: boolean;
  home_team?: Team;
  away_team?: Team;
  result_team?: Team | null;
};

export type Pick = {
  id: string;
  user_id: string;
  fixture_id: string;
  picked_team_id: string | null;
  picked_draw: boolean;
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
  avatar_url: string | null;
  is_admin: boolean;
};

export type SeasonConfig = {
  id: number;
  competition_id: string;
  season_complete: boolean;
  season_name: string;
};

export type SponsorLocation = "home" | "leaderboard" | "email" | "all";

export type Sponsor = {
  id: string;
  name: string;
  logo_url: string | null;
  website_url: string | null;
  display_location: SponsorLocation;
  is_active: boolean;
  order_position: number;
  created_at: string;
};

export type League = {
  id: string;
  name: string;
  invite_code: string;
  created_by: string;
  created_at: string;
};

export type LeagueMember = {
  league_id: string;
  user_id: string;
  joined_at: string;
};

export type CompetitionParticipant = {
  user_id: string;
  competition_id: string;
  joined_at: string;
};

export type Season = {
  id: string;
  name: string;
  year: number;
  archived_at: string;
  winner_name: string | null;
  total_participants: number;
  total_rounds: number;
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
      leagues: {
        Row: League;
        Insert: Omit<League, "id" | "created_at"> & { id?: string; created_at?: string };
        Update: Partial<League>;
        Relationships: [];
      };
      league_members: {
        Row: LeagueMember;
        Insert: LeagueMember;
        Update: Partial<LeagueMember>;
        Relationships: [];
      };
      competition_participants: {
        Row: CompetitionParticipant;
        Insert: Omit<CompetitionParticipant, "joined_at"> & { joined_at?: string };
        Update: Partial<CompetitionParticipant>;
        Relationships: [];
      };
      sponsors: {
        Row: Sponsor;
        Insert: Omit<Sponsor, "id" | "created_at"> & { id?: string; created_at?: string };
        Update: Partial<Sponsor>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      upsert_pick: {
        Args: { p_fixture_id: string; p_picked_team_id?: string | null; p_picked_draw?: boolean };
        Returns: undefined;
      };
      auto_fill_missing_picks: {
        Args: { p_gameweek_id: string };
        Returns: number;
      };
      score_fixture_picks: {
        Args: { p_fixture_id: string; p_result_team_id?: string | null; p_is_draw?: boolean };
        Returns: number;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
