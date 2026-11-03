# ODPC Compliance Guide for TUSOME School Management System

## Overview

This document outlines how TUSOME addresses the Office of the Data Protection Commissioner (ODPC) requirements for handling children's personal data in Kenyan schools.

## Legal Framework

- **Data Protection Act, 2019** (Kenya)
- **ODPC Guidance on Processing Children's Personal Data**
- **Constitution of Kenya, 2010** (Article 31 - Privacy)

## Data Minimization

TUSOME collects only the data necessary for school operations:

- **Student records:** admission number, full name, gender, class/stream enrollment
- **Guardian records:** name, email, phone (via parent_student_links)
- **Medical records:** visit details, diagnoses, treatments (restricted access)
- **Behaviour records:** incident type, description, severity (restricted access)
- **Attendance records:** date, status, absence reason

No unnecessary personal data is collected. Fields are optional where possible.

## Consent & Lawful Basis

- Student data is processed under **legitimate interest** (school operations) and **legal obligation** (education regulations)
- Guardian linking requires explicit association via `link_parent_student` RPC
- Parents/guardians can view only their linked children's data

## Access Controls

### Role-Based Access
- 7 built-in roles: Administrator, Principal, Deputy Principal, Director, Secretary, Teacher, Non-teaching Staff
- Custom roles with granular permissions (60+ permissions across 7 categories)
- Per-user permission overrides (GRANT/DENY)
- Access revocation (suspend all permissions)

### Tenant Isolation
- Every table has Row Level Security (RLS) scoped to `tenant_id`
- Tenant ID extracted from JWT (`auth.jwt()->>'tenant_id'`)
- No cross-tenant data access possible via API or direct DB queries

### Field-Level Access
- Sensitive fields (medical, behaviour, counselling) logged via `sensitive_field_access` table
- Audit trail records all access to sensitive data
- Role-based UI navigation hides restricted features

### Sensitive Data Handling
- Medical alerts: restricted to authorized staff
- Behaviour records: restricted to authorized staff
- Counselling sessions: confidential, restricted access
- Emergency contacts: restricted to authorized staff

## Data Retention

- Configurable per-entity-type retention policies (`data_retention_policies` table)
- Actions: archive, anonymize, delete
- Default: 365 days (configurable per tenant)
- Audit events: retained indefinitely (immutable)

## Children's Data Specific Safeguards

1. **Data Minimization:** Only collect essential student data
2. **Purpose Limitation:** Data used only for school operations
3. **Access Restriction:** Sensitive records (medical, counselling, behaviour) restricted to authorized staff
4. **Parental Access:** Parents can only view their linked children's data
5. **No Profiling:** No automated decision-making or profiling of children
6. **Secure Storage:** All data encrypted at rest (Supabase) and in transit (HTTPS)
7. **Audit Trail:** All access to sensitive data logged

## Rights of Data Subjects

- **Right to access:** Parents can request their child's data
- **Right to rectification:** School administrators can correct data
- **Right to erasure:** Subject to legal retention requirements
- **Right to data portability:** CSV export available for analytics data

## Data Breach Response

1. Detection: Audit logs and RLS prevent unauthorized access
2. Containment: Access revocation via `set_user_access_revoked`
3. Notification: School administrators notified of suspicious activity
4. Recovery: Database backups and audit trail reconstruction

## Backup & Recovery

- Database backups via Supabase automated backups
- Audit trail provides reconstruction capability
- Data retention policies ensure compliance with storage limits

## Recommendations for Schools

1. Designate a Data Protection Officer (DPO) for the school
2. Obtain parental consent for data collection at enrollment
3. Limit access to sensitive records to essential staff only
4. Regularly review access permissions and audit logs
5. Train staff on data protection principles
6. Maintain records of data processing activities

## References

- Data Protection Act, 2019 (Kenya)
- ODPC Guidance on Processing Children's Personal Data
- Constitution of Kenya, 2010 (Article 31)
- TUSOME Data Retention Policies (configurable per tenant)