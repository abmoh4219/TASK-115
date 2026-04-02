import { Injectable } from '@angular/core';
import { DbService, Message, Thread } from './db.service';
import { AuditAction, AuditService } from './audit.service';
import { AuthService } from './auth.service';
import DOMPurify from 'dompurify';

// =====================================================
// Masking Policy
// Applied to ALL message bodies before persistence and display.
// =====================================================

const PHONE_PATTERN = /(\+?\d[\d\s\-(). ]{7,}\d)/g;
const EMAIL_PATTERN = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;

export function maskSensitiveContent(raw: string): string {
  return raw
    .replace(PHONE_PATTERN, '[PHONE REDACTED]')
    .replace(EMAIL_PATTERN, '[EMAIL REDACTED]');
}

@Injectable({ providedIn: 'root' })
export class MessagingService {

  constructor(
    private db: DbService,
    private audit: AuditService,
    private auth: AuthService,
  ) {}

  // --------------------------------------------------
  // Threads
  // --------------------------------------------------

  async getThreads(userId: number): Promise<Thread[]> {
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

  async getMessages(threadId: number): Promise<Message[]> {
    return this.db.messages
      .where('threadId').equals(threadId)
      .filter(m => !m.deleted)
      .sortBy('createdAt');
  }

  async sendMessage(params: {
    threadId: number;
    senderId: number;
    senderRole: string;
    recipientId?: number;
    rawBody: string;
    type: 'announcement' | 'direct';
    templateId?: number;
  }): Promise<Message> {
    const sanitized = DOMPurify.sanitize(params.rawBody);
    const masked = maskSensitiveContent(sanitized);

    const id = await this.db.messages.add({
      threadId:   params.threadId,
      senderId:   params.senderId,
      senderRole: params.senderRole,
      recipientId: params.recipientId,
      body:       masked,
      type:       params.type,
      readBy:     [],
      deleted:    false,
      templateId: params.templateId,
      createdAt:  new Date(),
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
      deleted: true,
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

  async markRead(messageId: number, userId: number): Promise<void> {
    const msg = await this.db.messages.get(messageId);
    if (!msg) return;
    if (msg.readBy.some(r => r.userId === userId)) return;

    await this.db.messages.update(messageId, {
      readBy: [...msg.readBy, { userId, readAt: new Date() }],
    });
  }

  async getUnreadCount(userId: number): Promise<number> {
    const threads = await this.getThreads(userId);
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

  async sendAnnouncement(params: {
    senderId: number;
    senderRole: string;
    subject: string;
    rawBody: string;
  }): Promise<{ thread: Thread; message: Message }> {
    const thread = await this.createThread([], params.subject);
    const message = await this.sendMessage({
      threadId:   thread.id!,
      senderId:   params.senderId,
      senderRole: params.senderRole,
      rawBody:    params.rawBody,
      type:       'announcement',
    });
    return { thread, message };
  }

  // --------------------------------------------------
  // Templates
  // --------------------------------------------------

  async getTemplates() {
    return this.db.messageTemplates.toArray();
  }

  async getTemplate(id: number) {
    return this.db.messageTemplates.get(id);
  }
}
