-- Track when an external event was successfully processed.
-- Prevents processExternalEvents from re-reading and re-applying the same rows on every scheduler run.
ALTER TABLE external_events
  ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ;

-- Partial index so the "fetch unprocessed" query hits only unprocessed rows
CREATE INDEX IF NOT EXISTS idx_external_events_unprocessed
  ON external_events(received_at)
  WHERE processed_at IS NULL;
