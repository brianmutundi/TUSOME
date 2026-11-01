---
name: TUSOME School Management System
description: Premium SaaS platform for Kenyan primary, junior, and senior school management
colors:
  primary: "#2563eb"
  primary-dark: "#1d4ed8"
  primary-light: "#3b82f6"
  primary-50: "#eff6ff"
  primary-100: "#dbeafe"
  success: "#059669"
  success-light: "#10b981"
  success-50: "#ecfdf5"
  warning: "#d97706"
  warning-light: "#f59e0b"
  warning-50: "#fffbeb"
  danger: "#dc2626"
  danger-light: "#ef4444"
  danger-50: "#fef2f2"
  info: "#0891b2"
  info-50: "#ecfeff"
  neutral-50: "#f9fafb"
  neutral-100: "#f3f4f6"
  neutral-200: "#e5e7eb"
  neutral-300: "#d1d5db"
  neutral-400: "#9ca3af"
  neutral-500: "#6b7280"
  neutral-600: "#4b5563"
  neutral-700: "#374151"
  neutral-800: "#1f2937"
  neutral-900: "#111827"
typography:
  display:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "2rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  heading:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "-0.015em"
  subheading:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "0em"
  body:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "0em"
  label:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "0.025em"
  caption:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "0.6875rem"
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
    backgroundColor: "{colors.primary}"
    textColor: "{colors.neutral-50}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  button-secondary:
    backgroundColor: "{colors.neutral-100}"
    textColor: "{colors.neutral-700}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  button-danger:
    backgroundColor: "{colors.danger}"
    textColor: "{colors.neutral-50}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  card:
    backgroundColor: "{colors.neutral-50}"
    rounded: "{rounded.lg}"
    padding: "24px"
  badge-success:
    backgroundColor: "{colors.success-50}"
    textColor: "{colors.success}"
    rounded: "{rounded.full}"
    padding: "2px 8px"
  badge-danger:
    backgroundColor: "{colors.danger-50}"
    textColor: "{colors.danger}"
    rounded: "{rounded.full}"
    padding: "2px 8px"
  badge-warning:
    backgroundColor: "{colors.warning-50}"
    textColor: "{colors.warning}"
    rounded: "{rounded.full}"
    padding: "2px 8px"
  badge-info:
    backgroundColor: "{colors.info-50}"
    textColor: "{colors.info}"
    rounded: "{rounded.full}"
    padding: "2px 8px"
---

# Design System

## Overview

TUSOME is a premium school management SaaS platform for Kenyan primary, junior, and senior schools. The design prioritizes clarity, information density, and professional aesthetics suitable for school administrators, bursars, teachers, and principals. The interface uses a restrained blue-and-green palette on neutral surfaces with strong typography and clear content hierarchy.

## Colors

### Primary Palette
- **Blue (#2563eb):** Primary navigation, links, key actions, active states
- **Blue Dark (#1d4ed8):** Hover states for primary actions
- **Blue Light (#3b82f6):** Secondary highlights

### Semantic Colors
- **Green (#059669):** Success, positive outcomes, active status
- **Amber (#d97706):** Warnings, pending states
- **Red (#dc2626):** Errors, destructive actions, critical states
- **Cyan (#0891b2):** Informational badges and highlights

### Neutral Surfaces
- **Gray 50 (#f9fafb):** Page background
- **Gray 100 (#f3f4f6):** Card backgrounds, secondary surfaces
- **Gray 200 (#e5e7eb):** Borders, dividers
- **Gray 500 (#6b7280):** Secondary text, labels
- **Gray 900 (#111827):** Primary text, headings

### Status Colors
Status badges use tinted backgrounds with matching text:
- Success: green-50 bg / green-700 text
- Danger: red-50 bg / red-800 text
- Warning: amber-50 bg / amber-800 text
- Info: blue-50 bg / blue-800 text
- Neutral: gray-100 bg / gray-700 text

## Typography

### Type Scale
- **Display (2rem, 700):** Page titles only
- **Heading (1.5rem, 700):** Section headings
- **Subheading (1.125rem, 600):** Card titles, subsections
- **Body (0.875rem, 400):** Default text, table data
- **Label (0.75rem, 500):** Form labels, column headers
- **Caption (0.6875rem, 400):** Metadata, timestamps, helper text
- **Mono (0.8125rem, 400):** IDs, codes, reference numbers

### Font Family
System font stack: `ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`

### Font Weights
- 400: Body text, data values
- 500: Labels, secondary emphasis
- 600: Subheadings, card titles
- 700: Page titles, primary headings

## Layout

### Application Shell
- **Sidebar:** Fixed left, 240px wide on desktop, collapsible on mobile
- **Top bar:** 56px height, contains search, notifications, user menu
- **Content area:** Max-width 1280px, centered, with 24px padding
- **Page header:** Title (h1) + description + primary action button

### Spacing Scale
4px, 8px, 12px, 16px, 24px, 32px, 48px (multiples of 4)

### Grid
- Forms: 2-4 column grid on desktop, 1 column on mobile
- Dashboard: 3-column summary cards, 2-column charts
- Tables: Full-width with horizontal scroll on mobile

## Elevation & Depth

- **Cards:** `shadow-sm` (subtle), `rounded-lg` (8px)
- **Modals/Dialogs:** `shadow-lg`, `rounded-xl` (12px)
- **Dropdowns:** `shadow-md`, `rounded-md` (6px)
- **No nested cards** — use flat sections within a card instead

## Shapes

- **Buttons:** 6px border radius
- **Cards:** 8px border radius
- **Badges:** Full border radius (pill shape)
- **Inputs:** 6px border radius
- **Tables:** No border radius on container, rounded header

## Components

### Buttons
- Primary: Blue bg, white text
- Secondary: Gray-100 bg, gray-700 text
- Danger: Red bg, white text
- Disabled: Reduced opacity, no pointer

### Badges/Status
- Pill shape with tinted background and matching text
- Success (green), Danger (red), Warning (amber), Info (blue), Neutral (gray)

### Forms
- Labels: 12px, uppercase, tracking-wide, gray-500
- Inputs: 6px radius, gray-300 border, focus ring blue-200
- Helper text: 12px, gray-500
- Error text: 12px, red-600

### Tables
- Header: gray-50 bg, uppercase, tracking-wide, gray-500 text
- Rows: white bg, hover gray-50
- Borders: gray-200 between rows
- Empty state: centered message with description

### Cards
- White background, gray-200 border, rounded-lg, shadow-sm
- Header: title + description
- Body: consistent padding (16px or 24px)

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