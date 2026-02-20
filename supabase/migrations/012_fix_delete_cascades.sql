-- Fix: Products and Orders deletion conflicts
-- Previously, deleting a product or an order would fail if it was tied to a return_prevention_attempts record.
-- Switching from restricted foreign keys to ON DELETE SET NULL allows deletion while preserving analytics.

ALTER TABLE return_prevention_attempts
  -- Drop existing strict foreign key constraints
  DROP CONSTRAINT IF EXISTS return_prevention_attempts_order_id_fkey,
  DROP CONSTRAINT IF EXISTS return_prevention_attempts_product_id_fkey,
  
  -- Add new foreign keys with ON DELETE SET NULL
  ADD CONSTRAINT return_prevention_attempts_order_id_fkey 
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL,
    
  ADD CONSTRAINT return_prevention_attempts_product_id_fkey 
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL;
