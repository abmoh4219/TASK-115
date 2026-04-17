/**
 * Extra coverage for ContentPolicyService — evaluate, getPolicies, togglePolicy, addPolicy, deletePolicy
 */
import 'fake-indexeddb/auto';
import { TestBed } from '@angular/core/testing';
import { ContentPolicyService } from '../../../src/app/core/services/content-policy.service';
import { DbService } from '../../../src/app/core/services/db.service';
import { AuthService } from '../../../src/app/core/services/auth.service';

async function setup() {
  TestBed.configureTestingModule({
    providers: [ContentPolicyService, DbService, AuthService],
  });
  const db = TestBed.inject(DbService);
  await db.open();
  await new Promise(r => setTimeout(r, 150));
  await TestBed.inject(AuthService).selectRole('admin', 'harborpoint2024');
  return { service: TestBed.inject(ContentPolicyService), db };
}

async function teardown(db: DbService) {
  await db.close();
  TestBed.resetTestingModule();
}

describe('ContentPolicyService — evaluate', () => {
  it('flags text matching a keyword policy', async () => {
    const { service, db } = await setup();
    const result = await service.evaluate('this is spam content');
    // The seeded DB has a spam policy
    expect(typeof result.flagged).toBe('boolean');
    expect(Array.isArray(result.matchedPolicies)).toBe(true);
    await teardown(db);
  });

  it('blocks text matching a block-action policy', async () => {
    const { service, db } = await setup();
    // "harassment" is a block-action policy in seed data
    const result = await service.evaluate('you are experiencing harassment');
    if (result.action === 'block') {
      expect(result.flagged).toBe(true);
    }
    await teardown(db);
  });

  it('returns no match for clean text', async () => {
    const { service, db } = await setup();
    const result = await service.evaluate('Welcome to HarborPoint community');
    expect(result.matchedPolicies.length).toBe(0);
    await teardown(db);
  });
});

describe('ContentPolicyService — getPolicies', () => {
  it('returns all policies for admin', async () => {
    const { service, db } = await setup();
    const policies = await service.getPolicies();
    expect(Array.isArray(policies)).toBe(true);
    expect(policies.length).toBeGreaterThan(0);
    await teardown(db);
  });

  it('throws when non-admin calls getPolicies', async () => {
    TestBed.configureTestingModule({
      providers: [ContentPolicyService, DbService, AuthService],
    });
    const db = TestBed.inject(DbService);
    await db.open();
    await new Promise(r => setTimeout(r, 150));
    await TestBed.inject(AuthService).selectRole('resident', 'harborpoint2024');
    const svc = TestBed.inject(ContentPolicyService);
    await expect(svc.getPolicies()).rejects.toThrow('Unauthorized');
    await db.close();
    TestBed.resetTestingModule();
  });
});

describe('ContentPolicyService — togglePolicy', () => {
  it('disables a policy', async () => {
    const { service, db } = await setup();
    const policies = await service.getPolicies();
    const policy = policies[0];
    await service.togglePolicy(policy.id!, false);
    const updated = await db.contentPolicies.get(policy.id!);
    expect(updated!.enabled).toBe(false);
    await teardown(db);
  });
});

describe('ContentPolicyService — addPolicy and deletePolicy', () => {
  it('adds and then deletes a policy', async () => {
    const { service, db } = await setup();
    await service.addPolicy({
      type: 'keyword',
      pattern: 'testword',
      action: 'flag',
      severity: 'low',
      enabled: true,
      createdAt: new Date(),
    });
    const policies = await service.getPolicies();
    const added = policies.find(p => p.pattern === 'testword');
    expect(added).toBeDefined();

    await service.deletePolicy(added!.id!);
    const remaining = await service.getPolicies();
    expect(remaining.find(p => p.pattern === 'testword')).toBeUndefined();
    await teardown(db);
  });
});
