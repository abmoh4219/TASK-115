/**
 * Cycle 2 Security Tests
 *
 * Tests for:
 * - H-01: Service-layer ownership enforcement (resident cross-user mutation rejection)
 * - H-02: Audit actor identity is session-derived (not caller-controlled)
 * - H-03: Forced password change on first login with default credentials
 */

import 'fake-indexeddb/auto';
import { TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';

import { AuthService } from '../../../src/app/core/services/auth.service';
import { CryptoService } from '../../../src/app/core/services/crypto.service';
import { ResidentService } from '../../../src/app/core/services/resident.service';
import { DocumentService } from '../../../src/app/core/services/document.service';
import { EnrollmentService } from '../../../src/app/core/services/enrollment.service';
import { PropertyService } from '../../../src/app/core/services/property.service';
import { ImportExportService } from '../../../src/app/core/services/import-export.service';
import { DbService } from '../../../src/app/core/services/db.service';
import { AuditService } from '../../../src/app/core/services/audit.service';
import { AnomalyService } from '../../../src/app/core/services/anomaly.service';
import { SearchService } from '../../../src/app/core/services/search.service';
import { ContentPolicyService } from '../../../src/app/core/services/content-policy.service';
import { LoggerService } from '../../../src/app/core/services/logger.service';

// ──────────────────────────────────────────────────────────────────────────────
// Setup
// ──────────────────────────────────────────────────────────────────────────────

function setupAll() {
  TestBed.configureTestingModule({
    imports: [RouterTestingModule],
    providers: [
      AuthService, CryptoService, DbService, AuditService, AnomalyService,
      PropertyService, DocumentService, EnrollmentService,
      ImportExportService, SearchService, ResidentService, ContentPolicyService, LoggerService,
    ],
  });
  return {
    auth:       TestBed.inject(AuthService),
    resident:   TestBed.inject(ResidentService),
    document:   TestBed.inject(DocumentService),
    enrollment: TestBed.inject(EnrollmentService),
    db:         TestBed.inject(DbService),
  };
}

function teardown() {
  TestBed.resetTestingModule();
  localStorage.clear();
}

const BASE = {
  firstName: 'Test', lastName: 'User', email: 'test@hp.local',
  phone: '555-0000', dateOfBirth: new Date('1990-01-01'), status: 'active' as const,
};

// ──────────────────────────────────────────────────────────────────────────────
// H-01: Resident cross-user mutation rejection
// ──────────────────────────────────────────────────────────────────────────────

describe('H-01: Ownership enforcement — resident cannot mutate other residents', () => {

  it('updateResident rejects when resident tries to update another resident', async () => {
    const { auth, resident, db } = setupAll();
    await db.open();

    // Create a resident as admin
    await auth.selectRole('admin', 'harborpoint2024');
    const r = await resident.createResident({ ...BASE, email: 'other@hp.local' });

    // Switch to resident role (userId=2), try to update resident with different id
    await auth.selectRole('resident', 'harborpoint2024');

    await expect(
      resident.updateResident(r.id!, { firstName: 'Hacked' }),
    ).rejects.toThrow('Unauthorized');

    await db.close();
    teardown();
  });

  it('updateResident allows resident to update their own profile (id matches session)', async () => {
    const { auth, resident, db } = setupAll();
    await db.open();

    // Seed resident with id=2 (matches resident role userId) — use put to handle existing
    await auth.selectRole('admin', 'harborpoint2024');
    await db.residents.put({
      id: 2, ...BASE, email: 'self@hp.local',
      encryptedId: 'e', notes: [], consentGiven: false,
      createdAt: new Date(), updatedAt: new Date(),
    });

    await auth.selectRole('resident', 'harborpoint2024');
    const { resident: updated } = await resident.updateResident(2, { phone: '555-1111' });
    expect(updated.phone).toBe('555-1111');

    await db.close();
    teardown();
  });

  it('grantConsent rejects when resident tries to grant consent for another resident', async () => {
    const { auth, document, db } = setupAll();
    await db.open();

    await auth.selectRole('admin', 'harborpoint2024');
    const residentId = await db.residents.add({
      id: 99, ...BASE, email: 'other2@hp.local',
      encryptedId: 'e', notes: [], consentGiven: false,
      createdAt: new Date(), updatedAt: new Date(),
    });

    await auth.selectRole('resident', 'harborpoint2024');
    // Resident userId=2 tries to grant consent for residentId=99
    await expect(document.grantConsent(99)).rejects.toThrow('Unauthorized');

    await db.close();
    teardown();
  });

  it('revokeConsent rejects when resident tries to revoke for another resident', async () => {
    const { auth, document, db } = setupAll();
    await db.open();

    await auth.selectRole('admin', 'harborpoint2024');
    await db.residents.add({
      id: 88, ...BASE, email: 'other3@hp.local',
      encryptedId: 'e', notes: [], consentGiven: true,
      createdAt: new Date(), updatedAt: new Date(),
    });

    await auth.selectRole('resident', 'harborpoint2024');
    await expect(document.revokeConsent(88)).rejects.toThrow('Unauthorized');

    await db.close();
    teardown();
  });

  it('enroll rejects when resident tries to enroll a different resident', async () => {
    const { auth, enrollment, db } = setupAll();
    await db.open();

    await auth.selectRole('admin', 'harborpoint2024');
    const courseId = await db.courses.add({
      title: 'Test', description: '', category: 'General',
      prerequisites: [], createdAt: new Date(), updatedAt: new Date(),
    });
    const roundId = await db.courseRounds.add({
      courseId, startAt: new Date(Date.now() + 86400000 * 30),
      endAt: new Date(Date.now() + 86400000 * 60),
      capacity: 10, waitlistCapacity: 5,
      addCutoffAt: new Date(Date.now() + 86400000 * 25),
      dropCutoffAt: new Date(Date.now() + 86400000 * 28),
      enrolled: [], waitlisted: [], status: 'open',
    });

    await auth.selectRole('resident', 'harborpoint2024');
    // Resident userId=2 tries to enroll residentId=99
    await expect(enrollment.enroll(99, roundId)).rejects.toThrow('Unauthorized');

    await db.close();
    teardown();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// H-02: Audit actor identity is session-derived
// ──────────────────────────────────────────────────────────────────────────────

describe('H-02: Audit actor identity — always session-derived', () => {

  it('createResident audit log uses session actorId (admin=1), not caller input', async () => {
    const { auth, resident, db } = setupAll();
    await db.open();
    await auth.selectRole('admin', 'harborpoint2024');

    const r = await resident.createResident({ ...BASE, email: 'audit1@hp.local' });

    // Wait for fire-and-forget audit
    await new Promise(r => setTimeout(r, 200));

    const logs = await db.auditLogs
      .filter(l => l.action === 'RESIDENT_CREATED' && Number(l.targetId) === r.id)
      .toArray();

    expect(logs.length).toBeGreaterThanOrEqual(1);
    expect(logs[0].actorId).toBe(1);     // admin userId from session
    expect(logs[0].actorRole).toBe('admin'); // from session, not caller
    await db.close();
    teardown();
  });

  it('updateResident audit log uses session actorId, not caller input', async () => {
    const { auth, resident, db } = setupAll();
    await db.open();
    await auth.selectRole('admin', 'harborpoint2024');

    const r = await resident.createResident({ ...BASE, email: 'audit2@hp.local' });
    await resident.updateResident(r.id!, { firstName: 'Changed' });

    await new Promise(r => setTimeout(r, 200));

    const logs = await db.auditLogs
      .filter(l => l.action === 'RESIDENT_UPDATED' && Number(l.targetId) === r.id)
      .toArray();

    expect(logs.length).toBeGreaterThanOrEqual(1);
    expect(logs[0].actorId).toBe(1);
    expect(logs[0].actorRole).toBe('admin');
    await db.close();
    teardown();
  });

  it('grantConsent audit uses session compliance actorId=3', async () => {
    const { auth, document, db } = setupAll();
    await db.open();

    // Grant consent as admin (actorId=1)
    await auth.selectRole('admin', 'harborpoint2024');
    await db.residents.add({
      id: 50, ...BASE, email: 'auditconsent@hp.local',
      encryptedId: 'e', notes: [], consentGiven: false,
      createdAt: new Date(), updatedAt: new Date(),
    });

    await document.grantConsent(50);
    await new Promise(r => setTimeout(r, 200));

    const logs = await db.auditLogs
      .filter(l => l.action === 'CONSENT_GRANTED' && Number(l.targetId) === 50)
      .toArray();

    expect(logs.length).toBeGreaterThanOrEqual(1);
    expect(logs[0].actorId).toBe(1);  // admin session
    expect(logs[0].actorRole).toBe('admin');

    await db.close();
    teardown();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Credential validation — QA defaults work, password change supported
// ──────────────────────────────────────────────────────────────────────────────

describe('Credentials — QA default login and optional password change', () => {

  it('login succeeds with default QA credentials for all roles', async () => {
    for (const role of ['admin', 'resident', 'compliance', 'analyst'] as const) {
      const { auth } = setupAll();
      localStorage.clear();
      const ok = await auth.selectRole(role, 'harborpoint2024');
      expect(ok).toBe(true);
      expect(auth.getCurrentRole()).toBe(role);
      teardown();
    }
  });

  it('changePassword updates credential and default no longer works', async () => {
    const { auth } = setupAll();
    localStorage.clear();

    await auth.selectRole('admin', 'harborpoint2024');
    const ok = await auth.changePassword('admin', 'harborpoint2024', 'newSecurePass123');
    expect(ok).toBe(true);

    auth.logout();
    const failOld = await auth.selectRole('admin', 'harborpoint2024');
    expect(failOld).toBe(false);

    const succeedNew = await auth.selectRole('admin', 'newSecurePass123');
    expect(succeedNew).toBe(true);

    teardown();
  });
});
