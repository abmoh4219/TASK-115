import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { Subscription, filter } from 'rxjs';
import { AuthService, UserRole } from './core/services/auth.service';
import { MessagingService } from './core/services/messaging.service';
import { AnomalyService, AnomalyEvent } from './core/services/anomaly.service';
import { ToastComponent } from './shared/components/toast/toast.component';
import { BadgeComponent } from './shared/components/badge/badge.component';
import { ModalComponent } from './shared/components/modal/modal.component';

interface NavItem {
  path: string;
  label: string;
  icon: string;
  roles: UserRole[];
}

const NAV_ITEMS: NavItem[] = [
  { path: '/dashboard',  label: 'Dashboard',     icon: 'dashboard',   roles: ['admin'] },
  { path: '/property',   label: 'Property',       icon: 'business',    roles: ['admin'] },
  { path: '/residents',  label: 'Residents',      icon: 'people',      roles: ['admin', 'compliance'] },
  { path: '/my-profile', label: 'My Profile',     icon: 'person',      roles: ['resident'] },
  { path: '/documents',  label: 'Documents Queue',icon: 'assignment',  roles: ['compliance'] },
  { path: '/messages',   label: 'Messages',        icon: 'chat',        roles: ['admin', 'resident', 'compliance', 'analyst'] },
  { path: '/search',     label: 'Search',          icon: 'search',      roles: ['admin', 'resident', 'compliance', 'analyst'] },
  { path: '/enrollment', label: 'Enrollment',      icon: 'school',      roles: ['admin', 'resident'] },
  { path: '/analytics',  label: 'Analytics',       icon: 'analytics',   roles: ['admin', 'analyst'] },
  { path: '/audit',      label: 'Audit Log',       icon: 'history',     roles: ['admin'] },
  { path: '/settings',   label: 'Settings',        icon: 'settings',    roles: ['admin'] },
];

const ROLE_LABELS: Record<UserRole, string> = {
  admin:      'Property Admin',
  resident:   'Resident',
  compliance: 'Compliance',
  analyst:    'Analyst',
};

const HIDDEN_SIDEBAR_ROUTES = ['/login', '/unauthorized'];

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterModule,
    MatIconModule, MatButtonModule, MatTooltipModule,
    MatInputModule, MatFormFieldModule,
    ToastComponent, BadgeComponent, ModalComponent,
  ],
  template: `
    <!-- Toast notification stack -->
    <app-toast></app-toast>

    <!-- Re-auth modal (anomaly detection) -->
    <app-modal
      [open]="reAuthOpen"
      type="warning"
      title="Unusual Activity Detected"
      confirmLabel="Verify Identity"
      [loading]="reAuthLoading"
      [confirmDisabled]="!reAuthPassword"
      (confirmed)="onReAuthConfirm()"
      (cancelled)="onReAuthCancel()"
    >
      <div class="reauth-body">
        <div class="reauth-icon-wrap">
          <mat-icon class="reauth-shield">shield</mat-icon>
        </div>
        <p class="reauth-message">
          Suspicious activity was detected in your session.
          Please re-enter your password to continue.
        </p>
        <p *ngIf="reAuthAttemptsLeft < 3" class="reauth-attempts">
          {{ reAuthAttemptsLeft }} attempt{{ reAuthAttemptsLeft !== 1 ? 's' : '' }} remaining
        </p>
        <mat-form-field appearance="outline" class="reauth-field">
          <mat-label>Password</mat-label>
          <input
            matInput
            type="password"
            [(ngModel)]="reAuthPassword"
            (keydown.enter)="onReAuthConfirm()"
            autocomplete="current-password"
          />
        </mat-form-field>
        <p *ngIf="reAuthError" class="reauth-error">{{ reAuthError }}</p>
      </div>
    </app-modal>

    <!-- Login / Unauthorized: full screen, no sidebar -->
    <ng-container *ngIf="showSidebar; else fullscreen">
      <div class="app-shell">

        <!-- Sidebar -->
        <aside class="sidebar" [class.sidebar--collapsed]="sidebarCollapsed" role="navigation">
          <!-- Brand -->
          <div class="sidebar-brand">
            <span class="sidebar-logo">⚓</span>
            <span *ngIf="!sidebarCollapsed" class="sidebar-name">HarborPoint</span>
          </div>

          <!-- Nav links -->
          <nav class="sidebar-nav" aria-label="Main navigation">
            <a
              *ngFor="let item of visibleNavItems"
              [routerLink]="item.path"
              routerLinkActive="active"
              class="nav-link"
              [matTooltip]="sidebarCollapsed ? item.label : ''"
              matTooltipPosition="right"
              [attr.aria-label]="item.label"
            >
              <mat-icon class="nav-icon">{{ item.icon }}</mat-icon>
              <span *ngIf="!sidebarCollapsed" class="nav-label">{{ item.label }}</span>
              <!-- Unread badge on Messages -->
              <app-badge
                *ngIf="item.path === '/messages' && unreadCount > 0"
                [count]="unreadCount"
                variant="danger"
              ></app-badge>
            </a>
          </nav>

          <!-- Sidebar footer -->
          <div class="sidebar-footer">
            <button
              mat-button
              class="collapse-btn"
              (click)="toggleSidebar()"
              [matTooltip]="sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'"
              matTooltipPosition="right"
              aria-label="Toggle sidebar"
            >
              <mat-icon>{{ sidebarCollapsed ? 'chevron_right' : 'chevron_left' }}</mat-icon>
            </button>

            <div *ngIf="!sidebarCollapsed" class="role-badge">
              <span class="role-badge__label">Signed in as</span>
              <span class="role-badge__role">{{ roleLabel }}</span>
            </div>

            <button
              mat-icon-button
              class="lock-btn"
              (click)="lockSession()"
              matTooltip="Lock session"
              matTooltipPosition="right"
              aria-label="Lock session"
            >
              <mat-icon>lock</mat-icon>
            </button>
          </div>
        </aside>

        <!-- Main area -->
        <div class="app-main">
          <!-- Top bar -->
          <header class="topbar" role="banner">
            <h2 class="topbar-title">{{ pageTitle }}</h2>
            <div class="topbar-right">
              <span class="topbar-role hp-badge hp-badge--neutral">{{ roleLabel }}</span>
              <button
                mat-icon-button
                [routerLink]="'/messages'"
                matTooltip="Messages"
                aria-label="Open messages"
              >
                <mat-icon [matBadge]="unreadCount > 0 ? unreadCount : null" matBadgeColor="warn">chat</mat-icon>
              </button>
              <button mat-icon-button (click)="lockSession()" matTooltip="Lock session" aria-label="Lock session">
                <mat-icon>lock</mat-icon>
              </button>
            </div>
          </header>

          <!-- Router outlet -->
          <main class="app-content" role="main">
            <router-outlet></router-outlet>
          </main>
        </div>
      </div>
    </ng-container>

    <!-- Full-screen for login/unauthorized -->
    <ng-template #fullscreen>
      <router-outlet></router-outlet>
    </ng-template>
  `,
  styles: [`
    /* App shell layout */
    .app-shell {
      display: flex;
      height: 100vh;
      overflow: hidden;
    }

    /* Sidebar */
    .sidebar {
      width: var(--hp-sidebar-w);
      min-width: var(--hp-sidebar-w);
      background: var(--hp-navy);
      color: var(--hp-white);
      display: flex;
      flex-direction: column;
      transition: width 200ms, min-width 200ms;
      overflow: hidden;
      z-index: 100;
    }
    .sidebar--collapsed {
      width: 64px;
      min-width: 64px;
    }
    .sidebar-brand {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 1.25rem 1rem;
      border-bottom: 1px solid rgba(255,255,255,0.1);
      flex-shrink: 0;
    }
    .sidebar-logo {
      font-size: 1.5rem;
      flex-shrink: 0;
    }
    .sidebar-name {
      font-size: 1.125rem;
      font-weight: 700;
      white-space: nowrap;
      letter-spacing: -0.025em;
      color: var(--hp-white);
    }

    /* Nav */
    .sidebar-nav {
      flex: 1;
      padding: 1rem 0;
      overflow-y: auto;
    }
    .nav-link {
      display: flex;
      align-items: center;
      gap: 0.875rem;
      padding: 0.75rem 1rem;
      color: rgba(255,255,255,0.7);
      text-decoration: none;
      font-size: 0.9rem;
      font-weight: 500;
      transition: background 150ms, color 150ms;
      white-space: nowrap;
      position: relative;
    }
    .nav-link:hover {
      background: rgba(255,255,255,0.08);
      color: var(--hp-white);
    }
    .nav-link.active {
      background: rgba(45,212,191,0.15);
      color: var(--hp-teal);
      border-right: 3px solid var(--hp-teal);
    }
    .nav-icon { font-size: 1.25rem; width: 1.25rem; height: 1.25rem; flex-shrink: 0; }
    .nav-label { flex: 1; }

    /* Sidebar footer */
    .sidebar-footer {
      padding: 0.75rem;
      border-top: 1px solid rgba(255,255,255,0.1);
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex-shrink: 0;
    }
    .collapse-btn { color: rgba(255,255,255,0.6) !important; flex-shrink: 0; }
    .lock-btn { color: rgba(255,255,255,0.6) !important; flex-shrink: 0; margin-left: auto; }
    .role-badge {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 0.125rem;
      overflow: hidden;
    }
    .role-badge__label { font-size: 0.65rem; color: rgba(255,255,255,0.5); text-transform: uppercase; letter-spacing: 0.05em; }
    .role-badge__role  { font-size: 0.8rem; color: var(--hp-teal); font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

    /* Main area */
    .app-main {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      min-width: 0;
    }

    /* Top bar */
    .topbar {
      height: var(--hp-topbar-h);
      min-height: var(--hp-topbar-h);
      background: var(--hp-white);
      border-bottom: 1px solid var(--hp-border);
      display: flex;
      align-items: center;
      padding: 0 1.5rem;
      gap: 1rem;
      box-shadow: var(--hp-shadow);
      z-index: 50;
    }
    .topbar-title {
      flex: 1;
      margin: 0;
      font-size: 1.125rem;
      color: var(--hp-navy);
    }
    .topbar-right {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .topbar-role {
      font-size: 0.75rem;
    }

    /* Content */
    .app-content {
      flex: 1;
      overflow-y: auto;
      background: var(--hp-bg);
    }

    /* ── Re-auth modal body ────────────────────── */
    .reauth-body {
      display: flex; flex-direction: column; align-items: center;
      text-align: center; gap: 0.75rem; padding: 0.5rem 0;
    }
    .reauth-icon-wrap {
      width: 56px; height: 56px; border-radius: 50%;
      background: rgba(245,158,11,0.12);
      display: flex; align-items: center; justify-content: center;
    }
    .reauth-shield { color: #F59E0B; font-size: 28px; width: 28px; height: 28px; }
    .reauth-message { margin: 0; color: #475569; font-size: 0.9rem; max-width: 320px; }
    .reauth-attempts { margin: 0; font-size: 0.8rem; color: #EF4444; font-weight: 600; }
    .reauth-field { width: 100%; max-width: 320px; }
    .reauth-error { margin: 0; font-size: 0.8rem; color: #EF4444; }
  `],
})
export class AppComponent implements OnInit, OnDestroy {

  showSidebar = false;
  sidebarCollapsed = false;
  currentRole: UserRole | null = null;
  unreadCount = 0;
  pageTitle = 'HarborPoint';

  // Re-auth modal state
  reAuthOpen         = false;
  reAuthLoading      = false;
  reAuthPassword     = '';
  reAuthError        = '';
  reAuthAttemptsLeft = 3;
  private _pendingAnomaly: AnomalyEvent | null = null;

  private subs: Subscription[] = [];

  get visibleNavItems(): NavItem[] {
    if (!this.currentRole) return [];
    return NAV_ITEMS.filter(item => item.roles.includes(this.currentRole!));
  }

  get roleLabel(): string {
    return this.currentRole ? ROLE_LABELS[this.currentRole] : '';
  }

  constructor(
    private auth:      AuthService,
    private router:    Router,
    private messaging: MessagingService,
    private anomaly:   AnomalyService,
  ) {}

  ngOnInit(): void {
    // Track auth state
    this.subs.push(
      this.auth.state$.subscribe(state => {
        this.currentRole = state.role;
        this.loadUnreadCount();
      }),
    );

    // Track route changes to control sidebar visibility and page title
    this.subs.push(
      this.router.events.pipe(
        filter(event => event instanceof NavigationEnd),
      ).subscribe((event) => {
        const url = (event as NavigationEnd).urlAfterRedirects;
        this.showSidebar = !HIDDEN_SIDEBAR_ROUTES.some(r => url.startsWith(r));
        this.pageTitle = this.getTitleForRoute(url);
      }),
    );

    // Restore sidebar state from localStorage
    const collapsed = localStorage.getItem('hp_sidebar');
    if (collapsed) this.sidebarCollapsed = collapsed === 'true';

    // Subscribe to anomaly events → show re-auth modal
    this.subs.push(
      this.anomaly.anomalyDetected$.subscribe(event => {
        this._pendingAnomaly    = event;
        this.reAuthPassword     = '';
        this.reAuthError        = '';
        this.reAuthAttemptsLeft = 3;
        this.reAuthOpen         = true;
      }),
    );
  }

  private async loadUnreadCount(): Promise<void> {
    if (!this.currentRole) { this.unreadCount = 0; return; }
    // Use actor ID 1 as placeholder (real ID resolved in messaging feature)
    try {
      this.unreadCount = await this.messaging.getUnreadCount(1);
    } catch {
      this.unreadCount = 0;
    }
  }

  toggleSidebar(): void {
    this.sidebarCollapsed = !this.sidebarCollapsed;
    localStorage.setItem('hp_sidebar', String(this.sidebarCollapsed));
  }

  lockSession(): void {
    this.anomaly.reset();
    this.auth.lockSession();
  }

  // --------------------------------------------------
  // Re-auth modal handlers
  // --------------------------------------------------

  async onReAuthConfirm(): Promise<void> {
    if (this.reAuthLoading || !this.reAuthPassword) return;
    this.reAuthLoading = true;
    this.reAuthError   = '';

    try {
      const ok = await this.auth.reAuthenticate(this.reAuthPassword);
      if (ok) {
        this.reAuthOpen    = false;
        this.reAuthPassword = '';
        this._pendingAnomaly = null;
      } else {
        this.reAuthAttemptsLeft--;
        if (this.reAuthAttemptsLeft <= 0) {
          this.reAuthOpen = false;
          this.anomaly.reset();
          this.auth.lockSession();
        } else {
          this.reAuthError    = 'Incorrect password.';
          this.reAuthPassword = '';
        }
      }
    } finally {
      this.reAuthLoading = false;
    }
  }

  onReAuthCancel(): void {
    this.reAuthOpen = false;
    this.reAuthPassword = '';
    this._pendingAnomaly = null;
    // Cancelling the re-auth modal locks the session for security
    this.anomaly.reset();
    this.auth.lockSession();
  }

  private getTitleForRoute(url: string): string {
    const item = NAV_ITEMS.find(n => url.startsWith(n.path));
    return item?.label ?? 'HarborPoint';
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
  }
}
