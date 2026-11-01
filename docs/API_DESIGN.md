# TUSOME API Design Principles

## Overview

This document describes the API design principles applied to the TUSOME analytics API layer (`src/lib/analytics/api.ts`).

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   React Pages   │────▶│   API Layer      │────▶│   Supabase RPC  │
│   (UI)          │     │   (api.ts)       │     │   (PostgreSQL)  │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                              │
                              ├── errors.ts (consistent error types)
                              ├── validation.ts (input validation)
                              ├── idempotency.ts (idempotency keys)
                              └── rpc.ts (standardized RPC caller)
```

## Principles Applied

### 1. Contract First
TypeScript interfaces in `types.ts` define the contract before implementation. All API functions return typed interfaces.

### 2. Consistent Error Semantics
- All functions throw on error (no mixed return-null/throw patterns)
- `AnalyticsAPIError` with machine-readable codes + human-readable messages
- Supabase errors mapped via `fromSupabaseError()`
- Abort errors detected via `isAbortError()`

### 3. Validate at Boundaries
- Input validation utilities in `validation.ts`
- Server-side validation in RPCs (PostgreSQL constraints)
- TypeScript types enforce compile-time safety

### 4. Prefer Addition Over Modification
- All new fields are optional in interfaces
- No breaking changes to existing function signatures
- `upsert*` functions accept optional fields for partial updates

### 5. Predictable Naming
| Pattern | Convention | Example |
|---------|-----------|---------|
| List/Get | `get*` | `getStudents`, `getFeePayments` |
| Create | `create*` | `createExam`, `createInvoice` |
| Update | `upsert*` / `update*` | `upsertStudent`, `updateSchoolProfile` |
| Save | `save*` | `saveExamSubjectMarks`, `saveDailyAttendance` |
| Delete | `delete*` | `deleteStudentNote`, `deleteSectionHead` |
| Record | `record*` | `recordFeePayment`, `recordFeeCollection` |
| Check | `is*` | `isPeriodLocked`, `isAbortError` |

### 6. Idempotency
- RPCs use `ON CONFLICT` for upsert operations
- `generateIdempotencyKey()` utility for client-side keys
- Payment operations use unique constraints to prevent duplicates
- Waiver approvals use row-level locking (`FOR UPDATE`)

### 7. Pagination
- List endpoints accept `p_limit` parameter
- Clamped via `LEAST(GREATEST(COALESCE(p_limit, 50), 1), 500)`
- Default: 50, Max: 500

### 8. Abort Signals
- All functions accept `RequestOptions.signal`
- Consistent abort handling via `throwIfAborted()`

### 9. Tenant Isolation
- All RPCs extract `tenant_id` from `auth.jwt()->>'tenant_id'`
- `service_role` bypass for admin operations
- RLS policies on all tables

### 10. Response Normalization
- All RPC responses normalized via `guards.ts` functions
- `AnalyticsContractError` thrown for malformed payloads
- Type-safe return values

## Error Response Format

```typescript
interface APIError {
  code: AnalyticsErrorCode;  // Machine-readable
  message: string;           // Human-readable
  details?: unknown;         // Additional context
  statusCode?: number;       // HTTP status (if applicable)
}
```

## Error Codes

| Code | HTTP Status | Description |
|------|------------|-------------|
| `NOT_AUTHENTICATED` | 401 | No valid session |
| `MISSING_TENANT` | 400 | No tenant claim in JWT |
| `ACCESS_DENIED` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `VALIDATION_ERROR` | 422 | Invalid input data |
| `CONFLICT` | 409 | Duplicate or concurrent modification |
| `ABORTED` | 499 | Request was cancelled |
| `CONTRACT_ERROR` | 500 | Malformed response from server |
| `SERVER_ERROR` | 500 | Internal server error |
| `UNKNOWN` | 500 | Unhandled error |

## Standardized RPC Caller

```typescript
import { callRpc } from '@/lib/analytics/rpc';

// Before (manual):
const supabase = createClient();
const { data, error } = await supabase
  .rpc('get_students', { p_class_id: classId })
  .abortSignal(signal);
if (error) throw error;
return normalizeStudents(data);

// After (standardized):
const data = await callRpc('get_students', { p_class_id: classId }, { signal });
return normalizeStudents(data);
```

## Migration Status

- **Total migrations:** 52 (000000–000051)
- **Total API functions:** 230+
- **Total types:** 130+
- **Tested functions:** 8 (getClassPerformance, getMarkSheet, getStudentExamHistory, getMostImproved, getAccountDirectory, getAnalyticsFilters, describeAnalyticsError, isAbortError)

## Recommended Improvements

1. **Apply `AnalyticsAPIError` wrapping** to all 230+ functions (currently imported, partially applied)
2. **Add input validation** to form submission handlers using validation utilities
3. **Add idempotency keys** to financial operations (payments, waivers, collections)
4. **Add contract tests** for all API functions (currently only 8 tested)
5. **Create API documentation** from TypeScript interfaces (auto-generated)
6. **Standardize all functions** to use `callRpc` helper (currently manual)