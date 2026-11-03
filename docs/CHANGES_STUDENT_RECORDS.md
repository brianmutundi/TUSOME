# Student records change set

New
- `/analytics/students/new` add-student page; "Add student" button on the directory.
- Student profile: Edit details modal, medical alerts, emergency contacts, groups and residence, notes.
- `/analytics/transcript` index route (redirects to the student directory).
- `supabase/migrations/20261028000052_student_record_access.sql`
  - registers 15 permission codes that SQL checked but the catalogue lacked
  - adds `assert_student_access`, `get_student_notes`, `get_student_memberships`
  - re-defines notes, emergency contact, medical alert and group/residence RPCs with permission and tenant checks
- `src/lib/analytics/studentForms.ts` (+ test), `FormBits.tsx`, `StudentRecordPanels.tsx`

Teachers module (second pass)
- `/analytics/teachers` with Teachers, Assignments and Groups tabs; nav entry under Staff.
- Wires `getTeacherDirectory`, `upsertTeacherProfile`, `getTeacherAllocations`, `upsert/deleteTeacherAllocation`, `getStaffGroups`, `upsert/deleteStaffGroup`.
- Editing a teacher re-sends their current groups, because `upsert_teacher_profile` replaces memberships.
- Shared `Section.tsx` (`useSection`, `SectionBody`), `teacherForms.ts` (+ test).
- Hard-coded 2026 defaults (teacher allocation, exam form, settings year list) now use the current year.
- Note: `upsert_teacher_profile` writes `profiles` and `auth.users` as the caller. RLS on `profiles` only allows admin-type roles, so a non-admin granted `add-teachers` will be refused. Confirm on staging.

Behaviour changes
- Reading contacts, alerts, notes and memberships needs `view-student-profile`.
- Writing notes, contacts and alerts needs `edit-student-profile`.
- Assigning a group needs `edit-student-groups`; a residence needs `add-edit-student-residences`.

Before merging
- Run `npm run typecheck && npm test`, then apply migration 52 on staging.
- Not built: removing a student from a group. Still unwired: subject-teacher access grants, library, transport, boarding, sports, trips, finance, counselling, opportunities, timetable, leave, duty.
