"use client";

import type { ReactNode } from "react";
import { ChevronRightIcon } from "@/components/ui/icons";

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
    <div className="py-1">
      <button
        type="button"
        aria-expanded={isExpanded}
        onClick={onToggle}
        className="flex w-full items-center gap-1.5 px-1 py-1.5 text-left text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <span>{label}</span>
        <ChevronRightIcon
          className={`h-4 w-4 shrink-0 text-secondary-foreground transition-transform duration-200 ease-in-out-strong ${
            isExpanded ? "rotate-90" : ""
          }`}
        />
      </button>
      {isExpanded && (
        <div className="ml-[7px] space-y-1.5 border-l border-border pb-2 pl-4 pt-1">{children}</div>
      )}
    </div>
  );
}
