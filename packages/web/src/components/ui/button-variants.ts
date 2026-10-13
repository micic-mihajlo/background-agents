import { cva } from "class-variance-authority";

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md text-sm font-medium transition-[color,background-color,border-color,box-shadow,transform] duration-150 ease-out-strong active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary:
          "bg-accent text-accent-foreground shadow-sm shadow-accent/20 ring-1 ring-inset ring-black/5 hover:bg-accent/90",
        outline: "border border-border bg-card text-foreground shadow-card hover:bg-muted",
        ghost: "text-muted-foreground hover:text-foreground hover:bg-muted",
        destructive: "text-destructive hover:text-destructive hover:bg-destructive-muted",
        subtle: "text-secondary-foreground hover:text-foreground disabled:opacity-30",
      },
      size: {
        default: "h-8 px-3 text-sm",
        sm: "h-7 px-2.5 text-[13px]",
        xs: "h-6 rounded-sm px-2 text-xs",
        icon: "h-7 w-7 p-1.5",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  }
);
