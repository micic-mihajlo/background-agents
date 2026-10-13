"use client";

import { signOut } from "@/lib/auth-session";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function UserMenu({
  user,
}: {
  user?: { name?: string | null; image?: string | null } | null;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex h-9 w-full items-center gap-2 rounded-md px-1.5 text-left text-[13px] font-medium text-foreground transition hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          aria-label={`Signed in as ${user?.name || "User"}`}
          title={`Signed in as ${user?.name || "User"}`}
        >
          <span className="h-6 w-6 shrink-0 overflow-hidden rounded-full ring-1 ring-border">
            {user?.image ? (
              <img src={user.image} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center rounded-full bg-accent-muted text-[11px] font-semibold text-accent">
                {user?.name?.charAt(0).toUpperCase() || "?"}
              </span>
            )}
          </span>
          <span className="min-w-0 truncate">{user?.name || "User"}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top" sideOffset={4}>
        <DropdownMenuLabel className="font-medium truncate">
          {user?.name || "User"}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => signOut()}>
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3-3l3-3m0 0l-3-3m3 3H9"
            />
          </svg>
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
