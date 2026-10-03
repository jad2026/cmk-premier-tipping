-- Add site_url to competitions (nullable, additive only)
ALTER TABLE competitions ADD COLUMN IF NOT EXISTS site_url text;

-- Populate known values
UPDATE competitions SET site_url = 'https://clubrugbytipping.com'
  WHERE id = 'bf6bb916-86c7-4cb1-8268-ba887a973c1f'; -- NPC

UPDATE competitions SET site_url = 'https://taranaki.clubrugbytipping.com'
  WHERE id = 'b3dbe30d-91ef-40c3-9680-3586c6d17ef8'; -- CMK (Taranaki)

UPDATE competitions SET site_url = 'https://bridlington.clubrugbytipping.com'
  WHERE id = '7a27f36c-aab6-4ba8-86e3-2bd9b182361e'; -- Bridlington

UPDATE competitions SET site_url = 'https://waikato.clubrugbytipping.com'
  WHERE id = '24d98bce-ce4b-4411-be28-8af22f4663a7'; -- Waikato
