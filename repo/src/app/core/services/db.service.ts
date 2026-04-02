import { Injectable } from '@angular/core';
import Dexie, { Table } from 'dexie';

// =====================================================
// Data Models
// =====================================================

export interface Building {
  id?: number;
  name: string;
  address: string;
  floors: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Unit {
  id?: number;
  buildingId: number;
  unitNumber: string;
  floor: number;
  type: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Room {
  id?: number;
  unitId: number;
  roomNumber: string;
  capacity: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Occupancy {
  id?: number;
  residentId: number;
  roomId: number;
  effectiveFrom: Date;
  effectiveTo?: Date;
  reasonCode: string;
  status: 'active' | 'ended';
  createdAt: Date;
}

export interface ResidentNote {
  text: string;
  confidential: boolean;
  encryptedText?: string;
  createdAt: Date;
}

export interface Resident {
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

export interface Document {
  id?: number;
  residentId: number;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  fileHash: string;        // AES-GCM encrypted at rest
  fileData?: string;       // base64 encoded file content (encrypted)
  status: 'pending_review' | 'approved' | 'rejected';
  reviewNotes?: string;
  reviewedBy?: number;
  reviewedAt?: Date;
  consentRecordId: number;
  hidden: boolean;
  createdAt: Date;
}

export interface Message {
  id?: number;
  threadId: number;
  senderId: number;
  senderRole: string;
  recipientId?: number;
  body: string;            // stored post-masking
  originalBody?: string;  // encrypted, for audit
  type: 'announcement' | 'direct';
  readBy: { userId: number; readAt: Date }[];
  deleted: boolean;
  deletedAt?: Date;
  deletedBy?: number;
  templateId?: number;
  createdAt: Date;
}

export interface Thread {
  id?: number;
  participantIds: number[];
  subject: string;
  lastMessageAt: Date;
  createdAt: Date;
}

export interface EnrollmentHistory {
  status: string;
  changedAt: Date;
  changedBy: number;
  reason?: string;
}

export interface Enrollment {
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

export interface CoursePrerequisite {
  type: 'age' | 'active_resident' | 'prior_completion';
  value: unknown;
}

export interface Course {
  id?: number;
  title: string;
  description: string;
  category: string;
  prerequisites: CoursePrerequisite[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CourseRound {
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

export interface AuditLog {
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

export interface SearchIndexEntry {
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

export interface SearchDictionaryEntry {
  id?: number;
  term: string;
  synonyms: string[];
  corrections: string[];
}

export interface ConsentRecord {
  id?: number;
  residentId: number;
  action: 'granted' | 'revoked';
  timestamp: Date;
  policyVersion: string;
}

export interface ZeroResultsLog {
  id?: number;
  query: string;
  timestamp: Date;
  userId?: number;
}

export interface ContentPolicy {
  id?: number;
  pattern: string;
  type: 'keyword' | 'regex' | 'phrase';
  action: 'flag' | 'block' | 'redact';
  severity: 'low' | 'medium' | 'high';
  enabled: boolean;
  createdAt: Date;
}

export interface MessageTemplate {
  id?: number;
  name: string;
  subject: string;
  body: string;
  category: string;
  createdBy: number;
  createdAt: Date;
  updatedAt: Date;
}

// =====================================================
// Database Class
// =====================================================

@Injectable({ providedIn: 'root' })
export class DbService extends Dexie {

  buildings!:         Table<Building, number>;
  units!:             Table<Unit, number>;
  rooms!:             Table<Room, number>;
  occupancies!:       Table<Occupancy, number>;
  residents!:         Table<Resident, number>;
  documents!:         Table<Document, number>;
  messages!:          Table<Message, number>;
  threads!:           Table<Thread, number>;
  enrollments!:       Table<Enrollment, number>;
  courses!:           Table<Course, number>;
  courseRounds!:      Table<CourseRound, number>;
  auditLogs!:         Table<AuditLog, number>;
  searchIndex!:       Table<SearchIndexEntry, number>;
  searchDictionary!:  Table<SearchDictionaryEntry, number>;
  consentRecords!:    Table<ConsentRecord, number>;
  zeroResultsLog!:    Table<ZeroResultsLog, number>;
  contentPolicies!:   Table<ContentPolicy, number>;
  messageTemplates!:  Table<MessageTemplate, number>;

  constructor() {
    super('HarborPointDB');

    this.version(1).stores({
      buildings:        '++id, name, createdAt',
      units:            '++id, buildingId, unitNumber',
      rooms:            '++id, unitId, roomNumber',
      occupancies:      '++id, residentId, roomId, status, effectiveFrom',
      residents:        '++id, status, firstName, lastName',
      documents:        '++id, residentId, status, hidden',
      messages:         '++id, threadId, senderId, type, deleted',
      threads:          '++id, *participantIds, lastMessageAt',
      enrollments:      '++id, residentId, roundId, status',
      courses:          '++id, title, category',
      courseRounds:     '++id, courseId, status, startAt',
      auditLogs:        '++id, timestamp, actorId, action, anomalyFlagged',
      searchIndex:      '++id, entityType, entityId',
      searchDictionary: '++id, term',
      consentRecords:   '++id, residentId, action, timestamp',
      zeroResultsLog:   '++id, query, timestamp',
      contentPolicies:  '++id, pattern, type',
      messageTemplates: '++id, name',
    });

    this.on('ready', () => this.seedIfEmpty());
  }

  private async seedIfEmpty(): Promise<void> {
    const buildingCount = await this.buildings.count();
    if (buildingCount > 0) return;

    const now = new Date();
    const future = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days out

    // --- Buildings ---
    const buildingId = await this.buildings.add({
      name: 'Harbor Tower',
      address: '1 Harbor Drive, HarborPoint, CA 90210',
      floors: 10,
      createdAt: now,
      updatedAt: now,
    });

    // --- Units ---
    const unit1Id = await this.units.add({
      buildingId,
      unitNumber: '101',
      floor: 1,
      type: '2BR',
      createdAt: now,
      updatedAt: now,
    });
    const unit2Id = await this.units.add({
      buildingId,
      unitNumber: '102',
      floor: 1,
      type: '1BR',
      createdAt: now,
      updatedAt: now,
    });

    // --- Rooms ---
    await this.rooms.bulkAdd([
      { unitId: unit1Id, roomNumber: '101A', capacity: 2, createdAt: now, updatedAt: now },
      { unitId: unit1Id, roomNumber: '101B', capacity: 2, createdAt: now, updatedAt: now },
      { unitId: unit2Id, roomNumber: '102A', capacity: 1, createdAt: now, updatedAt: now },
      { unitId: unit2Id, roomNumber: '102B', capacity: 1, createdAt: now, updatedAt: now },
    ]);

    // --- Demo Residents (one per role) ---
    await this.residents.bulkAdd([
      {
        firstName: 'Admin', lastName: 'User',
        email: 'admin@harborpoint.local', phone: '555-0001',
        dateOfBirth: new Date('1980-01-01'), status: 'active',
        encryptedId: 'demo-admin-id',
        notes: [], consentGiven: false,
        createdAt: now, updatedAt: now,
      },
      {
        firstName: 'Resident', lastName: 'User',
        email: 'resident@harborpoint.local', phone: '555-0002',
        dateOfBirth: new Date('1990-06-15'), status: 'active',
        encryptedId: 'demo-resident-id',
        notes: [], consentGiven: false,
        createdAt: now, updatedAt: now,
      },
      {
        firstName: 'Compliance', lastName: 'Reviewer',
        email: 'compliance@harborpoint.local', phone: '555-0003',
        dateOfBirth: new Date('1985-03-20'), status: 'active',
        encryptedId: 'demo-compliance-id',
        notes: [], consentGiven: false,
        createdAt: now, updatedAt: now,
      },
      {
        firstName: 'Analyst', lastName: 'User',
        email: 'analyst@harborpoint.local', phone: '555-0004',
        dateOfBirth: new Date('1988-09-10'), status: 'active',
        encryptedId: 'demo-analyst-id',
        notes: [], consentGiven: false,
        createdAt: now, updatedAt: now,
      },
    ]);

    // --- Sample Course ---
    const courseId = await this.courses.add({
      title: 'Community Orientation',
      description: 'Welcome orientation for new residents covering building rules, amenities, and community guidelines.',
      category: 'Onboarding',
      prerequisites: [{ type: 'active_resident', value: true }],
      createdAt: now,
      updatedAt: now,
    });

    // --- Course Round (future date) ---
    const roundStart = new Date(future.getTime());
    roundStart.setHours(9, 0, 0, 0);
    const roundEnd = new Date(future.getTime());
    roundEnd.setHours(12, 0, 0, 0);
    const addCutoff = new Date(future.getTime() - 24 * 60 * 60 * 1000);
    const dropCutoff = new Date(roundStart.getTime() - 2 * 60 * 60 * 1000);

    await this.courseRounds.add({
      courseId,
      startAt: roundStart,
      endAt: roundEnd,
      capacity: 20,
      waitlistCapacity: 10,
      addCutoffAt: addCutoff,
      dropCutoffAt: dropCutoff,
      enrolled: [],
      waitlisted: [],
      status: 'open',
    });

    // --- Search Dictionary (5 entries with synonyms) ---
    await this.searchDictionary.bulkAdd([
      { term: 'apartment', synonyms: ['unit', 'flat', 'suite'], corrections: ['appartment', 'aprtment'] },
      { term: 'resident', synonyms: ['tenant', 'occupant', 'renter'], corrections: ['residant', 'resedent'] },
      { term: 'maintenance', synonyms: ['repair', 'fix', 'upkeep'], corrections: ['maintanence', 'maintainence'] },
      { term: 'payment', synonyms: ['rent', 'fee', 'charge'], corrections: ['payement', 'paymant'] },
      { term: 'document', synonyms: ['file', 'attachment', 'record'], corrections: ['documant', 'docement'] },
    ]);

    // --- Default Content Safety Policies (10) ---
    await this.contentPolicies.bulkAdd([
      { pattern: 'spam', type: 'keyword', action: 'flag', severity: 'low', enabled: true, createdAt: now },
      { pattern: 'scam', type: 'keyword', action: 'flag', severity: 'medium', enabled: true, createdAt: now },
      { pattern: 'fraud', type: 'keyword', action: 'flag', severity: 'high', enabled: true, createdAt: now },
      { pattern: 'harassment', type: 'keyword', action: 'block', severity: 'high', enabled: true, createdAt: now },
      { pattern: 'threat', type: 'keyword', action: 'block', severity: 'high', enabled: true, createdAt: now },
      { pattern: '\\b\\d{3}[-.]?\\d{3}[-.]?\\d{4}\\b', type: 'regex', action: 'redact', severity: 'medium', enabled: true, createdAt: now },
      { pattern: '[a-zA-Z0-9._%+\\-]+@[a-zA-Z0-9.\\-]+\\.[a-zA-Z]{2,}', type: 'regex', action: 'redact', severity: 'medium', enabled: true, createdAt: now },
      { pattern: 'confidential', type: 'keyword', action: 'flag', severity: 'low', enabled: true, createdAt: now },
      { pattern: 'password', type: 'keyword', action: 'flag', severity: 'medium', enabled: true, createdAt: now },
      { pattern: 'social security', type: 'phrase', action: 'block', severity: 'high', enabled: true, createdAt: now },
    ]);

    // --- Default Message Template ---
    await this.messageTemplates.add({
      name: 'Welcome Message',
      subject: 'Welcome to Harbor Tower',
      body: 'Welcome to Harbor Tower! We are happy to have you as part of our community. Please feel free to reach out if you need any assistance.',
      category: 'Onboarding',
      createdBy: 1,
      createdAt: now,
      updatedAt: now,
    });
  }

  // =====================================================
  // Import / Export Helpers
  // =====================================================

  async exportAll(): Promise<Record<string, unknown[]>> {
    const [
      buildings, units, rooms, occupancies, residents,
      documents, messages, threads, enrollments, courses,
      courseRounds, auditLogs, searchIndex, searchDictionary,
      consentRecords, zeroResultsLog, contentPolicies, messageTemplates
    ] = await Promise.all([
      this.buildings.toArray(),
      this.units.toArray(),
      this.rooms.toArray(),
      this.occupancies.toArray(),
      this.residents.toArray(),
      this.documents.toArray(),
      this.messages.toArray(),
      this.threads.toArray(),
      this.enrollments.toArray(),
      this.courses.toArray(),
      this.courseRounds.toArray(),
      this.auditLogs.toArray(),
      this.searchIndex.toArray(),
      this.searchDictionary.toArray(),
      this.consentRecords.toArray(),
      this.zeroResultsLog.toArray(),
      this.contentPolicies.toArray(),
      this.messageTemplates.toArray(),
    ]);
    return {
      buildings, units, rooms, occupancies, residents,
      documents, messages, threads, enrollments, courses,
      courseRounds, auditLogs, searchIndex, searchDictionary,
      consentRecords, zeroResultsLog, contentPolicies, messageTemplates,
      _meta: { exportedAt: new Date().toISOString(), version: 1 },
    };
  }

  async importAll(data: Record<string, unknown[]>, overwrite = false): Promise<void> {
    const tables: (keyof DbService & string)[] = [
      'buildings', 'units', 'rooms', 'occupancies', 'residents',
      'documents', 'messages', 'threads', 'enrollments', 'courses',
      'courseRounds', 'auditLogs', 'searchIndex', 'searchDictionary',
      'consentRecords', 'zeroResultsLog', 'contentPolicies', 'messageTemplates',
    ];

    await this.transaction('rw',
      this.buildings, this.units, this.rooms, this.occupancies, this.residents,
      this.documents, this.messages, this.threads, this.enrollments, this.courses,
      this.courseRounds, this.auditLogs, this.searchIndex, this.searchDictionary,
      this.consentRecords, this.zeroResultsLog, this.contentPolicies, this.messageTemplates,
      async () => {
        for (const tableName of tables) {
          const records = data[tableName];
          if (!Array.isArray(records)) continue;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const table = (this as any)[tableName] as Table<any, number>;
          if (overwrite) {
            await table.clear();
            await table.bulkAdd(records);
          } else {
            await table.bulkPut(records);
          }
        }
      }
    );
  }
}
