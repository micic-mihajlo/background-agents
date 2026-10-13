import { cva, type VariantProps } from "class-variance-authority";

const PR_STATE_TEXT_CLASS = {
  open: "text-accent",
  draft: "text-muted-foreground",
  merged: "text-success",
  closed: "text-destructive",
} as const;

export const badgeVariants = cva(
  "inline-flex h-5 items-center gap-1 rounded-sm px-1.5 text-xs font-medium",
  {
    variants: {
      variant: {
        default: "bg-muted text-muted-foreground",
        "pr-merged": `bg-success-muted ${PR_STATE_TEXT_CLASS.merged}`,
        "pr-closed": `bg-destructive-muted ${PR_STATE_TEXT_CLASS.closed}`,
        "pr-draft": `bg-muted ${PR_STATE_TEXT_CLASS.draft}`,
        "pr-open": `bg-accent-muted ${PR_STATE_TEXT_CLASS.open}`,
        info: "bg-info-muted text-info border border-info/20",
        kbd: "h-[18px] bg-muted px-1 font-sans text-[11px] text-muted-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export function prBadgeVariant(
  state: string
): NonNullable<VariantProps<typeof badgeVariants>["variant"]> {
  switch (state) {
    case "merged":
      return "pr-merged";
    case "closed":
      return "pr-closed";
    case "draft":
      return "pr-draft";
    case "open":
    default:
      return "pr-open";
  }
}
