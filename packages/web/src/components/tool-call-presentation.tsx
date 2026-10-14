"use client";

import type { ReactNode } from "react";
import {
  BotIcon,
  CircleAlertIcon,
  CircleCheckIcon,
  CircleIcon,
  FileTextIcon,
  FilePlusIcon,
  FolderSearchIcon,
  GlobeIcon,
  ListTodoIcon,
  LoaderCircleIcon,
  PencilIcon,
  SearchIcon,
  SquareTerminalIcon,
  WrenchIcon,
} from "lucide-react";
import {
  CodeBlock,
  CodeBlockContent,
  CodeBlockCopyButton,
  CodeBlockHeader,
  CodeBlockLine,
  CodeBlockTitle,
  CodeBlockActions,
} from "@/components/ui/code-block";
import { Trace, TraceIcon, TraceLine, TraceTitle } from "@/components/ui/trace";
import { useHighlightedCode } from "@/hooks/use-highlighted-code";

/** Trace line status for a tool call's runtime status. */
export type TraceStatus = "running" | "error" | "pending" | undefined;

export function toolTraceStatus(status: string | undefined): TraceStatus {
  if (status === "running") return "running";
  if (status === "pending") return "pending";
  if (status === "error") return "error";
  return undefined;
}

/** Icon for a formatted tool call (see `formatToolCall().icon`). */
export function ToolIcon({ name, status }: { name: string | null; status?: TraceStatus }) {
  if (status === "running") return <LoaderCircleIcon className="animate-spin" />;
  if (status === "error") return <CircleAlertIcon />;

  switch (name) {
    case "file":
      return <FileTextIcon />;
    case "pencil":
      return <PencilIcon />;
    case "plus":
      return <FilePlusIcon />;
    case "terminal":
      return <SquareTerminalIcon />;
    case "search":
      return <SearchIcon />;
    case "folder":
      return <FolderSearchIcon />;
    case "box":
      return <BotIcon />;
    case "globe":
      return <GlobeIcon />;
    case "todo":
      return <ListTodoIcon />;
    default:
      return <WrenchIcon />;
  }
}

const EXTENSION_LANGUAGES: Record<string, string> = {
  css: "css",
  diff: "diff",
  html: "html",
  js: "javascript",
  cjs: "javascript",
  mjs: "javascript",
  json: "json",
  jsx: "jsx",
  md: "markdown",
  mdx: "markdown",
  py: "python",
  sh: "bash",
  sql: "sql",
  ts: "typescript",
  mts: "typescript",
  tsx: "tsx",
  yaml: "yaml",
  yml: "yaml",
};

/** Highlighter language for a file path, or "text" when it isn't one we load. */
export function languageForPath(path: string | null | undefined): string {
  const extension = path?.split(".").pop()?.toLowerCase();
  return (extension && EXTENSION_LANGUAGES[extension]) || "text";
}

/**
 * A small Code Block with syntax highlighting, used inside trace lines.
 * Lines highlight progressively, so streaming output stays cheap.
 */
export function HighlightedCodeBlock({
  code,
  language = "text",
  title,
  copyable = false,
  variant = "default",
  wrap = false,
  className = "max-h-64",
}: {
  code: string;
  language?: string;
  title?: ReactNode;
  copyable?: boolean;
  variant?: "default" | "destructive";
  /** Wrap long lines instead of scrolling horizontally, for prose. */
  wrap?: boolean;
  className?: string;
}) {
  const lines = useHighlightedCode(code, language);

  return (
    <CodeBlock size="sm" variant={variant}>
      {title ? (
        <CodeBlockHeader>
          <CodeBlockTitle>{title}</CodeBlockTitle>
          {copyable && (
            <CodeBlockActions>
              <CodeBlockCopyButton value={code} />
            </CodeBlockActions>
          )}
        </CodeBlockHeader>
      ) : (
        copyable && (
          <CodeBlockActions>
            <CodeBlockCopyButton value={code} />
          </CodeBlockActions>
        )
      )}
      <CodeBlockContent wrap={wrap} className={className}>
        {lines.map((line, index) => (
          <CodeBlockLine key={index}>{line}</CodeBlockLine>
        ))}
      </CodeBlockContent>
    </CodeBlock>
  );
}

type DiffLine = { variant: "added" | "removed" | "default"; text: string };

function diffLinesFromPatch(patch: string): DiffLine[] {
  return patch
    .replace(/\n$/, "")
    .split("\n")
    .map((line) => {
      if (line.startsWith("+") && !line.startsWith("+++")) {
        return { variant: "added", text: line.slice(1) };
      }
      if (line.startsWith("-") && !line.startsWith("---")) {
        return { variant: "removed", text: line.slice(1) };
      }
      return { variant: "default", text: line };
    });
}

function diffLinesFromReplacement(oldText: string, newText: string): DiffLine[] {
  const removed = oldText.replace(/\n$/, "").split("\n");
  const added = newText.replace(/\n$/, "").split("\n");
  return [
    ...removed.map((text): DiffLine => ({ variant: "removed", text })),
    ...added.map((text): DiffLine => ({ variant: "added", text })),
  ];
}

/** A diff as a Code Block: a unified patch, or an old/new string replacement. */
export function DiffCodeBlock(
  props: { title?: ReactNode } & ({ patch: string } | { oldText: string; newText: string })
) {
  const lines =
    "patch" in props
      ? diffLinesFromPatch(props.patch)
      : diffLinesFromReplacement(props.oldText, props.newText);

  return (
    <CodeBlock size="sm">
      {props.title && (
        <CodeBlockHeader>
          <CodeBlockTitle>{props.title}</CodeBlockTitle>
        </CodeBlockHeader>
      )}
      <CodeBlockContent className="max-h-64">
        {lines.map((line, index) => (
          <CodeBlockLine key={index} variant={line.variant}>
            {line.text}
          </CodeBlockLine>
        ))}
      </CodeBlockContent>
    </CodeBlock>
  );
}

export type TodoItem = { content: string; status: "pending" | "in_progress" | "completed" };

/** The agent's todo list, in the shape of the AI Elements Queue pattern. */
export function TodoTrace({ todos }: { todos: TodoItem[] }) {
  return (
    <Trace>
      {todos.map((todo, index) => (
        <TraceLine
          key={`${index}:${todo.content}`}
          status={todo.status === "in_progress" ? "running" : undefined}
          className={todo.status === "completed" ? "line-through decoration-border" : undefined}
        >
          <TraceIcon>
            {todo.status === "completed" ? (
              <CircleCheckIcon className="text-success" />
            ) : todo.status === "in_progress" ? (
              <LoaderCircleIcon className="animate-spin" />
            ) : (
              <CircleIcon />
            )}
          </TraceIcon>
          <TraceTitle>{todo.content}</TraceTitle>
        </TraceLine>
      ))}
    </Trace>
  );
}
