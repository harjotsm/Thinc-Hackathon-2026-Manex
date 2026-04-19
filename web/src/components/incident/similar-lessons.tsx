import Link from "next/link";

export type LessonView = {
  lesson_id: string;
  signature: string;
  applied_count: number;
  trend?: "up" | "down" | "flat";
};

type Props = {
  lessons: LessonView[];
};

const trendGlyph = (trend: LessonView["trend"]): string => {
  switch (trend) {
    case "up":
      return "↑";
    case "down":
      return "↓";
    case "flat":
      return "→";
    default:
      return "·";
  }
};

const trendColor = (trend: LessonView["trend"]): string => {
  // For lessons, "down" recurrence is GOOD (color green); "up" is BAD (red).
  switch (trend) {
    case "down":
      return "var(--sev-low, #2f8a6f)";
    case "up":
      return "var(--sev-high, #d97236)";
    default:
      return "var(--ink-muted, #64748b)";
  }
};

export function SimilarLessons({ lessons }: Props) {
  if (lessons.length === 0) {
    return null;
  }

  return (
    <section data-testid="similar-lessons" style={{ marginTop: 18 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 10,
          flexWrap: "wrap",
        }}
      >
        <span
          className="eyebrow"
          style={{
            fontSize: 10,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            fontWeight: 600,
            color: "var(--ink-muted, #64748b)",
          }}
        >
          Similar past lessons ({lessons.length})
        </span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 10,
        }}
      >
        {lessons.slice(0, 3).map((l) => (
          <Link
            key={l.lesson_id}
            href={`/lessons?id=${encodeURIComponent(l.lesson_id)}`}
            data-testid={`lesson-card-${l.lesson_id}`}
            style={{
              padding: "12px 14px",
              border: "1px solid var(--line, #e2e8f0)",
              borderRadius: 8,
              background: "var(--bg-surface, white)",
              textDecoration: "none",
              color: "inherit",
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span
                className="mono"
                style={{
                  fontSize: 10,
                  color: "var(--accent, #639fc4)",
                  fontWeight: 600,
                }}
              >
                {l.lesson_id}
              </span>
              <div className="spacer" style={{ flex: 1 }} />
              <span
                className="chip sev-low"
                style={{
                  background: "rgba(95,194,163,0.10)",
                  color: "var(--sev-low, #2f8a6f)",
                  borderColor: "rgba(95,194,163,0.25)",
                  padding: "2px 7px",
                  borderRadius: 4,
                  fontSize: 10,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                }}
              >
                resolved
              </span>
            </div>
            <div
              style={{
                fontSize: 12.5,
                fontWeight: 500,
                lineHeight: 1.35,
                color: "var(--ink-primary, #0f172a)",
                overflowWrap: "anywhere",
              }}
            >
              {l.signature}
            </div>
            <div
              className="muted tt"
              style={{
                fontSize: 11,
                color: "var(--ink-muted, #64748b)",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span>Applied {l.applied_count}×</span>
              {l.trend ? (
                <>
                  <span style={{ color: "var(--ink-muted, #cbd5e1)" }}>·</span>
                  <span style={{ color: trendColor(l.trend), fontWeight: 600 }}>
                    {trendGlyph(l.trend)} recurrence
                  </span>
                </>
              ) : null}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
