/**
 * Unit Tests — MessagingService
 *
 * Tests: maskSensitiveContent (phone, email), getThreads (admin vs non-admin),
 * getMessages (admin-access audit), sendMessage (masking before storage),
 * createTemplate (stored correctly).
 */

import 'fake-indexeddb/auto';
import { TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';

import { MessagingService, maskSensitiveContent } from '../../../src/app/core/services/messaging.service';
import { DbService } from '../../../src/app/core/services/db.service';
import { AuditService } from '../../../src/app/core/services/audit.service';
import { AuditAction } from '../../../src/app/core/services/audit.service';
import { AuthService } from '../../../src/app/core/services/auth.service';
import { CryptoService } from '../../../src/app/core/services/crypto.service';
import { LoggerService } from '../../../src/app/core/services/logger.service';
import { SearchService } from '../../../src/app/core/services/search.service';
import { AnomalyService } from '../../../src/app/core/services/anomaly.service';
import { ContentPolicyService } from '../../../src/app/core/services/content-policy.service';

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

async function setup() {
  TestBed.configureTestingModule({
    imports: [RouterTestingModule],
    providers: [MessagingService, DbService, AuditService, AuthService, CryptoService, LoggerService, SearchService, AnomalyService, ContentPolicyService],
  });
  const db = TestBed.inject(DbService);
  await db.open();
  await new Promise(r => setTimeout(r, 150));
  await TestBed.inject(AuthService).selectRole('admin', 'harborpoint2024');
  return {
    service: TestBed.inject(MessagingService),
    audit:   TestBed.inject(AuditService),
    db,
  };
}

async function teardown(db: DbService) {
  await db.close();
  TestBed.resetTestingModule();
}

// ──────────────────────────────────────────────────────────────────────────────
// maskSensitiveContent — pure function
// ──────────────────────────────────────────────────────────────────────────────

describe('MessagingService — maskSensitiveContent', () => {

  it('redacts phone numbers', () => {
    const result = maskSensitiveContent('Call me at 555-867-5309 anytime');
    expect(result).not.toContain('555-867-5309');
    expect(result).toContain('[PHONE REDACTED]');
  });

  it('redacts email addresses', () => {
    const result = maskSensitiveContent('Reach me at jane.doe@example.com please');
    expect(result).not.toContain('jane.doe@example.com');
    expect(result).toContain('[EMAIL REDACTED]');
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// getThreads — role-based visibility
// ──────────────────────────────────────────────────────────────────────────────

describe('MessagingService — getThreads role filtering', () => {

  it('admin role returns all threads regardless of participation', async () => {
    const { service, db } = await setup();
    // admin userId=1 — create threads where admin is NOT a participant
    await service.createThread([5, 6], 'Thread A');
    await service.createThread([7, 8], 'Thread B');

    const threads = await service.getThreads();
    expect(threads.length).toBe(2); // admin sees all

    await teardown(db);
  });

  it('non-admin returns only threads where user is a participant', async () => {
    const { service, db } = await setup();
    const auth = TestBed.inject(AuthService);

    // Create threads as admin first
    await service.createThread([2, 3], 'Thread A');  // resident (userId=2) is in A
    await service.createThread([1, 5], 'Thread B');  // resident (userId=2) NOT in B

    // Switch to resident role (userId=2)
    await auth.selectRole('resident', 'harborpoint2024');

    const threads = await service.getThreads();
    expect(threads.length).toBe(1);
    expect(threads[0].subject).toBe('Thread A');

    await teardown(db);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// getMessages — admin non-participant access audit
// ──────────────────────────────────────────────────────────────────────────────

describe('MessagingService — getMessages admin access audit', () => {

  it('writes MESSAGE_ADMIN_ACCESS audit entry when admin is not a thread participant', async () => {
    const { service, db } = await setup();

    // Thread does NOT include admin userId=1
    const thread = await service.createThread([5, 6], 'Private Thread');
    await service.sendMessage({
      threadId: thread.id!,
      rawBody: 'hello',
      type: 'direct',
    });

    // Admin (userId=1) accesses thread they're not a participant in
    await service.getMessages(thread.id!);

    // Audit log should contain MESSAGE_ADMIN_ACCESS for actorId=1
    const logs = await db.auditLogs.toArray();
    const entry = logs.find(
      l => l.action === AuditAction.MESSAGE_ADMIN_ACCESS && l.actorId === 1,
    );
    expect(entry).toBeDefined();
    expect(entry!.targetType).toBe('thread');
    expect(entry!.targetId).toBe(thread.id);

    await teardown(db);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// sendMessage — masking applied before storage
// ──────────────────────────────────────────────────────────────────────────────

describe('MessagingService — sendMessage masking', () => {

  it('stores masked body, not raw PII content', async () => {
    const { service, db } = await setup();

    const thread = await service.createThread([1, 2], 'Mask Test');
    const msg = await service.sendMessage({
      threadId: thread.id!,
      rawBody: 'Contact info: admin@harborpoint.local or call 555-123-4567',
      type: 'direct',
    });

    expect(msg.body).not.toContain('admin@harborpoint.local');
    expect(msg.body).not.toContain('555-123-4567');
    expect(msg.body).toContain('[EMAIL REDACTED]');
    expect(msg.body).toContain('[PHONE REDACTED]');

    await teardown(db);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// createTemplate — storage
// ──────────────────────────────────────────────────────────────────────────────

describe('MessagingService — createTemplate', () => {

  it('stores template with sanitized fields and returns it with an id', async () => {
    const { service, db } = await setup();

    const tmpl = await service.createTemplate({
      name:      'Welcome Letter',
      subject:   'Welcome to HarborPoint',
      body:      'Dear resident, welcome!',
      category:  'onboarding',
      createdBy: 1,
    });

    expect(tmpl.id).toBeDefined();
    expect(tmpl.name).toBe('Welcome Letter');
    expect(tmpl.subject).toBe('Welcome to HarborPoint');
    expect(tmpl.body).toBe('Dear resident, welcome!');
    expect(tmpl.category).toBe('onboarding');
    expect(tmpl.createdBy).toBe(1);
    expect(tmpl.createdAt).toBeInstanceOf(Date);

    const stored = await db.messageTemplates.get(tmpl.id!);
    expect(stored).toBeDefined();
    expect(stored!.name).toBe('Welcome Letter');

    await teardown(db);
  });
});
