/**
 * Extra coverage for MessagingService — deleteMessage, markRead, getUnreadCount, getAnnouncements
 */
import 'fake-indexeddb/auto';
import { TestBed } from '@angular/core/testing';
import { MessagingService } from '../../../src/app/core/services/messaging.service';
import { DbService } from '../../../src/app/core/services/db.service';
import { AuthService } from '../../../src/app/core/services/auth.service';
import { AuditService } from '../../../src/app/core/services/audit.service';
import { ContentPolicyService } from '../../../src/app/core/services/content-policy.service';
import { SearchService } from '../../../src/app/core/services/search.service';
import { AnomalyService } from '../../../src/app/core/services/anomaly.service';
import { LoggerService } from '../../../src/app/core/services/logger.service';

async function setup() {
  TestBed.configureTestingModule({
    providers: [MessagingService, DbService, AuthService, AuditService, ContentPolicyService, SearchService, AnomalyService, LoggerService],
  });
  const db = TestBed.inject(DbService);
  await db.open();
  await new Promise(r => setTimeout(r, 150));
  await TestBed.inject(AuthService).selectRole('admin', 'harborpoint2024');
  return { service: TestBed.inject(MessagingService), db };
}

async function teardown(db: DbService) {
  await db.close();
  TestBed.resetTestingModule();
}

describe('MessagingService — createThread and sendMessage', () => {
  it('creates a thread and sends a message', async () => {
    const { service, db } = await setup();
    const thread = await service.createThread([1, 2], 'Test Thread', );
    expect(thread.id).toBeDefined();
    const msg = await service.sendMessage({ threadId: thread.id!, rawBody: 'Hello', type: 'direct' as const });
    expect(msg).toBeDefined();
    await teardown(db);
  });
});

describe('MessagingService — deleteMessage', () => {
  it('marks message as deleted', async () => {
    const { service, db } = await setup();
    const thread = await service.createThread([1, 2], 'Del Thread', );
    const msg = await service.sendMessage({ threadId: thread.id!, rawBody: 'To delete', type: 'direct' as const });
    await service.deleteMessage(msg.id!);
    const updated = await db.messages.get(msg.id!);
    expect(updated!.deleted).toBe(true);
    await teardown(db);
  });

  it('throws when message not found', async () => {
    const { service, db } = await setup();
    await expect(service.deleteMessage(99999)).rejects.toThrow('Message not found');
    await teardown(db);
  });
});

describe('MessagingService — markRead', () => {
  it('marks a message as read', async () => {
    const { service, db } = await setup();
    const thread = await service.createThread([1, 2], 'Read Thread', );
    const msg = await service.sendMessage({ threadId: thread.id!, rawBody: 'Read me', type: 'direct' as const });
    await service.markRead(msg.id!);
    const updated = await db.messages.get(msg.id!);
    expect(updated!.readBy.length).toBeGreaterThan(0);
    await teardown(db);
  });

  it('is idempotent — does not double mark', async () => {
    const { service, db } = await setup();
    const thread = await service.createThread([1, 2], 'Idempotent', );
    const msg = await service.sendMessage({ threadId: thread.id!, rawBody: 'Test', type: 'direct' as const });
    await service.markRead(msg.id!);
    await service.markRead(msg.id!);
    const updated = await db.messages.get(msg.id!);
    const userId = TestBed.inject(AuthService).getCurrentUserId()!;
    const readCount = updated!.readBy.filter(r => r.userId === userId).length;
    expect(readCount).toBe(1);
    await teardown(db);
  });
});

describe('MessagingService — getUnreadCount', () => {
  it('returns a number', async () => {
    const { service, db } = await setup();
    const count = await service.getUnreadCount();
    expect(typeof count).toBe('number');
    await teardown(db);
  });
});

describe('MessagingService — getAnnouncements', () => {
  it('returns announcement threads', async () => {
    const { service, db } = await setup();
    const announcements = await service.getAnnouncements();
    expect(Array.isArray(announcements)).toBe(true);
    await teardown(db);
  });
});

describe('MessagingService — createAnnouncement', () => {
  it('creates an announcement thread and message', async () => {
    const { service, db } = await setup();
    const result = await service.createAnnouncement({
      subject: 'Community Notice',
      rawBody: 'Important update for all residents',
    });
    expect(result.thread).toBeDefined();
    expect(result.message).toBeDefined();
    await teardown(db);
  });
});

describe('MessagingService — getTemplates', () => {
  it('returns templates array', async () => {
    const { service, db } = await setup();
    const templates = await service.getTemplates();
    expect(Array.isArray(templates)).toBe(true);
    await teardown(db);
  });

  it('returns template by id', async () => {
    const { service, db } = await setup();
    const templates = await service.getTemplates();
    if (templates.length > 0) {
      const t = await service.getTemplate(templates[0].id!);
      expect(t).toBeDefined();
    }
    await teardown(db);
  });
});

describe('MessagingService — getThreads and getMessages', () => {
  it('returns threads', async () => {
    const { service, db } = await setup();
    const threads = await service.getThreads();
    expect(Array.isArray(threads)).toBe(true);
    await teardown(db);
  });

  it('returns messages for a thread', async () => {
    const { service, db } = await setup();
    const thread = await service.createThread([1, 2], 'GetMsgs', );
    await service.sendMessage({ threadId: thread.id!, rawBody: 'Hello', type: 'direct' as const });
    const messages = await service.getMessages(thread.id!);
    expect(messages.length).toBeGreaterThan(0);
    await teardown(db);
  });
});
