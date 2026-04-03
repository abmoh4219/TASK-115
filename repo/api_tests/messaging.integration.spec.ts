/**
 * Messaging Integration Tests
 * Tests: thread creation, masking policy, read receipts
 */

import 'fake-indexeddb/auto';
import { TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { MessagingService, maskSensitiveContent } from '../src/app/core/services/messaging.service';
import { DbService } from '../src/app/core/services/db.service';
import { AuditService } from '../src/app/core/services/audit.service';
import { AuthService } from '../src/app/core/services/auth.service';
import { CryptoService } from '../src/app/core/services/crypto.service';
import { LoggerService } from '../src/app/core/services/logger.service';

describe('Messaging Integration — thread & message flow', () => {
  let service: MessagingService;
  let db: DbService;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [RouterTestingModule],
      providers: [MessagingService, DbService, AuditService, AuthService, CryptoService, LoggerService],
    });
    db = TestBed.inject(DbService);
    service = TestBed.inject(MessagingService);
    await db.open();
    await new Promise(r => setTimeout(r, 200));
    await TestBed.inject(AuthService).selectRole('admin', 'harborpoint2024');
  });

  afterEach(async () => {
    await db.close();
    TestBed.resetTestingModule();
  });

  it('creates a thread', async () => {
    const thread = await service.createThread([1, 2], 'Test Subject');
    expect(thread.id).toBeDefined();
    expect(thread.subject).toBe('Test Subject');
    expect(thread.participantIds).toContain(1);
  });

  it('sends a message to a thread', async () => {
    const thread = await service.createThread([1, 2], 'Chat');
    const msg = await service.sendMessage({
      threadId: thread.id!,
      rawBody: 'Hello there!',
      type: 'direct',
    });
    expect(msg.id).toBeDefined();
    expect(msg.body).toBe('Hello there!');
    expect(msg.deleted).toBe(false);
  });

  it('retrieves messages for a thread', async () => {
    const thread = await service.createThread([1, 2], 'Thread');
    await service.sendMessage({ threadId: thread.id!, rawBody: 'Msg 1', type: 'direct' });
    await service.sendMessage({ threadId: thread.id!, rawBody: 'Msg 2', type: 'direct' });

    const messages = await service.getMessages(thread.id!);
    expect(messages.length).toBe(2);
  });

  it('marks a message as read', async () => {
    const thread = await service.createThread([1, 2], 'Thread');
    const msg = await service.sendMessage({ threadId: thread.id!, rawBody: 'Hi', type: 'direct' });
    await service.markRead(msg.id!);

    const updated = await db.messages.get(msg.id!);
    expect(updated?.readBy.some(r => r.userId === 1)).toBe(true);
  });

  it('does not duplicate read receipts', async () => {
    const thread = await service.createThread([1, 2], 'Thread');
    const msg = await service.sendMessage({ threadId: thread.id!, rawBody: 'Hi', type: 'direct' });
    await service.markRead(msg.id!);
    await service.markRead(msg.id!); // called twice

    const updated = await db.messages.get(msg.id!);
    expect(updated?.readBy.filter(r => r.userId === 1).length).toBe(1);
  });

  it('soft-deletes a message (deleted=true)', async () => {
    const thread = await service.createThread([1, 2], 'Thread');
    const msg = await service.sendMessage({ threadId: thread.id!, rawBody: 'Delete me', type: 'direct' });
    await service.deleteMessage(msg.id!);

    const deleted = await db.messages.get(msg.id!);
    expect(deleted?.deleted).toBe(true);
    expect(deleted?.deletedAt).toBeDefined();
  });

  it('deleted messages excluded from getMessages', async () => {
    const thread = await service.createThread([1, 2], 'Thread');
    const msg = await service.sendMessage({ threadId: thread.id!, rawBody: 'Visible', type: 'direct' });
    const msg2 = await service.sendMessage({ threadId: thread.id!, rawBody: 'Hidden', type: 'direct' });
    await service.deleteMessage(msg2.id!);

    const messages = await service.getMessages(thread.id!);
    expect(messages.length).toBe(1);
    expect(messages[0].id).toBe(msg.id);
  });
});

describe('Messaging Integration — admin thread visibility', () => {
  let service: MessagingService;
  let db: DbService;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [RouterTestingModule],
      providers: [MessagingService, DbService, AuditService, AuthService, CryptoService, LoggerService],
    });
    db = TestBed.inject(DbService);
    service = TestBed.inject(MessagingService);
    await db.open();
    await new Promise(r => setTimeout(r, 200));
    await TestBed.inject(AuthService).selectRole('admin', 'harborpoint2024');
    await db.threads.clear();
    await db.messages.clear();
    await db.auditLogs.clear();
  });

  afterEach(async () => {
    await db.close();
    TestBed.resetTestingModule();
  });

  it('admin getThreads returns threads user is not a participant of', async () => {
    await service.createThread([10, 11], 'Thread for others');
    await service.createThread([1, 2], 'Admin thread');

    // Admin userId=1 sees both threads (including one they are not in)
    const adminThreads = await service.getThreads();
    expect(adminThreads.length).toBe(2);
  });

  it('resident getThreads returns only their own threads', async () => {
    await service.createThread([2, 6], 'Resident thread');
    await service.createThread([7, 8], 'Other thread');

    // Switch to resident role (userId=2) to test resident visibility
    await TestBed.inject(AuthService).selectRole('resident', 'harborpoint2024');
    const residentThreads = await service.getThreads();
    expect(residentThreads.length).toBe(1);
    expect(residentThreads[0].participantIds).toContain(2);
  });

  it('getMessages writes MESSAGE_ADMIN_ACCESS when admin is not a participant', async () => {
    const thread = await service.createThread([10, 11], 'Private');
    await service.sendMessage({ threadId: thread.id!, rawBody: 'private note', type: 'direct' });

    // Admin id=1 (from session) — not a participant of thread [10, 11]
    await service.getMessages(thread.id!);

    const logs = await db.auditLogs.toArray();
    const entry = logs.find(l => l.action === 'MESSAGE_ADMIN_ACCESS' && l.actorId === 1);
    expect(entry).toBeDefined();
    expect(entry!.targetId).toBe(thread.id);
  });

  it('getMessages does NOT write MESSAGE_ADMIN_ACCESS when admin IS a participant', async () => {
    const adminId = 1;
    const thread = await service.createThread([adminId, 2], 'Admin Chat');
    await service.sendMessage({ threadId: thread.id!, rawBody: 'hello', type: 'direct' });

    await service.getMessages(thread.id!);

    const logs = await db.auditLogs.toArray();
    const entry = logs.find(l => l.action === 'MESSAGE_ADMIN_ACCESS' && l.actorId === adminId);
    expect(entry).toBeUndefined();
  });
});

describe('Messaging Integration — createAnnouncement', () => {
  let service: MessagingService;
  let db: DbService;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [RouterTestingModule],
      providers: [MessagingService, DbService, AuditService, AuthService, CryptoService, LoggerService],
    });
    db = TestBed.inject(DbService);
    service = TestBed.inject(MessagingService);
    await db.open();
    await new Promise(r => setTimeout(r, 200));
    await TestBed.inject(AuthService).selectRole('admin', 'harborpoint2024');
    await db.threads.clear();
    await db.messages.clear();
  });

  afterEach(async () => {
    await db.close();
    TestBed.resetTestingModule();
  });

  it('createAnnouncement creates a thread and announcement-type message', async () => {
    const { thread, message } = await service.createAnnouncement({
      subject: 'Community Update',
      rawBody: 'The pool will be closed this weekend.',
    });

    expect(thread.id).toBeDefined();
    expect(thread.subject).toBe('Community Update');
    expect(thread.participantIds).toEqual([]);

    expect(message.id).toBeDefined();
    expect(message.type).toBe('announcement');
    expect(message.body).toContain('pool');
  });

  it('getAnnouncements returns threads with announcement messages', async () => {
    await service.createAnnouncement({
      subject: 'Announcement 1',
      rawBody: 'First announcement.',
    });
    await service.createAnnouncement({
      subject: 'Announcement 2',
      rawBody: 'Second announcement.',
    });

    const announcements = await service.getAnnouncements();
    expect(announcements.length).toBe(2);
  });
});

describe('Messaging Integration — createTemplate', () => {
  let service: MessagingService;
  let db: DbService;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [RouterTestingModule],
      providers: [MessagingService, DbService, AuditService, AuthService, CryptoService, LoggerService],
    });
    db = TestBed.inject(DbService);
    service = TestBed.inject(MessagingService);
    await db.open();
    await new Promise(r => setTimeout(r, 200));
    await TestBed.inject(AuthService).selectRole('admin', 'harborpoint2024');
    await db.messageTemplates.clear();
  });

  afterEach(async () => {
    await db.close();
    TestBed.resetTestingModule();
  });

  it('stores template and retrieves it by id', async () => {
    const tmpl = await service.createTemplate({
      name:      'Move-In Welcome',
      subject:   'Welcome!',
      body:      'We are pleased to welcome you.',
      category:  'onboarding',
      createdBy: 1,
    });

    expect(tmpl.id).toBeDefined();
    const fetched = await service.getTemplate(tmpl.id!);
    expect(fetched).toBeDefined();
    expect(fetched!.name).toBe('Move-In Welcome');
    expect(fetched!.category).toBe('onboarding');
  });

  it('getTemplates returns all templates', async () => {
    await service.createTemplate({ name: 'T1', subject: 'S1', body: 'B1', category: 'cat', createdBy: 1 });
    await service.createTemplate({ name: 'T2', subject: 'S2', body: 'B2', category: 'cat', createdBy: 1 });

    const templates = await service.getTemplates();
    expect(templates.length).toBe(2);
  });

  it('masks PII in template body before storage', async () => {
    const tmpl = await service.createTemplate({
      name:      'Contact Template',
      subject:   'Contact Info',
      body:      'Email support@harborpoint.local or call 555-999-0000',
      category:  'support',
      createdBy: 1,
    });

    expect(tmpl.body).not.toContain('support@harborpoint.local');
    expect(tmpl.body).not.toContain('555-999-0000');
    expect(tmpl.body).toContain('[EMAIL REDACTED]');
    expect(tmpl.body).toContain('[PHONE REDACTED]');
  });
});

describe('Messaging Integration — masking policy', () => {
  it('redacts phone number in message body', () => {
    const masked = maskSensitiveContent('Call me at 555-867-5309 ok?');
    expect(masked).not.toContain('555-867-5309');
    expect(masked).toContain('[PHONE REDACTED]');
  });

  it('redacts email address in message body', () => {
    const masked = maskSensitiveContent('Email me at john.doe@example.com please');
    expect(masked).not.toContain('john.doe@example.com');
    expect(masked).toContain('[EMAIL REDACTED]');
  });

  it('redacts both phone and email in same message', () => {
    const masked = maskSensitiveContent('Phone: +1 (555) 123-4567, email: test@example.com');
    expect(masked).not.toContain('555');
    expect(masked).not.toContain('test@example.com');
    expect(masked).toContain('[PHONE REDACTED]');
    expect(masked).toContain('[EMAIL REDACTED]');
  });

  it('leaves clean messages unchanged', () => {
    const clean = 'Hello, how are you today?';
    expect(maskSensitiveContent(clean)).toBe(clean);
  });

  it('message body is masked before storage', async () => {
    const TestBed2 = (await import('@angular/core/testing')).TestBed;
    TestBed2.configureTestingModule({
      imports: [(await import('@angular/router/testing')).RouterTestingModule],
      providers: [
        MessagingService, DbService, AuditService, AuthService, CryptoService, LoggerService,
      ],
    });
    const db2 = TestBed2.inject(DbService);
    const service2 = TestBed2.inject(MessagingService);
    await db2.open();
    await new Promise(r => setTimeout(r, 200));
    await TestBed2.inject(AuthService).selectRole('admin', 'harborpoint2024');

    const thread = await service2.createThread([1, 2], 'Masking Test');
    const msg = await service2.sendMessage({
      threadId: thread.id!,
      rawBody: 'Contact admin@harborpoint.local or 555-123-4567',
      type: 'direct',
    });

    expect(msg.body).not.toContain('admin@harborpoint.local');
    expect(msg.body).not.toContain('555-123-4567');
    expect(msg.body).toContain('[EMAIL REDACTED]');
    expect(msg.body).toContain('[PHONE REDACTED]');

    await db2.close();
    TestBed2.resetTestingModule();
  });
});
