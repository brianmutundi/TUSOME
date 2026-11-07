---
name: TUSOME School Management System
description: Premium SaaS platform for Kenyan primary, junior, and senior school management
colors:
  brand-600: "#1d6b70"
  brand-700: "#18575c"
  brand-50: "#eef7f7"
  surface: "#ffffff"
  surface-sunken: "#f8f7f4"
  ink: "#1c1b17"
  muted: "#57554c"
  subtle: "#6f6c62"
  hairline: "#e4e1da"
  focus: "#2a8388"
  success: "#059669"
  warning: "#d97706"
  danger: "#dc2626"
  info: "#0891b2"
typography:
  display:
    fontFamily: "var(--font-sans), ui-sans-serif, system-ui, sans-serif"
    fontSize: "2rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  heading:
    fontFamily: "var(--font-sans), ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "-0.015em"
  subheading:
    fontFamily: "var(--font-sans), ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "0em"
  body:
    fontFamily: "var(--font-sans), ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "0em"
  label:
    fontFamily: "var(--font-sans), ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "0.025em"
  caption:
    fontFamily: "var(--font-sans), ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "0.025em"
  mono:
    fontFamily: "ui-monospace, 'SF Mono', 'Cascadia Code', 'Segoe UI Mono', monospace"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "0em"
rounded:
  sm: "4px"
  md: "6px"
  lg: "8px"
  xl: "12px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  2xl: "32px"
  3xl: "48px"
components:
  button-primary:
    backgroundColor: "{colors.brand-600}"
    textColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    padding: "8px 16px"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "8px 16px"
  button-danger:
    backgroundColor: "{colors.danger}"
    textColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    padding: "8px 16px"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    padding: "20px"
  badge-success:
    backgroundColor: "#ecfdf5"
    textColor: "#047857"
    rounded: "{rounded.full}"
    padding: "2px 8px"
  badge-danger:
    backgroundColor: "#fef2f2"
    textColor: "#b91c1c"
    rounded: "{rounded.full}"
    padding: "2px 8px"
  badge-warning:
    backgroundColor: "#fffbeb"
    textColor: "#b45309"
    rounded: "{rounded.full}"
    padding: "2px 8px"
  badge-info:
    backgroundColor: "#ecfeff"
    textColor: "#0e7490"
    rounded: "{rounded.full}"
    padding: "2px 8px"
---

# Design System

## Overview

TUSOME is a premium school management SaaS platform for Kenyan primary, junior, and senior schools. The design prioritises clarity, information density, and professional aesthetics for administrators, bursars, teachers, principals, and parents. The interface uses a restrained petrol-teal brand on warm paper surfaces, with strong typographic hierarchy and print-first report cards.

This document is the source of truth. It replaced the pre-November 2026 blue/system-font spec, which no longer matched the code.

## Colors

### Brand
- **Petrol teal (`brand-600` #1d6b70):** Primary navigation, links, key actions, active states
- **`brand-700` (#18575c):** Hover and pressed states
- **`brand-50` (#eef7f7):** Selected rows, active nav backgrounds

`tailwind.config.ts` remaps `blue`, `gray` and `slate` onto the teal and warm-neutral ramps so legacy classes such as `bg-blue-600` and `text-gray-500` render the v2 palette. New code should use `brand-*` or the semantic tokens below.

### Semantic tokens (preferred in new code)
Defined as CSS variables in `src/app/globals.css` and exposed to Tailwind:

| Token | Value | Use |
| --- | --- | --- |
| `surface` | `#ffffff` | Cards, sheets, inputs |
| `surface-sunken` | `#f8f7f4` | Page background |
| `ink` | `#1c1b17` | Primary text |
| `muted` | `#57554c` | Secondary text (6.9:1) |
| `subtle` | `#6f6c62` | Lightest legal text (5.4:1) |
| `hairline` | `#e4e1da` | Borders and dividers |
| `focus` | `#2a8388` | Focus ring |

**Never go lighter than `subtle` for text.** `gray-400` (#9c988c) is 2.4:1 on white and is banned for text and meaningful icons — it was removed repo-wide in the Nov 2026 audit.

### Status
- **Emerald (#059669):** success, paid, present
- **Amber (#d97706):** warning, pending, partial
- **Red (#dc2626):** error, arrears, absent
- **Cyan (#0891b2):** informational

Status is always colour **plus** a text label or icon, never colour alone.

## Typography

### Type scale
- **Display (2rem, 700):** Page titles
- **Heading (1.5rem, 700):** Section headings
- **Subheading (1.125rem, 600):** Card titles
- **Body (0.875rem, 400):** Default text, table data
- **Label (0.75rem, 500):** Form labels, column headers
- **Caption (0.75rem, 400):** Metadata, helper text, footers
- **Mono (0.8125rem, 400):** IDs, codes, reference numbers

**12px is the floor.** `caption` was 11px before the audit; nothing smaller than 12px ships now, including badges and rail labels. The Tailwind aliases (`text-body`, `text-caption`, …) exist in `tailwind.config.ts`; most screens use the equivalent raw utilities (`text-sm`, `text-xs`).

### Font
Hanken Grotesk via `next/font` (`--font-sans`) with a system fallback. Table cells, marks and money use `tabular-nums` so columns align and print cleanly.

## Layout

### Application shell
- **Desktop:** 72px icon rail (no sidebar column), flyout popovers per nav group
- **Below 1024px:** bottom bar (Home, Students, Academics, Finance, Menu) with a bottom-sheet menu
- **Top bar:** 56px, breadcrumb + search (`Cmd/Ctrl+K`) + shortcuts + profile
- **Content:** fluid width, `p-2 sm:p-4 lg:p-5`, bottom padding clears the mobile bar
- **Page header:** title (`h1`) + description + primary action

### Spacing
4, 8, 12, 16, 24, 32, 48px — multiples of 4. Prefer `gap-*` on grids/flex over per-child margins.

### Responsive
Mobile-first. Reflow dense tables into cards or a scroller with a sticky first column; never shrink desktop layouts into a phone width.

## Elevation & Depth

- **Cards:** white, `border-hairline`, `rounded-lg`, `shadow-sm`
- **Modals:** `rounded-xl`, large soft shadow, bottom sheet on phones
- **Popovers:** `shadow-md`, portalled and fixed so tables never clip them
- **No nested cards** — use flat sections with a divider inside a card

## Shapes

- **Buttons and inputs:** 8px radius
- **Cards:** 8px
- **Badges:** full pill
- **Dialogs:** 14px on desktop, 16px top corners on the phone sheet

## Components

### Buttons
- Primary: `brand-600` bg, white text
- Secondary: white bg, hairline border, ink text
- Ghost: transparent, hover `surface-sunken`
- Danger: red bg, white text
- Disabled: 50% opacity, `cursor-not-allowed`
- Minimum target 44px tall (`min-h-[2.75rem]`); 36px only in dense desktop toolbars

### Badges / status
Pill, tinted background with the matching 700-level text colour. Grades keep their database colour, and the chart label flips between white and ink by measured luminance.

### Forms
- Label: 12px, uppercase, `tracking-wide`, `gray-500`, always visible (never placeholder-only)
- Input: 8px radius, hairline border, 2px ring on focus in `brand-200`
- Hint: 12px `muted`, wired via `aria-describedby`
- Error: 12px bold `red-700` directly under the field, with `aria-invalid`

### Tables
- Header: `surface-sunken`, uppercase, 12px, `gray-500`
- Rows: white, hover `surface-sunken`, hairline dividers
- Numeric columns: right-aligned, `tabular-nums`
- Horizontal scroll on narrow screens; empty state with a description and a next action

### Cards
- White, hairline border, `rounded-lg`, `shadow-sm`
- Header: title + optional description + action
- Body padding 16–20px

## Accessibility baseline

- Text contrast ≥ 4.5:1; non-text UI (icons, borders that carry meaning) ≥ 3:1
- Focus ring: 2px `--focus` with 2px offset, from the global `*:focus-visible` rule — never `outline-none` without a replacement
- Skip link to `#main` on every shell
- Reduced motion honoured globally, not per component
- `prefers-contrast`, print and screen-reader paths are part of "done"

## Do's and Don'ts

### Do
- Use the established color tokens consistently
- Maintain information density for administrative workflows
- Use tables for data-heavy screens
- Provide clear loading, empty, and error states
- Use semantic HTML and accessible labels
- Format monetary values in KES with proper separators
- Show status with both color and text

### Don't
- Don't use excessive gradients or decorative effects
- Don't nest cards inside cards
- Don't use color alone to communicate status
- Don't add nonfunctional decorative elements
- Don't shrink desktop layouts for mobile — reorganize instead
- Don't use oversized headings that waste workspace
- Don't scatter arbitrary hex values — use design tokens
- Don't add glassmorphism or neon effects

## Redesign v2 (palette, type, overlays)

- **Primary** is deep petrol teal (`brand-600` #1d6b70), neutrals are warm paper (`gray-50` #f8f7f4 page, `gray-200` borders). `tailwind.config.ts` remaps `blue`, `gray` and `slate` to these ramps, so every existing `bg-blue-600` / `text-gray-500` class follows the new palette. New code should use `brand-*`; migrate old classes over time.
- **Status stays emerald / amber / red** and is always paired with a text label (never colour alone).
- **Font:** Hanken Grotesk through `next/font`, with the system stack as fallback. Tables use tabular numerals so marks and KES amounts align.
- **Modals:** use `Modal` / `ConfirmDialog` from `@/components/overlays` (native `<dialog>`: focus trap, Esc, backdrop). Never `window.confirm`. Destructive actions need a `ConfirmDialog` that names what is lost; irreversible finance or bulk actions add `requirePhrase`. Phones get a bottom sheet.
- **Radios:** use `RadioCardGroup` for 2–5 choices; use a select for longer lists. Targets are at least 44px; the selected state is a filled dot plus a tinted border.
- **Motion:** enter ease-out about 200ms from scale .96; exit about 120ms; honour `prefers-reduced-motion`.

## App shell and overlays (Nov 2026 redesign)

- **Navigation:** no sidebar column. A 72px icon rail (desktop) holds Home plus nine groups; each opens a flyout popover of its pages. Under 1024px the rail is replaced by a bottom bar (Home, Students, Academics, Finance, Menu) whose entries open a bottom-sheet modal. Ctrl/Cmd+K opens a page-search palette on every screen size. Nav data lives in `components/shell/nav.ts`; add a page there once and it appears in the rail, sheet and palette.
- **Top bar (56px):** breadcrumb (group / page), search, shortcuts popover, profile card popover. Sign out lives in the profile card.
- **Choosing a control:** `SelectField` (popover listbox, searchable above 8 options) for 5+ options or long lists; `SegmentedControl` for 2-5 short view/filter options; `RadioCardGroup` when each option needs a description; `Modal` for create/edit/review forms; `ConfirmDialog` for destructive actions; `Popover` for help text and small menus; `ProfileCard` for identity headers (user, learner, staff).
- **Popover rules:** portalled and `position: fixed`, so tables and modal bodies never clip it. Esc closes and returns focus to the trigger. Menus use arrow keys.
