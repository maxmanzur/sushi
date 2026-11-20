INSERT INTO settings (key, value) VALUES
  ('pickup_cash_discount_percent', '10'),
  ('store_name', 'GOTOKU SUSHI')
ON CONFLICT(key) DO NOTHING;
INSERT INTO categories (name, sort_order) SELECT 'Entradas', 1 WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name='Entradas');
INSERT INTO categories (name, sort_order) SELECT 'Rollos', 2 WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name='Rollos');
INSERT INTO categories (name, sort_order) SELECT 'Combinados', 3 WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name='Combinados');
INSERT INTO categories (name, sort_order) SELECT 'Cortes', 4 WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name='Cortes');
INSERT INTO categories (name, sort_order) SELECT 'Adicionales', 5 WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name='Adicionales');
