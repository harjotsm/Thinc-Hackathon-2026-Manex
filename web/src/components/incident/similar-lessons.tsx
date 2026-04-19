import Link from "next/link";
import { TrendingDown, TrendingUp, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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

const TrendIcon = ({ trend }: { trend: LessonView["trend"] }) => {
  switch (trend) {
    case "up":
      return <TrendingUp className="size-3" aria-hidden />;
    case "down":
      return <TrendingDown className="size-3" aria-hidden />;
    case "flat":
      return <Minus className="size-3" aria-hidden />;
    default:
      return null;
  }
};

// For lessons, "down" recurrence is GOOD (color green); "up" is BAD.
const trendClass = (trend: LessonView["trend"]): string => {
  switch (trend) {
    case "down":
      return "text-emerald-700";
    case "up":
      return "text-orange-700";
    default:
      return "text-muted-foreground";
  }
};

export function SimilarLessons({ lessons }: Props) {
  if (lessons.length === 0) {
    return null;
  }

  return (
    <section data-testid="similar-lessons">
      <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-3">
        Similar past lessons ({lessons.length})
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
        {lessons.slice(0, 3).map((l) => (
          <Link
            key={l.lesson_id}
            href={`/lessons?id=${encodeURIComponent(l.lesson_id)}`}
            data-testid={`lesson-card-${l.lesson_id}`}
            className="block group"
          >
            <Card size="sm" className="transition-colors hover:border-primary/30 hover:bg-muted/40 h-full">
              <CardHeader className="pb-0 flex flex-row items-center gap-2">
                <span className="font-mono text-[10px] font-semibold text-primary">
                  {l.lesson_id}
                </span>
                <div className="flex-1" />
                <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 uppercase tracking-wider text-[9px] font-semibold rounded-md px-1.5">
                  resolved
                </Badge>
              </CardHeader>
              <CardContent className="flex flex-col gap-1.5">
                <div className="text-xs font-medium text-foreground leading-snug break-words">
                  {l.signature}
                </div>
                <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                  <span>Applied {l.applied_count}×</span>
                  {l.trend ? (
                    <>
                      <span className="text-muted-foreground/40">·</span>
                      <span
                        className={cn(
                          "inline-flex items-center gap-0.5 font-semibold",
                          trendClass(l.trend),
                        )}
                      >
                        <TrendIcon trend={l.trend} />
                        <span>{trendGlyph(l.trend)} recurrence</span>
                      </span>
                    </>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </section>
  );
}
