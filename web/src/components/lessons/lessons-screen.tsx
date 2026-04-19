"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, Sparkles } from "lucide-react";
import { PROTOTYPE_DATA } from "@/lib/prototype-data";
import type { Lesson } from "@/lib/prototype-data";
import { Spark } from "@/components/themes/spark";
import { cn } from "@/lib/utils";

// Catalog-scale hero numbers used for the network-effect narrative. The
// in-app fixture has 6 lessons; production-scale messaging is what sells
// the cross-plant story. Cards below use the real fixture data.
const HERO = {
  catalog: 324,
  applied: 4521,
  plants: 3,
};

// Tag map mirrors what the prior PrototypeLessonsScreen surfaced. Kept
// as a literal table because tags are curated, not derived.
const TAGS_BY_LESSON: Record<string, string[]> = {
  "LES-018": ["solder", "supplier", "SB-00007"],
  "LES-022": ["thermal", "R33", "PM-00012"],
  "LES-014": ["torque", "calibration", "Stn-04"],
  "LES-031": ["rework", "operator", "shift-2"],
  "LES-009": ["label", "printer", "L3"],
  "LES-027": ["EOL", "near-miss", "SPC"],
};

const ARCHETYPE_HEX: Record<string, string> = {
  supplier: "#f48a5c",
  drift:    "#f3c969",
  design:   "#f472b6",
  operator: "#a78bfa",
  unknown:  "#6b7080",
};

// Heuristic — derive an archetype from tags first, then fall back to sig
// text. Cosmetic only; drives the left-border accent and signature colour.
const archetypeFor = (lesson: Lesson): string => {
  const tags = TAGS_BY_LESSON[lesson.id] ?? [];
  const haystack = (lesson.sig + " " + lesson.fix + " " + tags.join(" ")).toLowerCase();
  if (haystack.includes("supplier") || haystack.includes("batch") || haystack.includes("inbound")) {
    return "supplier";
  }
  if (haystack.includes("thermal") || haystack.includes("drift") || haystack.includes("calibration")) {
    return "drift";
  }
  if (haystack.includes("design") || haystack.includes("clearance") || haystack.includes("footprint") || haystack.includes("spec")) {
    return "design";
  }
  if (
    haystack.includes("operator") ||
    haystack.includes("rework") ||
    haystack.includes("shift") ||
    haystack.includes("label") ||
    haystack.includes("torque") ||
    haystack.includes("jig") ||
    haystack.includes("retrain")
  ) {
    return "operator";
  }
  return "unknown";
};

export const LessonsScreen = () => {
  const [activeTag, setActiveTag] = useState<string | null>(null);

  const allTags = useMemo(
    () => Array.from(new Set(Object.values(TAGS_BY_LESSON).flat())).sort(),
    [],
  );

  const filtered = useMemo(
    () =>
      activeTag
        ? PROTOTYPE_DATA.lessons.filter((l) =>
            (TAGS_BY_LESSON[l.id] ?? []).includes(activeTag),
          )
        : PROTOTYPE_DATA.lessons,
    [activeTag],
  );

  return (
    <div className="px-6 py-5 space-y-6">
      {/* Hero */}
      <section
        data-testid="lessons-hero"
        className="relative overflow-hidden rounded-2xl bg-card ring-1 ring-border/60 p-6 md:p-8 flex flex-col md:flex-row md:items-end md:justify-between gap-6"
      >
        <div
          aria-hidden
          className="absolute -right-24 -top-24 size-72 rounded-full opacity-50 blur-3xl"
          style={{ background: "color-mix(in oklab, var(--cta) 22%, transparent)" }}
        />
        <div
          aria-hidden
          className="absolute -left-16 -bottom-16 size-56 rounded-full opacity-40 blur-3xl"
          style={{ background: "color-mix(in oklab, var(--accent) 30%, transparent)" }}
        />

        <div className="relative z-10 max-w-2xl">
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-foreground leading-tight">
            Lessons Library
          </h1>
          <div className="mt-4 flex flex-wrap items-baseline gap-x-5 gap-y-2">
            <span className="inline-flex items-baseline gap-2">
              <span className="font-mono text-2xl font-bold text-foreground">
                {HERO.catalog}
              </span>
              <span className="text-sm text-muted-foreground">lessons cataloged</span>
            </span>
            <span className="text-muted-foreground/30 text-2xl font-light">/</span>
            <span className="inline-flex items-baseline gap-2">
              <span className="font-mono text-4xl md:text-5xl font-black text-[color:var(--cta)] tracking-tighter">
                {HERO.applied.toLocaleString("de-DE")}×
              </span>
              <span className="text-[10px] uppercase tracking-widest font-mono font-bold text-muted-foreground">
                network effect
              </span>
            </span>
            <span className="text-muted-foreground/30 text-2xl font-light">/</span>
            <span className="inline-flex items-baseline gap-2">
              <span className="font-mono text-2xl font-bold text-foreground">
                {HERO.plants}
              </span>
              <span className="text-sm text-muted-foreground">global plants</span>
            </span>
          </div>
        </div>

        <div className="relative z-10 max-w-xs rounded-xl bg-card/70 backdrop-blur ring-1 ring-border/60 p-5">
          <div className="inline-flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase tracking-widest text-[color:var(--cta)]">
            <Sparkles className="size-3" />
            Organizational Learning
          </div>
          <p className="mt-2 text-sm leading-relaxed italic text-foreground/85">
            „Wissen wird durch Teilung vermehrt."
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Quality insights scale across cross-functional units.
          </p>
        </div>
      </section>

      {/* Tag filter */}
      <section className="flex items-center gap-3 overflow-x-auto -mx-1 px-1 pb-1">
        <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-muted-foreground/80 whitespace-nowrap">
          Filter by topic:
        </span>
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            data-testid="tag-filter"
            data-active={activeTag === null}
            onClick={() => setActiveTag(null)}
            className={cn(
              "px-3 py-1 rounded-full text-xs font-bold transition-colors",
              activeTag === null
                ? "bg-[color:var(--cta)] text-white shadow-sm"
                : "bg-muted text-foreground/80 hover:bg-muted/80",
            )}
          >
            All Lessons
          </button>
          {allTags.map((tag) => (
            <button
              key={tag}
              data-testid="tag-filter"
              data-active={activeTag === tag}
              onClick={() => setActiveTag((prev) => (prev === tag ? null : tag))}
              className={cn(
                "px-3 py-1 rounded-full text-xs font-semibold transition-colors",
                activeTag === tag
                  ? "bg-[color:var(--cta)] text-white shadow-sm"
                  : "bg-muted text-foreground/70 hover:bg-muted/80 hover:text-foreground",
              )}
            >
              {tag}
            </button>
          ))}
        </div>
      </section>

      {/* Cards grid */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filtered.map((lesson) => (
          <LessonCard key={lesson.id} lesson={lesson} />
        ))}
      </section>
    </div>
  );
};

function LessonCard({ lesson }: { lesson: Lesson }) {
  const archetype = archetypeFor(lesson);
  const archHex = ARCHETYPE_HEX[archetype];
  const recurring = lesson.outcome === "recurring";
  const tags = TAGS_BY_LESSON[lesson.id] ?? [];
  const sparkColor = recurring ? "var(--sev-crit)" : "var(--sev-low)";

  return (
    <div
      data-testid="lesson-card"
      className="group flex flex-col rounded-2xl bg-card ring-1 ring-border/60 p-5 transition-all hover:ring-foreground/15 hover:shadow-md"
      style={{ borderLeft: `4px solid ${archHex}` }}
    >
      <div className="flex justify-between items-start mb-4">
        <span className="font-mono text-[10px] font-semibold text-muted-foreground bg-muted px-2 py-1 rounded">
          {lesson.id}
        </span>
        {recurring ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold uppercase tracking-wider text-[color:var(--sev-crit)] bg-[color:var(--sev-crit)]/10 px-2 py-0.5 rounded-full">
            <AlertTriangle className="size-3" />
            Recurring
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase tracking-wider text-[color:var(--sev-low)] bg-[color:var(--sev-low)]/10 px-2 py-0.5 rounded-full">
            <span className="size-1.5 rounded-full bg-[color:var(--sev-low)]" aria-hidden />
            Resolved
          </span>
        )}
      </div>

      <h3
        className="font-mono text-xs font-bold uppercase tracking-tight"
        style={{ color: archHex }}
      >
        {archetype !== "unknown" ? `${archetype}:${lesson.id.toLowerCase()}` : lesson.id}
      </h3>
      <p className="mt-1.5 text-sm font-medium leading-snug text-foreground">
        {lesson.sig}
      </p>
      <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
        {lesson.fix}
      </p>

      {tags.length > 0 ? (
        <div className="mt-3 flex items-center gap-1 flex-wrap">
          {tags.map((tag) => (
            <span
              key={tag}
              className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted/60 text-muted-foreground"
            >
              {tag}
            </span>
          ))}
        </div>
      ) : null}

      <div className="mt-4 flex items-end gap-4">
        <div className="flex flex-col">
          <span className="text-[10px] uppercase font-mono font-bold tracking-widest text-muted-foreground/80">
            Usage
          </span>
          <span className="font-mono text-xl font-bold text-[color:var(--cta)] leading-none">
            {lesson.applied}×
          </span>
          <span className="text-[10px] text-muted-foreground mt-0.5">
            {lesson.plants} plant{lesson.plants === 1 ? "" : "s"}
          </span>
        </div>
        <div className="flex-1 h-10 self-end pb-1">
          <Spark
            data={lesson.trend}
            color={sparkColor}
            variant="bars"
            height={36}
          />
          <div className="text-[9px] uppercase tracking-wider text-muted-foreground/70 font-mono text-center mt-0.5">
            8w recurrence
          </div>
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-border/60 flex justify-between items-center opacity-0 group-hover:opacity-100 transition-opacity">
        <span
          className={cn(
            "text-xs font-semibold cursor-pointer hover:underline",
            recurring ? "text-[color:var(--sev-crit)]" : "text-[color:var(--cta)]",
          )}
        >
          {recurring ? "Escalate analysis" : "View details"}
        </span>
        <ArrowRight
          className={cn(
            "size-3.5",
            recurring ? "text-[color:var(--sev-crit)]" : "text-muted-foreground",
          )}
        />
      </div>
    </div>
  );
}
