# HarborPoint System Design Document

## 1. Project Overview

HarborPoint is a fully offline, browser-only Resident & Services Management System built for on-site property teams. It runs as an Angular 17 Single-Page Application with zero backend dependencies. All data is persisted in IndexedDB via Dexie.js, with sensitive fields encrypted using the Web Crypto API (AES-GCM + PBKDF2). The application is containerized with Docker and served via Nginx.

### Goals

- **Offline-first**: full functionality with zero network access after initial load
- **Role-based access**: four distinct roles with enforced route guards and service-level checks
- **Data security**: AES-GCM encryption at rest, PBKDF2 key derivation, masking of PII in messages
- **Auditability**: append-only audit log of all admin actions, anomaly detection with re-auth
- **Production quality**: premium SaaS-grade UI, comprehensive test suite, Docker deployment

---

## 2. Architecture

### High-Level Architecture

```
+------------------------------------------------------------------+
|                         BROWSER                                   |
|                                                                   |
|  +------------------------------------------------------------+  |
|  |                   Angular 17 SPA                            |  |
|  |                                                              |  |
|  |  +------------------+    +-----------------------------+     |  |
|  |  |  Feature Modules |    |     Shared Components       |     |  |
|  |  |                  |    |                             |     |  |
|  |  |  - Property      |    |  Table, Drawer, Modal,      |     |  |
|  |  |  - Residents     |    |  Badge, Toast, StatCard,    |     |  |
|  |  |  - Documents     |    |  Forms (Input, Select,      |     |  |
|  |  |  - Messaging     |    |  Textarea, FileUpload),     |     |  |
|  |  |  - Search        |    |  StatusBadge, RoleBadge,    |     |  |
|  |  |  - Enrollment    |    |  EmptyState, MaskPipe       |     |  |
|  |  |  - Analytics     |    +-----------------------------+     |  |
|  |  |  - Audit         |                                        |  |
|  |  |  - Settings      |    +-----------------------------+     |  |
|  |  +------------------+    |      Route Guards           |     |  |
|  |                          |  Admin, Resident, Compliance|     |  |
|  |                          |  Analyst, MultiRole         |     |  |
|  |                          +-----------------------------+     |  |
|  |                                                              |  |
|  |  +--------------------------------------------------------+  |  |
|  |  |                  Core Services                          |  |  |
|  |  |                                                          |  |  |
|  |  |  AuthService     PropertyService   ResidentService      |  |  |
|  |  |  CryptoService   DocumentService   MessagingService     |  |  |
|  |  |  AuditService    SearchService     EnrollmentService    |  |  |
|  |  |  AnomalyService  ImportExportService  ThemeService      |  |  |
|  |  |  AnalyticsService                                       |  |  |
|  |  +---------------------------+----------------------------+  |  |
|  |                              |                               |  |
|  +------------------------------|-------------------------------+  |
|                                 |                                  |
|         +-----------------------+------------------------+         |
|         |                       |                        |         |
|  +------v-------+    +---------v--------+    +---------v-------+  |
|  |   Dexie.js   |    |  LocalStorage    |    | Web Crypto API  |  |
|  |  (IndexedDB) |    |  (Preferences)   |    | (AES-GCM,       |  |
|  |              |    |                  |    |  PBKDF2)        |  |
|  |  18 stores   |    |  hp_last_role    |    |                 |  |
|  |  per schema  |    |  hp_theme        |    |  encrypt/decrypt|  |
|  |  below       |    |  hp_density      |    |  deriveKey      |  |
|  |              |    |  hp_sidebar      |    |  hashFile       |  |
|  |              |    |  hp_vt_*         |    |                 |  |
|  +--------------+    +------------------+    +-----------------+  |
+------------------------------------------------------------------+
```

### Docker Serving Layer

```
+-------------------------------------------------------------------+
|                     Docker Compose                                 |
|                                                                    |
|  +-----------------------------+  +----------------------------+   |
|  |   app service               |  |   test service             |   |
|  |                             |  |                            |   |
|  |  Dockerfile (multi-stage):  |  |  Dockerfile.test:          |   |
|  |                             |  |                            |   |
|  |  Stage 1: node:20-alpine   |  |  node:20-alpine            |   |
|  |    npm install              |  |    npm install             |   |
|  |    ng build --production    |  |    chmod +x run_tests.sh   |   |
|  |                             |  |    CMD run_tests.sh        |   |
|  |  Stage 2: nginx:alpine     |  |                            |   |
|  |    COPY dist/ -> html/     |  |  Runs:                     |   |
|  |    COPY nginx.conf         |  |    jest unit_tests/         |   |
|  |    EXPOSE 80               |  |    jest api_tests/          |   |
|  |                             |  |      --runInBand           |   |
|  |  Port: 4200 -> 80          |  |                            |   |
|  +-----------------------------+  +----------------------------+   |
|                                                                    |
|  nginx.conf:                                                       |
|    try_files $uri $uri/ /index.html  (SPA fallback routing)       |
|    gzip on (text, css, json, js, xml)                             |
+-------------------------------------------------------------------+
```

---

## 3. Module Breakdown

### 3.1 Property Module (`features/property/`)

**Responsibility**: Building -> Unit -> Room hierarchy CRUD, occupancy management (move-in/move-out).

**Components**: `PropertyComponent`, `BuildingDrawerComponent`, `UnitDrawerComponent`, `MoveInModalComponent`, `MoveOutModalComponent`

**Service Dependencies**: `PropertyService`, `ResidentService`, `DbService`, `AuditService`

**Key Features**: Occupancy stats per building, one-active-occupancy-per-resident enforcement, reason code tracking.

### 3.2 Residents Module (`features/residents/`)

**Responsibility**: Resident profiles, two-panel roster view, 5-tab detail drawer (Profile, Notes, Documents, Enrollment, Change Log).

**Components**: `ResidentListComponent`, `ResidentDrawerComponent`, `MyProfileComponent`, `AddResidentModalComponent`

**Service Dependencies**: `ResidentService`, `PropertyService`, `EnrollmentService`, `DbService`, `AuthService`

**Key Features**: Sidebar filters (status, building), full-text search, inline profile editing, confidential notes, AES-GCM encrypted resident IDs.

### 3.3 Documents Module (`features/documents/`)

**Responsibility**: File upload with consent flow, compliance review queue, approve/reject with notes.

**Components**: `DocumentQueueComponent`, `DocumentUploadComponent`, `DocumentReviewDrawerComponent`, `ConsentModalComponent`

**Service Dependencies**: `DocumentService`, `CryptoService`, `AuditService`

**Key Features**: Max 5 files per resident (10 MB each, PDF/JPG/PNG), SHA-256 hashing, AES-GCM encrypted file data, consent grant/revoke with audit trail, hidden flag on revoke.

### 3.4 Messaging Module (`features/messaging/`)

**Responsibility**: In-app DM threads, system announcements, template library, PII masking.

**Components**: `MessagingComponent`

**Service Dependencies**: `MessagingService`, `AuthService`, `CryptoService`, `AuditService`

**Key Features**: Two-panel chat UI, auto-redaction of phone/email patterns, read receipts, unread badges, template insertion, admin-access audit logging, encrypted original body for audit.

### 3.5 Search Module (`features/search/`)

**Responsibility**: Full-text search with Lunr.js, faceted filters, synonym/spell correction, trending terms, zero-results reporting.

**Components**: `SearchComponent`

**Service Dependencies**: `SearchService`, `AnomalyService`

**Key Features**: Lunr.js index built from IndexedDB searchIndex store, synonym expansion from editable dictionary, spell suggestions, category/building/date/mediaType facets, >30 searches/min anomaly detection.

### 3.6 Enrollment Module (`features/enrollment/`)

**Responsibility**: Course catalog, registration rounds, capacity/waitlist management, prerequisite checking.

**Components**: `EnrollmentComponent`

**Service Dependencies**: `EnrollmentService`, `AnomalyService`, `AuditService`

**Key Features**: Category-filtered course grid, detail drawer with round cards and capacity bars, enroll/waitlist/drop modals, FIFO waitlist backfill, immutable enrollment history, admin course/round creation, 2-hour drop cutoff enforcement.

### 3.7 Analytics Module (`features/analytics/`)

**Responsibility**: Operational dashboards, A/B comparisons (building vs building, date range vs date range).

**Components**: `AnalyticsDashboardComponent`

**Service Dependencies**: `AnalyticsService`, `SearchService`, `DbService`

**Key Features**: Chart.js integration (bar, line, doughnut, area charts), 4 summary stat cards with count-up animation, occupancy by building, enrollment trends, search health, compliance pipeline, messaging activity, building/date-range comparison with winner badges.

### 3.8 Audit Module (`features/audit/`)

**Responsibility**: Immutable audit log viewer with filtering, detail drawer, JSON export.

**Components**: `AuditLogComponent`

**Service Dependencies**: `AuditService`, `AuthService`

**Key Features**: Filter bar (actor, role, action, date range, anomaly toggle), alternating row table with amber anomaly highlighting, detail drawer with before/after JSON diff (red/green cards), export with warning modal.

### 3.9 Settings Module (`features/settings/`)

**Responsibility**: Data management, search dictionary, content safety policies, message templates, UI preferences, security.

**Components**: `SettingsComponent`

**Service Dependencies**: `ImportExportService`, `SearchService`, `MessagingService`, `AuthService`, `ThemeService`, `DbService`, `ToastService`

**Key Features**: 6-section sidebar nav, encrypted export/import with file dropzone and merge/overwrite modes, inline dictionary editing, policy toggle cards, template grid with CRUD, light/dark theme with preview thumbnails, density settings, password change.

---

## 4. IndexedDB Store Schemas

All stores managed by `DbService extends Dexie` with auto-incrementing integer primary keys.

| Store | Indexes | Key Fields |
|-------|---------|------------|
| `buildings` | `++id, name, createdAt` | name, address, floors |
| `units` | `++id, buildingId, unitNumber` | buildingId, unitNumber, floor, type |
| `rooms` | `++id, unitId, roomNumber` | unitId, roomNumber, capacity |
| `occupancies` | `++id, residentId, roomId, status` | residentId, roomId, effectiveFrom, effectiveTo, reasonCode, status |
| `residents` | `++id, status, firstName, lastName` | firstName, lastName, email, phone, dateOfBirth, status, encryptedId, notes[], consentGiven |
| `documents` | `++id, residentId, status, hidden` | residentId, fileName, mimeType, sizeBytes, fileHash (encrypted), fileData (encrypted), status, reviewNotes, consentRecordId, hidden |
| `messages` | `++id, threadId, senderId, type, deleted` | threadId, senderId, senderRole, body (masked), originalBody (encrypted), type, readBy[], deleted |
| `threads` | `++id, *participantIds, lastMessageAt` | participantIds[], subject, lastMessageAt |
| `enrollments` | `++id, residentId, roundId, status` | residentId, courseId, roundId, status, enrolledAt, historySnapshot[] |
| `courses` | `++id, title, category` | title, description, category, prerequisites[] |
| `courseRounds` | `++id, courseId, status, startAt` | courseId, startAt, endAt, capacity, waitlistCapacity, addCutoffAt, dropCutoffAt, enrolled[], waitlisted[], status |
| `auditLogs` | `++id, timestamp, actorId, action, anomalyFlagged` | timestamp, actorId, actorRole, action, targetType, targetId, before, after, anomalyFlagged |
| `searchIndex` | `++id, entityType, entityId` | entityType, entityId, title, body, tags[], building, category |
| `searchDictionary` | `++id, term` | term, synonyms[], corrections[] |
| `consentRecords` | `++id, residentId, timestamp` | residentId, action, timestamp, policyVersion |
| `zeroResultsLog` | `++id, timestamp` | query, timestamp, userId |
| `contentPolicies` | `++id, enabled` | pattern, type, action, severity, enabled |
| `messageTemplates` | `++id, name, category` | name, subject, body, category, createdBy |

---

## 5. Security Design

### 5.1 Encryption Architecture

```
Password Entry (login / export / import)
         |
         v
  +------------------+
  |     PBKDF2       |
  |  SHA-256          |
  |  100,000 iter     |
  |  16-byte salt     |
  +--------+---------+
           |
           v
  +------------------+
  |   AES-GCM Key    |
  |   256-bit         |
  |   (never stored)  |
  +--------+---------+
           |
     +-----+------+
     |            |
     v            v
 ENCRYPT       DECRYPT
 12-byte IV    from stored
 per op        IV + salt
     |            |
     v            v
 EncryptedPayload:
 { ciphertext, iv, salt }
```

**What is encrypted at rest:**
- `resident.encryptedId` — AES-GCM with internal key
- `document.fileHash` — SHA-256 hash, encrypted
- `document.fileData` — entire file content, encrypted
- `message.originalBody` — pre-masking body for audit, encrypted
- `notes[].encryptedText` — confidential resident notes
- Export `.hpd` files — entire dataset encrypted with user-provided password

**Validation tokens**: Each role stores an encrypted test payload in LocalStorage (`hp_vt_{role}`). On login, the password is validated by attempting decryption. On first run, the default password creates the token.

### 5.2 Session Lifecycle

```
  [Login Page]
       |
       | username + password
       v
  AuthService.login()
       |
       +-- Map username -> role
       +-- selectRole(role, password)
       |     +-- Validate against hp_vt_{role} or DEFAULT_PASSWORDS
       |     +-- Store hp_last_role in LocalStorage (UX only)
       |     +-- Emit AuthState { role, isLoggedIn: true, isLocked: false }
       |     +-- Start 30-min inactivity timer
       |
       v
  [App Shell — role-filtered sidebar]
       |
       +-- Activity events (mousedown, keydown, touchstart, scroll)
       |     reset inactivity timer
       |
       +-- Inactivity timeout (30 min)
       |     |
       |     v
       |   lockSession() -> AuthState { isLocked: true } -> /login
       |
       +-- Anomaly detected (>30 searches/min, >3 reg attempts/10s)
       |     |
       |     v
       |   Re-auth modal (3 attempts, then auto-lock)
       |
       +-- Manual lock (sidebar lock button)
             |
             v
           lockSession() -> /login
```

### 5.3 Anomaly Detection

| Trigger | Threshold | Window | Action |
|---------|-----------|--------|--------|
| Search rate | > 30 searches | 60 seconds | Emit `anomalyDetected$`, audit `ANOMALY_FLAGGED`, open re-auth modal |
| Registration attempts | > 3 for same resident+round | 10 seconds | Emit `anomalyDetected$`, audit `ANOMALY_FLAGGED`, open re-auth modal |

Re-auth flow: User must enter password within 3 attempts. Failure or cancel triggers `lockSession()`.

### 5.4 Route Guards

All role checks are enforced in Angular route guards and service methods — never in templates for security-sensitive decisions.

| Guard | Allowed Roles |
|-------|---------------|
| `AdminGuard` | admin |
| `ResidentGuard` | resident |
| `ComplianceGuard` | compliance |
| `AnalystGuard` | analyst |
| `AllRolesGuard` | admin, resident, compliance, analyst |
| `AdminOrComplianceGuard` | admin, compliance |
| `AdminOrResidentGuard` | admin, resident |

---

## 6. Role Permission Matrix

| Feature | Admin | Resident | Compliance | Analyst |
|---------|-------|----------|------------|---------|
| Dashboard | X | | | |
| Property CRUD | X | | | |
| Residents Roster | X | | X | |
| My Profile | | X | | |
| Document Upload | | X | | |
| Document Review Queue | | | X | |
| Messaging | X | X | X | X |
| Search | X | X | X | X |
| Enrollment | X | X | | |
| Analytics Dashboard | | | | X |
| Audit Log | X | | | |
| Settings | X | | | |

---

## 7. Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **Dexie.js over raw IndexedDB** | Dexie provides a clean Promise-based API, compound indexes, and transaction support. Avoids verbose IDBRequest callback pattern. |
| **Standalone components** | Angular 17 standalone components remove NgModule boilerplate. Each component declares its own imports, enabling tree-shaking. |
| **OnPush change detection** | All feature components use `ChangeDetectionStrategy.OnPush` with explicit `ChangeDetectorRef.markForCheck()` for performance. |
| **Fire-and-forget audit** | `AuditService.log()` returns `void` (not Promise). Audit writes never block user operations. Errors are caught and logged silently. |
| **Lunr.js for search** | Lunr.js provides full-text indexing with tf-idf scoring entirely in-browser. UMD module loaded via `require()` for Jest/esbuild compatibility. |
| **Chart.js (not ng2-charts)** | Direct Chart.js canvas API with `ViewChild` refs avoids wrapper overhead. Tree-shakeable registration of only needed controllers. |
| **CSS custom properties for theming** | All colors reference `--hp-*` variables. `body.dark-theme` overrides them, enabling theme switching without rebuilding. |
| **Encrypted export files (.hpd)** | Full dataset encrypted with user password before Blob creation. Prevents plaintext exposure of sensitive data in export files. |
| **In-memory auth state** | Role is stored only in BehaviorSubject — never written to LocalStorage for security. Only `hp_last_role` (UX hint) persisted. |
| **Masking before persistence** | Message bodies are masked (phone/email redacted) before storage. Original body encrypted separately for audit-only access. |
| **fake-indexeddb for testing** | Integration tests run against a real Dexie database in a fake IndexedDB environment, ensuring actual query behavior is tested. |

---

## 8. Data Flow Diagrams

### 8.1 Document Upload & Review

```
Resident                    System                     Compliance Reviewer
   |                          |                              |
   |  Click "Upload"          |                              |
   |------------------------->|                              |
   |                          |                              |
   |  Consent Modal           |                              |
   |<-------------------------|                              |
   |                          |                              |
   |  Accept Consent          |                              |
   |------------------------->|                              |
   |                    ConsentRecord written                 |
   |                    AuditAction.CONSENT_GRANTED           |
   |                          |                              |
   |  Select File (PDF/JPG/PNG, <= 10MB)                     |
   |------------------------->|                              |
   |                    Validate: type, size, count <= 5      |
   |                    SHA-256 hash file                     |
   |                    AES-GCM encrypt fileData              |
   |                    AES-GCM encrypt fileHash              |
   |                    Save Document (status: pending_review)|
   |                    AuditAction.DOCUMENT_UPLOADED         |
   |                          |                              |
   |                          |  Document appears in queue   |
   |                          |----------------------------->|
   |                          |                              |
   |                          |        Open review drawer    |
   |                          |<-----------------------------|
   |                          |                              |
   |                          |  Approve / Reject + notes    |
   |                          |<-----------------------------|
   |                    Update status                         |
   |                    AuditAction.DOCUMENT_APPROVED/REJECTED|
   |                          |                              |
```

### 8.2 Enrollment + Waitlist Backfill

```
Resident                    EnrollmentService              Database
   |                              |                           |
   |  Click "Enroll"              |                           |
   |----------------------------->|                           |
   |                              |                           |
   |                   Check anomaly (>3 attempts/10s?)       |
   |                   Check prerequisites:                   |
   |                     - active_resident?                   |
   |                     - age >= 18?                         |
   |                     - prior_completion?                  |
   |                   Check add cutoff not passed            |
   |                   Check not already enrolled             |
   |                              |                           |
   |                   capacity available?                    |
   |                     YES -> status: enrolled              |
   |                            add to round.enrolled[]       |
   |                     NO  -> waitlist available?            |
   |                              YES -> status: waitlisted   |
   |                                     add to waitlisted[]  |
   |                              NO  -> CAPACITY_EXCEEDED    |
   |                              |                           |
   |                   Append historySnapshot entry           |
   |                   AuditAction.ENROLLMENT_CREATED         |
   |                              |                           |
   |  Result: enrolled/waitlisted |                           |
   |<-----------------------------|                           |
   |                              |                           |
   === LATER: Someone drops ===   |                           |
   |                              |                           |
   |                   drop() called                          |
   |                   Check drop cutoff (2h before start)    |
   |                   Update enrollment: dropped             |
   |                   Remove from round.enrolled[]           |
   |                   backfillFromWaitlist(roundId):          |
   |                     Take FIFO from waitlisted[]          |
   |                     Move to enrolled[]                   |
   |                     Update enrollment: enrolled          |
   |                     Append historySnapshot               |
   |                     AuditAction.WAITLIST_PROMOTED        |
   |                              |                           |
```

### 8.3 Search Query Pipeline

```
User                        SearchComponent             SearchService
  |                              |                           |
  |  Type query in search bar    |                           |
  |----------------------------->|                           |
  |                              |  search(query, userId)    |
  |                              |-------------------------->|
  |                              |                           |
  |                              |   1. recordSearch()       |
  |                              |      (anomaly check)      |
  |                              |                           |
  |                              |   2. expandQuery()        |
  |                              |      - load dictionary    |
  |                              |      - synonym expansion  |
  |                              |      - spell correction   |
  |                              |                           |
  |                              |   3. _safeSearch(lunr)    |
  |                              |      - query Lunr index   |
  |                              |      - fallback: spell    |
  |                              |        suggestion query   |
  |                              |                           |
  |                              |   4. Zero results?        |
  |                              |      -> log to            |
  |                              |         zeroResultsLog    |
  |                              |                           |
  |                              |   5. _applyFilters()      |
  |                              |      - category           |
  |                              |      - building           |
  |                              |      - date range         |
  |                              |      - media type         |
  |                              |                           |
  |                              |   6. _trackTrending()     |
  |                              |                           |
  |                              |   SearchResult[]          |
  |                              |<--------------------------|
  |                              |                           |
  |  Display results with        |                           |
  |  highlighted matches,        |                           |
  |  spell suggestion pill,      |                           |
  |  facet sidebar               |                           |
  |<-----------------------------|                           |
```

---

## 9. Testing Strategy

### Test Structure

```
unit_tests/                     # 15 suites, 207 tests
  services/
    auth.service.spec.ts
    crypto.service.spec.ts
    property.service.spec.ts
    resident.service.spec.ts
    document.service.spec.ts
    messaging.service.spec.ts
    search.service.spec.ts
    enrollment.service.spec.ts
    audit.service.spec.ts
    anomaly.service.spec.ts
    analytics.service.spec.ts
    toast.service.spec.ts
    db.service.spec.ts
    table.component.spec.ts
  pipes/
    mask.pipe.spec.ts

api_tests/                      # 9 suites, 121 tests
  property.integration.spec.ts
  residents.integration.spec.ts
  enrollment.integration.spec.ts
  messaging.integration.spec.ts
  search.integration.spec.ts
  document.integration.spec.ts
  auth.integration.spec.ts
  audit.integration.spec.ts
  import-export.integration.spec.ts
```

### Unit vs Integration

| Aspect | Unit Tests | Integration Tests |
|--------|-----------|-------------------|
| Location | `unit_tests/` | `api_tests/` |
| Jest flags | default | `--runInBand` (sequential, shared fake-indexeddb) |
| Database | Mocked or minimal TestBed | Real Dexie + `fake-indexeddb/auto` |
| Isolation | Per-test setup/teardown | `beforeEach` table clears for data isolation |
| Focus | Single service method behavior | Multi-service workflows (enroll->drop->backfill) |

### Docker Test Execution

```
docker compose run test
  |
  v
Dockerfile.test:
  FROM node:20-alpine
  npm install
  CMD ["sh", "run_tests.sh"]
  |
  v
run_tests.sh:
  1. npx jest unit_tests/ --forceExit --ci
  2. npx jest api_tests/ --runInBand --forceExit --ci
  3. Exit 0 (all pass) or 1 (any fail)
```

### Test Environment Setup (`setup-jest.ts`)

- **Cross-realm ArrayBuffer fix**: Patches `%TypedArray%.prototype.buffer` to return module-realm ArrayBuffers compatible with Node.js WebCrypto
- **WebCrypto polyfill**: Assigns Node.js native `webcrypto` to `globalThis.crypto`
- **Blob polyfills**: `Blob.prototype.arrayBuffer` and `Blob.prototype.text` for jsdom
- **structuredClone polyfill**: Deep-clone implementation for jsdom environments
