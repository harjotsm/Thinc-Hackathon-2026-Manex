BEGIN;

CREATE OR REPLACE FUNCTION resolve_approve_initiative(
  _initiative_id TEXT,
  _incident_id TEXT,
  _agent_domain TEXT,
  _target_system TEXT,
  _owner_user_id TEXT,
  _due_ts TIMESTAMPTZ,
  _status TEXT,
  _closure_predicate JSONB,
  _product_id TEXT,
  _defect_id TEXT,
  _section_id TEXT,
  _comments TEXT,
  _action_id TEXT
)
RETURNS TABLE (initiative JSONB, product_action_id TEXT)
LANGUAGE plpgsql
AS $$
DECLARE
  v_now TIMESTAMPTZ := now();
  v_initiative initiative%ROWTYPE;
BEGIN
  IF _product_id IS NULL OR length(trim(_product_id)) = 0 THEN
    RAISE EXCEPTION 'product_id is required to write product_action';
  END IF;

  INSERT INTO product_action (
    action_id,
    product_id,
    ts,
    action_type,
    status,
    user_id,
    section_id,
    comments,
    defect_id
  )
  VALUES (
    _action_id,
    _product_id,
    v_now,
    format('resolve_%s', _agent_domain),
    'open',
    COALESCE(_owner_user_id, 'resolve_agent'),
    _section_id,
    _comments,
    _defect_id
  );

  INSERT INTO initiative (
    initiative_id,
    incident_id,
    agent_domain,
    target_system,
    external_ref,
    product_action_id,
    owner_user_id,
    due_ts,
    status,
    closure_predicate
  )
  VALUES (
    _initiative_id,
    _incident_id,
    _agent_domain,
    _target_system,
    _action_id,
    _action_id,
    _owner_user_id,
    _due_ts,
    _status,
    _closure_predicate
  )
  RETURNING * INTO v_initiative;

  UPDATE incident
  SET status = 'resolving'
  WHERE incident_id = _incident_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'incident % not found', _incident_id;
  END IF;

  initiative := to_jsonb(v_initiative);
  product_action_id := _action_id;
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION resolve_apply_closure_result(
  _initiative_id TEXT,
  _incident_id TEXT,
  _satisfied BOOLEAN,
  _metric TEXT,
  _value NUMERIC,
  _confidence NUMERIC,
  _measured_ts TIMESTAMPTZ DEFAULT now()
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_measurement_id TEXT;
BEGIN
  IF _satisfied THEN
    UPDATE initiative
    SET status = 'done',
        closed_ts = _measured_ts
    WHERE initiative_id = _initiative_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'initiative % not found', _initiative_id;
    END IF;

    v_measurement_id := 'MEAS-' || to_char(_measured_ts, 'YYYYMMDDHH24MISSMS') || lpad((floor(random() * 100000))::INT::TEXT, 5, '0');
    INSERT INTO impact_measurement (
      measurement_id,
      initiative_id,
      measured_ts,
      metric,
      value,
      confidence,
      method
    )
    VALUES (
      v_measurement_id,
      _initiative_id,
      _measured_ts,
      _metric,
      _value,
      _confidence,
      'closure-monitor'
    );

    IF NOT EXISTS (
      SELECT 1
      FROM initiative i
      WHERE i.incident_id = _incident_id
        AND i.initiative_id <> _initiative_id
        AND i.status IN ('approved', 'in_progress', 'reopen')
    ) THEN
      UPDATE incident
      SET status = 'closed',
          closed_ts = _measured_ts
      WHERE incident_id = _incident_id;
    END IF;
  ELSE
    UPDATE initiative
    SET status = 'reopen',
        closed_ts = NULL
    WHERE initiative_id = _initiative_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'initiative % not found', _initiative_id;
    END IF;

    UPDATE incident
    SET status = 'reasoning',
        closed_ts = NULL
    WHERE incident_id = _incident_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION resolve_approve_initiative(
  TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, TEXT, JSONB, TEXT, TEXT, TEXT, TEXT, TEXT
) TO team_writer;

GRANT EXECUTE ON FUNCTION resolve_apply_closure_result(
  TEXT, TEXT, BOOLEAN, TEXT, NUMERIC, NUMERIC, TIMESTAMPTZ
) TO team_writer;

COMMIT;
