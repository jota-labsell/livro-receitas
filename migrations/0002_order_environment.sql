-- Existing orders are sandbox purchases. Preserve them and isolate real orders.
ALTER TABLE orders ADD COLUMN environment TEXT NOT NULL DEFAULT 'sandbox'
  CHECK(environment IN ('sandbox','production'));
CREATE INDEX orders_environment_status ON orders(environment, status);
