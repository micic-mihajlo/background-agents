"use client";

import type { ReactNode } from "react";
import { FileTextIcon, ScrollTextIcon } from "lucide-react";
import { formatSessionEventTime } from "@/lib/time";
import { formatToolCall } from "@/lib/tool-formatters";
import type { ToolCallEvent } from "@/lib/timeline-items";
import { Badge } from "@/components/ui/badge";
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
import { HighlightedCodeBlock, ToolIcon, toolTraceStatus } from "./tool-call-presentation";

function stringArg(event: ToolCallEvent, key: string): string | null {
  const value = event.args?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function cleanTaskResult(output: string | undefined): string | null {
  if (!output?.trim()) return null;

  const trimmed = output.trim();
  const envelope = trimmed.match(
    /^<task(?:\s[^>]*)?>\s*<(task_result|task_error)>\s*([\s\S]*?)\s*<\/\1>\s*<\/task>$/
  );
  return envelope ? envelope[2].trim() : output;
}

/**
 * A subagent run, following the AI Elements Subagent pattern: one line that
 * expands into the agent and task badges, the tool calls it made, and its
 * instructions and result.
 */
export function TaskActivityItem({
  event,
  hasActivity,
  children,
  expansionKey,
  expandedSections,
  onToggleSection,
}: {
  event: ToolCallEvent;
  hasActivity: boolean;
  children: ReactNode;
  expansionKey: string;
  expandedSections: ReadonlySet<string>;
  onToggleSection: (key: string) => void;
}) {
  const sectionKey = (section: "task" | "instructions" | "result") => `${expansionKey}:${section}`;
  const isExpanded = expandedSections.has(sectionKey("task"));
  const formatted = formatToolCall(event);
  const prompt = stringArg(event, "prompt");
  const agent = stringArg(event, "subagent_type");
  const taskId = stringArg(event, "task_id");
  const result = cleanTaskResult(event.output);
  const status = toolTraceStatus(event.status);
  const isRunning = status === "running";

  return (
    <Trace>
      <TraceCollapsible open={isExpanded} onOpenChange={() => onToggleSection(sectionKey("task"))}>
        <TraceCollapsibleTrigger className="w-full">
          <TraceLine status={status} className="w-full">
            <TraceIcon>
              <ToolIcon name="box" status={status} />
            </TraceIcon>
            <TraceTitle>
              {formatted.toolName} {formatted.summary}
            </TraceTitle>
            <TraceDescription className="ml-auto pl-2 text-xs">
              {formatSessionEventTime(event.timestamp)}
            </TraceDescription>
          </TraceLine>
        </TraceCollapsibleTrigger>
        {isRunning && (
          <span role="status" className="sr-only">
            Task in progress
          </span>
        )}
        <TraceCollapsibleContent className="flex flex-col gap-3">
          {(agent || taskId) && (
            <div className="flex flex-wrap items-center gap-1.5">
              {agent && <Badge>Agent: {agent}</Badge>}
              {taskId && <Badge className="font-mono">Task ID: {taskId}</Badge>}
            </div>
          )}
          {hasActivity && (
            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium text-secondary-foreground">Task activity</span>
              {children}
            </div>
          )}
          {(prompt || result) && (
            <Trace>
              {prompt && (
                <TraceCollapsible
                  open={expandedSections.has(sectionKey("instructions"))}
                  onOpenChange={() => onToggleSection(sectionKey("instructions"))}
                >
                  <TraceCollapsibleTrigger>
                    <TraceLine>
                      <TraceIcon>
                        <ScrollTextIcon />
                      </TraceIcon>
                      <TraceTitle>Instructions</TraceTitle>
                    </TraceLine>
                  </TraceCollapsibleTrigger>
                  <TraceCollapsibleContent>
                    <HighlightedCodeBlock code={prompt} wrap />
                  </TraceCollapsibleContent>
                </TraceCollapsible>
              )}
              {result && (
                <TraceCollapsible
                  open={expandedSections.has(sectionKey("result"))}
                  onOpenChange={() => onToggleSection(sectionKey("result"))}
                >
                  <TraceCollapsibleTrigger>
                    <TraceLine>
                      <TraceIcon>
                        <FileTextIcon />
                      </TraceIcon>
                      <TraceTitle>Result</TraceTitle>
                    </TraceLine>
                  </TraceCollapsibleTrigger>
                  <TraceCollapsibleContent>
                    <HighlightedCodeBlock code={result} wrap className="max-h-96" />
                  </TraceCollapsibleContent>
                </TraceCollapsible>
              )}
            </Trace>
          )}
        </TraceCollapsibleContent>
      </TraceCollapsible>
    </Trace>
  );
}
