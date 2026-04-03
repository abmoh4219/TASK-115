# HarborPoint Internal Service-Layer API Specification

## Table of Contents

1. [AuthService](#1-authservice)
2. [CryptoService](#2-cryptoservice)
3. [DbService](#3-dbservice)
4. [AuditService](#4-auditservice)
5. [AnomalyService](#5-anomalyservice)
6. [PropertyService](#6-propertyservice)
7. [ResidentService](#7-residentservice)
8. [DocumentService](#8-documentservice)
9. [MessagingService](#9-messagingservice)
10. [SearchService](#10-searchservice)
11. [EnrollmentService](#11-enrollmentservice)
12. [AnalyticsService](#12-analyticsservice)
13. [ImportExportService](#13-importexportservice)
14. [ThemeService](#14-themeservice)
15. [ToastService](#15-toastservice)
16. [TypeScript Interfaces](#16-typescript-interfaces)
17. [IndexedDB Store Schemas](#17-indexeddb-store-schemas)
18. [LocalStorage Keys](#18-localstorage-keys)
19. [Docker Service Reference](#19-docker-service-reference)
20. [Data Flow Diagrams](#20-data-flow-diagrams)

---

## 1. AuthService

**File**: `src/app/core/services/auth.service.ts`
**Provided in**: root
**Dependencies**: `CryptoService`, `Router`, `NgZone`

### Types

```typescript
type UserRole = 'admin' | 'resident' | 'compliance' | 'analyst';

interface AuthState {
  role:       UserRole | null;
  isLocked:   boolean;
  isLoggedIn: boolean;
}
```

### Observable

```typescript
state$: Observable<AuthState>
```

Emits on every auth state change (login, lock, logout).

### Methods

#### `login(username, password)`

```typescript
async login(username: string, password: string): Promise<{ success: boolean; error?: string }>
```

Maps username (case-insensitive) to role, validates password. Returns generic error on any failure.

| Param | Type | Description |
|-------|------|-------------|
| `username` | `string` | One of: admin, resident, compliance, analyst |
| `password` | `string` | User password |

**Returns**: `{ success: true }` or `{ success: false, error: 'Invalid username or password' }`

**Example**:
```typescript
const result = await authService.login('admin', 'harborpoint2024');
if (result.success) router.navigate(['/dashboard']);
```

#### `selectRole(role, password)`

```typescript
async selectRole(role: UserRole, password: string): Promise<boolean>
```

Internal login — validates password against stored validation token or default. On success sets auth state, saves `hp_last_role`, starts inactivity timer.

#### `lockSession()`

```typescript
lockSession(): void
```

Sets `isLocked: true`, clears inactivity timer, navigates to `/login`.

#### `reAuthenticate(password)`

```typescript
async reAuthenticate(password: string): Promise<boolean>
```

Re-validates password for current role. Used by the anomaly re-auth modal.

#### `hasRole(role)`

```typescript
hasRole(role: UserRole): boolean
```

Returns `true` if logged in, not locked, and current role matches.

#### `hasAnyRole(...roles)`

```typescript
hasAnyRole(...roles: UserRole[]): boolean
```

Returns `true` if logged in, not locked, and current role is in the list.

#### `getCurrentRole()`

```typescript
getCurrentRole(): UserRole | null
```

#### `isLoggedIn()`

```typescript
isLoggedIn(): boolean
```

Returns `true` if logged in and not locked.

#### `getLastRole()`

```typescript
getLastRole(): UserRole | null
```

Reads `hp_last_role` from LocalStorage. UX hint only.

#### `logout()`

```typescript
logout(): void
```

Clears auth state, navigates to `/login`.

#### `changePassword(role, currentPassword, newPassword)`

```typescript
async changePassword(role: UserRole, currentPassword: string, newPassword: string): Promise<boolean>
```

Validates current password, creates new validation token. Returns `false` if current password wrong.

#### `resetInactivityTimer()`

```typescript
resetInactivityTimer(): void
```

Resets the 30-minute inactivity timer. Called on user activity events.

---

## 2. CryptoService

**File**: `src/app/core/services/crypto.service.ts`
**Provided in**: root
**Dependencies**: none (uses Web Crypto API)

### Types

```typescript
interface EncryptedPayload {
  ciphertext: string;  // base64
  iv:         string;  // base64 (12 bytes)
  salt:       string;  // base64 (16 bytes)
}
```

### Methods

#### `deriveKey(password, salt)`

```typescript
async deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey>
```

PBKDF2 SHA-256 with 100,000 iterations. Returns AES-GCM 256-bit key.

#### `encrypt(plaintext, password)`

```typescript
async encrypt(plaintext: string, password: string): Promise<EncryptedPayload>
```

Generates random salt + IV, derives key, encrypts with AES-GCM.

**Example**:
```typescript
const payload = await crypto.encrypt('sensitive data', 'mypassword');
// { ciphertext: 'base64...', iv: 'base64...', salt: 'base64...' }
```

#### `decrypt(payload, password)`

```typescript
async decrypt(payload: EncryptedPayload, password: string): Promise<string>
```

Derives key from payload salt, decrypts. Throws `DOMException` on wrong password.

#### `validatePassword(password, testPayload)`

```typescript
async validatePassword(password: string, testPayload: EncryptedPayload): Promise<boolean>
```

Attempts decryption of test payload. Returns `true` if successful.

#### `createValidationToken(password)`

```typescript
async createValidationToken(password: string): Promise<EncryptedPayload>
```

Encrypts a known string to create a validation token for future password checks.

#### `hashFile(data)`

```typescript
async hashFile(data: ArrayBuffer): Promise<string>
```

SHA-256 hash, returned as hex string.

#### `bufferToBase64(buffer)` / `base64ToBuffer(base64)`

```typescript
bufferToBase64(buffer: ArrayBuffer | Uint8Array): string
base64ToBuffer(base64: string): ArrayBuffer
```

Utility conversion functions.

#### `generateSalt()` / `generateIV()`

```typescript
generateSalt(): Uint8Array   // 16 bytes
generateIV(): Uint8Array     // 12 bytes
```

---

## 3. DbService

**File**: `src/app/core/services/db.service.ts`
**Provided in**: root
**Extends**: `Dexie`

### Tables

18 Dexie tables — see [IndexedDB Store Schemas](#17-indexeddb-store-schemas) for full details.

### Methods

#### `exportAll()`

```typescript
async exportAll(): Promise<Record<string, unknown>>
```

Exports all 18 tables in parallel. Returns object with table names as keys and `_meta: { exportedAt, version: 1 }`.

#### `importAll(data, overwrite)`

```typescript
async importAll(data: Record<string, unknown[]>, overwrite?: boolean): Promise<void>
```

Imports data inside a single transaction. If `overwrite=true`, clears each table before inserting. Otherwise uses `bulkPut` (upsert).

---

## 4. AuditService

**File**: `src/app/core/services/audit.service.ts`
**Provided in**: root
**Dependencies**: `DbService`

### Enum

```typescript
enum AuditAction {
  RESIDENT_CREATED        RESIDENT_UPDATED
  DOCUMENT_UPLOADED       DOCUMENT_APPROVED       DOCUMENT_REJECTED
  CONSENT_GRANTED         CONSENT_REVOKED
  MESSAGE_SENT            MESSAGE_DELETED          MESSAGE_ADMIN_ACCESS
  ENROLLMENT_CREATED      WAITLIST_ADDED           ENROLLMENT_DROPPED
  WAITLIST_PROMOTED
  MOVE_IN                 MOVE_OUT
  RULE_CHANGED            DATA_EXPORTED            DATA_IMPORTED
  ANOMALY_FLAGGED         SESSION_LOCKED           SESSION_REAUTH
  DOCUMENT_HIDDEN         PASSWORD_CHANGED         CONTENT_POLICY_CHANGED
}
```

### Methods

#### `log(...)`

```typescript
log(
  action: AuditAction | string,
  actorId: number,
  actorRole: string,
  targetType: string,
  targetId: number | string,
  before?: unknown,
  after?: unknown,
  anomalyFlagged?: boolean   // default: false
): void
```

**Fire-and-forget** — returns `void`, not `Promise`. Never throws. Append-only; the `auditLogs` table has no update or delete operations.

**Example**:
```typescript
audit.log(AuditAction.MOVE_IN, 1, 'admin', 'occupancy', 42, null, { roomId: 5 });
```

#### `getLogs(options)`

```typescript
async getLogs(options?: {
  limit?:       number;
  actorId?:     number;
  action?:      string;
  anomalyOnly?: boolean;
  from?:        Date;
  to?:          Date;
}): Promise<AuditLog[]>
```

Returns entries sorted descending by timestamp. All filters are AND-combined.

---

## 5. AnomalyService

**File**: `src/app/core/services/anomaly.service.ts`
**Provided in**: root
**Dependencies**: `AuditService`, `AuthService`

### Types

```typescript
interface AnomalyEvent {
  type:    'search_rate' | 'registration_repeat';
  actorId: number;
  detail:  string;
}
```

### Observable

```typescript
anomalyDetected$: Subject<AnomalyEvent>
```

Emits when a threshold is exceeded. AppComponent subscribes to show re-auth modal.

### Methods

#### `recordSearch()`

```typescript
recordSearch(): boolean
```

Sliding-window rate limit: > 30 searches in 60 seconds triggers anomaly. Returns `true` if anomaly flagged.

#### `recordRegistrationAttempt(key)`

```typescript
recordRegistrationAttempt(key: string): boolean
```

Per-key (e.g. `${residentId}-${roundId}`) sliding window: > 3 attempts in 10 seconds triggers anomaly.

#### `reset()`

```typescript
reset(): void
```

Clears all tracking state. Called on session lock.

#### Legacy aliases

```typescript
trackSearch(): boolean                          // calls recordSearch()
trackRegistrationAttempt(key: string): boolean  // calls recordRegistrationAttempt()
resetSearchTracking(): void                     // calls reset()
```

---

## 6. PropertyService

**File**: `src/app/core/services/property.service.ts`
**Provided in**: root
**Dependencies**: `DbService`, `AuditService`

### Enum

```typescript
enum ReasonCode {
  MOVE_IN_NEW         TRANSFER            LEASE_START
  MOVE_OUT_VOLUNTARY  MOVE_OUT_EVICTION   LEASE_END
  ADMINISTRATIVE
}
```

### Methods

#### Buildings

```typescript
async getBuildings(): Promise<Building[]>
async getBuilding(id: number): Promise<Building | undefined>
async createBuilding(data: Omit<Building, 'id'|'createdAt'|'updatedAt'>, actorId: number, actorRole: string): Promise<Building>
async updateBuilding(id: number, data: Partial<Building>, actorId: number, actorRole: string): Promise<void>
```

#### Units

```typescript
async getUnits(buildingId?: number): Promise<Unit[]>
async createUnit(data: Omit<Unit, 'id'|'createdAt'|'updatedAt'>, actorId: number, actorRole: string): Promise<Unit>
async updateUnit(id: number, data: Partial<Unit>, actorId: number, actorRole: string): Promise<void>
```

#### Rooms

```typescript
async getRooms(unitId?: number): Promise<Room[]>
async createRoom(data: Omit<Room, 'id'|'createdAt'|'updatedAt'>, actorId: number, actorRole: string): Promise<Room>
async updateRoom(id: number, data: Partial<Room>, actorId: number, actorRole: string): Promise<void>
```

#### Occupancy

```typescript
async moveIn(params: {
  residentId: number; roomId: number; effectiveFrom: Date;
  reasonCode: string; actorId: number; actorRole: string;
}): Promise<Occupancy>
```

Enforces one active occupancy per resident. Throws if resident already has active occupancy.

```typescript
async moveOut(params: {
  residentId: number; effectiveTo: Date;
  reasonCode: string; actorId: number; actorRole: string;
}): Promise<void>
```

Sets active occupancy status to `'ended'` with `effectiveTo` date.

```typescript
async getActiveOccupancy(residentId: number): Promise<Occupancy | undefined>
async getOccupancyHistory(residentId: number): Promise<Occupancy[]>
async getRoomOccupants(roomId: number): Promise<{ occupancy: Occupancy; resident: Resident }[]>
```

---

## 7. ResidentService

**File**: `src/app/core/services/resident.service.ts`
**Provided in**: root
**Dependencies**: `DbService`, `CryptoService`, `AuditService`

### Types

```typescript
interface ResidentFilters {
  status?:     ('active' | 'inactive' | 'pending')[];
  buildingId?: number;
  search?:     string;
}

type CreateResidentData = Omit<Resident, 'id'|'encryptedId'|'notes'|'consentGiven'|'consentTimestamp'|'createdAt'|'updatedAt'>;
type UpdateResidentData = Partial<Omit<Resident, 'id'|'encryptedId'|'createdAt'>>;
```

### Methods

```typescript
async getResidents(filters?: ResidentFilters): Promise<Resident[]>
async getResident(id: number): Promise<Resident | undefined>
async createResident(data: CreateResidentData, actorId: number, actorRole: string): Promise<Resident>
```

`createResident` encrypts the resident ID with AES-GCM using an internal key.

```typescript
async updateResident(
  id: number, data: UpdateResidentData, actorId: number, actorRole: string
): Promise<{ resident: Resident; warnings: string[] }>
```

Returns warnings (e.g. "Resident has active room assignment" when marking inactive).

```typescript
async getChangeLog(residentId: number): Promise<AuditLog[]>
async searchResidents(query: string): Promise<Resident[]>
```

---

## 8. DocumentService

**File**: `src/app/core/services/document.service.ts`
**Provided in**: root
**Dependencies**: `DbService`, `CryptoService`, `AuditService`

### Types

```typescript
type DocumentStatus = 'pending_review' | 'approved' | 'rejected';

interface ConsentStatus {
  granted: boolean;
  record:  ConsentRecord | undefined;
}
```

### Constants

| Constant | Value |
|----------|-------|
| `MAX_FILE_SIZE_BYTES` | 10,485,760 (10 MB) |
| `MAX_FILES_PER_RESIDENT` | 5 |
| `ALLOWED_MIME_TYPES` | `['application/pdf', 'image/jpeg', 'image/png']` |
| `POLICY_VERSION` | `'1.0'` |

### Methods

```typescript
async getDocuments(residentId: number): Promise<Document[]>
async getPendingReview(): Promise<Document[]>
```

```typescript
async uploadDocument(
  residentId: number, file: File, consentRecordId: number,
  actorId: number, actorRole: string
): Promise<Document>
```

Validates type, size, and count limits. SHA-256 hashes file. Encrypts file data and hash with AES-GCM.

**Errors**: Throws on invalid type, exceeds size, exceeds count.

```typescript
async reviewDocument(
  id: number, decision: 'approved' | 'rejected',
  reviewNotes: string, actorId: number, actorRole: string
): Promise<Document>
```

```typescript
async grantConsent(residentId: number, actorId: number, actorRole: string): Promise<number>
async revokeConsent(residentId: number, actorId: number, actorRole: string): Promise<void>
async getConsentStatus(residentId: number): Promise<ConsentStatus>
```

`revokeConsent` sets `hidden: true` on all resident documents. Audit entries preserved.

```typescript
async getFileData(doc: Document): Promise<string>
async createPreviewUrl(doc: Document): Promise<string>
formatSize(bytes: number): string
```

---

## 9. MessagingService

**File**: `src/app/core/services/messaging.service.ts`
**Provided in**: root
**Dependencies**: `DbService`, `AuditService`, `AuthService`, `CryptoService`

### Masking

```typescript
// Applied before persistence and display
const PHONE_PATTERN = /(\+?\d[\d\s\-(). ]{7,}\d)/g;
const EMAIL_PATTERN = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
```

### Methods

```typescript
async getThreads(userId: number, role?: string): Promise<Thread[]>
```

Admin sees all threads. Other roles see only threads where they are a participant.

```typescript
async createThread(participantIds: number[], subject: string): Promise<Thread>
```

```typescript
async getMessages(threadId: number, requesterId?: number, requesterRole?: string): Promise<Message[]>
```

If admin accesses a thread they are not a participant of, logs `MESSAGE_ADMIN_ACCESS`.

```typescript
async sendMessage(params: {
  threadId: number; senderId: number; senderRole: string;
  recipientId?: number; rawBody: string;
  type: 'announcement' | 'direct'; templateId?: number;
}): Promise<Message>
```

Sanitizes body with DOMPurify, masks phone/email, encrypts original body for audit.

```typescript
async deleteMessage(messageId: number, actorId: number, actorRole: string): Promise<void>
async markRead(messageId: number, userId: number): Promise<void>
async getUnreadCount(userId: number, role?: string): Promise<number>
```

```typescript
async createAnnouncement(params: {
  senderId: number; senderRole: string;
  subject: string; rawBody: string;
}): Promise<{ thread: Thread; message: Message }>
```

Creates a new thread with a single announcement message.

```typescript
async getTemplates(): Promise<MessageTemplate[]>
async getTemplate(id: number): Promise<MessageTemplate | undefined>
async createTemplate(params: {
  name: string; subject: string; body: string;
  category: string; createdBy: number;
}): Promise<MessageTemplate>
```

---

## 10. SearchService

**File**: `src/app/core/services/search.service.ts`
**Provided in**: root
**Dependencies**: `DbService`, `AnomalyService`, `AuditService`, `AuthService`

### Types

```typescript
interface SearchFilters {
  category?:  string;
  building?:  string;
  mediaType?: string;
  from?:      Date;
  to?:        Date;
}

interface SearchResult {
  entry:      SearchIndexEntry;
  score:      number;
  highlights: string[];
}

interface SearchFacets {
  categories: { value: string; count: number }[];
  buildings:  { value: string; count: number }[];
  mediaTypes: { value: string; count: number }[];
}
```

### Methods

```typescript
async buildIndex(): Promise<void>
```

Builds Lunr.js in-memory index from the `searchIndex` store. Fields: title (boost 10), body, tags, category, building.

```typescript
async search(query: string, userId?: number, filters?: SearchFilters): Promise<SearchResult[]>
```

Full pipeline: anomaly check -> synonym expansion -> Lunr search -> spell fallback -> zero-results log -> filter -> trending.

```typescript
async getSpellSuggestion(query: string): Promise<string | null>
async getFacets(): Promise<SearchFacets>
async getTrendingTerms(limit?: number): Promise<{ term: string; count: number }[]>
async getZeroResultsReport(limit?: number): Promise<ZeroResultsLog[]>
```

```typescript
async getDictionary(): Promise<SearchDictionaryEntry[]>
async addDictionaryEntry(params: { term: string; synonyms: string[]; corrections: string[] }): Promise<SearchDictionaryEntry>
async updateDictionaryEntry(id: number, params: Partial<Pick<SearchDictionaryEntry, 'synonyms'|'corrections'>>): Promise<void>
```

```typescript
async indexEntity(entry: Omit<SearchIndexEntry, 'id'>): Promise<void>
async removeFromIndex(entityType: string, entityId: number | string): Promise<void>
```

---

## 11. EnrollmentService

**File**: `src/app/core/services/enrollment.service.ts`
**Provided in**: root
**Dependencies**: `DbService`, `AuditService`, `AnomalyService`

### Types

```typescript
type EnrollmentResult =
  | { success: true;  status: 'enrolled' | 'waitlisted'; enrollment: Enrollment }
  | { success: false; reason: string };

interface CreateCourseParams {
  title: string; description: string; category: string;
  prerequisites: CoursePrerequisite[];
}

interface CreateRoundParams {
  courseId: number; startAt: Date; endAt: Date;
  capacity: number; waitlistCapacity: number;
  addCutoffAt: Date; dropCutoffAt: Date;
}
```

### Methods

#### Course Management

```typescript
async getCourses(): Promise<Course[]>
async getCourse(id: number): Promise<Course | undefined>
async createCourse(params: CreateCourseParams): Promise<Course>
async getCourseRounds(courseId: number): Promise<CourseRound[]>
async createRound(params: CreateRoundParams): Promise<CourseRound>
```

#### Enrollment

```typescript
async enroll(residentId: number, roundId: number, actorRole: string): Promise<EnrollmentResult>
```

Pipeline: anomaly check -> prerequisite check -> add cutoff check -> duplicate check -> capacity check (enroll or waitlist) -> append history -> audit.

**Failure reasons**: `ANOMALY_DETECTED`, `PREREQ_NOT_ACTIVE_RESIDENT`, `PREREQ_AGE_18`, `PREREQ_PRIOR_COMPLETION`, `ADD_CUTOFF_PASSED`, `ALREADY_ENROLLED`, `CAPACITY_EXCEEDED`

```typescript
async drop(
  enrollmentId: number, actorId: number, actorRole: string, reasonCode: string
): Promise<{ success: boolean; reason?: string }>
```

Checks drop cutoff (2 hours before round start). On success, triggers FIFO waitlist backfill.

**Failure reasons**: `DROP_CUTOFF_PASSED`, `NOT_FOUND`

#### Prerequisite Checking

```typescript
async checkPrerequisites(residentId: number, courseId: number): Promise<{
  ok: boolean;
  reason?: string;
  details?: { prereq: CoursePrerequisite; met: boolean; reason?: string }[];
}>
```

Checks each prerequisite: `active_resident`, `age` (>= value), `prior_completion` (completed enrollment for required course).

#### Queries

```typescript
async getEnrollmentsForResident(residentId: number): Promise<Enrollment[]>
async getRoundEnrollments(roundId: number): Promise<Enrollment[]>
async getEnrollmentHistory(enrollmentId: number): Promise<EnrollmentHistory[]>
```

---

## 12. AnalyticsService

**File**: `src/app/core/services/analytics.service.ts`
**Provided in**: root
**Dependencies**: `DbService`, `AuditService`

### Types

```typescript
interface SummaryStats {
  activeResidents: number;      activeResidentsDelta: number;
  enrollmentsThisMonth: number; enrollmentsDelta: number;
  pendingReviews: number;       pendingReviewsDelta: number;
  messagesThisWeek: number;     messagesDelta: number;
}

interface BuildingOccupancy {
  buildingId: number; buildingName: string;
  totalRooms: number; occupied: number; rate: number;
}

interface WeeklyEnrollment {
  weekLabel: string; enrolled: number; waitlisted: number; dropped: number;
}

interface CourseEnrollmentStat {
  courseId: number; title: string;
  enrolled: number; waitlisted: number; dropped: number; completionPct: number;
}

interface CompliancePipeline {
  pending: number; approved: number; rejected: number;
  avgReviewHours: number; oldestPendingDays: number; approvalRate: number;
}

interface DailyMessaging {
  dateLabel: string; direct: number; announcements: number;
}

interface CompareResult {
  metricA: number; metricB: number;
  labelA: string; labelB: string;
  metric: string; winner: 'a' | 'b' | 'tie';
}
```

### Methods

```typescript
async getSummaryStats(): Promise<SummaryStats>
async getOccupancyByBuilding(): Promise<BuildingOccupancy[]>
async getEnrollmentTrends(weeks?: number): Promise<WeeklyEnrollment[]>
async getCourseEnrollmentStats(): Promise<CourseEnrollmentStat[]>
async getCompliancePipeline(): Promise<CompliancePipeline>
async getMessagingActivity(days?: number): Promise<DailyMessaging[]>
async compareBuildingMetric(buildingA: number, buildingB: number, metric: string): Promise<CompareResult>
async compareDateRangeMetric(fromA: Date, toA: Date, fromB: Date, toB: Date, metric: string): Promise<CompareResult>
```

---

## 13. ImportExportService

**File**: `src/app/core/services/import-export.service.ts`
**Provided in**: root
**Dependencies**: `DbService`, `CryptoService`, `AuditService`, `SearchService`

### Methods

#### `exportData(password, actorId, actorRole)`

```typescript
async exportData(password: string, actorId: number, actorRole: string): Promise<void>
```

Collects all stores via `db.exportAll()`, encrypts JSON with password, saves as `.hpd` file via FileSaver, audits `DATA_EXPORTED`.

#### `importData(file, password, actorId, actorRole, overwrite)`

```typescript
async importData(
  file: File, password: string, actorId: number, actorRole: string,
  overwrite?: boolean
): Promise<{ success: boolean; reason?: string }>
```

Reads `.hpd` file, decrypts, validates schema (requires buildings, units, rooms, residents), applies prototype pollution guard (strips `__proto__`, `constructor`, `prototype`), imports via `db.importAll()`, rebuilds search index, audits `DATA_IMPORTED`.

**Failure reasons**: `INVALID_FILE_FORMAT`, `WRONG_PASSWORD`, `CORRUPT_DATA`, `MISSING_KEY_BUILDINGS`, `MISSING_KEY_UNITS`, `MISSING_KEY_ROOMS`, `MISSING_KEY_RESIDENTS`, `UNKNOWN_ERROR`

---

## 14. ThemeService

**File**: `src/app/core/services/theme.service.ts`
**Provided in**: root

### Types

```typescript
type ThemeMode = 'light' | 'dark';
type UiDensity = 'compact' | 'comfortable' | 'spacious';
```

### Observables

```typescript
theme$:   Observable<ThemeMode>
density$: Observable<UiDensity>
```

### Methods

```typescript
init(): void                    // Load from localStorage; call once at app startup
setTheme(mode: ThemeMode): void // Adds/removes body.dark-theme class
toggleTheme(): void
setDensity(d: UiDensity): void  // Adds body.density-{d} class
```

### Properties

```typescript
get currentTheme(): ThemeMode
get currentDensity(): UiDensity
```

---

## 15. ToastService

**File**: `src/app/shared/components/toast/toast.service.ts`
**Provided in**: root

### Types

```typescript
type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string; type: ToastType; message: string;
  title?: string; durationMs: number;
}
```

### Observable

```typescript
toasts$: Observable<Toast[]>
```

### Methods

```typescript
show(message: string, type: ToastType, duration?: number, title?: string): string
success(message: string, title?: string): string
error(message: string, title?: string): string
warning(message: string, title?: string): string
info(message: string, title?: string): string
dismiss(id: string): void
clear(): void
```

Default durations: success 4000ms, error 6000ms, warning 5000ms, info 4000ms. Max 5 toasts (oldest removed when exceeded).

---

## 16. TypeScript Interfaces

### Data Models

```typescript
interface Building {
  id?: number;
  name: string;
  address: string;
  floors: number;
  createdAt: Date;
  updatedAt: Date;
}

interface Unit {
  id?: number;
  buildingId: number;
  unitNumber: string;
  floor: number;
  type: string;
  createdAt: Date;
  updatedAt: Date;
}

interface Room {
  id?: number;
  unitId: number;
  roomNumber: string;
  capacity: number;
  createdAt: Date;
  updatedAt: Date;
}

interface Occupancy {
  id?: number;
  residentId: number;
  roomId: number;
  effectiveFrom: Date;
  effectiveTo?: Date;
  reasonCode: string;
  status: 'active' | 'ended';
  createdAt: Date;
}

interface ResidentNote {
  text: string;
  confidential: boolean;
  encryptedText?: string;
  createdAt: Date;
}

interface Resident {
  id?: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: Date;
  status: 'active' | 'inactive' | 'pending';
  encryptedId: string;
  notes: ResidentNote[];
  consentGiven: boolean;
  consentTimestamp?: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface Document {
  id?: number;
  residentId: number;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  fileHash: string;
  fileData?: string;
  status: 'pending_review' | 'approved' | 'rejected';
  reviewNotes?: string;
  reviewedBy?: number;
  reviewedAt?: Date;
  consentRecordId: number;
  hidden: boolean;
  createdAt: Date;
}

interface Message {
  id?: number;
  threadId: number;
  senderId: number;
  senderRole: string;
  recipientId?: number;
  body: string;
  originalBody?: string;
  type: 'announcement' | 'direct';
  readBy: { userId: number; readAt: Date }[];
  deleted: boolean;
  deletedAt?: Date;
  deletedBy?: number;
  templateId?: number;
  createdAt: Date;
}

interface Thread {
  id?: number;
  participantIds: number[];
  subject: string;
  lastMessageAt: Date;
  createdAt: Date;
}

interface EnrollmentHistory {
  status: string;
  changedAt: Date;
  changedBy: number;
  reason?: string;
}

interface Enrollment {
  id?: number;
  residentId: number;
  courseId: number;
  roundId: number;
  status: 'enrolled' | 'waitlisted' | 'dropped' | 'completed';
  enrolledAt: Date;
  droppedAt?: Date;
  dropReasonCode?: string;
  historySnapshot: EnrollmentHistory[];
}

interface CoursePrerequisite {
  type: 'age' | 'active_resident' | 'prior_completion';
  value: unknown;
}

interface Course {
  id?: number;
  title: string;
  description: string;
  category: string;
  prerequisites: CoursePrerequisite[];
  createdAt: Date;
  updatedAt: Date;
}

interface CourseRound {
  id?: number;
  courseId: number;
  startAt: Date;
  endAt: Date;
  capacity: number;
  waitlistCapacity: number;
  addCutoffAt: Date;
  dropCutoffAt: Date;
  enrolled: number[];
  waitlisted: number[];
  status: 'open' | 'closed' | 'cancelled';
}

interface AuditLog {
  id?: number;
  timestamp: Date;
  actorId: number;
  actorRole: string;
  action: string;
  targetType: string;
  targetId: number | string;
  before?: unknown;
  after?: unknown;
  anomalyFlagged: boolean;
}

interface SearchIndexEntry {
  id?: number;
  entityType: string;
  entityId: number | string;
  title: string;
  body: string;
  tags: string[];
  metadata: Record<string, unknown>;
  building?: string;
  category?: string;
  createdAt: Date;
}

interface SearchDictionaryEntry {
  id?: number;
  term: string;
  synonyms: string[];
  corrections: string[];
}

interface ConsentRecord {
  id?: number;
  residentId: number;
  action: 'granted' | 'revoked';
  timestamp: Date;
  policyVersion: string;
}

interface ZeroResultsLog {
  id?: number;
  query: string;
  timestamp: Date;
  userId?: number;
}

interface ContentPolicy {
  id?: number;
  pattern: string;
  type: 'keyword' | 'regex' | 'phrase';
  action: 'flag' | 'block' | 'redact';
  severity: 'low' | 'medium' | 'high';
  enabled: boolean;
  createdAt: Date;
}

interface MessageTemplate {
  id?: number;
  name: string;
  subject: string;
  body: string;
  category: string;
  createdBy: number;
  createdAt: Date;
  updatedAt: Date;
}
```

---

## 17. IndexedDB Store Schemas

Database name: `HarborPointDB`, version: 1.

| Store | Dexie Schema | Description |
|-------|-------------|-------------|
| `buildings` | `++id, name, createdAt` | Property buildings |
| `units` | `++id, buildingId, unitNumber` | Units within buildings |
| `rooms` | `++id, unitId, roomNumber` | Rooms within units |
| `occupancies` | `++id, residentId, roomId, status` | Resident room assignments |
| `residents` | `++id, status, firstName, lastName` | Resident profiles |
| `documents` | `++id, residentId, status, hidden` | Uploaded documents |
| `messages` | `++id, threadId, senderId, type, deleted` | Chat messages |
| `threads` | `++id, *participantIds, lastMessageAt` | Conversation threads |
| `enrollments` | `++id, residentId, roundId, status` | Course enrollments |
| `courses` | `++id, title, category` | Course definitions |
| `courseRounds` | `++id, courseId, status, startAt` | Scheduled course rounds |
| `auditLogs` | `++id, timestamp, actorId, action, anomalyFlagged` | Immutable audit trail |
| `searchIndex` | `++id, entityType, entityId` | Full-text search entries |
| `searchDictionary` | `++id, term` | Synonyms and corrections |
| `consentRecords` | `++id, residentId, timestamp` | Data consent history |
| `zeroResultsLog` | `++id, timestamp` | Failed search queries |
| `contentPolicies` | `++id, enabled` | Content safety rules |
| `messageTemplates` | `++id, name, category` | Pre-written message templates |

`*participantIds` = Dexie multi-entry index (each array element indexed).

---

## 18. LocalStorage Keys

| Key | Type | Purpose |
|-----|------|---------|
| `hp_last_role` | `UserRole` | Last selected role (UX hint for login) |
| `hp_theme` | `'light' \| 'dark'` | Theme preference |
| `hp_density` | `'compact' \| 'comfortable' \| 'spacious'` | UI density preference |
| `hp_sidebar` | `'true' \| 'false'` | Sidebar collapsed state |
| `hp_vt_admin` | `EncryptedPayload` (JSON) | Admin password validation token |
| `hp_vt_resident` | `EncryptedPayload` (JSON) | Resident password validation token |
| `hp_vt_compliance` | `EncryptedPayload` (JSON) | Compliance password validation token |
| `hp_vt_analyst` | `EncryptedPayload` (JSON) | Analyst password validation token |

No sensitive data (passwords, session tokens) is stored in LocalStorage. Role state is in-memory only.

---

## 19. Docker Service Reference

### App Service

| Property | Value |
|----------|-------|
| Dockerfile | `Dockerfile` (multi-stage) |
| Builder stage | `node:20-alpine`, `npm install`, `ng build --production` |
| Runner stage | `nginx:alpine`, serves from `/usr/share/nginx/html` |
| Port mapping | `4200:80` |
| Container name | `harborpoint-app` |
| Restart policy | `unless-stopped` |
| SPA routing | nginx `try_files $uri $uri/ /index.html` |
| Compression | gzip enabled for text, css, json, js, xml |

### Test Service

| Property | Value |
|----------|-------|
| Dockerfile | `Dockerfile.test` |
| Base image | `node:20-alpine` |
| Entrypoint | `sh run_tests.sh` |
| Container name | `harborpoint-tests` |
| Profile | `test` (only runs when explicitly invoked) |
| Test runner | Jest via `npx jest` |
| Unit tests | `jest unit_tests/ --forceExit --ci` |
| Integration tests | `jest api_tests/ --runInBand --forceExit --ci` |

### Commands

```bash
docker compose up --build          # Build and start app at http://localhost:4200
docker compose run --build test    # Build and run all tests
docker compose down                # Stop and remove containers
```

---

## 20. Data Flow Diagrams

### Enrollment Flow

```
Resident                    EnrollmentService                 Database
   |                              |                              |
   |  enroll(residentId, roundId) |                              |
   |----------------------------->|                              |
   |                              |                              |
   |                    1. recordRegistrationAttempt(key)         |
   |                       key = "{residentId}-{roundId}"        |
   |                       >3 in 10s? -> ANOMALY_DETECTED        |
   |                              |                              |
   |                    2. checkPrerequisites(residentId, courseId)|
   |                       - active_resident status?             |
   |                       - age >= required?                    |
   |                       - prior course completed?             |
   |                       fail? -> PREREQ_* error               |
   |                              |                              |
   |                    3. Check addCutoffAt not passed           |
   |                    4. Check not ALREADY_ENROLLED             |
   |                              |                              |
   |                    5. capacity check:                        |
   |                       enrolled < capacity?                  |
   |                         YES -> add to enrolled[]            |
   |                                status: 'enrolled'           |
   |                         NO  -> waitlist < waitlistCapacity? |
   |                                  YES -> add to waitlisted[] |
   |                                         status: 'waitlisted'|
   |                                  NO  -> CAPACITY_EXCEEDED   |
   |                              |                              |
   |                    6. Append EnrollmentHistory entry         |
   |                    7. Audit: ENROLLMENT_CREATED or           |
   |                              WAITLIST_ADDED                 |
   |                              |                              |
   |  { success, status, enrollment }                            |
   |<-----------------------------|                              |
   |                              |                              |
   |  === DROP (later) ===        |                              |
   |  drop(enrollmentId)          |                              |
   |----------------------------->|                              |
   |                    Check dropCutoffAt (2h before startAt)   |
   |                    Set status: 'dropped'                    |
   |                    Remove from enrolled[]                   |
   |                    backfillFromWaitlist():                   |
   |                      FIFO: take first from waitlisted[]     |
   |                      Move to enrolled[], status: 'enrolled' |
   |                      Audit: WAITLIST_PROMOTED               |
   |<-----------------------------|                              |
```

### Document Upload Flow

```
Resident                    DocumentService                  Database
   |                              |                              |
   |  Check consent status        |                              |
   |----------------------------->|                              |
   |                    getConsentStatus(residentId)             |
   |  { granted: false }          |                              |
   |<-----------------------------|                              |
   |                              |                              |
   |  Grant consent               |                              |
   |----------------------------->|                              |
   |                    grantConsent():                          |
   |                      Write ConsentRecord                    |
   |                      Audit: CONSENT_GRANTED                 |
   |  consentRecordId             |                              |
   |<-----------------------------|                              |
   |                              |                              |
   |  Upload file                 |                              |
   |----------------------------->|                              |
   |                    uploadDocument():                        |
   |                      Validate: mimeType in [pdf,jpg,png]   |
   |                      Validate: size <= 10 MB                |
   |                      Validate: count < 5 for resident       |
   |                      SHA-256 hash file content              |
   |                      AES-GCM encrypt fileData               |
   |                      AES-GCM encrypt fileHash               |
   |                      Save Document (status: pending_review) |
   |                      Audit: DOCUMENT_UPLOADED               |
   |  Document                    |                              |
   |<-----------------------------|                              |
   |                              |                              |
   === Compliance reviews ===     |                              |
   |                              |                              |
   Compliance  reviewDocument(id, 'approved', notes, ...)        |
   |----------------------------->|                              |
   |                    Update status -> 'approved'              |
   |                    Audit: DOCUMENT_APPROVED                 |
   |<-----------------------------|                              |
```

### Search Query Flow

```
User                        SearchService                    Database
   |                              |                              |
   |  search("pool hours")       |                              |
   |----------------------------->|                              |
   |                              |                              |
   |                    1. recordSearch()                         |
   |                       >30/min? -> anomaly event             |
   |                              |                              |
   |                    2. expandQuery("pool hours"):            |
   |                       Load searchDictionary                 |
   |                       Find synonyms for each term           |
   |                       Generate spell suggestions            |
   |                       -> expandedTerms, spellSuggestion     |
   |                              |                              |
   |                    3. _safeSearch(expandedQuery):            |
   |                       Query Lunr.js in-memory index         |
   |                       Match against title, body, tags       |
   |                       Score by tf-idf relevance             |
   |                              |                              |
   |                    4. No results?                            |
   |                       Try spell suggestion query             |
   |                       Still none? -> zeroResultsLog.add()   |
   |                              |                              |
   |                    5. _applyFilters(results, filters):      |
   |                       - category match                      |
   |                       - building match                      |
   |                       - date range (from/to)                |
   |                       - media type                          |
   |                              |                              |
   |                    6. _trackTrending("pool hours")          |
   |                       Increment term count                  |
   |                              |                              |
   |  SearchResult[]              |                              |
   |  (entry, score, highlights)  |                              |
   |<-----------------------------|                              |
```
