import { Injectable } from '@angular/core';
import { DbService, Message, Thread, MessageTemplate } from './db.service';
import { AuditAction, AuditService } from './audit.service';
import { AuthService } from './auth.service';
import { CryptoService } from './crypto.service';
import { ContentPolicyService } from './content-policy.service';
import { SearchService } from './search.service';
import DOMPurify from 'dompurify';

// =====================================================
// Masking Policy
// Applied to ALL message bodies before persistence and display.
// =====================================================

const PHONE_PATTERN = /(\+?\d[\d\s\-(). ]{7,}\d)/g;
const EMAIL_PATTERN = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;

// originalBody encryption now uses the session-derived key via CryptoService

export function maskSensitiveContent(raw: string): string {
  return raw
    .replace(PHONE_PATTERN, '[PHONE REDACTED]')
    .replace(EMAIL_PATTERN, '[EMAIL REDACTED]');
}

// =====================================================
// MessagingService
// =====================================================

@Injectable({ providedIn: 'root' })
export class MessagingService {

  constructor(
    private db:            DbService,
    private audit:         AuditService,
    private auth:          AuthService,
    private crypto:        CryptoService,
    private contentPolicy: ContentPolicyService,
    private searchService: SearchService,
  ) {}

  private requireRole(...allowedRoles: string[]): void {
    const current = this.auth.getCurrentRole();
    if (!current || !allowedRoles.includes(current)) {
      throw new Error(`Unauthorized: requires role ${allowedRoles.join(' or ')}`);
    }
  }

  // --------------------------------------------------
  // Threads
  // --------------------------------------------------

  /**
   * Admin role → returns ALL threads (full admin visibility).
   * Other roles → only threads where participantIds includes userId.
   */
  async getThreads(): Promise<Thread[]> {
    const role = this.auth.getCurrentRole();
    const userId = this.auth.getCurrentUserId();
    if (!role || userId == null) throw new Error('Unauthorized: no active session');

    if (role === 'admin') {
      return this.db.threads
        .orderBy('lastMessageAt')
        .reverse()
        .toArray();
    }
    return this.db.threads
      .filter(t => t.participantIds.includes(userId))
      .sortBy('lastMessageAt')
      .then(arr => arr.reverse());
  }

  async createThread(participantIds: number[], subject: string): Promise<Thread> {
    const role = this.auth.getCurrentRole();
    const userId = this.auth.getCurrentUserId();
    if (!role || userId == null) throw new Error('Unauthorized: no active session');

    if (participantIds.length > 0) {
      if (participantIds.length < 2) {
        throw new Error('Invalid: thread requires at least 2 participants');
      }
      if (!participantIds.includes(userId) && role !== 'admin') {
        throw new Error('Unauthorized: sender must be a participant in the thread');
      }
    }

    const now = new Date();
    const id = await this.db.threads.add({
      participantIds,
      subject: DOMPurify.sanitize(subject),
      lastMessageAt: now,
      createdAt: now,
    });
    const thread = await this.db.threads.get(id);
    return thread!;
  }

  // --------------------------------------------------
  // Messages
  // --------------------------------------------------

  /**
   * Fetch visible (non-deleted) messages for a thread.
   * If an admin who is NOT a participant accesses the thread,
   * a MESSAGE_ADMIN_ACCESS audit entry is written per CLAUDE.md security requirements.
   */
  async getMessages(threadId: number): Promise<Message[]> {
    const role = this.auth.getCurrentRole();
    const userId = this.auth.getCurrentUserId();
    if (!role || userId == null) throw new Error('Unauthorized: no active session');

    const thread = await this.db.threads.get(threadId);
    if (thread) {
      if (role === 'admin' && !thread.participantIds.includes(userId)) {
        this.audit.log(AuditAction.MESSAGE_ADMIN_ACCESS, userId, role, 'thread', threadId);
      } else if (role !== 'admin' && !thread.participantIds.includes(userId)) {
        throw new Error('Unauthorized: not a participant in this thread');
      }
    }

    return this.db.messages
      .where('threadId').equals(threadId)
      .filter(m => !m.deleted)
      .sortBy('createdAt');
  }

  /**
   * Send a message.
   * Order of operations (per CLAUDE.md):
   *   1. Sanitize raw input (DOMPurify)
   *   2. Mask sensitive content → stored as `body`
   *   3. Encrypt original sanitized body → stored as `originalBody` (audit-only)
   *   4. Persist to DB
   *   5. Update thread.lastMessageAt
   *   6. Emit MESSAGE_SENT audit entry
   */
  async sendMessage(params: {
    threadId:    number;
    recipientId?: number;
    rawBody:     string;
    type:        'announcement' | 'direct';
    templateId?: number;
  }): Promise<Message> {
    const senderId = this.auth.getCurrentUserId();
    const senderRole = this.auth.getCurrentRole();
    if (senderId == null || !senderRole) throw new Error('Unauthorized: no active session');

    // Verify sender is participant (non-admin, non-announcement)
    if (senderRole !== 'admin' && params.type !== 'announcement') {
      const thread = await this.db.threads.get(params.threadId);
      if (!thread) throw new Error('Thread not found');
      if (!thread.participantIds.includes(senderId)) {
        throw new Error('Unauthorized: sender is not a participant in this thread');
      }
    }

    const sanitized = DOMPurify.sanitize(params.rawBody);
    const masked    = maskSensitiveContent(sanitized);

    // Content policy enforcement
    const policyResult = await this.contentPolicy.evaluate(masked);
    if (policyResult.action === 'block') {
      throw new Error('Message blocked by content safety policy');
    }

    // Encrypt original (pre-mask) body for audit trail
    let encryptedOriginal: string | undefined;
    try {
      const sessionKey = this.crypto.getSessionKey();
      if (!sessionKey) throw new Error('No session key');
      const { ciphertext, iv } = await this.crypto.encryptRaw(sanitized, sessionKey);
      const payload = { ciphertext, iv };
      encryptedOriginal = JSON.stringify(payload);
    } catch {
      encryptedOriginal = undefined;
    }

    const id = await this.db.messages.add({
      threadId:     params.threadId,
      senderId,
      senderRole,
      recipientId:  params.recipientId,
      body:         masked,
      originalBody: encryptedOriginal,
      type:         params.type,
      readBy:       [],
      deleted:      false,
      templateId:   params.templateId,
      createdAt:    new Date(),
    });

    await this.db.threads.update(params.threadId, { lastMessageAt: new Date() });

    this.audit.log(AuditAction.MESSAGE_SENT, senderId, senderRole, 'message', id);

    const msg = await this.db.messages.get(id);

    // Index for full-text search
    const thread = await this.db.threads.get(params.threadId);
    this.searchService.reindexEntity({
      entityType: 'message',
      entityId: id,
      title: thread?.subject ?? 'Message',
      body: masked,
      tags: ['message', params.type],
      metadata: { threadId: params.threadId, senderRole },
      category: 'message',
      createdAt: new Date(),
    }).catch(() => {/* best-effort */});

    return msg!;
  }

  async deleteMessage(messageId: number): Promise<void> {
    this.requireRole('admin');
    const actorId = this.auth.getCurrentUserId()!;
    const actorRole = this.auth.getCurrentRole()!;
    const msg = await this.db.messages.get(messageId);
    if (!msg) throw new Error('Message not found');

    await this.db.messages.update(messageId, {
      deleted:   true,
      deletedAt: new Date(),
      deletedBy: actorId,
    });

    this.audit.log(AuditAction.MESSAGE_DELETED, actorId, actorRole, 'message', messageId, msg);
  }

  /**
   * Mark a message read by userId.
   * Called by IntersectionObserver when message scrolls into viewport.
   * Idempotent — no-op if already marked read.
   */
  async markRead(messageId: number): Promise<void> {
    const userId = this.auth.getCurrentUserId();
    if (userId == null) return;
    const msg = await this.db.messages.get(messageId);
    if (!msg) return;
    if (msg.readBy.some(r => r.userId === userId)) return;

    await this.db.messages.update(messageId, {
      readBy: [...msg.readBy, { userId, readAt: new Date() }],
    });
  }

  async getUnreadCount(): Promise<number> {
    const userId = this.auth.getCurrentUserId();
    if (userId == null) return 0;
    const threads = await this.getThreads();
    let count = 0;
    for (const thread of threads) {
      const messages = await this.getMessages(thread.id!);
      count += messages.filter(
        m => m.senderId !== userId && !m.readBy.some(r => r.userId === userId),
      ).length;
    }
    return count;
  }

  // --------------------------------------------------
  // Announcements
  // --------------------------------------------------

  /**
   * Returns threads that contain at least one announcement-type message,
   * sorted descending by lastMessageAt.
   */
  async getAnnouncements(): Promise<Thread[]> {
    const annMsgs = await this.db.messages
      .where('type').equals('announcement')
      .filter(m => !m.deleted)
      .toArray();

    const threadIds = [...new Set(annMsgs.map(m => m.threadId))];

    const threads = await Promise.all(threadIds.map(id => this.db.threads.get(id)));

    return threads
      .filter((t): t is Thread => t !== undefined)
      .sort(
        (a, b) =>
          new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime(),
      );
  }

  async createAnnouncement(params: {
    subject:    string;
    rawBody:    string;
  }): Promise<{ thread: Thread; message: Message }> {
    this.requireRole('admin');
    const thread  = await this.createThread([], params.subject);
    const message = await this.sendMessage({
      threadId:   thread.id!,
      rawBody:    params.rawBody,
      type:       'announcement',
    });
    return { thread, message };
  }

  // --------------------------------------------------
  // Templates
  // --------------------------------------------------

  async getTemplates(): Promise<MessageTemplate[]> {
    return this.db.messageTemplates.toArray();
  }

  async getTemplate(id: number): Promise<MessageTemplate | undefined> {
    return this.db.messageTemplates.get(id);
  }

  async createTemplate(params: {
    name:      string;
    subject:   string;
    body:      string;
    category:  string;
    createdBy: number;
  }): Promise<MessageTemplate> {
    this.requireRole('admin');
    const now = new Date();
    const id = await this.db.messageTemplates.add({
      name:      DOMPurify.sanitize(params.name),
      subject:   DOMPurify.sanitize(params.subject),
      body:      maskSensitiveContent(DOMPurify.sanitize(params.body)),
      category:  DOMPurify.sanitize(params.category),
      createdBy: params.createdBy,
      createdAt: now,
      updatedAt: now,
    });
    const tmpl = await this.db.messageTemplates.get(id);
    return tmpl!;
  }

  async deleteTemplate(id: number): Promise<void> {
    this.requireRole('admin');
    await this.db.messageTemplates.delete(id);
  }
}
