-- Widget tokens: one per device, multiple per user.
-- Only the SHA-256 hash is stored. Account deletion cascades all tokens.
CREATE TABLE IF NOT EXISTS widget_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz
);

CREATE INDEX IF NOT EXISTS widget_tokens_user_id_idx ON widget_tokens(user_id);

ALTER TABLE widget_tokens ENABLE ROW LEVEL SECURITY;
