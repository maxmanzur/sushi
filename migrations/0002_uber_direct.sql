ALTER TABLE orders ADD COLUMN payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'confirmed'));
ALTER TABLE orders ADD COLUMN payment_confirmed_at TEXT;
ALTER TABLE orders ADD COLUMN payment_confirmed_by TEXT;
ALTER TABLE orders ADD COLUMN delivery_status TEXT NOT NULL DEFAULT 'not_ready' CHECK (delivery_status IN ('not_ready', 'ready'));
ALTER TABLE orders ADD COLUMN delivery_ready_at TEXT;
ALTER TABLE orders ADD COLUMN delivery_ready_by TEXT;

CREATE TABLE IF NOT EXISTS uber_dispatches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL UNIQUE,
  state TEXT NOT NULL DEFAULT 'requested' CHECK (state IN ('requested', 'quoted', 'created', 'dry_run', 'failed', 'cancelled')),
  requested_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  requested_by TEXT NOT NULL,
  operator_session_id TEXT NOT NULL,
  quote_id TEXT,
  delivery_id TEXT,
  tracking_url TEXT,
  uber_status TEXT,
  last_error TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_uber_dispatches_state ON uber_dispatches(state, updated_at);
