import { cva, type VariantProps } from "class-variance-authority";
import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";

import { cn } from "@avm-daily/ui/lib/utils";

/**
 * Badge — matches AVM Daily design (`avm-components.jsx`).
 *
 * Variants:
 *  - default:     primary tint on primary-dim background (goal category, generic status).
 *  - success:     verified, completed, credit tx.
 *  - warning:     pending, partial, in-progress.
 *  - destructive: rejected, failed, debit tx (paired with `-` amount).
 *  - muted:       locked, disabled, not-yet-reached step.
 *  - secondary / outline / ghost / link: retained for legacy admin surfaces.
 *
 * Design spec: full-round pill, 3px×10px inset, 11px/700, `0.04em` tracking,
 * uppercase discouraged — copy is title-case per screen.
 */
const badgeVariants = cva(
  "group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border border-transparent px-2.5 py-0.5 text-[0.6875rem] font-bold tracking-[0.04em] whitespace-nowrap transition-all focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-2.5!",
  {
    variants: {
      variant: {
        default:
          "bg-primary-dim text-primary [a]:hover:brightness-110",
        success:
          "bg-success-dim text-success [a]:hover:brightness-110",
        warning:
          "bg-warning-dim text-warning [a]:hover:brightness-110",
        destructive:
          "bg-destructive-dim text-destructive [a]:hover:brightness-110",
        muted:
          "bg-muted text-muted-foreground [a]:hover:brightness-110",
        secondary:
          "bg-secondary text-secondary-foreground [a]:hover:bg-secondary/80",
        outline:
          "border-border bg-input/20 text-foreground [a]:hover:bg-muted [a]:hover:text-muted-foreground",
        ghost:
          "hover:bg-muted hover:text-muted-foreground dark:hover:bg-muted/50",
        link: "text-primary underline-offset-4 hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

type BadgeProps = useRender.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants>;

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: BadgeProps) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      { className: cn(badgeVariants({ variant }), className) },
      props
    ),
    render,
    state: { slot: "badge", variant },
  });
}

export { Badge, badgeVariants };
