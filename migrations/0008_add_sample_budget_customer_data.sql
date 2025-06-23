-- Add sample data for AI Budget Tiers and Customer Data
-- This migration adds realistic sample data for testing the new tables

-- Insert sample budget tiers
INSERT OR IGNORE INTO ai_budget_tiers (id, tenant_id, name, min_price, max_price, description, typical_flowers, typical_arrangements, is_active) VALUES 
('budget-economy', 'default', 'Economy', 0, 30, 'Affordable arrangements for everyday occasions', '["carnations", "daisies", "baby breath"]', '["small bouquet", "simple vase"]', 1),
('budget-standard', 'default', 'Standard', 30, 80, 'Quality arrangements for special occasions', '["roses", "tulips", "lilies"]', '["medium bouquet", "vase arrangement"]', 1),
('budget-premium', 'default', 'Premium', 80, 200, 'Luxury arrangements for very special occasions', '["peonies", "orchids", "garden roses"]', '["large bouquet", "elegant vase"]', 1),
('budget-luxury', 'default', 'Luxury', 200, 500, 'Ultra-premium arrangements for exclusive events', '["rare orchids", "imported roses", "exotic flowers"]', '["designer bouquet", "luxury vase"]', 1);

-- Insert sample customer data
INSERT OR IGNORE INTO ai_customer_data (id, tenant_id, customer_id, recipient_name, birthday, anniversary, special_dates, preferences, allergies, favorite_flowers, favorite_colors, budget_preference, is_active) VALUES 
('customer-001', 'default', 'CUST001', 'Sarah Johnson', '1985-03-15', '2010-06-20', '["2024-01-15", "2024-09-10"]', '{"style": "romantic", "size": "medium", "seasonal": true}', '["lilies", "pollen"]', '["roses", "peonies", "tulips"]', '["pink", "white", "purple"]', 'Premium', 1),
('customer-002', 'default', 'CUST002', 'Michael Chen', '1990-07-22', '2015-08-14', '["2024-02-28", "2024-11-05"]', '{"style": "modern", "size": "large", "minimalist": true}', '[]', '["orchids", "succulents", "monstera"]', '["white", "green", "black"]', 'Luxury', 1),
('customer-003', 'default', 'CUST003', 'Emily Rodriguez', '1988-11-08', '2012-04-12', '["2024-03-20", "2024-10-15"]', '{"style": "rustic", "size": "small", "natural": true}', '["roses"]', '["sunflowers", "daisies", "wildflowers"]', '["yellow", "orange", "brown"]', 'Standard', 1),
('customer-004', 'default', 'CUST004', 'David Thompson', '1982-12-03', '2008-09-25', '["2024-05-18", "2024-12-01"]', '{"style": "elegant", "size": "medium", "formal": true}', '["pollen"]', '["lilies", "roses", "hydrangeas"]', '["purple", "white", "silver"]', 'Premium', 1),
('customer-005', 'default', 'CUST005', 'Lisa Wang', '1992-05-30', '2018-02-14', '["2024-06-22", "2024-08-30"]', '{"style": "tropical", "size": "large", "vibrant": true}', '[]', '["birds of paradise", "ginger", "heliconia"]', '["orange", "pink", "yellow"]', 'Luxury', 1); 