// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ToolCallEvent } from "@/lib/timeline-items";
import { TaskActivityItem } from "./task-activity-item";

afterEach(cleanup);

describe("TaskActivityItem", () => {
  it("marks a running subagent with a spinner and running status", () => {
    const event: ToolCallEvent = {
      type: "tool_call",
      sandboxId: "sandbox-1",
      messageId: "message-1",
      callId: "call-1",
      tool: "Task",
      args: {
        description: "Explore timeline rendering",
        subagent_type: "explore",
      },
      status: "running",
      timestamp: 1,
    };

    render(
      <TaskActivityItem
        event={event}
        hasActivity={false}
        expansionKey="task-1"
        expandedSections={new Set()}
        onToggleSection={vi.fn()}
      >
        {null}
      </TaskActivityItem>
    );

    const button = screen.getByRole("button", { name: /Task Explore timeline rendering/ });
    const line = button.querySelector("[data-slot=trace-line]");

    // A running subagent shows a spinner and the shimmering running status.
    expect(line).toHaveAttribute("data-status", "running");
    expect(button.querySelector(".animate-spin")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Task in progress");
  });
});
