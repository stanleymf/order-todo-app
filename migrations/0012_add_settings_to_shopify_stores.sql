-- Add settings column to shopify_stores table to store webhook configurations and other settings
ALTER TABLE shopify_stores ADD COLUMN settings TEXT DEFAULT '{}'; 