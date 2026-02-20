-- Migration: Add is_super_admin flag to merchants table
-- Merchants represent the app users (owners) logging into the dashboard.
-- Setting this flag to true grants them access to the global Super Admin panel.

ALTER TABLE merchants 
ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN DEFAULT false;

COMMENT ON COLUMN merchants.is_super_admin IS 
  'Flag indicating if this merchant user has global Super Admin privileges.';
