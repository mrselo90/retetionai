-- Fix scheduled_tasks schema drift.
--
-- Application code has long assumed scheduled_tasks carries merchant_id, but
-- the original table definition was created without it in early migrations.
-- Add the column, backfill from users, then enforce the expected constraint
-- and supporting index.

ALTER TABLE public.scheduled_tasks
  ADD COLUMN IF NOT EXISTS merchant_id UUID;

UPDATE public.scheduled_tasks st
SET merchant_id = u.merchant_id
FROM public.users u
WHERE st.user_id = u.id
  AND st.merchant_id IS NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.scheduled_tasks
    WHERE merchant_id IS NULL
  ) THEN
    RAISE EXCEPTION 'scheduled_tasks contains rows that could not be backfilled with merchant_id';
  END IF;
END
$$;

ALTER TABLE public.scheduled_tasks
  ALTER COLUMN merchant_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'scheduled_tasks_merchant_id_fkey'
      AND conrelid = 'public.scheduled_tasks'::regclass
  ) THEN
    ALTER TABLE public.scheduled_tasks
      ADD CONSTRAINT scheduled_tasks_merchant_id_fkey
      FOREIGN KEY (merchant_id) REFERENCES public.merchants(id) ON DELETE CASCADE;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_merchant_id
  ON public.scheduled_tasks(merchant_id);

CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_merchant_order_type
  ON public.scheduled_tasks(merchant_id, order_id, task_type);

NOTIFY pgrst, 'reload schema';
