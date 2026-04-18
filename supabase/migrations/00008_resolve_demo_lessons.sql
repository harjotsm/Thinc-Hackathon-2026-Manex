-- 00008_resolve_demo_lessons.sql
-- Inserts 3 pre-approved demo lessons (Stories 1, 2, 4) for demo/network-effect seeding.
-- Story 3 (design thermal drift, MC-200/R33) is deliberately excluded — it is the
-- live network-effect demonstration and should emerge from pipeline reasoning.
--
-- embedding + signature_embedding are left NULL — to be filled by the embedding
-- recovery worker in M5 (backfill_watermark drives this).

BEGIN;

-- Placeholder closed incidents for demo lessons
-- (using separate INC-SEED-* IDs so they don't collide with Harjot's seeded data)
INSERT INTO incident (
  incident_id,
  opened_ts,
  closed_ts,
  status,
  title,
  summary,
  severity,
  archetype,
  signal_count
) VALUES
  (
    'INC-SEED-SUPPLIER-001',
    '2025-11-01 06:00:00+00',
    '2025-11-15 18:00:00+00',
    'closed',
    'ElektroParts SB-00007 batch escape — 100µF capacitor failures',
    'Cluster of factory defects traced to supplier batch SB-00007 (100µF capacitors from ElektroParts). Quarantine + supplier QA escalation resolved.',
    'high',
    'supplier',
    12
  ),
  (
    'INC-SEED-DRIFT-001',
    '2025-12-01 07:00:00+00',
    '2026-01-20 12:00:00+00',
    'closed',
    'VIB_TEST calibration drift at Montage Linie 1 (W49–W2)',
    'Rising test failure rate at VIB_TEST station over weeks W49–W2, across multiple supplier batches. Root cause: station calibration drift. Resolved by recalibration.',
    'medium',
    'drift',
    18
  ),
  (
    'INC-SEED-OPERATOR-001',
    '2026-01-10 06:00:00+00',
    '2026-02-01 15:00:00+00',
    'closed',
    'Operator handling defect cluster — user_042 late shift',
    'Defects clustered on user_042 across PO-00012/18/24, consistent with late shift pattern. No common supplier batch or design change. Root cause: operator handling gap.',
    'medium',
    'operator',
    9
  )
ON CONFLICT (incident_id) DO NOTHING;

-- 3 pre-approved demo lessons
INSERT INTO lesson (
  lesson_id,
  incident_id,
  signature_text,
  outcome,
  fix_summary,
  archetype,
  prompt_snippet,
  root_cause,
  triggers,
  confidence,
  engineer_validated,
  seed_source,
  embedding,
  signature_embedding,
  created_ts
) VALUES
  -- Lesson A — Story 1: Supplier batch escape
  (
    'LSN-SEED-SUPPLIER',
    'INC-SEED-SUPPLIER-001',
    'Cluster of identical or near-identical defects on recently-received supplier batch → likely supplier QA escape, not in-process issue.',
    'resolved',
    'Quarantine batch, containment + supplier QA escalation, re-inspect adjacent batches.',
    'supplier',
    'When multiple signals share the same part_number + the same supplier_batch_id within a short window, strongly consider supplier archetype. Initiate containment + supplier-notice before attempting root-cause rework.',
    'Supplier batch QA escape (counterfeit / out-of-spec / mishandling at supplier).',
    '{"pattern": "same_part_same_batch_multi_signal", "min_signals": 3}'::jsonb,
    0.9,
    'approved',
    'demo',
    NULL,
    NULL,
    now()
  ),
  -- Lesson B — Story 2: Calibration drift
  (
    'LSN-SEED-DRIFT',
    'INC-SEED-DRIFT-001',
    'Single test station fails multiple units over a sustained window of weeks → likely station calibration drift.',
    'resolved',
    'Pause station, recalibrate + verify golden-unit, re-test affected WIP.',
    'drift',
    'When a single test_key + single section shows a rising failure rate over many weeks with products spread across supplier batches, drift archetype applies. Inspect calibration history before blaming parts.',
    'Test station calibration drift.',
    '{"pattern": "single_station_rising_failure", "window_weeks_min": 2}'::jsonb,
    0.9,
    'approved',
    'demo',
    NULL,
    NULL,
    now()
  ),
  -- Lesson D — Story 4: Operator handling
  (
    'LSN-SEED-OPERATOR',
    'INC-SEED-OPERATOR-001',
    'Defects spike on specific user_id + specific shift → likely operator handling issue, not design or supplier.',
    'resolved',
    'Retraining + standard-work refresh + buddy check for affected operator.',
    'operator',
    'When signals cluster on a single user_id + consistent shift, with no common supplier batch and no design change, operator archetype is most likely. Start with handling review.',
    'Operator handling / training gap.',
    '{"pattern": "same_operator_same_shift", "min_signals": 3}'::jsonb,
    0.9,
    'approved',
    'demo',
    NULL,
    NULL,
    now()
  )
ON CONFLICT (lesson_id) DO NOTHING;

COMMIT;
