# Phase 9 — Resource-level isolation audit

## Design (from migrations)
- Parents: `assert_parent_of(student_id)` guard in every parent read RPC; RESTRICTIVE policies block direct table access. Only linked children visible.
- Teachers: allocations via `teacher_allocations` (SUBJECT_TEACHER/CLASS_TEACHER/CLASS_SUPERVISOR); RPCs filter by assigned classes/subjects.
- Class teachers: scoped to their classes via `class_teacher` allocations.
- Learners: own records only (own student_id).
- Bursar/accountant: finance RPCs gated by view-fees/manage-fees at route level + RLS.
- Exams officer: exam setup/marks/publication RPCs.
- School admin: tenant-scoped (my_tenant_id()).
- Platform super-admin: platform tenant management only; school data via ordinary tenant APIs would require tenant claim matching.

## Unaudited (no live DB)
- Per-RPC ownership filtering (whether every RPC that accepts student_id/class_id validates the caller's assignment).
- Teacher mark-entry RPCs (whether a teacher can enter marks for unassigned subjects).
- Parent thread/message RPCs (whether parent can read another parent's thread).
- Learner self-access RPCs.
- Cross-tenant test execution.
