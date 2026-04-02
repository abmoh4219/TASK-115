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

describe('Messaging Integration — thread & message flow', () => {
  let service: MessagingService;
  let db: DbService;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [RouterTestingModule],
      providers: [MessagingService, DbService, AuditService, AuthService, CryptoService],
    });
    db = TestBed.inject(DbService);
    service = TestBed.inject(MessagingService);
    await db.open();
    await new Promise(r => setTimeout(r, 200));
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
      senderId: 1,
      senderRole: 'admin',
      rawBody: 'Hello there!',
      type: 'direct',
    });
    expect(msg.id).toBeDefined();
    expect(msg.body).toBe('Hello there!');
    expect(msg.deleted).toBe(false);
  });

  it('retrieves messages for a thread', async () => {
    const thread = await service.createThread([1, 2], 'Thread');
    await service.sendMessage({ threadId: thread.id!, senderId: 1, senderRole: 'admin', rawBody: 'Msg 1', type: 'direct' });
    await service.sendMessage({ threadId: thread.id!, senderId: 2, senderRole: 'resident', rawBody: 'Msg 2', type: 'direct' });

    const messages = await service.getMessages(thread.id!);
    expect(messages.length).toBe(2);
  });

  it('marks a message as read', async () => {
    const thread = await service.createThread([1, 2], 'Thread');
    const msg = await service.sendMessage({ threadId: thread.id!, senderId: 1, senderRole: 'admin', rawBody: 'Hi', type: 'direct' });
    await service.markRead(msg.id!, 2);

    const updated = await db.messages.get(msg.id!);
    expect(updated?.readBy.some(r => r.userId === 2)).toBe(true);
  });

  it('does not duplicate read receipts', async () => {
    const thread = await service.createThread([1, 2], 'Thread');
    const msg = await service.sendMessage({ threadId: thread.id!, senderId: 1, senderRole: 'admin', rawBody: 'Hi', type: 'direct' });
    await service.markRead(msg.id!, 2);
    await service.markRead(msg.id!, 2); // called twice

    const updated = await db.messages.get(msg.id!);
    expect(updated?.readBy.filter(r => r.userId === 2).length).toBe(1);
  });

  it('soft-deletes a message (deleted=true)', async () => {
    const thread = await service.createThread([1, 2], 'Thread');
    const msg = await service.sendMessage({ threadId: thread.id!, senderId: 1, senderRole: 'admin', rawBody: 'Delete me', type: 'direct' });
    await service.deleteMessage(msg.id!, 1, 'admin');

    const deleted = await db.messages.get(msg.id!);
    expect(deleted?.deleted).toBe(true);
    expect(deleted?.deletedAt).toBeDefined();
  });

  it('deleted messages excluded from getMessages', async () => {
    const thread = await service.createThread([1, 2], 'Thread');
    const msg = await service.sendMessage({ threadId: thread.id!, senderId: 1, senderRole: 'admin', rawBody: 'Visible', type: 'direct' });
    const msg2 = await service.sendMessage({ threadId: thread.id!, senderId: 1, senderRole: 'admin', rawBody: 'Hidden', type: 'direct' });
    await service.deleteMessage(msg2.id!, 1, 'admin');

    const messages = await service.getMessages(thread.id!);
    expect(messages.length).toBe(1);
    expect(messages[0].id).toBe(msg.id);
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
        MessagingService, DbService, AuditService, AuthService, CryptoService,
      ],
    });
    const db2 = TestBed2.inject(DbService);
    const service2 = TestBed2.inject(MessagingService);
    await db2.open();
    await new Promise(r => setTimeout(r, 200));

    const thread = await service2.createThread([1, 2], 'Masking Test');
    const msg = await service2.sendMessage({
      threadId: thread.id!,
      senderId: 1,
      senderRole: 'admin',
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
