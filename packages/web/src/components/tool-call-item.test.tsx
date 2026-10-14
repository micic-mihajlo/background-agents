// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { SandboxEvent } from "@/types/session";
import { ToolCallItem } from "./tool-call-item";

afterEach(cleanup);

describe("ToolCallItem", () => {
  it("shows when tool-call arguments or output were truncated", () => {
    const event: Extract<SandboxEvent, { type: "tool_call" }> = {
      type: "tool_call",
      sandboxId: "sandbox-1",
      messageId: "message-1",
      callId: "call-1",
      tool: "Bash",
      args: { command: "partial" },
      timestamp: 1,
      truncated: { fields: ["args.command", "output"], originalBytes: 2_000_000 },
    };

    render(<ToolCallItem event={event} isExpanded onToggle={() => {}} />);

    expect(screen.getByRole("button", { name: /truncated/i })).toBeInTheDocument();
    expect(screen.getByText(/arguments and output were truncated/i)).toBeInTheDocument();
  });

  it("ellipsizes long collapsed summaries while retaining complete text", () => {
    const command = `PYTHONPATH=src uv run pytest ${"tests/very_long_directory/".repeat(4)}test_file.py`;
    const event: Extract<SandboxEvent, { type: "tool_call" }> = {
      type: "tool_call",
      sandboxId: "sandbox-1",
      messageId: "message-call-1",
      callId: "call-1",
      tool: "Bash",
      args: { command },
      timestamp: 1,
    };

    render(<ToolCallItem event={event} isExpanded={false} onToggle={() => {}} />);

    const button = screen.getByRole("button", { name: new RegExp(command) });
    expect(button).toHaveTextContent(command);
    expect(button.querySelector(".truncate")).toHaveTextContent(`Bash ${command}`);
    // The tool icon and the disclosure chevron are decorative.
    expect(button.querySelectorAll("svg").length).toBeGreaterThan(0);
    expect(
      [...button.querySelectorAll("[data-slot=trace-icon]")].every(
        (icon) => icon.getAttribute("aria-hidden") === "true"
      )
    ).toBe(true);
  });

  it("renders TodoWrite todos as a queue with long items truncated in place", () => {
    const content = `implement-${"unbroken-task-description".repeat(20)}`;
    const args = {
      todos: [{ content, status: "in_progress", priority: "high" }],
    };
    const event: Extract<SandboxEvent, { type: "tool_call" }> = {
      type: "tool_call",
      sandboxId: "sandbox-1",
      messageId: "message-call-2",
      callId: "call-2",
      tool: "TodoWrite",
      args,
      timestamp: 1,
    };

    render(<ToolCallItem event={event} isExpanded onToggle={() => {}} />);

    const todo = screen.getByText(content);
    expect(todo).toHaveClass("truncate");
    expect(todo.closest("[data-slot=trace-line]")).toHaveAttribute("data-status", "running");
  });

  it("keeps Apply Patch content preformatted and horizontally scrollable", () => {
    const patchText = `*** Begin Patch\n*** Update File: source.ts\n-${"old".repeat(80)}\n+${"new".repeat(80)}\n*** End Patch`;
    const event: Extract<SandboxEvent, { type: "tool_call" }> = {
      type: "tool_call",
      sandboxId: "sandbox-1",
      messageId: "message-call-3",
      callId: "call-3",
      tool: "apply_patch",
      args: { patchText },
      timestamp: 1,
    };

    render(<ToolCallItem event={event} isExpanded onToggle={() => {}} />);

    const patchBlock = screen.getByText("Patch").closest("[data-slot=code-block]");
    const patchPre = patchBlock?.querySelector("pre");
    const lines = [...(patchPre?.querySelectorAll("[data-slot=code-block-line]") ?? [])];
    expect(lines.map((line) => line.getAttribute("data-variant"))).toEqual([
      "default",
      "default",
      "removed",
      "added",
      "default",
    ]);
    expect(lines[2]).toHaveTextContent("old".repeat(80));
    expect(lines[3]).toHaveTextContent("new".repeat(80));
    // Long lines scroll horizontally instead of wrapping.
    expect(patchPre).toHaveClass("overflow-auto");
    expect(patchPre).not.toHaveAttribute("data-wrap");
  });

  it("keeps Bash output preformatted and horizontally scrollable", () => {
    const output = `COLUMN_A    COLUMN_B    ${"wide-terminal-value".repeat(20)}`;
    const event: Extract<SandboxEvent, { type: "tool_call" }> = {
      type: "tool_call",
      sandboxId: "sandbox-1",
      messageId: "message-call-4",
      callId: "call-4",
      tool: "Bash",
      args: { command: "print-table" },
      output,
      timestamp: 1,
    };

    render(<ToolCallItem event={event} isExpanded onToggle={() => {}} />);

    const outputPre = screen
      .getByText("Output")
      .closest("[data-slot=code-block]")
      ?.querySelector("pre");
    const lines = [...(outputPre?.querySelectorAll("[data-slot=code-block-line]") ?? [])];
    expect(lines.map((line) => line.textContent)).toEqual(["$ print-table", output]);
    expect(outputPre).toHaveClass("overflow-auto");
    expect(outputPre).not.toHaveAttribute("data-wrap");
  });

  it("uses the rich renderer for create-pull-request regardless of tool name casing", () => {
    const event: Extract<SandboxEvent, { type: "tool_call" }> = {
      type: "tool_call",
      sandboxId: "sandbox-1",
      messageId: "message-call-5",
      callId: "call-5",
      tool: "Create-Pull-Request",
      args: { title: "Improve the timeline", body: "A clearer pull request preview." },
      output:
        "Pull request created successfully!\n\nPR #42 (feature/timeline -> main): https://github.com/acme/web/pull/42\n\nThe pull request is now ready for review.",
      status: "completed",
      timestamp: 1,
    };

    render(<ToolCallItem event={event} isExpanded onToggle={() => {}} />);

    expect(screen.getByText("Opened pull request #42")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /open pr/i })).toHaveAttribute(
      "href",
      "https://github.com/acme/web/pull/42"
    );
  });

  it("does not derive a pull request result from truncated output", () => {
    const event: Extract<SandboxEvent, { type: "tool_call" }> = {
      type: "tool_call",
      sandboxId: "sandbox-1",
      messageId: "message-1",
      callId: "call-1",
      tool: "create-pull-request",
      args: {},
      output: "Pull request created successfully!\n\nPR #42: https://github.com/acme/web/pull/42",
      timestamp: 1,
      truncated: { fields: ["output"], originalBytes: 2_000_000 },
    };

    render(<ToolCallItem event={event} isExpanded onToggle={() => {}} />);

    expect(screen.queryByText("Opened pull request #42")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /truncated/i })).toBeInTheDocument();
    expect(screen.getByText("Output was truncated.")).toBeInTheDocument();
  });
});
