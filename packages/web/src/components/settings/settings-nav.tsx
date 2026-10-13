"use client";

import Link from "next/link";
import { useState } from "react";
import { BackIcon, ChevronRightIcon, SearchIcon } from "@/components/ui/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCurrentUserAuthorization } from "@/hooks/use-current-user-authorization";
import { useMeTeams } from "@/hooks/use-teams";
import { useSettingsIsMobile } from "./settings-viewport-context";
import { getSettingsGroups, type SettingsCategory } from "./settings-registry";

export {
  DEFAULT_SETTINGS_CATEGORY,
  getSettingsCategoryLabel,
  isSettingsCategory,
  type SettingsCategory,
} from "./settings-registry";

interface SettingsNavProps {
  activeCategory: SettingsCategory;
  onSelect: (category: SettingsCategory, trigger: HTMLButtonElement) => void;
}

function SettingsSearch({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <label className="relative block">
      <span className="sr-only">Search settings</span>
      <span aria-hidden="true">
        <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-secondary-foreground" />
      </span>
      <Input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search settings"
        className="pl-8"
      />
    </label>
  );
}

/**
 * Renders searchable settings navigation containing only categories the current user may access.
 */
export function SettingsNav({ activeCategory, onSelect }: SettingsNavProps) {
  const isMobile = useSettingsIsMobile();
  const [query, setQuery] = useState("");
  const { hasPermission } = useCurrentUserAuthorization();
  const { teams } = useMeTeams();
  const groups = getSettingsGroups({
    query,
    hasPermission,
    canEditTeam: teams.some((team) => team.capabilities?.canEditMetadata === true),
  });

  const navigation = (
    <div className="space-y-6">
      {groups.map((group) => (
        <section key={group.label} aria-labelledby={`settings-${group.label.toLowerCase()}`}>
          <h2
            id={`settings-${group.label.toLowerCase()}`}
            className="mb-1 px-2 text-xs font-medium text-secondary-foreground"
          >
            {group.label}
          </h2>
          <ul
            className={
              isMobile
                ? "divide-y divide-border-muted overflow-hidden rounded-xl border border-border-muted bg-card"
                : "space-y-px"
            }
          >
            {group.items.map((item) => {
              const isActive = activeCategory === item.id;
              const Icon = item.icon;
              return (
                <li key={item.id}>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={(event) => {
                      onSelect(item.id, event.currentTarget);
                    }}
                    aria-current={isActive ? "page" : undefined}
                    className={`h-auto w-full justify-start gap-3 whitespace-normal rounded-md text-left ${
                      isMobile
                        ? "px-4 py-3.5 text-foreground hover:bg-muted/60"
                        : `h-8 gap-2.5 px-2 py-0 ${
                            isActive
                              ? "bg-card font-medium text-foreground shadow-card"
                              : "text-muted-foreground hover:bg-muted hover:text-foreground"
                          }`
                    }`}
                  >
                    <span aria-hidden="true">
                      <Icon
                        className={`h-4 w-4 shrink-0 ${isActive ? "text-foreground" : "text-muted-foreground"}`}
                      />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={`block font-medium ${isMobile ? "text-sm" : "text-[13px]"}`}>
                        {item.label}
                      </span>
                      {isMobile && (
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          {item.description}
                        </span>
                      )}
                    </span>
                    {isMobile && (
                      <span aria-hidden="true">
                        <ChevronRightIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                      </span>
                    )}
                  </Button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      {groups.length === 0 && (
        <p
          aria-live="polite"
          className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground"
        >
          No settings match “{query}”.
        </p>
      )}
    </div>
  );

  if (isMobile) {
    return (
      <nav aria-label="Settings" className="mx-auto w-full max-w-xl px-4 py-6">
        <p className="mb-5 text-sm text-muted-foreground">
          Manage your preferences, workspace, and connected services.
        </p>
        <div className="mb-6">
          <SettingsSearch value={query} onChange={setQuery} />
        </div>
        {navigation}
      </nav>
    );
  }

  return (
    <nav aria-label="Settings" className="flex w-60 shrink-0 flex-col bg-shell">
      <div className="px-3 pt-3 pb-2">
        <Button asChild variant="ghost" size="sm" className="mb-3 gap-2 px-2">
          <Link href="/">
            <span aria-hidden="true">
              <BackIcon className="h-4 w-4" />
            </span>
            Back to app
          </Link>
        </Button>
        <h1 className="mb-3 px-2 text-[15px] font-semibold tracking-tight text-foreground">
          Settings
        </h1>
        <SettingsSearch value={query} onChange={setQuery} />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pt-2 pb-5">{navigation}</div>
    </nav>
  );
}
