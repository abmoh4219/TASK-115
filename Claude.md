# CLAUDE.md — HarborPoint Resident & Services Management System

---

## Original Business Prompt (Source of Truth)

> This is the exact original requirement. Every decision made in this project must trace back to this prompt. If anything below conflicts with this prompt, this prompt wins.

A HarborPoint Resident & Services management system that includes resident/property records, controlled registration workflows, secure messaging, local search, and operations analytics for an on-site property team running fully offline. Primary roles are Property Administrator (configures buildings, units, rules, and audits), Resident User (maintains their profile, registers for on-site classes/services, and messages staff), Compliance Reviewer (approves sensitive document attachments and performs content safety review), and Operations Analyst (builds dashboards and A/B comparisons). The Angular + TypeScript single-page application uses responsive layouts with frontend routing and rich UI components such as Tables for resident rosters and registration lists, Drawers for profile and unit details, and Modals for consent prompts, overrides, and confirmation steps. Property modeling supports Building → Unit → Room hierarchy, binding residents to a specific room with effective dates and a change log; move-in/move-out transitions require selecting a reason code and timestamp, and only one active occupancy per resident is allowed at a time. Residents can attach IDs or lease addenda as local files (PDF/JPG/PNG, max 10 MB each, up to 5 files per profile) which enter a "Pending Review" state until a Compliance Reviewer marks them Approved/Rejected with notes. In-app messaging includes system announcements and direct-message threads with unread badges, read receipts, and a masking policy that automatically redacts phone numbers and email-like strings; a template library enables staff to insert prewritten responses, but all delivery remains in-app (no SMS/email/push). On-site search provides full-text search across titles, bodies, tags, and metadata with faceted filters (category, date range, building, media type), synonym/spell correction from an editable local dictionary, trending term counts, and a "zero results" report for operations tuning. Course/service registration supports defined rounds (e.g., 03/27/2026 9:00 AM–12:00 PM), prerequisites (age 18+, active resident status, or prior completion flags), capacity with waitlists, add/drop cutoffs (no drops within 2 hours of start), and deterministic backfill; each change produces an immutable enrollment history record.

All processing runs in a browser-only service layer with no backend dependencies; the app persists structured data in IndexedDB (profiles, messages, enrollments, events) and uses LocalStorage for lightweight settings (last active role, UI preferences). Admins can import/export a complete offline dataset via JSON using Blob/FileSaver, with schema validation and duplicate-key handling on import. Sensitive fields (document file hashes, resident IDs, notes marked "confidential") are encrypted at rest using Web Crypto (AES-GCM) with a key derived from the local password (PBKDF2, 100,000 iterations), and "in transit" protection is enforced within the app by encrypting data before any file export and requiring a password on import. Consent management is explicit: residents must accept a data-minimization notice before uploading documents, and can revoke consent to hide attachments while retaining audit entries. Audit logs record admin actions, rule changes, overrides, and message deletions with timestamp and role, and anomalous behavior detection flags patterns such as more than 30 searches/minute or repeated registration attempts within 10 seconds; flagged actions require a re-authentication Modal and are logged. Content safety review is enforced through a local review queue, basic keyword policies, and strict input sanitization to prevent injection and privilege escalation by ensuring all role checks are performed in the Angular route guards and service methods, never in the view layer.

---

## Project Metadata

**project_type:** frontend (web)
**frontend_framework:** Angular + TypeScript
**backend_framework:** none
**databases:** none
**language:** TypeScript

> Note: The metadata above supports the original prompt. The original prompt takes priority over metadata in all cases.

---

## Project Identity

**Project Name:** HarborPoint Resident & Services Management System
**Type:** Pure Frontend SPA (no backend, no Docker required)
**Framework:** Angular + TypeScript
**Storage:** IndexedDB (structured data) + LocalStorage (settings/preferences)
**Crypto:** Web Crypto API — AES-GCM encryption, PBKDF2 key derivation
**Tests:** Unit tests (`unit_tests/`) + API/Integration tests (`api_tests/`) + `run_tests.sh`

---

## Non-Negotiable Rules (Read Before Every Response)

1. **No backend. No server. No Docker.** Everything runs in the browser. All data lives in IndexedDB and LocalStorage. Never suggest or implement a server, REST API endpoint, or database connection.
2. **Angular + TypeScript only.** Do not switch frameworks. Do not use React, Vue, or plain JS.
3. **Offline-first.** The app must function with zero network access after the initial load. No external API calls at runtime except what the user explicitly triggers (file import/export).
4. **Role guards in Angular route guards and service methods — never in templates/views.** This is a security requirement.
5. **Never expose sensitive fields in plaintext.** Document file hashes, resident IDs, and confidential notes must be encrypted at rest using AES-GCM.
6. **Immutable audit log.** Audit entries are append-only; never delete or modify them programmatically.
7. **Masking policy is always on.** Phone numbers and email-like strings in messages must be automatically redacted before display.
8. **Test coverage is mandatory.** Every feature module must have corresponding unit tests and integration (API-layer) tests. Missing tests = failing QA.
9. **`.gitignore` is mandatory.** The `repo/` folder is shared via GitHub with the QA team. A proper `.gitignore` must exist at `repo/.gitignore` and must exclude all build artifacts, dependencies, and caches. Never commit `node_modules/`, `dist/`, or `.angular/`. There is no `.env` file — this project has zero environment variables, zero API keys, and zero server configuration. QA runs `npm install && npm start` and the app works immediately.

---

## Architecture Overview

```
src/
├── app/
│   ├── core/                        # Singleton services, guards, interceptors
│   │   ├── services/
│   │   │   ├── db.service.ts        # IndexedDB abstraction (Dexie.js)
│   │   │   ├── auth.service.ts      # Role management, session, re-auth modal trigger
│   │   │   ├── crypto.service.ts    # AES-GCM encrypt/decrypt, PBKDF2 key derivation
│   │   │   ├── audit.service.ts     # Immutable audit log writer
│   │   │   ├── anomaly.service.ts   # Rate limiting: >30 searches/min, repeated reg
│   │   │   ├── messaging.service.ts # DM threads, announcements, masking, templates
│   │   │   ├── search.service.ts    # Full-text, facets, synonyms, spell-correct
│   │   │   ├── enrollment.service.ts# Registration, waitlist, backfill, history
│   │   │   ├── property.service.ts  # Building → Unit → Room hierarchy, occupancy
│   │   │   ├── document.service.ts  # File attach, compliance queue, consent
│   │   │   └── import-export.service.ts # JSON Blob import/export, schema validation
│   │   └── guards/
│   │       ├── admin.guard.ts
│   │       ├── resident.guard.ts
│   │       ├── compliance.guard.ts
│   │       └── analyst.guard.ts
│   ├── shared/                      # Reusable UI components
│   │   ├── components/
│   │   │   ├── table/               # Sortable, paginated data table
│   │   │   ├── drawer/              # Side-panel drawer
│   │   │   ├── modal/               # Generic modal with confirm/cancel
│   │   │   ├── badge/               # Unread count badges
│   │   │   └── toast/               # Success/error/warning toast
│   │   └── pipes/
│   │       └── mask.pipe.ts         # Redacts phone/email patterns in text
│   ├── features/
│   │   ├── property/                # Building/Unit/Room CRUD, occupancy management
│   │   ├── residents/               # Resident profiles, move-in/out, change log
│   │   ├── documents/               # Attach, consent, compliance review queue
│   │   ├── messaging/               # Announcements, DM threads, template library
│   │   ├── search/                  # Full-text search, facets, zero-results report
│   │   ├── enrollment/              # Course/service rounds, waitlist, history
│   │   ├── analytics/               # Dashboards, A/B comparisons (Analyst role)
│   │   ├── audit/                   # Audit log viewer (Admin role)
│   │   └── settings/                # UI preferences, password change, import/export
│   └── app-routing.module.ts        # All routes guarded by role guards
├── unit_tests/                      # Jest unit tests mirroring src/app structure
├── api_tests/                       # Integration tests for service-layer contracts
├── run_tests.sh                     # One-click test runner (unit + integration)
└── README.md
```

---

## Role Matrix

| Role | Key Capabilities |
|---|---|
| **Property Administrator** | Configure buildings/units/rooms, manage residents, view audit logs, run import/export, trigger rule changes |
| **Resident User** | Maintain profile, upload documents (with consent), register/drop courses, send/receive messages |
| **Compliance Reviewer** | Approve/reject document attachments with notes, review content safety queue |
| **Operations Analyst** | Build dashboards, A/B comparisons, view search analytics, zero-results report |

---

## Data Models (IndexedDB Stores)

### `buildings`
```typescript
{ id, name, address, floors, createdAt, updatedAt }
```

### `units`
```typescript
{ id, buildingId, unitNumber, floor, type, createdAt, updatedAt }
```

### `rooms`
```typescript
{ id, unitId, roomNumber, capacity, createdAt, updatedAt }
```

### `occupancies`
```typescript
{ id, residentId, roomId, effectiveFrom, effectiveTo, reasonCode, status: 'active'|'ended', createdAt }
// Rule: only one active occupancy per resident at any time
```

### `residents`
```typescript
{
  id, firstName, lastName, email (masked in messages), phone (masked),
  dateOfBirth, status: 'active'|'inactive'|'pending',
  encryptedId: string,       // AES-GCM encrypted
  notes: { text, confidential: boolean, encryptedText?: string }[],
  consentGiven: boolean, consentTimestamp,
  createdAt, updatedAt
}
```

### `documents`
```typescript
{
  id, residentId, fileName, mimeType, sizeBytes,
  fileHash: string,          // AES-GCM encrypted at rest
  status: 'pending_review'|'approved'|'rejected',
  reviewNotes?, reviewedBy?, reviewedAt?,
  consentRecordId,           // links to consent audit entry
  hidden: boolean,           // true when consent revoked (file hidden, audit kept)
  createdAt
}
```

### `messages`
```typescript
{
  id, threadId, senderId, senderRole, recipientId?,
  body: string,              // stored post-masking
  originalBody?,             // kept for audit only, encrypted
  type: 'announcement'|'direct',
  readBy: { userId, readAt }[],
  deleted: boolean, deletedAt?, deletedBy?,
  templateId?,
  createdAt
}
```

### `threads`
```typescript
{ id, participantIds, subject, lastMessageAt, createdAt }
```

### `enrollments`
```typescript
{
  id, residentId, courseId, roundId,
  status: 'enrolled'|'waitlisted'|'dropped'|'completed',
  enrolledAt, droppedAt?, dropReasonCode?,
  historySnapshot: EnrollmentHistory[]   // immutable log of every state change
}
```

### `courses`
```typescript
{
  id, title, description, category,
  prerequisites: { type: 'age'|'active_resident'|'prior_completion', value: any }[],
  rounds: CourseRound[]
}
```

### `courseRounds`
```typescript
{
  id, courseId,
  startAt: Date, endAt: Date,
  capacity: number, waitlistCapacity: number,
  addCutoffAt: Date, dropCutoffAt: Date,   // no drops within 2h of start
  enrolled: string[], waitlisted: string[],
  status: 'open'|'closed'|'cancelled'
}
```

### `auditLogs`
```typescript
{
  id, timestamp, actorId, actorRole,
  action: string,      // e.g. 'DOCUMENT_APPROVED', 'RULE_CHANGED', 'MESSAGE_DELETED'
  targetType, targetId,
  before?, after?,     // JSON snapshots
  anomalyFlagged: boolean
}
// APPEND-ONLY — no update or delete operations allowed on this store
```

### `searchIndex`
```typescript
{ id, entityType, entityId, title, body, tags, metadata, building, category, createdAt }
```

### `searchDictionary`
```typescript
{ id, term, synonyms: string[], corrections: string[] }
```

### `consentRecords`
```typescript
{ id, residentId, action: 'granted'|'revoked', timestamp, policyVersion }
```

---

## Security Requirements

### Encryption (Web Crypto)
- **Key derivation:** PBKDF2, SHA-256, 100,000 iterations, 16-byte salt stored alongside encrypted data
- **Encryption:** AES-GCM, 256-bit key, 12-byte IV per encryption operation
- **What is encrypted:** `document.fileHash`, `resident.encryptedId`, notes with `confidential: true`
- **Export:** Full dataset encrypted before Blob creation; password required on import
- **Never store the derived key** — re-derive from password on each session unlock

### Route Guards
```typescript
// ALL role checks MUST be in guards and service methods
// NEVER check roles in templates with *ngIf="role === 'admin'" for security-sensitive UI
canActivate(): boolean {
  return this.authService.hasRole('admin');  // ✅
}
// Template-level role checks for cosmetic UI only (show/hide nav items) are acceptable
```

### Anomaly Detection
- Track search events per minute per session; if > 30 → flag, require re-auth modal, write audit entry
- Track registration attempts per 10-second window; if repeated for same course → flag + re-auth
- Re-auth modal: prompt current password, re-derive key, confirm session

### Input Sanitization
- All user text inputs sanitized with DOMPurify before persistence
- No `innerHTML` binding without explicit `DomSanitizer.bypassSecurityTrustHtml` justification
- SQL-injection not applicable (no SQL), but prevent prototype pollution in JSON imports

### Masking Policy
```typescript
// Applied to ALL message bodies before display and before persistence in body field
const PHONE_PATTERN = /(\+?\d[\d\s\-().]{7,}\d)/g;
const EMAIL_PATTERN = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
masked = raw.replace(PHONE_PATTERN, '[PHONE REDACTED]').replace(EMAIL_PATTERN, '[EMAIL REDACTED]');
```

---

## Functional Rules

### Property / Occupancy
- One active occupancy per resident (enforced in `property.service.ts`)
- Move-in/out requires: reason code (from enum), timestamp, actor audit entry
- Change log stored in `occupancies` table as historical records

### Document Workflow
1. Resident clicks "Upload" → Consent modal appears (data-minimization notice)
2. On accept → consent record written → file stored, status = `pending_review`
3. Compliance Reviewer sees queue → approves/rejects with notes
4. If resident revokes consent → `document.hidden = true`, audit entry kept, file not deleted from IndexedDB (only hidden from UI)
5. Max 5 files per resident, max 10 MB each, types: PDF/JPG/PNG only

### Enrollment Rules
- Prerequisites checked before enrollment: age ≥ 18, `resident.status === 'active'`, prior course completion flag
- Add cutoff: defined per round (`addCutoffAt`)
- Drop cutoff: no drops within 2 hours of `round.startAt`
- Waitlist backfill: deterministic (FIFO from waitlist array)
- Every state change → immutable `EnrollmentHistory` entry appended

### Search
- Full-text across: title, body, tags, metadata
- Facets: category, date range, building, media type
- Synonym expansion from `searchDictionary`
- Spell correction from `searchDictionary.corrections`
- Track trending terms (count per term per day)
- Zero-results log: record query + timestamp when no results found

### Messaging
- Announcements: one-to-many, sent by Admin/Staff
- DM threads: two-party
- Unread badges: count of messages where `readBy` does not include current user
- Read receipts: written when message rendered in viewport
- Template library: Admin-managed pre-written responses, insertable in compose
- No SMS/email/push — all delivery is in-app only

---

## Import / Export

```typescript
// Export
const snapshot = await this.dbService.exportAll();  // all IndexedDB stores
const encrypted = await this.cryptoService.encrypt(JSON.stringify(snapshot), password);
const blob = new Blob([encrypted], { type: 'application/octet-stream' });
FileSaver.saveAs(blob, `harborpoint-export-${Date.now()}.hpd`);

// Import
const decrypted = await this.cryptoService.decrypt(fileBuffer, password);
const data = JSON.parse(decrypted);
// Schema validation → duplicate key handling (skip or overwrite option)
await this.dbService.importAll(data);
```

---

## UI/UX Standards

- **Design language:** Modern SaaS — use Angular Material or PrimeNG with custom theming
- **Color palette:** Deep navy primary (#1E3A5F), teal accent (#2DD4BF), white backgrounds, subtle gray borders
- **Typography:** Inter or Geist font family
- **Components:**
  - `<app-table>` — sortable, paginated, row-click opens Drawer
  - `<app-drawer>` — right-side slide-in panel (profile, unit details)
  - `<app-modal>` — centered overlay (consent, override, re-auth, confirm)
  - `<app-badge>` — unread count indicator
  - `<app-toast>` — top-right notification stack
- **Responsiveness:** All layouts must work at 1024px, 1280px, 1440px, 1920px
- **Interaction feedback:** All buttons have loading state + disabled state during async ops
- **Empty states:** Every list/table has a meaningful empty state illustration + message
- **Error states:** All service errors surface as toast notifications with actionable messages

---

## Testing Requirements

### Structure
```
unit_tests/
├── services/
│   ├── crypto.service.spec.ts
│   ├── auth.service.spec.ts
│   ├── property.service.spec.ts
│   ├── enrollment.service.spec.ts
│   ├── messaging.service.spec.ts
│   ├── search.service.spec.ts
│   ├── document.service.spec.ts
│   ├── audit.service.spec.ts
│   └── anomaly.service.spec.ts
└── pipes/
    └── mask.pipe.spec.ts

api_tests/
├── property.integration.spec.ts   # CRUD + occupancy rules
├── enrollment.integration.spec.ts # Full enrollment flow, waitlist, drop rules
├── messaging.integration.spec.ts  # Thread creation, masking, read receipts
├── search.integration.spec.ts     # Full-text, facets, zero-results
├── document.integration.spec.ts   # Upload → review → consent revoke flow
└── auth.integration.spec.ts       # Role guard checks, anomaly detection
```

### Test Runner (`run_tests.sh`)
```bash
#!/bin/bash
set -e
echo "=== HarborPoint Test Suite ==="
echo ""
echo "--- Unit Tests ---"
npx jest unit_tests/ --coverage --coverageReporters=text
echo ""
echo "--- Integration Tests ---"
npx jest api_tests/ --runInBand
echo ""
echo "=== All tests complete ==="
```

### Minimum Coverage Requirements
- Happy paths: enrollment, document upload, property hierarchy, messaging, search
- Error paths: 401-equivalent (wrong role), 403-equivalent (guard block), not-found, duplicate key on import, capacity exceeded
- Security: role guard cannot be bypassed, masking always applied, anomaly threshold triggers re-auth
- Boundaries: max file size (10 MB), max files (5), drop cutoff (within 2h), search >30/min

---

## LocalStorage Keys

```typescript
const LS_KEYS = {
  LAST_ACTIVE_ROLE: 'hp_last_role',
  UI_THEME: 'hp_theme',
  UI_DENSITY: 'hp_density',
  SIDEBAR_COLLAPSED: 'hp_sidebar',
  SEARCH_HISTORY: 'hp_search_history',   // last 20 terms only, no sensitive data
};
```

---

## Development Sequence (Follow This Order)

1. Project scaffold + routing + role system + DB schema + **`.gitignore`** (created in Phase 1)
2. Core services: `db.service`, `crypto.service`, `auth.service`, `audit.service`
3. Shared UI components: table, drawer, modal, badge, toast
4. Property module: building/unit/room CRUD + occupancy management
5. Resident module: profiles, move-in/out, change log
6. Document module: upload flow, consent modal, compliance queue
7. Messaging module: announcements, DM threads, masking, templates
8. Search module: full-text, facets, synonyms, zero-results log
9. Enrollment module: rounds, prerequisites, waitlist, immutable history
10. Analytics module: dashboards, A/B comparisons
11. Audit log viewer
12. Import/export with encryption
13. Anomaly detection + re-auth modal
14. Unit tests + integration tests + run_tests.sh
15. README finalization

---

## `.gitignore` — Required Content for `repo/.gitignore`

Create this file at `repo/.gitignore` in Phase 1. The QA team clones the GitHub repo — anything listed here must never appear in the repository.

```gitignore
# Dependencies
node_modules/

# Angular build output
dist/
.angular/
.angular/cache/

# Test coverage output
coverage/
jest-coverage/
.jest-cache/

# OS files
.DS_Store
Thumbs.db

# IDE / Editor
.idea/
.vscode/
*.suo
*.ntvs*
*.njsproj
*.sln

# Logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Temporary files
*.tmp
*.temp
.tmp/

# App-generated export files (runtime only, not source)
*.hpd
```

> **Note:** No `.env` file exists or is needed. This is a fully offline, browser-only app with no environment variables, no API keys, and no server configuration. The QA team runs `npm install && npm start` — that's it.

---

## README Must Include

```markdown
## How to Run
npm install
npm start
# Access at http://localhost:4200

## Default Test Credentials (local only)
Admin: admin / harborpoint2024
Resident: resident / harborpoint2024
Compliance: compliance / harborpoint2024
Analyst: analyst / harborpoint2024

## How to Run Tests
chmod +x run_tests.sh
./run_tests.sh

## How to Import/Export Data
Settings → Import/Export → Enter password → Select file

## Verification
1. Log in as Admin → Create a building → Add a unit → Add a room
2. Log in as Resident → Fill profile → Upload a document → Register for a course
3. Log in as Compliance → Approve the document
4. Log in as Analyst → View the dashboard
```