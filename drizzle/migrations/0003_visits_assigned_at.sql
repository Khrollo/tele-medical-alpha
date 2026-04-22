-- Add visits.assigned_at so the "wait time" UI metric can be reset on
-- clinician pickup WITHOUT destroying the original queue-entry timestamp.
--
-- Before this column existed, assignVisitToMeAction overwrote visits.created_at
-- with NOW() to reset the board's wait counter. That destroyed the canonical
-- arrival time (breaking median-wait metrics, audit chronology, and any
-- time-series reports) and made replays impossible.
--
-- Wait-time semantics going forward:
--   waitMinutes = (NOW() - COALESCE(assigned_at, created_at)) / 60000
-- created_at is immutable from this migration onward.

ALTER TABLE visits
  ADD COLUMN IF NOT EXISTS assigned_at timestamptz;

-- Backfill: for any visit already flipped to a clinician-owned status,
-- stamp assigned_at at created_at. This preserves current UI behavior for
-- historical rows (they show 0m wait, which is what they showed before).
UPDATE visits
SET assigned_at = created_at
WHERE assigned_at IS NULL
  AND clinician_id IS NOT NULL
  AND status IN ('In Progress', 'in_progress', 'finalized', 'signed');
