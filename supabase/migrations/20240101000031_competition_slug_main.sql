-- Add slug (unique, human-readable identifier for invite links and hostname lookup)
-- and is_main_comp (marks the representative competition for each site_url).
-- Adding a new tenant becomes data-only: insert a row, add the Vercel domain, done.

ALTER TABLE competitions ADD COLUMN IF NOT EXISTS slug text UNIQUE;
ALTER TABLE competitions ADD COLUMN IF NOT EXISTS is_main_comp boolean NOT NULL DEFAULT false;
ALTER TABLE competitions ADD COLUMN IF NOT EXISTS display_name text;

-- Mark the four main competitions
UPDATE competitions SET is_main_comp = true, slug = 'provincial', display_name = 'Provincial Rugby'
  WHERE id = 'bf6bb916-86c7-4cb1-8268-ba887a973c1f';

UPDATE competitions SET is_main_comp = true, slug = 'taranaki', display_name = 'Taranaki Club Rugby'
  WHERE id = 'b3dbe30d-91ef-40c3-9680-3586c6d17ef8';

UPDATE competitions SET is_main_comp = true, slug = 'bridlington', display_name = 'Bridlington RUFC'
  WHERE id = '7a27f36c-aab6-4ba8-86e3-2bd9b182361e';

UPDATE competitions SET is_main_comp = true, slug = 'waikato', display_name = 'Waikato Premier'
  WHERE id = '24d98bce-ce4b-4411-be28-8af22f4663a7';

-- Non-main comps that share a site_url still get a slug for direct references
UPDATE competitions SET slug = 'taranaki-women'
  WHERE id = '952743a7-9e79-4c5b-b15c-7fe07c4ca420' AND slug IS NULL;
