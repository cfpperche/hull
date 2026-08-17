/**
 * The product's design tokens, in the only form mail clients understand.
 *
 * `packages/ui/src/styles.css` states these as `oklch()` custom properties.
 * Neither survives the trip: Gmail drops colour functions it does not know, every
 * client strips `:root`, and Outlook has never parsed either. The palette is
 * achromatic, so converting is exact rather than approximate — oklch(0.145 0 0)
 * is #0a0a0a, which is also where shadcn's neutral scale started.
 *
 * Keep these in step with styles.css by hand. There is no build-time link and
 * there should not be one: a stylesheet compiled for a browser is the wrong
 * source for a medium that cannot run it.
 */

export const color = {
  foreground: "#0a0a0a", // oklch(0.145 0 0)
  primary: "#171717", // oklch(0.205 0 0)
  primaryForeground: "#fafafa", // oklch(0.985 0 0)
  /** 4.74:1 on white — passes 4.5:1, so body copy may use it. */
  mutedForeground: "#737373", // oklch(0.556 0 0)
  border: "#e5e5e5", // oklch(0.922 0 0)
  surface: "#ffffff",
  /** The sidebar tone, used here as the page behind the card. */
  ground: "#fafafa",
} as const;

/** --radius is 0.625rem. Buttons are rounded-lg (1.0x); the mark is rounded-md (0.8x). */
export const radius = { lg: "10px", md: "8px" } as const;

/**
 * Geist first for the clients that happen to have it, then the stack every
 * client can actually satisfy. No `@font-face` — Gmail strips it, and a webfont
 * that loads in one client and not the others is worse than not trying.
 */
export const font =
  "'Geist Variable','Geist',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

/** Narrow, like the product's auth column. Wide transactional mail reads as marketing. */
export const width = 480;
