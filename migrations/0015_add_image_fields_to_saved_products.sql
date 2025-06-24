-- Migration: Add image and extra product fields to saved_products
ALTER TABLE saved_products ADD COLUMN image_url TEXT;
ALTER TABLE saved_products ADD COLUMN image_alt TEXT;
ALTER TABLE saved_products ADD COLUMN image_width INTEGER;
ALTER TABLE saved_products ADD COLUMN image_height INTEGER;
-- description already exists, so no need to add it 