"use client";

import type { ReactNode } from "react";
import { ListChecksIcon } from "lucide-react";
import {
  Trace,
  TraceCollapsible,
  TraceCollapsibleContent,
  TraceCollapsibleTrigger,
  TraceIcon,
  TraceLine,
  TraceTitle,
} from "@/components/ui/trace";

function formatDuration(durationMs: number): string {
  const totalSeconds = Math.round(durationMs / 1000);
  if (totalSeconds < 1) return "less than a second";

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours > 0 ? `${hours}h` : null, minutes > 0 ? `${minutes}m` : null, `${seconds}s`]
    .filter(Boolean)
    .join(" ");
}

/**
 * The work an agent did for one turn, following the AI Elements Chain of
 * Thought pattern: a summary line that expands into every step it took.
 */
export function SessionWorkGroup({
  durationMs,
  isExpanded,
  onToggle,
  children,
}: {
  durationMs: number;
  isExpanded: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const label = `Worked for ${formatDuration(durationMs)}`;

  return (
    <Trace className="py-1">
      <TraceCollapsible open={isExpanded} onOpenChange={onToggle}>
        <TraceCollapsibleTrigger>
          <TraceLine>
            <TraceIcon>
              <ListChecksIcon />
            </TraceIcon>
            <TraceTitle className="font-medium">{label}</TraceTitle>
          </TraceLine>
        </TraceCollapsibleTrigger>
        <TraceCollapsibleContent className="flex flex-col gap-2">
          {children}
        </TraceCollapsibleContent>
      </TraceCollapsible>
    </Trace>
  );
}
