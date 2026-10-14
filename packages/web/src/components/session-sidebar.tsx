"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useCallback, useEffect, useState } from "react";
import { useAuthSession } from "@/lib/auth-session";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { useIsMobile } from "@/hooks/use-media-query";
import { useSidebarSessions } from "@/hooks/use-sidebar-sessions";
import type { SessionItem } from "@/hooks/use-sidebar-sessions";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  SidebarIcon,
  PlusIcon,
  SearchIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ArchiveIcon,
} from "@/components/ui/icons";
import { AppIcon } from "@/components/ui/app-icon";
import { APP_NAME } from "@/lib/site-config";
import { PRIMARY_APP_DESTINATIONS, SETTINGS_DESTINATION } from "@/components/app-destinations";
import { Button } from "@/components/ui/button";
import { useEnvironments } from "@/hooks/use-environments";
import { SessionWithChildren } from "@/components/session-with-children";
import { UserMenu } from "@/components/sidebar-user-menu";
import { useCurrentUserAuthorization } from "@/hooks/use-current-user-authorization";
import { buildSessionsHref } from "@/lib/session-discovery";
import { useActiveTeam } from "@/hooks/use-active-team";
import { TeamSwitcher } from "./team-switcher";

export type { SessionItem } from "@/hooks/use-sidebar-sessions";
/** Archived work is discovered on the Sessions page; unarchiving stays in Settings. */
type SessionGroupId = "needs-attention" | "in-progress" | "recent";

const DEFAULT_SESSION_GROUP_EXPANDED_STATE: Record<SessionGroupId, boolean> = {
  "needs-attention": true,
  "in-progress": true,
  recent: true,
};
const SESSION_GROUP_EXPANDED_STORAGE_KEY_PREFIX = "open-inspect-session-sidebar-expanded:";

const NAV_ITEM_CLASS =
  "flex h-8 w-full items-center gap-2.5 rounded-md px-2 text-[13px] font-medium transition-[color,background-color,box-shadow,transform] duration-150 ease-out-strong active:scale-[0.98]";
const NAV_ITEM_ACTIVE_CLASS = "bg-card text-foreground shadow-card";
const NAV_ITEM_IDLE_CLASS = "text-muted-foreground hover:bg-muted hover:text-foreground";

interface SidebarActionButtonProps {
  onClick?: () => void;
}

export function SearchSessionsButton({ onClick }: SidebarActionButtonProps) {
  const { labels } = useKeyboardShortcuts();
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={onClick}
      title={`Quick search recent sessions (${labels["open-command-menu"]})`}
      aria-label={`Quick search recent sessions (${labels["open-command-menu"]})`}
    >
      <SearchIcon className="w-4 h-4" />
    </Button>
  );
}

function SidebarSearchField({ onClick }: SidebarActionButtonProps) {
  const { labels } = useKeyboardShortcuts();
  return (
    <button
      type="button"
      onClick={onClick}
      title={`Quick search recent sessions (${labels["open-command-menu"]})`}
      aria-label={`Quick search recent sessions (${labels["open-command-menu"]})`}
      className="flex h-8 w-full items-center gap-2 rounded-md border border-border-muted bg-card px-2.5 text-left text-[13px] text-secondary-foreground shadow-card transition-[color,border-color,transform] duration-150 ease-out-strong hover:border-border hover:text-muted-foreground active:scale-[0.98]"
    >
      <SearchIcon className="h-3.5 w-3.5 shrink-0" />
      <span className="flex-1">Search</span>
      <kbd className="rounded-sm bg-muted px-1.5 py-px font-sans text-[11px] font-medium text-muted-foreground">
        {labels["open-command-menu"]}
      </kbd>
    </button>
  );
}

export function NewSessionButton({ onClick }: SidebarActionButtonProps) {
  const { labels } = useKeyboardShortcuts();
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={onClick}
      title={`New session (${labels["new-session"]})`}
      aria-label={`New session (${labels["new-session"]})`}
    >
      <PlusIcon className="w-4 h-4" />
    </Button>
  );
}

interface SessionSidebarProps {
  onNewSession?: () => void;
  onSearchSessions?: () => void;
  onToggle?: () => void;
  onSessionSelect?: () => void;
}

/**
 * Renders navigation and session groups, preserving each group's expanded state across visits.
 */
export function SessionSidebar({
  onNewSession,
  onSearchSessions,
  onToggle,
  onSessionSelect,
}: SessionSidebarProps) {
  const { labels } = useKeyboardShortcuts();
  const { data: authSession } = useAuthSession();
  const { hasPermission } = useCurrentUserAuthorization();
  const { activeTeamId, scope } = useActiveTeam();
  const teamQuery = { teamIds: activeTeamId ? [activeTeamId] : undefined, scope };
  const pathname = usePathname();
  const router = useRouter();
  const isMobile = useIsMobile();

  const currentSessionId = pathname?.startsWith("/session/") ? pathname.split("/")[2] : null;
  const [expandedGroups, setExpandedGroups] = useState(DEFAULT_SESSION_GROUP_EXPANDED_STATE);

  useEffect(() => {
    try {
      setExpandedGroups({
        "needs-attention":
          localStorage.getItem(`${SESSION_GROUP_EXPANDED_STORAGE_KEY_PREFIX}needs-attention`) !==
          "false",
        "in-progress":
          localStorage.getItem(`${SESSION_GROUP_EXPANDED_STORAGE_KEY_PREFIX}in-progress`) !==
          "false",
        recent:
          localStorage.getItem(`${SESSION_GROUP_EXPANDED_STORAGE_KEY_PREFIX}recent`) !== "false",
      });
    } catch {
      // Storage is optional; all groups stay expanded when unavailable.
    }
  }, []);

  const {
    needsAttention,
    inProgress,
    finished,
    childrenMap,
    loading,
    sessionsError,
    refreshSnapshot,
    sectionPagination,
    sessionCreatorFilter,
    setSessionCreatorFilter,
    handleSessionArchived,
    handleMarkLatestMessageRead,
  } = useSidebarSessions();

  // Archiving the session on screen leaves nothing to show, so fall back to the home page.
  const handleArchivedSession = useCallback(
    async (sessionId: string) => {
      await handleSessionArchived(sessionId);
      if (currentSessionId === sessionId) {
        router.push("/");
      }
    },
    [currentSessionId, handleSessionArchived, router]
  );

  // Environment provenance for the cards, resolved once for the whole list.
  // Names are looked up so a deleted environment (or one still loading)
  // simply drops the chip instead of showing a raw id.
  const { environments } = useEnvironments({ teamId: activeTeamId });
  const environmentNamesById = useMemo(
    () => new Map(environments.map((environment) => [environment.id, environment.name])),
    [environments]
  );

  const hasSessionListError = sessionsError;
  const emptyMessage =
    sessionCreatorFilter === "mine" ? "No sessions started by you" : "No sessions yet";

  const handleNavigationSelect = useCallback(() => {
    if (isMobile) {
      onSessionSelect?.();
    }
  }, [isMobile, onSessionSelect]);
  const SettingsDestinationIcon = SETTINGS_DESTINATION.icon;

  const renderSessionGroup = (
    groupId: SessionGroupId,
    title: string,
    groupSessions: SessionItem[],
    pagination: {
      hasMore: boolean;
      loadingMore: boolean;
      loadMore: () => void;
      error?: unknown;
      retry: () => Promise<unknown>;
    },
    emphasize = false
  ) => {
    if (groupSessions.length === 0 && !pagination.error) return null;

    const headingId = `session-group-${groupId}`;
    const contentId = `${headingId}-content`;
    const expanded = expandedGroups[groupId];

    return (
      <section aria-labelledby={headingId}>
        <h2 id={headingId}>
          <button
            type="button"
            aria-expanded={expanded}
            aria-controls={contentId}
            className={`group/heading mt-1 flex h-7 w-full items-center gap-1 rounded-md px-2 text-left text-xs font-medium transition-colors hover:text-foreground ${
              emphasize ? "text-muted-foreground" : "text-secondary-foreground"
            }`}
            onClick={() => {
              const nextExpanded = !expanded;
              setExpandedGroups((previous) => ({
                ...previous,
                [groupId]: nextExpanded,
              }));
              try {
                localStorage.setItem(
                  `${SESSION_GROUP_EXPANDED_STORAGE_KEY_PREFIX}${groupId}`,
                  String(nextExpanded)
                );
              } catch {
                // Continue with the in-memory preference when storage is unavailable.
              }
            }}
          >
            {title}
            <span
              aria-hidden="true"
              className="ml-auto opacity-0 transition group-hover/heading:opacity-100"
            >
              {expanded ? (
                <ChevronDownIcon className="h-3 w-3 shrink-0" />
              ) : (
                <ChevronRightIcon className="h-3 w-3 shrink-0" />
              )}
            </span>
          </button>
        </h2>
        <div id={contentId} className="flex flex-col gap-px">
          {expanded && (
            <>
              {groupSessions.map((session) => (
                <SessionWithChildren
                  key={session.id}
                  session={session}
                  environmentName={
                    session.environmentId
                      ? environmentNamesById.get(session.environmentId)
                      : undefined
                  }
                  childrenMap={childrenMap}
                  currentSessionId={currentSessionId}
                  isMobile={isMobile}
                  onArchive={handleArchivedSession}
                  onSessionSelect={onSessionSelect}
                  onMarkLatestMessageRead={handleMarkLatestMessageRead}
                />
              ))}
              {Boolean(pagination.error) && (
                <div className="my-1 flex items-center justify-between gap-2 px-2 py-2 text-xs text-destructive">
                  <span>Unable to load {title.toLowerCase()}</span>
                  <Button variant="ghost" size="sm" onClick={() => void pagination.retry()}>
                    Retry
                  </Button>
                </div>
              )}
              {pagination.hasMore && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="my-1 w-full justify-start px-2 text-xs text-secondary-foreground"
                  disabled={pagination.loadingMore}
                  onClick={pagination.loadMore}
                >
                  {pagination.loadingMore ? "Loading..." : `Load more ${title.toLowerCase()}`}
                </Button>
              )}
            </>
          )}
        </div>
      </section>
    );
  };

  return (
    <aside className="w-72 h-dvh flex flex-col bg-shell">
      {/* Header */}
      <div className="flex flex-col gap-2 px-3 pt-3 pb-1">
        <div className="flex h-8 items-center justify-between gap-2">
          <Link
            href="/"
            onClick={handleNavigationSelect}
            className="flex min-w-0 items-center gap-2 rounded-md px-1 py-1 text-sm font-semibold tracking-tight text-foreground transition hover:bg-muted"
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground shadow-xs ring-1 ring-inset ring-black/10">
              <AppIcon className="h-3.5 w-3.5" />
            </span>
            <span className="truncate">{APP_NAME}</span>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggle}
            title={`Toggle sidebar (${labels["toggle-sidebar"]})`}
            aria-label={`Toggle sidebar (${labels["toggle-sidebar"]})`}
          >
            <SidebarIcon className="w-4 h-4" />
          </Button>
        </div>
        <div className="empty:hidden">
          <TeamSwitcher onNavigate={handleNavigationSelect} />
        </div>
        <SidebarSearchField onClick={onSearchSessions} />
      </div>

      {/* Nav links */}
      <nav className="px-3 pt-1 pb-2 flex flex-col gap-px" aria-label="Primary">
        {hasPermission("sessions.create") && (
          <button
            type="button"
            onClick={onNewSession}
            title={`New session (${labels["new-session"]})`}
            aria-label={`New session (${labels["new-session"]})`}
            className={`${NAV_ITEM_CLASS} ${
              pathname === "/" ? NAV_ITEM_ACTIVE_CLASS : NAV_ITEM_IDLE_CLASS
            }`}
          >
            <PlusIcon className="h-4 w-4" />
            <span className="flex-1 text-left">New session</span>
          </button>
        )}
        {PRIMARY_APP_DESTINATIONS.filter((destination) =>
          hasPermission(destination.requiredPermission)
        ).map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href === "/sessions" ? buildSessionsHref(teamQuery) : href}
            onClick={handleNavigationSelect}
            aria-current={
              pathname === href || pathname?.startsWith(`${href}/`) ? "page" : undefined
            }
            className={`${NAV_ITEM_CLASS} ${
              pathname === href || pathname?.startsWith(`${href}/`)
                ? NAV_ITEM_ACTIVE_CLASS
                : NAV_ITEM_IDLE_CLASS
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </Link>
        ))}
      </nav>

      <div className="flex items-center justify-between px-5 pt-2 pb-1">
        <span className="text-xs font-medium text-secondary-foreground">Sessions</span>
        <ToggleGroup
          type="single"
          value={sessionCreatorFilter ?? ""}
          onValueChange={(value) => {
            if (value === "all" || value === "mine") {
              setSessionCreatorFilter(value);
            }
          }}
          className="gap-0.5 rounded-md bg-muted p-0.5"
          aria-label="Session owner filter"
        >
          <ToggleGroupItem
            value="all"
            className="h-5 min-w-0 rounded-sm px-2 text-[11px] text-muted-foreground hover:bg-transparent data-[state=on]:bg-card data-[state=on]:text-foreground data-[state=on]:shadow-card"
          >
            All
          </ToggleGroupItem>
          <ToggleGroupItem
            value="mine"
            className="h-5 min-w-0 rounded-sm px-2 text-[11px] text-muted-foreground hover:bg-transparent data-[state=on]:bg-card data-[state=on]:text-foreground data-[state=on]:shadow-card"
          >
            Mine
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {/* Session List */}
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-current border-t-transparent text-muted-foreground" />
          </div>
        ) : (
          <>
            {needsAttention.length === 0 && inProgress.length === 0 && finished.length === 0 ? (
              hasSessionListError ? (
                <div className="flex items-center justify-between gap-2 px-4 py-8 text-sm text-destructive">
                  <span>Unable to load sessions</span>
                  <Button variant="ghost" size="sm" onClick={() => void refreshSnapshot()}>
                    Retry
                  </Button>
                </div>
              ) : (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                  {emptyMessage}
                </div>
              )
            ) : (
              <>
                {renderSessionGroup(
                  "needs-attention",
                  "Needs attention",
                  needsAttention,
                  sectionPagination.needsAttention,
                  true
                )}
                {renderSessionGroup(
                  "in-progress",
                  "In progress",
                  inProgress,
                  sectionPagination.inProgress
                )}
                {renderSessionGroup("recent", "Recent", finished, sectionPagination.finished)}
              </>
            )}

            {hasPermission("sessions.read") && (
              <Link
                href={buildSessionsHref({ ...teamQuery, lifecycle: "archived" })}
                onClick={handleNavigationSelect}
                className="mt-2 flex h-7 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-secondary-foreground transition hover:bg-muted hover:text-foreground"
              >
                <ArchiveIcon className="h-3.5 w-3.5" />
                Archived
              </Link>
            )}
          </>
        )}
      </div>

      <div className="flex items-center gap-1 px-2 pb-2 pt-1">
        <div className="min-w-0 flex-1">
          <UserMenu user={authSession?.user} />
        </div>
        <Link
          href={SETTINGS_DESTINATION.href}
          onClick={handleNavigationSelect}
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition ${
            pathname === SETTINGS_DESTINATION.href
              ? "bg-card text-foreground shadow-card"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
          title={SETTINGS_DESTINATION.label}
          aria-label={SETTINGS_DESTINATION.label}
        >
          <SettingsDestinationIcon className="w-4 h-4" />
        </Link>
      </div>
    </aside>
  );
}
