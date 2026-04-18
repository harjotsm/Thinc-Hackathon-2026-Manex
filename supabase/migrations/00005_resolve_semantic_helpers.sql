BEGIN;

CREATE OR REPLACE FUNCTION resolve_semantic_neighbors(
  _signal_id TEXT,
  _threshold DOUBLE PRECISION DEFAULT 0.45,
  _limit_count INTEGER DEFAULT 20
)
RETURNS TABLE (
  signal_id TEXT,
  distance DOUBLE PRECISION
)
LANGUAGE sql
STABLE
AS $$
  WITH anchor_tokens AS (
    SELECT ARRAY(
      SELECT token
      FROM unnest(regexp_split_to_array(lower(coalesce(s_anchor.text_payload, '')), '\W+')) AS token
      WHERE length(token) >= 4
    ) AS tokens
    FROM signal s_anchor
    WHERE s_anchor.signal_id = _signal_id
  ),
  scored AS (
    SELECT
      s_other.signal_id,
      CASE
        WHEN cardinality(a.tokens) = 0 THEN 1.0
        ELSE 1.0 - (
          cardinality(
            ARRAY(
              SELECT token
              FROM unnest(a.tokens) AS token
              INTERSECT
              SELECT token
              FROM unnest(regexp_split_to_array(lower(coalesce(s_other.text_payload, '')), '\W+')) AS token
              WHERE length(token) >= 4
            )
          )::DOUBLE PRECISION / GREATEST(cardinality(a.tokens), 1)
        )
      END AS distance
    FROM signal s_other
    CROSS JOIN anchor_tokens a
    WHERE s_other.signal_id <> _signal_id
  )
  SELECT signal_id, distance
  FROM scored
  WHERE distance <= _threshold
  ORDER BY distance ASC
  LIMIT GREATEST(COALESCE(_limit_count, 20), 1);
$$;

GRANT EXECUTE ON FUNCTION resolve_semantic_neighbors(TEXT, DOUBLE PRECISION, INTEGER) TO team_writer;

COMMIT;
