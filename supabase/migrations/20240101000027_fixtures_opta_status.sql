-- Opta reports match state as a status string on its feeds — RU1 (fixtures)
-- sends "Fixture" | "Result", RU5 (livescores) also sends the in-play states
-- such as "First half". The ingest read that value but threw it away, leaving
-- the stats page to infer a status from scores and kickoff time. Persist it so
-- the real status can be read back.
alter table public.fixtures add column if not exists opta_status text;
