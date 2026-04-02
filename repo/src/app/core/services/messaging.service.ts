import { Injectable } from '@angular/core';
import { DbService, Message, Thread, MessageTemplate } from './db.service';
import { AuditAction, AuditService } from './audit.service';
import { AuthService } from './auth.service';
import { CryptoService } from './crypto.service';
import DOMPurify from 'dompurify';

// =====================================================
// Masking Policy
// Applied to ALL message bodies before persistence and display.
// =====================================================

const PHONE_PATTERN = /(\+?\d[\d\s\-(). ]{7,}\d)/g;
const EMAIL_PATTERN = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;

/** App-level key used to encrypt originalBody at rest for audit purposes. */
const ORIG_BODY_KEY = 'hp-msg-audit-key-v1';

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
    private db:     DbService,
    private audit:  AuditService,
    private auth:   AuthService,
    private crypto: CryptoService,
  ) {}

  // --------------------------------------------------
  // Threads
  // --------------------------------------------------

  /**
   * Admin role → returns ALL threads (full admin visibility).
   * Other roles → only threads where participantIds includes userId.
   */
  async getThreads(userId: number, role?: string): Promise<Thread[]> {
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
  async getMessages(
    threadId: number,
    requesterId?: number,
    requesterRole?: string,
  ): Promise<Message[]> {
    if (requesterId !== undefined && requesterRole === 'admin') {
      const thread = await this.db.threads.get(threadId);
      if (thread && !thread.participantIds.includes(requesterId)) {
        this.audit.log(
          AuditAction.MESSAGE_ADMIN_ACCESS,
          requesterId,
          requesterRole,
          'thread',
          threadId,
        );
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
    senderId:    number;
    senderRole:  string;
    recipientId?: number;
    rawBody:     string;
    type:        'announcement' | 'direct';
    templateId?: number;
  }): Promise<Message> {
    const sanitized = DOMPurify.sanitize(params.rawBody);
    const masked    = maskSensitiveContent(sanitized);

    // Encrypt original (pre-mask) body for audit trail
    let encryptedOriginal: string | undefined;
    try {
      const payload = await this.crypto.encrypt(sanitized, ORIG_BODY_KEY);
      encryptedOriginal = JSON.stringify(payload);
    } catch {
      encryptedOriginal = undefined;
    }

    const id = await this.db.messages.add({
      threadId:     params.threadId,
      senderId:     params.senderId,
      senderRole:   params.senderRole,
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

    this.audit.log(
      AuditAction.MESSAGE_SENT,
      params.senderId,
      params.senderRole,
      'message',
      id,
    );

    const msg = await this.db.messages.get(id);
    return msg!;
  }

  async deleteMessage(messageId: number, actorId: number, actorRole: string): Promise<void> {
    const msg = await this.db.messages.get(messageId);
    if (!msg) throw new Error('Message not found');

    await this.db.messages.update(messageId, {
      deleted:   true,
      deletedAt: new Date(),
      deletedBy: actorId,
    });

    this.audit.log(
      AuditAction.MESSAGE_DELETED,
      actorId,
      actorRole,
      'message',
      messageId,
      msg,
    );
  }

  /**
   * Mark a message read by userId.
   * Called by IntersectionObserver when message scrolls into viewport.
   * Idempotent — no-op if already marked read.
   */
  async markRead(messageId: number, userId: number): Promise<void> {
    const msg = await this.db.messages.get(messageId);
    if (!msg) return;
    if (msg.readBy.some(r => r.userId === userId)) return;

    await this.db.messages.update(messageId, {
      readBy: [...msg.readBy, { userId, readAt: new Date() }],
    });
  }

  async getUnreadCount(userId: number, role?: string): Promise<number> {
    const threads = await this.getThreads(userId, role);
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
    senderId:   number;
    senderRole: string;
    subject:    string;
    rawBody:    string;
  }): Promise<{ thread: Thread; message: Message }> {
    const thread  = await this.createThread([], params.subject);
    const message = await this.sendMessage({
      threadId:   thread.id!,
      senderId:   params.senderId,
      senderRole: params.senderRole,
      rawBody:    params.rawBody,
      type:       'announcement',
    });
    return { thread, message };
  }

  /** @deprecated Use createAnnouncement */
  sendAnnouncement(params: {
    senderId:   number;
    senderRole: string;
    subject:    string;
    rawBody:    string;
  }): Promise<{ thread: Thread; message: Message }> {
    return this.createAnnouncement(params);
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
}
