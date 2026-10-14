"use client";

import type { SandboxEvent } from "@/types/session";
import { formatSessionEventTime } from "@/lib/time";
import { formatToolCall } from "@/lib/tool-formatters";
import { extractLatestTasks } from "@/lib/tasks";
import { SlackNotifyEvent } from "./slack-notify-event";
import { CreatePullRequestEvent } from "./create-pull-request-event";
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
import {
  DiffCodeBlock,
  HighlightedCodeBlock,
  TodoTrace,
  ToolIcon,
  languageForPath,
  toolTraceStatus,
} from "@/components/tool-call-presentation";

type ToolCallEvent = Extract<SandboxEvent, { type: "tool_call" }>;

interface ToolCallItemProps {
  event: ToolCallEvent;
  isExpanded: boolean;
  onToggle: () => void;
  showTime?: boolean;
}

function stringArg(args: Record<string, unknown> | undefined, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = args?.[key];
    if (typeof value === "string") return value;
  }
  return null;
}

function truncationNotice(event: ToolCallEvent): string | null {
  if (!event.truncated) return null;
  const truncatedArgs = event.truncated.fields.some((field) => field.startsWith("args."));
  const truncatedOutput = event.truncated.fields.includes("output");
  if (truncatedArgs && truncatedOutput) return "Arguments and output were truncated.";
  return truncatedArgs ? "Arguments were truncated." : "Output was truncated.";
}

/**
 * Details for an expanded tool call, following the AI Elements Tool and
 * Terminal patterns: commands show their output, edits show a diff, file
 * reads and writes are highlighted, and todo lists render as a queue.
 */
function ToolCallDetails({ event }: { event: ToolCallEvent }) {
  const tool = event.tool?.toLowerCase() ?? "";
  const { args, output } = formatToolCall(event).getDetails();
  const notice = truncationNotice(event);
  const failed = event.status === "error";
  const filePath = stringArg(args, "filePath", "file_path", "notebook_path", "notebookPath");
  const blocks: React.ReactNode[] = [];

  if (tool === "bash") {
    const command = stringArg(args, "command") ?? "";
    blocks.push(
      <HighlightedCodeBlock
        key="terminal"
        title="Output"
        code={`$ ${command}${output ? `\n${output}` : ""}`}
        language="ansi"
        variant={failed ? "destructive" : "default"}
        copyable
      />
    );
  } else if (tool === "apply_patch" && typeof args?.patchText === "string") {
    blocks.push(<DiffCodeBlock key="patch" title="Patch" patch={args.patchText} />);
  } else if (tool === "edit" || tool === "multiedit") {
    const edits = Array.isArray(args?.edits)
      ? (args.edits as Record<string, unknown>[])
      : [args ?? {}];
    edits.forEach((edit, index) => {
      const oldText = stringArg(edit, "oldString", "old_string");
      const newText = stringArg(edit, "newString", "new_string");
      if (oldText !== null || newText !== null) {
        blocks.push(
          <DiffCodeBlock
            key={`edit:${index}`}
            title={filePath ?? "Edit"}
            oldText={oldText ?? ""}
            newText={newText ?? ""}
          />
        );
      }
    });
  } else if (tool === "write") {
    const content = stringArg(args, "content");
    if (content !== null) {
      blocks.push(
        <HighlightedCodeBlock
          key="write"
          title={filePath ?? "Write"}
          code={content}
          language={languageForPath(filePath)}
          copyable
        />
      );
    }
  } else if (tool === "todowrite") {
    const todos = extractLatestTasks([event]);
    if (todos.length > 0) blocks.push(<TodoTrace key="todos" todos={todos} />);
  } else if (tool === "read" && output) {
    blocks.push(
      <HighlightedCodeBlock
        key="read"
        title={filePath ?? "Output"}
        code={output}
        language={languageForPath(filePath)}
        copyable
      />
    );
  }

  // Tools without a dedicated view show their raw arguments and output.
  if (blocks.length === 0) {
    if (args && Object.keys(args).length > 0) {
      blocks.push(
        <HighlightedCodeBlock
          key="args"
          title="Arguments"
          code={JSON.stringify(args, null, 2)}
          language="json"
        />
      );
    }
  }
  const outputShown = tool === "bash" || tool === "read" || tool === "todowrite";
  if (output && !outputShown) {
    blocks.push(
      <HighlightedCodeBlock
        key="output"
        title="Output"
        code={output}
        variant={failed ? "destructive" : "default"}
        copyable
      />
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-2">
      {notice && <p className="text-xs text-muted-foreground">{notice}</p>}
      {blocks}
      {blocks.length === 0 && (
        <span className="text-xs text-secondary-foreground">No details available</span>
      )}
    </div>
  );
}

/** One tool call as a trace line that expands into its details. */
export function ToolCallItem({ event, isExpanded, onToggle, showTime = true }: ToolCallItemProps) {
  if (event.tool?.toLowerCase() === "create-pull-request" && !event.truncated) {
    return (
      <CreatePullRequestEvent
        event={event}
        isExpanded={isExpanded}
        onToggle={onToggle}
        showTime={showTime}
      />
    );
  }

  if (event.tool === "slack-notify" && !event.truncated) {
    return (
      <SlackNotifyEvent
        event={event}
        isExpanded={isExpanded}
        onToggle={onToggle}
        showTime={showTime}
      />
    );
  }

  const formatted = formatToolCall(event);
  const icon = event.tool?.toLowerCase() === "todowrite" ? "todo" : formatted.icon;
  const status = toolTraceStatus(event.status);

  return (
    <Trace>
      <TraceCollapsible open={isExpanded} onOpenChange={onToggle}>
        <TraceCollapsibleTrigger className="w-full">
          <TraceLine status={status} className="w-full">
            <TraceIcon>
              <ToolIcon name={icon} status={status} />
            </TraceIcon>
            <TraceTitle>
              {formatted.toolName} {formatted.summary}
              {event.truncated && " (truncated)"}
            </TraceTitle>
            {showTime && (
              <TraceDescription className="ml-auto pl-2 text-xs">
                {formatSessionEventTime(event.timestamp)}
              </TraceDescription>
            )}
          </TraceLine>
        </TraceCollapsibleTrigger>
        <TraceCollapsibleContent>
          <ToolCallDetails event={event} />
        </TraceCollapsibleContent>
      </TraceCollapsible>
    </Trace>
  );
}
