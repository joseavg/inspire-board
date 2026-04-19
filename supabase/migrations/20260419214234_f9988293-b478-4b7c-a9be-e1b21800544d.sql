ALTER TABLE public.tasks
  ADD COLUMN estimated_minutes integer,
  ADD COLUMN actual_minutes integer,
  ADD COLUMN started_at timestamptz,
  ADD COLUMN completed_at timestamptz,
  ADD COLUMN recurrence jsonb;