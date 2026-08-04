# Design system

Derived from the supplied reference screens. Tokens live in
[`src/app/globals.css`](../src/app/globals.css) under `@theme` — screens use the
token names, never raw hex.

## Two sub-brands, one component set

| Surface                                      | Ground | Chrome                                                 |
| -------------------------------------------- | ------ | ------------------------------------------------------ |
| Artist site (`/`, `/about`, …)               | Dark   | Script wordmark, six-item nav                          |
| Collector Intelligence Suite (`/collectors`) | Light  | Serif wordmark, Suite/About/Membership/Pricing + Apply |

Both use the **same components**. That works only because the tokens are named
for their _role_ — `canvas`, `heading`, `line` — rather than their colour.

- The `@theme` block is the default: the dark artist site.
- `.theme-light` flips a subtree to the collector palette.
- `.theme-dark` flips a band back — the collector pages are light with
  full-bleed dark bands (hero, belief, closing, footer).

Applying `.theme-light` to the collector layout is the entire integration. An
E2E test measures the computed background luminance of both sites, so the token
flip is verified to reach the DOM rather than merely apply a class.

### The two accent tokens

`accent` is the camel used for **fills, borders and rules**. `accent-ink` is
accent-coloured **text**, and must clear 4.5:1 against the page ground. On the
dark theme they are the same value; on the light theme the fill stays pale while
the ink darkens to a bronze, because pale camel on cream is only ~2.9:1.

`on-accent` is the foreground on a camel fill and is **dark in both themes** —
cream on camel fails at ~2.6:1.

## Palette

| Token          | Value     | Use                                     |
| -------------- | --------- | --------------------------------------- |
| `canvas`       | `#14100d` | Page ground — near-black espresso       |
| `surface`      | `#1c1712` | Cards, panels, form fields, footer      |
| `raised`       | `#241d17` | Hover states, elevated tiles            |
| `heading`      | `#f4ede4` | Headings, primary emphasis              |
| `body`         | `#d9cfc3` | Long-form copy                          |
| `muted`        | `#9c8e80` | Captions, meta, secondary detail        |
| `accent`       | `#c08b5c` | Camel — fills, borders, rules           |
| `accent-ink`   | `#c08b5c` | Accent-coloured text (bronze on light)  |
| `on-accent`    | `#14100d` | Foreground on a camel fill, both themes |
| `accent-hover` | `#d3a077` | Hover/active state for accent           |
| `accent-soft`  | `#3a2b20` | Tints and chips on the dark ground      |
| `line`         | `#2e2620` | Hairline dividers, input borders        |
| `line-strong`  | `#473a31` | Emphasised dividers, secondary buttons  |
| `danger`       | `#e5786b` | Errors — lightened to read on dark      |
| `success`      | `#7fa986` | Confirmation                            |

Usage: `bg-canvas`, `text-heading`, `bg-accent`, `border-line`, and so on.

### Contrast

Checked against the `canvas` ground: `body` ≈ 12:1, `muted` ≈ 6:1, `accent` ≈ 6.4:1.

**Buttons use dark text on camel, not white** — white on `accent` is only ~2.6:1
and fails WCAG AA. `bg-accent text-on-accent` gives ~6.4:1, in both themes.

`color-scheme: dark` is set on `html`, so native controls, form widgets and
scrollbars render dark rather than fighting the page.

## Type

- **Display** — Cormorant Garamond, weight 300–400. All `h1`–`h3`. Large, light,
  tight leading. `text-display` (3.5rem) and `text-hero` (4.5rem) come pre-tuned
  with leading and tracking.
- **Body** — Inter. Paragraphs, labels, UI.
- **Script** — Italianno, used **only** for the wordmark's signature. Never for
  running text; it is not legible at body sizes.

All three load via `next/font/google` in the root layout as `--font-display`,
`--font-body` and `--font-script`.

### The eyebrow + rule motif

The most repeated pattern in the design is a small tan letterspaced label, a
short horizontal rule, then a large serif heading. Two utilities exist for it:

```html
<p class="eyebrow">Evidence framework</p>
<span class="rule" aria-hidden="true"></span>
<h2>The Sx Score</h2>
```

`SectionHeading` composes all three and should be preferred over hand-rolling
them. The rule is decorative and always `aria-hidden`.

Note the eyebrow is **tan, not grey** — it uses `--color-accent-ink`, so it
darkens automatically on the light theme rather than washing out. An earlier
iteration had it muted, which lost the warmth that carries the design.

## Buttons

Four variants, all with uppercase letterspaced labels:

| Variant     | Use                                                         |
| ----------- | ----------------------------------------------------------- |
| `primary`   | Solid camel, dark text. Main page actions.                  |
| `outline`   | Tan hairline box, tan text. The header's "Enter the suite". |
| `secondary` | Neutral hairline box. Paired with a primary action.         |
| `ghost`     | Underlined tan text. Inline actions.                        |

**Case is not imposed by the button.** The designs use uppercase letterspaced
labels for navigation-level CTAs ("ENTER THE SUITE") but mixed case for
page-level actions ("Get Started"). Add the `.caps` utility where uppercase
belongs, rather than baking it into the component.

### Bands

The closing CTA and the footer are both **lifted slightly off the page ground**
(`bg-surface/40`), separated from each other by nothing but a hairline, so they
read as one continuous foot to the page. An earlier version had the footer
_darker_ than the page, which inverted the design.

## Layout rhythm

- Section spacing: `spacing-section` (7rem) on desktop, `spacing-section-sm`
  (4rem) on mobile. Whitespace is the dominant design element — resist tightening it.
- Content column: `max-w-6xl` for gallery grids and page bodies, `max-w-2xl` for
  forms and prose.
- Two corner radii: `radius-card` (2px) for buttons and inputs — near-square, as
  in the reference — and `radius-soft` (12px) for photographic tiles.
- Art cards use a `4/5` portrait aspect so mixed-orientation work still grids evenly.

## Photography

Marketing images are declared in [`content/images.ts`](../src/content/images.ts)
and rendered through [`EditorialImage`](../src/components/editorial-image.tsx),
which falls back to a tinted placeholder of the same dimensions when the asset
has not been supplied. Alt text is required either way.

Photographs behind text (the framework quote, the closing CTA) sit under a
`bg-canvas/80` scrim, so headline contrast does not depend on what the
photograph happens to contain.

## Rules

- Mobile-first, and verified: an E2E test asserts the home page does not scroll
  sideways at 390px.
- **A card whose image and title both link to the same place must expose one
  link, not two.** Mark the image link `aria-hidden` with `tabIndex={-1}` and give
  the image an empty `alt`; the title is the accessible link. See
  [`art-card.tsx`](../src/features/catalogue/art-card.tsx).
- **Numeric readouts get a real role.** The Sx Score bars are `meter`s with
  `aria-valuenow`, not decorated divs — a value expressed only as a bar width is
  invisible to assistive tech.
- Illustrative sample data must say so: the platform-preview record carries
  `aria-label="Example artist record"` so it is not mistaken for a live record.
- Always keep the visible focus ring defined in the base layer. Never remove it.
- Prices render through `formatMoney` — never interpolate a raw `Decimal`.
