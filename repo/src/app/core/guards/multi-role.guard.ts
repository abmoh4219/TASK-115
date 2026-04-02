import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { AuthService, UserRole } from '../services/auth.service';

/**
 * Guard factory for routes accessible by multiple roles.
 * Used where a route should be accessible by any of the specified roles.
 */
export function multiRoleGuardFactory(roles: UserRole[]) {
  @Injectable({ providedIn: 'root' })
  class MultiRoleGuard implements CanActivate {
    constructor(private auth: AuthService, private router: Router) {}

    canActivate(): boolean {
      if (this.auth.hasAnyRole(...roles)) return true;
      this.router.navigate(['/unauthorized']);
      return false;
    }
  }
  return MultiRoleGuard;
}

// Pre-built guards for common combinations
@Injectable({ providedIn: 'root' })
export class AllRolesGuard implements CanActivate {
  constructor(private auth: AuthService, private router: Router) {}

  canActivate(): boolean {
    if (this.auth.hasAnyRole('admin', 'resident', 'compliance', 'analyst')) return true;
    this.router.navigate(['/login']);
    return false;
  }
}

@Injectable({ providedIn: 'root' })
export class AdminOrComplianceGuard implements CanActivate {
  constructor(private auth: AuthService, private router: Router) {}

  canActivate(): boolean {
    if (this.auth.hasAnyRole('admin', 'compliance')) return true;
    this.router.navigate(['/unauthorized']);
    return false;
  }
}

@Injectable({ providedIn: 'root' })
export class AdminOrResidentGuard implements CanActivate {
  constructor(private auth: AuthService, private router: Router) {}

  canActivate(): boolean {
    if (this.auth.hasAnyRole('admin', 'resident')) return true;
    this.router.navigate(['/unauthorized']);
    return false;
  }
}
