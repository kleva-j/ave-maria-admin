import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@avm-daily/ui/lib/utils";

/**
 * Button — AVM Daily design (`avm-components.jsx` `Btn`) + shadcn legacy variants.
 *
 * Variants (see DESIGN.md for the hover contract):
 *  - primary:   bg-primary, white text, hover-lift + primary/33 shadow.
 *  - default:   alias for `primary` — same treatment. Kept so admin call sites
 *               that never pass `variant` still get the design's CTA look.
 *  - secondary: surface bg, secondary-foreground text, border-shift on hover (no lift).
 *  - ghost:     transparent, primary text, primary-dim on hover (no lift).
 *  - outline / destructive / link: unchanged shadcn baseline for admin surfaces.
 *
 * Sizes:
 *  - default:  h-7 compact — admin toolbars, utility rows (shadcn baseline).
 *  - md:       h-11 — dashboard tiles, form CTAs.
 *  - hero:     h-14 — full-width onboarding + primary in-flow CTAs (design default).
 *  - sm / xs / lg: unchanged shadcn baseline.
 *  - icon / icon-xs / icon-sm / icon-md / icon-lg: square variants.
 *
 * Radii scale with size — small buttons stay square-ish, `md`/`hero` use 14px.
 */
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center gap-1 rounded-md border border-transparent bg-clip-padding font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 disabled:pointer-events-none disabled:opacity-45 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        primary:
          "bg-primary text-primary-foreground font-semibold hover:-translate-y-[1px] hover:shadow-[0_6px_24px_color-mix(in_oklab,var(--primary)_33%,transparent)]",
        default:
          "bg-primary text-primary-foreground font-semibold hover:-translate-y-[1px] hover:shadow-[0_6px_24px_color-mix(in_oklab,var(--primary)_33%,transparent)]",
        secondary:
          "bg-secondary text-secondary-foreground border-border hover:border-[color-mix(in_oklab,var(--primary)_40%,transparent)] font-semibold aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
        ghost:
          "bg-transparent text-primary hover:bg-primary-dim font-semibold aria-expanded:bg-primary-dim",
        outline:
          "border-border text-foreground hover:bg-input/50 aria-expanded:bg-muted aria-expanded:text-foreground",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-7 gap-1 px-2 text-xs/relaxed has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        xs: "h-5 gap-1 rounded-sm px-2 text-[0.625rem] has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-2.5",
        sm: "h-6 gap-1 px-2 text-xs/relaxed has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        md: "h-11 rounded-[14px] px-6 text-[15px] has-data-[icon=inline-end]:pr-4 has-data-[icon=inline-start]:pl-4",
        lg: "h-8 gap-1 px-2.5 text-xs/relaxed has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 [&_svg:not([class*='size-'])]:size-4",
        hero:
          "h-14 rounded-[14px] px-6 text-[15px] has-data-[icon=inline-end]:pr-5 has-data-[icon=inline-start]:pl-5",
        icon: "size-7 [&_svg:not([class*='size-'])]:size-3.5",
        "icon-xs": "size-5 rounded-sm [&_svg:not([class*='size-'])]:size-2.5",
        "icon-sm": "size-6 [&_svg:not([class*='size-'])]:size-3",
        "icon-md":
          "size-11 rounded-[11px] [&_svg:not([class*='size-'])]:size-5",
        "icon-lg": "size-8 [&_svg:not([class*='size-'])]:size-4",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

type ButtonProps = ButtonPrimitive.Props & VariantProps<typeof buttonVariants>;

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonProps) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
