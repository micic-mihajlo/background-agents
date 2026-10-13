"use client";

import { useLayoutEffect, useRef } from "react";
import { PromptSkillTextarea } from "@/components/prompt-skill-autocomplete";
import { ActionBar } from "@/components/action-bar";
import { AttachmentPreviewStrip } from "@/components/attachment-preview-strip";
import { ModelReasoningSelector } from "@/components/model-reasoning-selector";
import { PaperclipIcon, SendIcon, StopIcon } from "@/components/ui/icons";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { useAttachmentDropZone } from "@/hooks/use-attachment-drop-zone";
import { ATTACHMENT_ACCEPT, type PendingAttachment } from "@/hooks/use-session-attachments";
import type { Artifact } from "@/types/session";
import { isSessionPromptable } from "@open-inspect/shared/types/session-activity";
import type { SessionStatus } from "@open-inspect/shared/types/sessions";
import { MAX_WEB_PROMPT_CHARS } from "@open-inspect/shared/types/websocket";
import type { PromptSkillSuggestionSource } from "@/lib/prompt-skill-completion";
import type { ModelCategory, ReasoningEffort, ValidModel } from "@open-inspect/shared/models";
import type { SessionCapabilities } from "@/lib/session-capabilities";
import type { HarnessId } from "@open-inspect/shared/harnesses";

type SessionPromptComposerProps = {
  session: {
    id: string;
    status: SessionStatus;
    artifacts: Artifact[];
    primaryRepo?: { repoOwner: string; repoName: string } | null;
    onArchive: () => void | Promise<void>;
    onUnarchive: () => void | Promise<void>;
    capabilities: SessionCapabilities;
    /** Agent harness the session runs on; fixed at create. */
    harness: HarnessId;
  };
  prompt: {
    value: string;
    isProcessing: boolean;
    draftLocked: boolean;
    sendBlocked: boolean;
    blockedReason?: string;
    submitError: string | null;
    inputRef: React.RefObject<HTMLTextAreaElement | null>;
    onSubmit: (e: React.FormEvent) => void;
    onValueChange: (value: string) => void;
    onKeyDown: (e: React.KeyboardEvent) => void;
    onStopExecution: () => void;
  };
  skillSuggestions: PromptSkillSuggestionSource;
  attachments: {
    items: PendingAttachment[];
    error: string | null;
    isUploading: boolean;
    onAdd: (files: Iterable<File>) => void;
    onRemove: (id: string) => void;
  };
  model: {
    selectedModel: ValidModel;
    reasoningEffort: ReasoningEffort | undefined;
    items: ModelCategory[];
    onModelChange: (model: ValidModel) => void;
    onReasoningEffortChange: (value: ReasoningEffort | undefined) => void;
  };
};

export function SessionPromptComposer({
  session,
  prompt,
  skillSuggestions,
  attachments,
  model,
}: SessionPromptComposerProps) {
  const { labels } = useKeyboardShortcuts();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hasContent = prompt.value.trim().length > 0 || attachments.items.length > 0;
  const sessionPromptable = isSessionPromptable(session.status);
  const sendDisabled =
    !hasContent || prompt.draftLocked || prompt.sendBlocked || !sessionPromptable;
  // Keep the complete draft stable while its attachments upload and until
  // the server confirms that the matching prompt was queued.
  const attachmentsLocked = prompt.draftLocked;
  const {
    isDraggingOver,
    handleFileInputChange,
    handlePaste,
    handleDrop,
    handleDragOver,
    handleDragLeave,
  } = useAttachmentDropZone({ locked: attachmentsLocked, onAdd: attachments.onAdd });

  useLayoutEffect(() => {
    const input = prompt.inputRef.current;
    if (!input) return;

    const resizeInput = () => {
      input.style.height = "auto";
      input.style.height = `${input.scrollHeight}px`;
    };

    resizeInput();
    window.addEventListener("resize", resizeInput);
    return () => window.removeEventListener("resize", resizeInput);
  }, [prompt.inputRef, prompt.value]);

  return (
    <footer className="min-w-0 flex-shrink-0">
      <form onSubmit={prompt.onSubmit} className="w-full min-w-0 max-w-3xl mx-auto px-4 pt-2 pb-4">
        {/* Action bar above input */}
        <div className="hidden mb-3 md:block">
          <ActionBar
            sessionId={session.id}
            sessionStatus={session.status}
            artifacts={session.artifacts}
            primaryRepo={session.primaryRepo}
            onArchive={session.onArchive}
            onUnarchive={session.onUnarchive}
            capabilities={session.capabilities}
          />
        </div>

        {/* Input container */}
        <div
          className={`relative overflow-hidden rounded-xl border bg-card shadow-card transition focus-within:border-foreground/20 focus-within:shadow-overlay ${
            isDraggingOver ? "border-accent" : "border-border"
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {/* Pending attachment previews */}
          <AttachmentPreviewStrip
            items={attachments.items}
            error={attachments.error}
            onRemove={attachments.onRemove}
            disabled={attachmentsLocked}
          />

          <PromptSkillTextarea
            ref={prompt.inputRef}
            value={prompt.value}
            suggestions={skillSuggestions}
            onValueChange={prompt.onValueChange}
            onKeyDown={prompt.onKeyDown}
            maxLength={MAX_WEB_PROMPT_CHARS}
            disabled={prompt.draftLocked}
            onPaste={handlePaste}
            autoComplete="off"
            placeholder={prompt.isProcessing ? "Add a follow-up..." : "Ask or build anything"}
            className="block min-h-12 max-h-40 w-full resize-none overflow-y-auto bg-transparent px-4 pt-3 pb-1 leading-6 text-foreground placeholder:text-secondary-foreground focus:outline-none sm:min-h-[4.5rem]"
            rows={1}
          />

          {/* Toolbar: agent/model control on the left, send controls on the right */}
          <div className="flex items-center gap-2 px-2 pb-2">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-0.5">
              <input
                ref={fileInputRef}
                type="file"
                accept={ATTACHMENT_ACCEPT}
                multiple
                className="hidden"
                onChange={handleFileInputChange}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={attachmentsLocked}
                className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-[color,background-color,transform] duration-150 ease-out-strong hover:bg-muted hover:text-foreground active:scale-[0.94] disabled:cursor-not-allowed disabled:opacity-30"
                title="Attach images"
                aria-label="Attach images"
              >
                <PaperclipIcon className="h-4 w-4" />
              </button>
              <ModelReasoningSelector
                selectedModel={model.selectedModel}
                reasoningEffort={model.reasoningEffort}
                items={model.items}
                onModelChange={model.onModelChange}
                onReasoningEffortChange={model.onReasoningEffortChange}
                harness={session.harness}
                disabled={prompt.draftLocked || !sessionPromptable}
              />
            </div>

            <div data-testid="prompt-actions" className="flex shrink-0 items-center gap-1.5">
              {attachments.isUploading && (
                <span className="whitespace-nowrap text-xs text-muted-foreground">Uploading…</span>
              )}
              {prompt.isProcessing && session.capabilities.lifecycle && (
                <button
                  type="button"
                  onClick={prompt.onStopExecution}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-foreground shadow-card transition-[background-color,transform] duration-150 ease-out-strong hover:bg-muted active:scale-[0.94]"
                  title="Stop current prompt; queued prompts will continue"
                  aria-label="Stop current prompt; queued prompts will continue"
                >
                  <StopIcon className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                type="submit"
                disabled={sendDisabled}
                className="flex h-8 min-w-8 items-center justify-center gap-1 rounded-lg bg-accent px-2 text-accent-foreground shadow-sm ring-1 ring-inset ring-black/10 transition-[background-color,box-shadow,transform] duration-150 ease-out-strong hover:bg-accent/90 active:scale-[0.94] disabled:cursor-not-allowed disabled:bg-muted disabled:text-secondary-foreground disabled:shadow-none disabled:ring-0"
                title={
                  prompt.isProcessing
                    ? "Queue follow-up; runs after the current prompt"
                    : `Send (${labels["send-prompt"]})`
                }
                aria-label={
                  prompt.isProcessing
                    ? "Queue follow-up; runs after the current prompt"
                    : `Send (${labels["send-prompt"]})`
                }
              >
                {prompt.isProcessing && <span className="pl-0.5 text-xs font-medium">Queue</span>}
                <SendIcon className="h-4 w-4" />
              </button>
            </div>
          </div>

          {prompt.submitError && (
            <p
              role="alert"
              className="border-t border-destructive-border px-4 py-2 text-sm text-destructive"
            >
              {prompt.submitError}
            </p>
          )}
          {prompt.blockedReason && (
            <p className="border-t border-warning/30 bg-warning/5 px-4 py-2 text-sm text-warning">
              {prompt.blockedReason}
            </p>
          )}
        </div>
      </form>
    </footer>
  );
}
