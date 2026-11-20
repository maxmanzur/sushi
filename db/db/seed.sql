-- Categorías iniciales vacías de productos.
-- Los productos y precios reales se cargarán desde el administrador.

INSERT INTO settings (key, value) VALUES
  ('pickup_cash_discount_percent', '10'),
  ('store_name', 'GOTOKU SUSHI')
ON CONFLICT(key) DO NOTHING;
