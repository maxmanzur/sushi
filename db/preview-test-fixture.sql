-- Exclusivo de sushi-preview-db. No copiar a producción.
INSERT INTO categories(name, sort_order, active)
SELECT 'PRUEBAS PREVIEW', 999, 1
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name='PRUEBAS PREVIEW');

INSERT INTO products(category_id, name, description, price, active, sort_order)
SELECT c.id, 'Pedido de prueba — no vender', 'Producto temporal exclusivo de Preview', NULL, 1, 999
FROM categories c
WHERE c.name='PRUEBAS PREVIEW'
  AND NOT EXISTS (SELECT 1 FROM products p WHERE p.name='Pedido de prueba — no vender');
