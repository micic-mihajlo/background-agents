"use client";

import { memo } from "react";
import type { SandboxEvent } from "@/types/session";
import { formatSessionEventTime } from "@/lib/time";
import { formatToolCall, formatToolGroup } from "@/lib/tool-formatters";
import { toolCallKey } from "@/lib/timeline-items";
import { ToolCallItem } from "./tool-call-item";
import {
  Trace,
  TraceCollapsible,
  TraceCollapsibleContent,
  TraceCollapsibleTrigger,
  TraceDescription,
  TraceIcon,
  TraceLine,
  TraceTitle,
} from "@/components/ui/trace";
import { ToolIcon, toolTraceStatus } from "@/components/tool-call-presentation";

type ToolCallEvent = Extract<SandboxEvent, { type: "tool_call" }>;

/** Consecutive calls to the same tool, summarized on one line that expands into each call. */
export const ToolCallGroup = memo(
  function ToolCallGroup({
    events,
    isExpanded,
    expandedToolCallIds,
    onToggleGroup,
    onToggleTool,
  }: {
    events: ToolCallEvent[];
    isExpanded: boolean;
    expandedToolCallIds: ReadonlySet<string>;
    onToggleGroup: () => void;
    onToggleTool: (event: ToolCallEvent) => void;
  }) {
    const formatted = formatToolGroup(events);
    const firstEvent = events[0];

    // For single tool call, render directly without group wrapper
    if (events.length === 1) {
      return (
        <ToolCallItem
          event={firstEvent}
          isExpanded={expandedToolCallIds.has(toolCallKey(firstEvent))}
          onToggle={() => onToggleTool(firstEvent)}
        />
      );
    }

    const statuses = events.map((event) => toolTraceStatus(event.status));
    const status = statuses.includes("running")
      ? "running"
      : statuses.includes("error")
        ? "error"
        : undefined;

    return (
      <Trace>
        <TraceCollapsible open={isExpanded} onOpenChange={onToggleGroup}>
          <TraceCollapsibleTrigger className="w-full">
            <TraceLine status={status} className="w-full">
              <TraceIcon>
                <ToolIcon name={formatToolCall(firstEvent).icon} status={status} />
              </TraceIcon>
              <TraceTitle>
                {formatted.toolName} {formatted.summary}
              </TraceTitle>
              <TraceDescription className="ml-auto pl-2 text-xs">
                {formatSessionEventTime(firstEvent.timestamp)}
              </TraceDescription>
            </TraceLine>
          </TraceCollapsibleTrigger>
          <TraceCollapsibleContent className="flex flex-col gap-2">
            {events.map((event) => (
              <ToolCallItem
                key={toolCallKey(event)}
                event={event}
                isExpanded={expandedToolCallIds.has(toolCallKey(event))}
                onToggle={() => onToggleTool(event)}
                showTime={false}
              />
            ))}
          </TraceCollapsibleContent>
        </TraceCollapsible>
      </Trace>
    );
  },
  (prev, next) =>
    prev.isExpanded === next.isExpanded &&
    prev.expandedToolCallIds === next.expandedToolCallIds &&
    prev.events.length === next.events.length &&
    prev.events.every((e, i) => e === next.events[i])
);
