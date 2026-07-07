-- Add per-competition scoring config and per-pick points column.
-- The trigger calculates points using each competition's scoring rules.

-- 1. Add points column to picks
ALTER TABLE public.picks
  ADD COLUMN IF NOT EXISTS points integer NOT NULL DEFAULT 0;

-- 2. Add scoring config to competitions (sensible defaults)
ALTER TABLE public.competitions
  ADD COLUMN IF NOT EXISTS scoring jsonb NOT NULL
  DEFAULT '{"correct_winner":1,"exact_margin":2,"within_margin":1,"within_margin_range":5,"correct_draw":1}'::jsonb;

-- 3. Backfill existing points from is_correct + margin_bonus
UPDATE public.picks
SET points = CASE
  WHEN is_correct = true THEN 1 + COALESCE(margin_bonus, 0)
  ELSE 0
END
WHERE is_correct IS NOT NULL;

-- 4. Updated trigger: per-competition scoring with margin + draw bonuses
CREATE OR REPLACE FUNCTION public.auto_score_on_result_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_scoring       jsonb;
  v_correct_winner int;
  v_exact_margin   int;
  v_within_margin  int;
  v_within_range   int;
  v_correct_draw   int;
  v_actual_margin  int;
  rec              record;
  v_points         int;
  v_margin_correct boolean;
  v_margin_bonus   int;
BEGIN
  -- Only act when result, draw flag, or scores changed
  IF NOT (
       (OLD.result_team_id IS DISTINCT FROM NEW.result_team_id)
    OR (OLD.is_draw        IS DISTINCT FROM NEW.is_draw)
    OR (OLD.home_score     IS DISTINCT FROM NEW.home_score)
    OR (OLD.away_score     IS DISTINCT FROM NEW.away_score)
  ) THEN
    RETURN NEW;
  END IF;

  -- Look up competition scoring config via fixture → gameweek → competition
  SELECT c.scoring INTO v_scoring
    FROM gameweeks g
    JOIN competitions c ON c.id = g.competition_id
   WHERE g.id = NEW.gameweek_id;

  -- Fall back to defaults if no config found
  v_correct_winner := COALESCE((v_scoring ->> 'correct_winner')::int, 1);
  v_exact_margin   := COALESCE((v_scoring ->> 'exact_margin')::int, 0);
  v_within_margin  := COALESCE((v_scoring ->> 'within_margin')::int, 0);
  v_within_range   := COALESCE((v_scoring ->> 'within_margin_range')::int, 5);
  v_correct_draw   := COALESCE((v_scoring ->> 'correct_draw')::int, 1);

  -- Result cleared → reset everything to null / 0
  IF NEW.result_team_id IS NULL AND NOT NEW.is_draw THEN
    UPDATE picks
       SET is_correct     = NULL,
           points         = 0,
           margin_correct = NULL,
           margin_bonus   = 0
     WHERE fixture_id = NEW.id;
    RETURN NEW;
  END IF;

  -- Actual margin from scores (NULL if scores missing)
  IF NEW.home_score IS NOT NULL AND NEW.away_score IS NOT NULL THEN
    v_actual_margin := ABS(NEW.home_score - NEW.away_score);
  ELSE
    v_actual_margin := NULL;
  END IF;

  -- Score each pick on this fixture
  FOR rec IN
    SELECT id, picked_team_id, picked_draw, predicted_margin
      FROM picks
     WHERE fixture_id = NEW.id
  LOOP
    v_points         := 0;
    v_margin_correct := NULL;
    v_margin_bonus   := 0;

    IF NEW.is_draw THEN
      -- ── Draw result ──────────────────────────────────────────────
      IF rec.picked_draw THEN
        v_points := v_correct_draw;
        UPDATE picks
           SET is_correct     = TRUE,
               points         = v_points,
               margin_correct = NULL,
               margin_bonus   = 0
         WHERE id = rec.id;
      ELSE
        UPDATE picks
           SET is_correct     = FALSE,
               points         = 0,
               margin_correct = CASE WHEN rec.predicted_margin IS NOT NULL THEN FALSE ELSE NULL END,
               margin_bonus   = 0
         WHERE id = rec.id;
      END IF;

    ELSIF rec.picked_team_id = NEW.result_team_id THEN
      -- ── Correct winner ───────────────────────────────────────────
      v_points := v_correct_winner;

      IF rec.predicted_margin IS NOT NULL AND v_actual_margin IS NOT NULL THEN
        IF rec.predicted_margin = v_actual_margin THEN
          v_margin_correct := TRUE;
          v_margin_bonus   := v_exact_margin;
          v_points         := v_points + v_exact_margin;
        ELSIF ABS(rec.predicted_margin - v_actual_margin) <= v_within_range THEN
          v_margin_correct := FALSE;
          v_margin_bonus   := v_within_margin;
          v_points         := v_points + v_within_margin;
        ELSE
          v_margin_correct := FALSE;
          v_margin_bonus   := 0;
        END IF;
      END IF;

      UPDATE picks
         SET is_correct     = TRUE,
             points         = v_points,
             margin_correct = v_margin_correct,
             margin_bonus   = v_margin_bonus
       WHERE id = rec.id;

    ELSE
      -- ── Wrong pick ───────────────────────────────────────────────
      UPDATE picks
         SET is_correct     = FALSE,
             points         = 0,
             margin_correct = CASE WHEN rec.predicted_margin IS NOT NULL THEN FALSE ELSE NULL END,
             margin_bonus   = 0
       WHERE id = rec.id;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

-- Trigger already exists from migration 000018; no need to recreate it.
-- The CREATE OR REPLACE above updates the function in place.
