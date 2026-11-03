# UI audit and redesign notes

Scope read: all 115 files in `src/` (63 pages, 15 analytics components, `ui.tsx`, `AuthGate`).

## Findings
1. `brand-*`, `success-*` etc. tokens are defined in `tailwind.config.ts` but used 0 times. Pages use raw Tailwind classes (~1,900 colour classes: gray 1,417, blue 332, emerald 151, red 72, amber 61).
2. No modal exists anywhere. Deletes/rejects were either immediate (`accounts` Remove section head, `fee-waivers` Cancel and Reject) or used `window.confirm` (`exams/[examId]` Delete All Marks).
3. Radios appear in one place (`report-forms`), unstyled and with small targets. 39 native `<select>` elements, 41 forms.
4. Shell: no role-aware navigation (every user sees all ~60 links), no skip link, icon-only buttons without labels, active state only on exact path match, off-canvas drawer links stay focusable.
5. Accessibility: only 10 `aria-label`s in the whole app; table headers are good (403 of 479 `<th>` have `scope`).
6. Inline review/approve form inside a table cell on fee-waivers (cramped on phones): a good next candidate for `Modal`.

## Changed in this pass
Palette/font remap, `overlays.tsx` (Modal, ConfirmDialog, RadioCardGroup), 4 pages wired, shell accessibility, DESIGN.md updated.

## Next
Role-aware nav; move the fee-waiver review and other inline create forms into `Modal`; replace the 39 selects that have under 6 options; migrate raw colour classes to `brand-*`; mobile card layouts for the widest tables (`mark-sheet`, `merit-list`).

## Pass 2: shell and overlays
Changed: sidebar (256px, 60+ links) replaced by a 72px rail with 9 flyout groups, bottom bar and bottom-sheet menu on phones, Ctrl/Cmd+K page search, shortcuts popover and profile-card popover. Duplicate Budgets and Accounting entries removed from Administration. `SelectField` is now a popover listbox with the native select kept hidden for forms and tests, so all 38 consumers keep working unchanged. Added `Popover`, `SegmentedControl`, `ProfileCard`/`Avatar`. Fee waivers: status filter is a segmented control; request and review forms moved from inline/table cell into modals. Student profile header is a profile card with a Records menu. Dashboard filter help moved into a popover; related views are pills. Parent portal header uses the same profile menu.
Not run in this pass: `npm ci`, `next build`, `vitest` (registry blocked in the authoring sandbox). Run `npm ci && npm run typecheck && npm test && npm run build` first.
Next: role-aware nav (hide groups the role cannot open); replace remaining inline create forms with `Modal`; mobile card layouts for mark-sheet and merit-list; dark rail/light content contrast review in a real browser.

## Pass 3: PDF API routes
`/api/receipts/[receiptId]/pdf` and `/api/trips/[tripId]/permission-slip/[studentId]/pdf` now share `src/lib/server/pdf.ts`: IDs must be UUIDs (400), the caller must send `Authorization: Bearer <supabase access token>` (401), and Chromium opens the page with that user's session so RLS still applies. `playwright` moved into `dependencies`. Call from the browser with `fetch(url, { headers: { Authorization: 'Bearer ' + session.access_token } })`, then save the blob. Install Chromium on the host (`npx playwright install chromium`). Untested: no registry access when written.

## Pass 4: Add school
Migration `20261028000056_platform_create_school.sql` adds `platform_create_school(name, owner_user_id, owner_name)` (super admin only; inserts tenant + owner profile). `POST /api/schools` verifies the caller is a super admin, creates the owner login with the service role (invite email, or a password you set), then calls the function; it deletes the new login if the function fails. UI: Administration > Schools. Needs `SUPABASE_SERVICE_ROLE_KEY` in the server environment. The JWT must carry a top-level `tenant_id` claim (every RPC reads `auth.jwt() ->> 'tenant_id'`); nothing in this repo sets it, so confirm your project's access-token hook derives it from `profiles`.
