ALTER TABLE profiles ADD COLUMN is_suspected_bot boolean NOT NULL DEFAULT false;

CREATE INDEX idx_profiles_is_suspected_bot ON profiles (id) WHERE is_suspected_bot = true;
