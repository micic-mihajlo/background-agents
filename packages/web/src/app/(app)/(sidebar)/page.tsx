"use client";

import { useAuthSession } from "@/lib/auth-session";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { mutate } from "swr";
import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { CollapsedSidebarControls, useSidebarContext } from "@/components/sidebar-layout";
import { ErrorBanner } from "@/components/ui/error-banner";
import { Button } from "@/components/ui/button";
import { SessionAccessSelector } from "@/components/session-access-selector";
import { matchesShortcut } from "@/lib/keyboard-shortcuts";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { isUnarchivedSessionListKey } from "@/lib/session-list";
import { isSessionInboxKey } from "@/lib/session-inbox-api";
import { APP_NAME } from "@/lib/site-config";
import { AppIcon } from "@/components/ui/app-icon";
import { MAX_WEB_PROMPT_CHARS } from "@open-inspect/shared/types/websocket";
import {
  getSubscriptionProviderForModel,
  type ModelCategory,
  type ReasoningEffort,
  type ValidModel,
} from "@open-inspect/shared/models";
import type { HarnessId } from "@open-inspect/shared/harnesses";
import { useLaunchPreferences } from "@/hooks/use-launch-preferences";
import { useFirstPromptLaunch } from "@/hooks/use-first-prompt-launch";
import { firstPromptDelivery } from "@/lib/first-prompt-delivery";
import { useEnabledModels } from "@/hooks/use-enabled-models";
import { useAttachmentDropZone } from "@/hooks/use-attachment-drop-zone";
import {
  ATTACHMENT_ACCEPT,
  useSessionAttachments,
  type PendingAttachment,
} from "@/hooks/use-session-attachments";
import { AttachmentPreviewStrip } from "@/components/attachment-preview-strip";
import {
  useSessionTargetPicker,
  type SessionTargetPickerProps,
} from "@/hooks/use-session-target-picker";
import { SessionTargetPicker } from "@/components/session-target-picker";
import { ModelReasoningSelector } from "@/components/model-reasoning-selector";
import { PaperclipIcon, SendIcon } from "@/components/ui/icons";
import { SessionSkillSelector } from "@/components/session-skill-selector";
import { PromptSkillTextarea } from "@/components/prompt-skill-autocomplete";
import type { SessionSkillSelection } from "@open-inspect/shared/types/skills";
import {
  useSkillResolutionPreview,
  type SkillResolutionPreviewInput,
  type SkillResolutionPreviewResponse,
} from "@/hooks/use-managed-skills";
import type { SessionTargetRequestFields } from "@/lib/session-target";
import type { PromptSkillSuggestionSource } from "@/lib/prompt-skill-completion";
import type {
  ModelProviderSelections,
  ModelProviderAccount,
  ModelProviderAccountDefault,
  ProviderAuthSelection,
  SubscriptionProviderId,
} from "@open-inspect/shared/types/provider-accounts";
import { ProviderAuthControls } from "@/components/provider-auth-controls";
import { useProviderAccounts } from "@/hooks/use-provider-accounts";
import { useWarmDraftSession, type WarmDraftSessionRequest } from "@/hooks/use-warm-draft-session";
import { useCurrentUserAuthorization } from "@/hooks/use-current-user-authorization";
import { useActiveTeam } from "@/hooks/use-active-team";
import { usePromptDraft } from "@/hooks/use-prompt-draft";
import { NEW_SESSION_PROMPT_DRAFT_ID } from "@/lib/prompt-drafts";
import type { SessionVisibility } from "@open-inspect/shared/types/teams";
import {
  parseStoredComposerAccess,
  resolveComposerAccess,
  type ComposerAccessDraft,
} from "@/lib/composer-access";
import { buildInteractiveProviderRoutingIdentity } from "@/lib/provider-selection";
import type { TeamResponse } from "@/hooks/use-teams";

const LAST_SESSION_ACCESS_STORAGE_KEY = "open-inspect-last-session-access";

function skillPreviewTarget(
  fields: SessionTargetRequestFields | null
): Omit<SkillResolutionPreviewInput, "selection"> | null {
  if (!fields) return null;
  if ("environmentId" in fields) return { environmentId: fields.environmentId };
  if ("repositories" in fields) {
    return {
      repositories: fields.repositories.map((repository) => ({
        ...repository,
        baseBranch: null,
      })),
    };
  }
  return fields.repoOwner && fields.repoName
    ? { repoOwner: fields.repoOwner, repoName: fields.repoName }
    : {};
}

/** One-click starters, following the AI Elements Suggestion pattern. They fill the prompt. */
const PROMPT_SUGGESTIONS = [
  "Fix the failing tests",
  "Find and fix a bug in recent commits",
  "Add tests for untested code",
  "Update outdated dependencies",
  "Explain how this codebase is structured",
];

export default function Home() {
  const { data: session } = useAuthSession();
  const { hasPermission } = useCurrentUserAuthorization();
  const canCreateSession = hasPermission("sessions.create");
  const router = useRouter();
  const teamContext = useActiveTeam();
  const { teams, requireTeamOnCreate, loading: loadingTeams, error: teamError } = teamContext;
  const [accessDraft, setAccessDraft] = useState<ComposerAccessDraft | null>(null);
  const { contextKey, teamId, visibility } = resolveComposerAccess(teamContext, accessDraft);
  const selectedTeam = teams.find((team) => team.id === teamId);
  const teamCreationReady =
    !loadingTeams && !teamError && (teamId === null ? !requireTeamOnCreate : !!selectedTeam);
  const picker = useSessionTargetPicker({
    teamId,
    defaultEnvironmentId: selectedTeam?.defaultEnvironmentId,
  });
  const { sessionTarget, buildRequestFields, isLaunchable } = picker;

  const accessStorageKey = session ? `${LAST_SESSION_ACCESS_STORAGE_KEY}:${session.user.id}` : null;
  const accessContextReady = !teamContext.loading && !teamContext.error;

  // Restore the user's last composer team/audience; it only applies while its sidebar context matches.
  useEffect(() => {
    let stored: ComposerAccessDraft | null = null;
    try {
      stored = accessStorageKey
        ? parseStoredComposerAccess(localStorage.getItem(accessStorageKey))
        : null;
    } catch {
      // Storage is optional; the composer falls back to the sidebar team defaults.
    }
    setAccessDraft(stored);
  }, [accessStorageKey]);

  const saveAccessDraft = useCallback(
    (draft: ComposerAccessDraft) => {
      setAccessDraft(draft);
      if (!accessStorageKey) return;
      try {
        localStorage.setItem(accessStorageKey, JSON.stringify(draft));
      } catch {
        // Continue with the in-memory selection when storage is unavailable.
      }
    },
    [accessStorageKey]
  );

  // Composer context changes preserve the audience; sidebar changes use team defaults.
  useEffect(() => {
    if (teamContext.loading || teamContext.error) return;
    setAccessDraft((draft) => (draft ? resolveComposerAccess(teamContext, draft) : null));
  }, [teamContext]);

  // Sidebar changes discard the draft, so drop the saved one too rather than reviving it on reload.
  useEffect(() => {
    if (!accessContextReady || !accessStorageKey) return;
    try {
      const stored = parseStoredComposerAccess(localStorage.getItem(accessStorageKey));
      if (stored && stored.contextKey !== contextKey) localStorage.removeItem(accessStorageKey);
    } catch {
      // Storage is optional.
    }
  }, [accessContextReady, accessStorageKey, contextKey]);
  const { prompt, setPrompt, clearSubmittedPrompt } = usePromptDraft(NEW_SESSION_PROMPT_DRAFT_ID);
  const [warmRequested, setWarmRequested] = useState(false);
  const [skillSelection, setSkillSelection] = useState<SessionSkillSelection>({ mode: "all" });
  const providerAccounts = useProviderAccounts();
  const sessionAttachments = useSessionAttachments();
  const models = useEnabledModels();
  const preferences = useLaunchPreferences({ models, providerAccounts });
  const { selectedModel, reasoningEffort, harness, providerSelections } = preferences;
  const targetRequestFields = buildRequestFields();
  const currentSkillPreviewTarget = session ? skillPreviewTarget(targetRequestFields) : null;
  const {
    preview: skillPreview,
    loading: skillPreviewLoading,
    suggestions: skillSuggestions,
  } = useSkillResolutionPreview(currentSkillPreviewTarget, skillSelection);

  const launchContextReady = canCreateSession && teamCreationReady && preferences.providerReady;
  const warmRequest: WarmDraftSessionRequest | null =
    launchContextReady && session && preferences.ready && targetRequestFields
      ? {
          ...targetRequestFields,
          harness,
          model: selectedModel,
          reasoningEffort,
          skillSelection,
          providerSelections,
          teamId,
          visibility,
        }
      : null;
  const warmRoutingIdentity = buildInteractiveProviderRoutingIdentity(
    providerSelections,
    providerAccounts.defaults,
    providerAccounts.accounts
  );
  const warmSession = useWarmDraftSession(warmRequest, warmRoutingIdentity);
  const {
    identity: warmIdentity,
    warm: createSessionForWarming,
    error: creationError,
  } = warmSession;

  useEffect(() => {
    if (!warmRequested || !warmIdentity) return;
    setWarmRequested(false);
    void createSessionForWarming();
  }, [warmRequested, warmIdentity, createSessionForWarming]);

  const hasAttachments = sessionAttachments.attachments.length > 0;
  const launch = useFirstPromptLaunch(
    {
      prompt,
      model: selectedModel,
      reasoningEffort,
      hasAttachments,
      blocked:
        !launchContextReady ||
        !!creationError?.terminal ||
        sessionAttachments.isUploading ||
        models.loading,
      validationError:
        preferences.modelAvailability.status === "unavailable"
          ? preferences.modelAvailability.message
          : !isLaunchable
            ? sessionTarget?.kind === "repos"
              ? "Select at least one repository"
              : "Please select a repository or environment"
            : null,
    },
    {
      sessions: warmSession,
      attachments: sessionAttachments,
      delivery: firstPromptDelivery,
      completion: {
        launched(sessionId, submittedPrompt) {
          clearSubmittedPrompt(submittedPrompt);
          sessionAttachments.clearAttachments();
          mutate(isUnarchivedSessionListKey);
          mutate(isSessionInboxKey);
          router.push(`/session/${sessionId}`);
        },
        denied: toast.error,
      },
    }
  );

  // Unlike warming, Send remains available for model/terminal feedback. Submission
  // still guards loading and terminal failures, including keyboard shortcuts.
  const sendDisabled =
    (!prompt.trim() && !hasAttachments) ||
    launch.submitting ||
    sessionAttachments.isUploading ||
    !launchContextReady ||
    !isLaunchable;

  return (
    <HomeContent
      isAuthenticated={!!session}
      canCreateSession={canCreateSession}
      picker={picker.pickerProps}
      targetKind={sessionTarget?.kind}
      access={{
        teams,
        requireTeamOnCreate,
        loading: loadingTeams,
        failed: !!teamError,
        ready: teamCreationReady,
      }}
      teamId={teamId}
      visibility={visibility}
      onTeamChange={(teamId) => {
        saveAccessDraft({ contextKey, teamId, visibility });
      }}
      onVisibilityChange={(value) => {
        if (teamId !== null || value !== "team")
          saveAccessDraft({
            contextKey,
            teamId,
            visibility: value,
          });
      }}
      selectedModel={selectedModel}
      setSelectedModel={preferences.handleModelChange}
      reasoningEffort={reasoningEffort}
      setReasoningEffort={preferences.handleReasoningEffortChange}
      harness={harness}
      setHarness={preferences.handleHarnessChange}
      prompt={prompt}
      handlePromptChange={(value) => {
        setPrompt(value);
        setWarmRequested(value.length > 0);
      }}
      attachments={{
        items: sessionAttachments.attachments,
        error: sessionAttachments.attachmentError,
        isUploading: sessionAttachments.isUploading,
        onAdd: sessionAttachments.addFiles,
        onRemove: sessionAttachments.removeAttachment,
      }}
      launch={{
        submitting: launch.submitting,
        warming: warmSession.isWarming,
        sendDisabled,
        error: creationError?.message ?? launch.error,
        onSubmit: (event) => {
          event.preventDefault();
          void launch.submit();
        },
      }}
      modelOptions={preferences.modelOptions}
      skillSelection={skillSelection}
      setSkillSelection={setSkillSelection}
      skillPreviewTarget={currentSkillPreviewTarget}
      skillPreview={skillPreview}
      skillPreviewLoading={skillPreviewLoading}
      skillSuggestions={skillSuggestions}
      providerSelections={providerSelections}
      onProviderSelectionChange={preferences.handleProviderSelectionChange}
      providerAccounts={{
        accounts: providerAccounts.accounts,
        defaults: providerAccounts.defaults,
      }}
    />
  );
}

function HomeContent({
  isAuthenticated,
  canCreateSession,
  picker,
  targetKind,
  access,
  teamId,
  visibility,
  onTeamChange,
  onVisibilityChange,
  selectedModel,
  setSelectedModel,
  reasoningEffort,
  setReasoningEffort,
  harness,
  setHarness,
  prompt,
  handlePromptChange,
  attachments,
  launch,
  modelOptions,
  skillSelection,
  setSkillSelection,
  skillPreviewTarget,
  skillPreview,
  skillPreviewLoading,
  skillSuggestions,
  providerSelections,
  onProviderSelectionChange,
  providerAccounts,
}: {
  isAuthenticated: boolean;
  canCreateSession: boolean;
  picker: SessionTargetPickerProps;
  targetKind: NonNullable<SessionTargetPickerProps["sessionTarget"]>["kind"] | undefined;
  access: {
    teams: TeamResponse[];
    requireTeamOnCreate: boolean;
    loading: boolean;
    failed: boolean;
    ready: boolean;
  };
  teamId: string | null;
  visibility: SessionVisibility;
  onTeamChange: (teamId: string | null) => void;
  onVisibilityChange: (value: SessionVisibility) => void;
  selectedModel: ValidModel;
  setSelectedModel: (value: ValidModel) => void;
  reasoningEffort: ReasoningEffort | undefined;
  setReasoningEffort: (value: ReasoningEffort | undefined) => void;
  harness: HarnessId;
  setHarness: (value: HarnessId) => void;
  prompt: string;
  handlePromptChange: (value: string) => void;
  attachments: {
    items: PendingAttachment[];
    error: string | null;
    isUploading: boolean;
    onAdd: (files: Iterable<File>) => void;
    onRemove: (id: string) => void;
  };
  launch: {
    submitting: boolean;
    warming: boolean;
    sendDisabled: boolean;
    error: string;
    onSubmit: (event: React.FormEvent) => void;
  };
  modelOptions: ModelCategory[];
  skillSelection: SessionSkillSelection;
  setSkillSelection: (value: SessionSkillSelection) => void;
  skillPreviewTarget: Omit<SkillResolutionPreviewInput, "selection"> | null;
  skillPreview: SkillResolutionPreviewResponse | null;
  skillPreviewLoading: boolean;
  skillSuggestions: PromptSkillSuggestionSource;
  providerSelections: ModelProviderSelections;
  onProviderSelectionChange: (
    provider: SubscriptionProviderId,
    selection: ProviderAuthSelection | undefined
  ) => void;
  providerAccounts: { accounts: ModelProviderAccount[]; defaults: ModelProviderAccountDefault[] };
}) {
  const { isOpen } = useSidebarContext();
  const { shortcuts, labels } = useKeyboardShortcuts();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const {
    submitting: creating,
    warming: isCreatingSession,
    error,
    onSubmit: handleSubmit,
  } = launch;
  const attachmentsLocked = creating || attachments.isUploading;
  const {
    isDraggingOver,
    handleFileInputChange,
    handlePaste,
    handleDrop,
    handleDragOver,
    handleDragLeave,
  } = useAttachmentDropZone({ locked: attachmentsLocked, onAdd: attachments.onAdd });
  const { repos, loadingRepos } = picker;
  const selectedProvider = getSubscriptionProviderForModel(selectedModel);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.nativeEvent.isComposing) return;

    if (matchesShortcut(e.nativeEvent, shortcuts["send-prompt"])) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header with toggle when sidebar is closed */}
      {!isOpen && (
        <header className="border-b border-border-muted shrink-0">
          <div className="px-4 py-3">
            <CollapsedSidebarControls />
          </div>
        </header>
      )}

      <div className="flex-1 flex flex-col items-center justify-center overflow-y-auto px-4 py-8 sm:px-8">
        <div className="w-full max-w-176 mt-[-8vh]">
          {/* Welcome text */}
          <div className="text-center mb-7">
            <div className="mx-auto mb-5 flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-accent-foreground shadow-xs ring-1 ring-inset ring-black/10">
              <AppIcon className="h-5 w-5" />
            </div>
            <h1 className="text-[28px] font-semibold tracking-[-0.02em] text-foreground mb-1.5">
              What should we build?
            </h1>
            <p className="sr-only">Welcome to {APP_NAME}</p>
            {isAuthenticated && canCreateSession ? (
              <p className="text-sm text-muted-foreground">
                Ask a question or describe what you want to build
              </p>
            ) : isAuthenticated ? (
              <p className="text-sm text-muted-foreground">
                You don&apos;t have permission to create sessions.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">Sign in to start a new session</p>
            )}
          </div>

          {/* Input box - only show when authenticated */}
          {isAuthenticated && canCreateSession && (
            <form onSubmit={handleSubmit}>
              {error && <ErrorBanner className="mb-4">{error}</ErrorBanner>}
              {access.failed ? (
                <ErrorBanner className="mb-4">
                  Unable to load team memberships and settings.
                </ErrorBanner>
              ) : !access.loading && access.requireTeamOnCreate && access.teams.length === 0 ? (
                <p role="status" className="mb-4 text-sm text-muted-foreground">
                  Join a team to create a session.
                </p>
              ) : null}

              <div className="mb-2.5 flex flex-wrap items-center gap-1.5">
                <SessionTargetPicker {...picker} disabled={creating} />
              </div>

              <div
                className={`relative rounded-xl border border-border bg-card shadow-card transition focus-within:border-foreground/20 focus-within:shadow-overlay ${isDraggingOver ? "ring-2 ring-accent" : ""}`}
                onPaste={handlePaste}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
              >
                <AttachmentPreviewStrip
                  items={attachments.items}
                  error={attachments.error}
                  onRemove={attachments.onRemove}
                  disabled={attachmentsLocked}
                />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ATTACHMENT_ACCEPT}
                  multiple
                  className="hidden"
                  onChange={handleFileInputChange}
                />
                {/* Text input area */}
                <PromptSkillTextarea
                  ref={inputRef}
                  value={prompt}
                  suggestions={skillSuggestions}
                  onValueChange={handlePromptChange}
                  onKeyDown={handleKeyDown}
                  maxLength={MAX_WEB_PROMPT_CHARS}
                  disabled={creating}
                  placeholder="What do you want to build?"
                  autoFocus
                  autoComplete="off"
                  className="block w-full min-h-[96px] resize-none bg-transparent px-4 pt-3.5 pb-2 text-[15px] leading-6 text-foreground placeholder:text-secondary-foreground focus:outline-hidden disabled:opacity-50"
                  rows={3}
                />

                {/* Agent configuration stays inside the composer. */}
                <div className="flex items-end gap-2 px-2 pb-2">
                  <div className="flex min-w-0 flex-1 flex-wrap items-center gap-0.5">
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
                      selectedModel={selectedModel}
                      reasoningEffort={reasoningEffort}
                      items={modelOptions}
                      onModelChange={setSelectedModel}
                      onReasoningEffortChange={setReasoningEffort}
                      harness={harness}
                      onHarnessChange={setHarness}
                      disabled={creating}
                    />

                    <SessionSkillSelector
                      value={skillSelection}
                      onChange={setSkillSelection}
                      target={skillPreviewTarget}
                      preview={skillPreview}
                      previewLoading={skillPreviewLoading}
                      disabled={creating}
                    />

                    {selectedProvider && (
                      <ProviderAuthControls
                        harness={harness}
                        variant="menu"
                        provider={selectedProvider}
                        accounts={providerAccounts.accounts}
                        defaultValue={providerAccounts.defaults.find(
                          (item) => item.provider === selectedProvider
                        )}
                        value={providerSelections[selectedProvider]}
                        disabled={creating}
                        onChange={(selection) =>
                          onProviderSelectionChange(selectedProvider, selection)
                        }
                      />
                    )}
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    {isCreatingSession && (
                      <span className="whitespace-nowrap text-xs text-muted-foreground">
                        Warming sandbox...
                      </span>
                    )}
                    <button
                      type="submit"
                      disabled={launch.sendDisabled}
                      className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-accent-foreground shadow-xs ring-1 ring-inset ring-black/10 transition-[background-color,box-shadow,transform] duration-150 ease-out-strong hover:bg-accent/90 active:scale-[0.94] disabled:cursor-not-allowed disabled:bg-muted disabled:text-secondary-foreground disabled:shadow-none disabled:ring-0"
                      title={`Send (${labels["send-prompt"]})`}
                      aria-label={`Send (${labels["send-prompt"]})`}
                    >
                      {creating ? (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      ) : (
                        <SendIcon className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {!prompt && (
                <div
                  aria-label="Suggested prompts"
                  className="mt-3 flex scroll-fade-x no-scrollbar gap-2 overflow-x-auto overscroll-x-contain"
                >
                  {PROMPT_SUGGESTIONS.map((suggestion) => (
                    <Button
                      key={suggestion}
                      type="button"
                      variant="outline"
                      size="sm"
                      className="shrink-0 rounded-full font-normal text-muted-foreground"
                      disabled={creating}
                      onClick={() => {
                        handlePromptChange(suggestion);
                        inputRef.current?.focus();
                      }}
                    >
                      {suggestion}
                    </Button>
                  ))}
                </div>
              )}

              <SessionAccessSelector
                teamId={teamId}
                teams={access.teams}
                visibility={visibility}
                onTeamChange={onTeamChange}
                onVisibilityChange={onVisibilityChange}
                requireTeamOnCreate={access.requireTeamOnCreate}
                disabled={creating || access.loading || access.failed}
                visibilityDisabled={!access.ready}
              />

              {/* Secrets disclosure per session target (design §7.4) */}
              {targetKind === "environment" && (
                <p className="mt-3 text-xs text-secondary-foreground text-center">
                  Sessions from this environment use global secrets plus the environment&apos;s
                  secrets.
                </p>
              )}
              {targetKind === "repos" && (
                <p className="mt-3 text-xs text-secondary-foreground text-center">
                  Ad-hoc sessions use global secrets plus the selected repositories&apos; secrets,
                  and don&apos;t get prebuilt images —{" "}
                  <Link href="/settings?tab=environments" className="text-accent hover:underline">
                    save this set as an environment
                  </Link>
                  .
                </p>
              )}

              {repos.length === 0 && !loadingRepos && (
                <p className="mt-3 text-sm text-muted-foreground text-center">
                  No repositories found. You can start without a repository or grant repository
                  access in settings.
                </p>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
