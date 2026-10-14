"use client";

import {
  CircleCheckIcon,
  CircleIcon,
  ListChecksIcon,
  ListTodoIcon,
  LoaderCircleIcon,
} from "lucide-react";
import type { Task } from "@/types/session";
import {
  Trace,
  TraceCollapsible,
  TraceCollapsibleContent,
  TraceCollapsibleTrigger,
  TraceIcon,
  TraceLine,
  TraceTitle,
} from "@/components/ui/trace";

interface TasksSectionProps {
  tasks: Task[];
}

/**
 * The agent's todo list, following the AI Elements Queue pattern: what is
 * left (open by default) and what is done, each as an expandable group.
 */
export function TasksSection({ tasks }: TasksSectionProps) {
  if (tasks.length === 0) return null;

  const remaining = tasks.filter((task) => task.status !== "completed");
  const completed = tasks.filter((task) => task.status === "completed");

  return (
    <Trace>
      {remaining.length > 0 && (
        <TraceCollapsible defaultOpen>
          <TraceCollapsibleTrigger>
            <TraceLine>
              <TraceIcon>
                <ListTodoIcon />
              </TraceIcon>
              <TraceTitle>{remaining.length} to do</TraceTitle>
            </TraceLine>
          </TraceCollapsibleTrigger>
          <TraceCollapsibleContent>
            <TaskList tasks={remaining} />
          </TraceCollapsibleContent>
        </TraceCollapsible>
      )}
      {completed.length > 0 && (
        <TraceCollapsible defaultOpen={remaining.length === 0}>
          <TraceCollapsibleTrigger>
            <TraceLine>
              <TraceIcon>
                <ListChecksIcon />
              </TraceIcon>
              <TraceTitle>{completed.length} completed</TraceTitle>
            </TraceLine>
          </TraceCollapsibleTrigger>
          <TraceCollapsibleContent>
            <TaskList tasks={completed} />
          </TraceCollapsibleContent>
        </TraceCollapsible>
      )}
    </Trace>
  );
}

function TaskList({ tasks }: { tasks: Task[] }) {
  return (
    <Trace>
      {tasks.map((task, index) => (
        <TraceLine
          key={`${task.content}-${index}`}
          status={task.status === "in_progress" ? "running" : undefined}
          className="items-start"
        >
          <TraceIcon className="mt-0.5">
            {task.status === "completed" ? (
              <CircleCheckIcon className="text-success" />
            ) : task.status === "in_progress" ? (
              <LoaderCircleIcon className="animate-spin text-accent" />
            ) : (
              <CircleIcon />
            )}
          </TraceIcon>
          <TraceTitle
            className={`whitespace-normal ${
              task.status === "completed"
                ? "text-secondary-foreground line-through decoration-secondary-foreground/60"
                : "text-foreground"
            }`}
          >
            {task.status === "in_progress" && task.activeForm ? task.activeForm : task.content}
          </TraceTitle>
        </TraceLine>
      ))}
    </Trace>
  );
}
