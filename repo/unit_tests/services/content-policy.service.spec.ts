/**
 * Unit Tests — ContentPolicyService
 * Tests: evaluate (keyword, regex, block, flag, disabled), messaging integration
 */

import 'fake-indexeddb/auto';
import { TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { ContentPolicyService } from '../../src/app/core/services/content-policy.service';
import { MessagingService } from '../../src/app/core/services/messaging.service';
import { DbService } from '../../src/app/core/services/db.service';
import { AuditService } from '../../src/app/core/services/audit.service';
import { AuthService } from '../../src/app/core/services/auth.service';
import { CryptoService } from '../../src/app/core/services/crypto.service';
import { LoggerService } from '../../src/app/core/services/logger.service';

async function setup() {
  TestBed.configureTestingModule({
    imports: [RouterTestingModule],
    providers: [
      ContentPolicyService, MessagingService, DbService,
      AuditService, AuthService, CryptoService, LoggerService,
    ],
  });
  const db = TestBed.inject(DbService);
  await db.open();
  await db.contentPolicies.clear();
  await new Promise(r => setTimeout(r, 150));
  await TestBed.inject(AuthService).selectRole('admin', 'harborpoint2024');
  return {
    policy:    TestBed.inject(ContentPolicyService),
    messaging: TestBed.inject(MessagingService),
    auth:      TestBed.inject(AuthService),
    db,
  };
}

function teardown() { TestBed.resetTestingModule(); }

describe('ContentPolicyService — evaluate', () => {

  it('returns flagged=false for clean text with no policies', async () => {
    const { policy, db } = await setup();
    const result = await policy.evaluate('hello world');
    expect(result.flagged).toBe(false);
    expect(result.action).toBeNull();
    await db.close();
    teardown();
  });

  it('detects keyword match (case insensitive)', async () => {
    const { policy, db } = await setup();
    await db.contentPolicies.add({
      pattern: 'banned', type: 'keyword', action: 'flag',
      severity: 'medium', enabled: true, createdAt: new Date(),
    });
    const result = await policy.evaluate('this is BANNED content');
    expect(result.flagged).toBe(true);
    expect(result.action).toBe('flag');
    expect(result.matchedPolicies).toContain('banned');
    await db.close();
    teardown();
  });

  it('detects regex match', async () => {
    const { policy, db } = await setup();
    await db.contentPolicies.add({
      pattern: '\\d{3}-\\d{4}', type: 'regex', action: 'flag',
      severity: 'low', enabled: true, createdAt: new Date(),
    });
    const result = await policy.evaluate('call 555-1234');
    expect(result.flagged).toBe(true);
    await db.close();
    teardown();
  });

  it('returns block when policy action is block', async () => {
    const { policy, db } = await setup();
    await db.contentPolicies.add({
      pattern: 'forbidden', type: 'keyword', action: 'block',
      severity: 'high', enabled: true, createdAt: new Date(),
    });
    const result = await policy.evaluate('forbidden phrase');
    expect(result.action).toBe('block');
    await db.close();
    teardown();
  });

  it('ignores disabled policies', async () => {
    const { policy, db } = await setup();
    await db.contentPolicies.add({
      pattern: 'banned', type: 'keyword', action: 'flag',
      severity: 'medium', enabled: false, createdAt: new Date(),
    });
    const result = await policy.evaluate('banned word here');
    expect(result.flagged).toBe(false);
    await db.close();
    teardown();
  });
});

describe('ContentPolicyService — messaging integration', () => {

  it('sendMessage throws when content policy blocks message', async () => {
    const { messaging, db } = await setup();
    await db.contentPolicies.add({
      pattern: 'forbidden', type: 'keyword', action: 'block',
      severity: 'high', enabled: true, createdAt: new Date(),
    });

    const thread = await messaging.createThread([1, 2], 'Policy Test');
    await expect(
      messaging.sendMessage({ threadId: thread.id!, rawBody: 'this is forbidden content', type: 'direct' }),
    ).rejects.toThrow('blocked by content safety policy');

    await db.close();
    teardown();
  });

  it('sendMessage succeeds when content policy flags (not blocks)', async () => {
    const { messaging, db } = await setup();
    await db.contentPolicies.add({
      pattern: 'suspicious', type: 'keyword', action: 'flag',
      severity: 'medium', enabled: true, createdAt: new Date(),
    });

    const thread = await messaging.createThread([1, 2], 'Flag Test');
    const msg = await messaging.sendMessage({
      threadId: thread.id!, rawBody: 'suspicious activity reported', type: 'direct',
    });
    expect(msg.id).toBeDefined();
    expect(msg.body).toContain('suspicious');

    await db.close();
    teardown();
  });
});
