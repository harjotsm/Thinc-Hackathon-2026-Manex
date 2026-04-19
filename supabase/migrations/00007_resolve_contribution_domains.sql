-- 00007_resolve_contribution_domains.sql
-- Provides seed_contribution_domains(p_incident_id TEXT) — inserts 9 stub rows
-- into contribution, one per domain, for a newly-created incident.
-- Called from the correlator at incident creation time (M5).

BEGIN;

CREATE OR REPLACE FUNCTION seed_contribution_domains(p_incident_id TEXT)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  domains TEXT[] := ARRAY[
    'market_research',
    'central_quality',
    'plant_quality_indirect',
    'plant_quality_direct',
    'process_planner',
    'technology_planning',
    'supplier_quality',
    'business_analytics',
    'marketing'
  ];
  d TEXT;
  contrib_id TEXT;
BEGIN
  FOREACH d IN ARRAY domains LOOP
    contrib_id := 'CTB-' || upper(substring(md5(p_incident_id || d || now()::text) FROM 1 FOR 20));
    INSERT INTO contribution (
      contribution_id,
      incident_id,
      domain,
      source,
      status,
      content,
      evidence_refs,
      weight,
      created_ts
    ) VALUES (
      contrib_id,
      p_incident_id,
      d,
      'stub',
      'pending',
      NULL,
      NULL,
      1.0,
      now()
    )
    ON CONFLICT DO NOTHING;
  END LOOP;
END;
$$;

-- Grant execute to team_writer so the app can call this function
GRANT EXECUTE ON FUNCTION seed_contribution_domains(TEXT) TO team_writer;

COMMIT;
