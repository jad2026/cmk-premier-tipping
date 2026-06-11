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

export type Database = {
  public: {
    Tables: {
      teams: { Row: Team; Insert: Omit<Team, "id">; Update: Partial<Team> };
      gameweeks: {
        Row: Gameweek;
        Insert: Omit<Gameweek, "id">;
        Update: Partial<Gameweek>;
      };
      fixtures: {
        Row: Fixture;
        Insert: Omit<Fixture, "id">;
        Update: Partial<Fixture>;
      };
      picks: {
        Row: Pick;
        Insert: Omit<Pick, "id">;
        Update: Partial<Pick>;
      };
    };
  };
};
