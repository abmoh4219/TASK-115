import { Injectable } from '@angular/core';
import { DbService, ContentPolicy } from './db.service';
import { AuthService } from './auth.service';

export interface PolicyResult {
  flagged: boolean;
  matchedPolicies: string[];
  action: 'flag' | 'block' | null;
}

@Injectable({ providedIn: 'root' })
export class ContentPolicyService {

  constructor(
    private db: DbService,
    private authService: AuthService,
  ) {}

  private requireRole(...roles: string[]): void {
    const current = this.authService.getCurrentRole();
    if (!current || !roles.includes(current)) {
      throw new Error('Unauthorized: requires role ' + roles.join(' or '));
    }
  }

  private async getActivePolicies(): Promise<ContentPolicy[]> {
    const all = await this.db.contentPolicies.toArray();
    return all.filter(p => p.enabled !== false);
  }

  async evaluate(text: string): Promise<PolicyResult> {
    const policies = await this.getActivePolicies();
    const matched: string[] = [];
    let highestAction: 'flag' | 'block' | null = null;

    for (const policy of policies) {
      let isMatch = false;
      try {
        if (policy.type === 'regex') {
          isMatch = new RegExp(policy.pattern, 'i').test(text);
        } else {
          isMatch = text.toLowerCase().includes(policy.pattern.toLowerCase());
        }
      } catch {
        continue;
      }

      if (isMatch) {
        matched.push(policy.pattern);
        if (policy.action === 'block') highestAction = 'block';
        else if (policy.action === 'flag' && highestAction !== 'block') highestAction = 'flag';
      }
    }

    return { flagged: matched.length > 0, matchedPolicies: matched, action: highestAction };
  }

  // Admin CRUD methods (used by settings component)

  async getPolicies(): Promise<ContentPolicy[]> {
    this.requireRole('admin');
    return this.db.contentPolicies.toArray();
  }

  async togglePolicy(id: number, enabled: boolean): Promise<void> {
    this.requireRole('admin');
    await this.db.contentPolicies.update(id, { enabled });
  }

  async addPolicy(policy: Omit<ContentPolicy, 'id'>): Promise<void> {
    this.requireRole('admin');
    await this.db.contentPolicies.add(policy as ContentPolicy);
  }

  async deletePolicy(id: number): Promise<void> {
    this.requireRole('admin');
    await this.db.contentPolicies.delete(id);
  }
}
