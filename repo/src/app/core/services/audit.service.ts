import { Injectable } from '@angular/core';
import { DbService } from './db.service';
import { LoggerService } from './logger.service';

// =====================================================
// Audit Actions Enum
// =====================================================

export enum AuditAction {
  RESIDENT_CREATED       = 'RESIDENT_CREATED',
  RESIDENT_UPDATED       = 'RESIDENT_UPDATED',
  DOCUMENT_UPLOADED      = 'DOCUMENT_UPLOADED',
  DOCUMENT_APPROVED      = 'DOCUMENT_APPROVED',
  DOCUMENT_REJECTED      = 'DOCUMENT_REJECTED',
  CONSENT_GRANTED        = 'CONSENT_GRANTED',
  CONSENT_REVOKED        = 'CONSENT_REVOKED',
  MESSAGE_SENT           = 'MESSAGE_SENT',
  MESSAGE_DELETED        = 'MESSAGE_DELETED',
  MESSAGE_ADMIN_ACCESS   = 'MESSAGE_ADMIN_ACCESS',
  ENROLLMENT_CREATED     = 'ENROLLMENT_CREATED',
  WAITLIST_ADDED         = 'WAITLIST_ADDED',
  ENROLLMENT_DROPPED     = 'ENROLLMENT_DROPPED',
  WAITLIST_PROMOTED      = 'WAITLIST_PROMOTED',
  MOVE_IN                = 'MOVE_IN',
  MOVE_OUT               = 'MOVE_OUT',
  RULE_CHANGED           = 'RULE_CHANGED',
  DATA_EXPORTED          = 'DATA_EXPORTED',
  DATA_IMPORTED          = 'DATA_IMPORTED',
  ANOMALY_FLAGGED        = 'ANOMALY_FLAGGED',
  SESSION_LOCKED         = 'SESSION_LOCKED',
  SESSION_REAUTH         = 'SESSION_REAUTH',
  DOCUMENT_HIDDEN        = 'DOCUMENT_HIDDEN',
  PASSWORD_CHANGED       = 'PASSWORD_CHANGED',
  CONTENT_POLICY_CHANGED = 'CONTENT_POLICY_CHANGED',
}

// =====================================================
// AuditService — APPEND-ONLY
// The auditLogs table must NEVER have update or delete calls.
// Fire-and-forget at call sites (no await required).
// =====================================================

@Injectable({ providedIn: 'root' })
export class AuditService {

  constructor(private db: DbService, private logger: LoggerService) {}

  /**
   * Write an immutable audit entry.
   * Fire-and-forget — no await required at call sites.
   * All errors are swallowed to prevent audit failures from
   * disrupting user-facing operations.
   */
  log(
    action: AuditAction | string,
    actorId: number,
    actorRole: string,
    targetType: string,
    targetId: number | string,
    before?: unknown,
    after?: unknown,
    anomalyFlagged = false,
  ): void {
    // Intentionally NOT awaited — fire-and-forget
    this.db.auditLogs.add({
      timestamp: new Date(),
      actorId,
      actorRole,
      action,
      targetType,
      targetId,
      before,
      after,
      anomalyFlagged,
    }).catch(err => {
      // Silently log to console — never throw from audit
      this.logger.error('AuditService', 'Failed to write audit entry', err);
    });
  }

  /**
   * Query audit logs — used by the Audit Log viewer.
   * Returns all entries sorted descending by timestamp.
   */
  async getLogs(options?: {
    limit?: number;
    actorId?: number;
    action?: string;
    anomalyOnly?: boolean;
    from?: Date;
    to?: Date;
  }): Promise<import('./db.service').AuditLog[]> {
    let query = this.db.auditLogs.orderBy('timestamp').reverse();

    const results = await query.toArray();

    return results.filter(entry => {
      if (options?.actorId !== undefined && entry.actorId !== options.actorId) return false;
      if (options?.action     && entry.action !== options.action) return false;
      if (options?.anomalyOnly && !entry.anomalyFlagged) return false;
      if (options?.from       && entry.timestamp < options.from) return false;
      if (options?.to         && entry.timestamp > options.to) return false;
      return true;
    }).slice(0, options?.limit ?? 10_000);
  }
}
