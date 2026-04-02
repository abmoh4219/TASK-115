import {
  Component, OnInit, AfterViewChecked, OnDestroy,
  ElementRef, NgZone, ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subscription } from 'rxjs';

import { MessagingService, maskSensitiveContent } from '../../core/services/messaging.service';
import { AuthService, UserRole } from '../../core/services/auth.service';
import { DbService, Message, Thread, MessageTemplate, Resident } from '../../core/services/db.service';
import { ModalComponent } from '../../shared/components/modal/modal.component';
import { MaskPipe } from '../../shared/pipes/mask.pipe';
import { ToastService } from '../../shared/components/toast/toast.service';

// =====================================================
// Types
// =====================================================

interface ThreadView {
  thread:       Thread;
  displayName:  string;
  initials:     string;
  avatarColor:  string;
  unreadCount:  number;
  lastBody:     string;
}

// Role → demo userId mapping for the single-instance demo app
const ROLE_USER_ID: Record<UserRole, number> = {
  admin:      1,
  resident:   2,
  compliance: 3,
  analyst:    4,
};

const AVATAR_COLORS = [
  '#1e3a5f', '#0d9488', '#7c3aed', '#db2777',
  '#ea580c', '#16a34a', '#2563eb', '#b45309',
];

// =====================================================
// MessagingComponent
// =====================================================

@Component({
  selector: 'app-messaging',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatIconModule, MatButtonModule, MatTooltipModule,
    ModalComponent, MaskPipe,
  ],
  template: `
<div class="msg-shell">

  <!-- ══════════════════════════════════════════
       LEFT PANEL — thread list
  ══════════════════════════════════════════════ -->
  <aside class="msg-panel-left">

    <!-- Search -->
    <div class="panel-search">
      <mat-icon class="search-icon">search</mat-icon>
      <input class="search-input" [(ngModel)]="searchQuery"
             placeholder="Search conversations…" aria-label="Search conversations">
    </div>

    <!-- Admin visibility note -->
    <div class="admin-note-banner" *ngIf="isAdmin">
      <mat-icon class="admin-note-icon">admin_panel_settings</mat-icon>
      <span>You can see all conversations</span>
    </div>

    <!-- Tabs -->
    <div class="panel-tabs">
      <button class="tab-btn" [class.tab-btn--active]="activeTab === 'messages'"
              (click)="switchTab('messages')">
        Messages
        <span class="tab-count" *ngIf="totalUnread > 0">{{ totalUnread }}</span>
      </button>
      <button class="tab-btn" [class.tab-btn--active]="activeTab === 'announcements'"
              (click)="switchTab('announcements')">
        Announcements
      </button>
    </div>

    <!-- Thread list -->
    <div class="thread-list" role="list">

      <!-- Loading skeletons -->
      <ng-container *ngIf="loadingThreads">
        <div class="thread-skeleton" *ngFor="let i of [1,2,3,4,5]" role="listitem"></div>
      </ng-container>

      <!-- Messages tab -->
      <ng-container *ngIf="!loadingThreads && activeTab === 'messages'">
        <div class="thread-empty" *ngIf="filteredThreads.length === 0">
          <mat-icon>chat_bubble_outline</mat-icon>
          <p>No conversations yet</p>
        </div>
        <div class="thread-item"
             *ngFor="let tv of filteredThreads"
             role="listitem"
             [class.thread-item--active]="selectedThread?.id === tv.thread.id"
             [class.thread-item--unread]="tv.unreadCount > 0"
             (click)="selectThread(tv.thread)"
             [attr.aria-selected]="selectedThread?.id === tv.thread.id">
          <div class="unread-dot" *ngIf="tv.unreadCount > 0" aria-hidden="true"></div>
          <div class="thread-avatar" [style.background]="tv.avatarColor" aria-hidden="true">
            {{ tv.initials }}
          </div>
          <div class="thread-info">
            <div class="thread-info-top">
              <span class="thread-name" [class.thread-name--bold]="tv.unreadCount > 0">
                {{ tv.displayName }}
              </span>
              <span class="thread-time">{{ tv.thread.lastMessageAt | date:'h:mm a' }}</span>
            </div>
            <div class="thread-info-bottom">
              <span class="thread-subject">{{ tv.thread.subject }}</span>
              <span class="unread-badge" *ngIf="tv.unreadCount > 0">{{ tv.unreadCount }}</span>
            </div>
          </div>
        </div>
      </ng-container>

      <!-- Announcements tab -->
      <ng-container *ngIf="!loadingThreads && activeTab === 'announcements'">
        <div class="thread-empty" *ngIf="filteredAnnouncements.length === 0">
          <mat-icon>campaign</mat-icon>
          <p>No announcements yet</p>
        </div>
        <div class="thread-item thread-item--announce"
             *ngFor="let tv of filteredAnnouncements"
             role="listitem"
             [class.thread-item--active]="selectedThread?.id === tv.thread.id"
             (click)="selectThread(tv.thread)">
          <div class="thread-avatar thread-avatar--announce" aria-hidden="true">
            <mat-icon>campaign</mat-icon>
          </div>
          <div class="thread-info">
            <div class="thread-info-top">
              <span class="thread-name">{{ tv.thread.subject }}</span>
              <span class="thread-time">{{ tv.thread.lastMessageAt | date:'MMM d' }}</span>
            </div>
            <div class="thread-info-bottom">
              <span class="thread-subject">{{ tv.lastBody | slice:0:50 }}{{ tv.lastBody.length > 50 ? '…' : '' }}</span>
            </div>
          </div>
        </div>
      </ng-container>

    </div><!-- /thread-list -->

    <!-- Bottom actions -->
    <div class="panel-actions">
      <button class="btn-new-msg" (click)="openNewThread()">
        <mat-icon>edit</mat-icon>
        New Message
      </button>
      <button class="btn-announce" *ngIf="isAdmin" (click)="announcementModalOpen = true"
              matTooltip="Post a broadcast announcement">
        <mat-icon>campaign</mat-icon>
        Announce
      </button>
    </div>

  </aside>

  <!-- ══════════════════════════════════════════
       RIGHT PANEL — conversation view
  ══════════════════════════════════════════════ -->
  <main class="msg-panel-right">

    <!-- ── Empty state ─────────────────────── -->
    <div class="msg-empty-state" *ngIf="!selectedThread">
      <div class="empty-illustration">
        <svg width="72" height="72" viewBox="0 0 24 24" fill="none">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
                stroke="#c7d2fe" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
      <h3>Select a conversation</h3>
      <p>Choose a message from the left panel to get started</p>
    </div>

    <!-- ── Thread view ─────────────────────── -->
    <ng-container *ngIf="selectedThread">

      <!-- Thread header -->
      <header class="msg-thread-header">
        <div class="participants-stack">
          <div class="p-avatar"
               *ngFor="let pid of visibleParticipants"
               [style.background]="colorById(pid)"
               [attr.aria-label]="nameById(pid)">
            {{ initialsById(pid) }}
          </div>
          <div class="p-avatar p-avatar--more" *ngIf="extraParticipants > 0">
            +{{ extraParticipants }}
          </div>
        </div>
        <div class="thread-header-text">
          <h3 class="thread-header-name">{{ currentThreadDisplayName }}</h3>
          <span class="thread-header-subject">{{ selectedThread.subject }}</span>
        </div>
        <button mat-icon-button class="thread-info-btn" matTooltip="Conversation info" aria-label="Info">
          <mat-icon>info_outline</mat-icon>
        </button>
      </header>

      <!-- Admin access banner -->
      <div class="admin-access-banner" *ngIf="isAdminAccessingThread" role="alert">
        <mat-icon class="banner-icon">security</mat-icon>
        <span>You are viewing this conversation as Administrator. This access is logged.</span>
      </div>

      <!-- Messages area -->
      <div class="messages-area" #messagesArea>

        <!-- Loading -->
        <div class="msgs-loading" *ngIf="loadingMessages">
          <div class="msg-skel msg-skel--in"  *ngFor="let i of [1,2,3]"></div>
        </div>

        <!-- Messages -->
        <div class="msgs-inner" *ngIf="!loadingMessages">

          <!-- Empty thread -->
          <div class="msgs-empty" *ngIf="messages.length === 0">
            <p>No messages yet — say something! 👋</p>
          </div>

          <ng-container *ngFor="let msg of messages; let i = index">

            <!-- Time divider -->
            <div class="time-divider" *ngIf="showTimeDivider(i)" aria-hidden="true">
              <span>{{ msg.createdAt | date:'EEE, MMM d · h:mm a' }}</span>
            </div>

            <!-- ── Incoming ── -->
            <div *ngIf="msg.senderId !== currentUserId"
                 class="msg-row msg-row--in msg-bubble"
                 [attr.data-msg-id]="msg.id">
              <div class="msg-avatar" [style.background]="colorById(msg.senderId)" aria-hidden="true">
                {{ initialsById(msg.senderId) }}
              </div>
              <div class="msg-content">
                <div class="msg-sender">
                  <span class="sender-name">{{ nameById(msg.senderId) }}</span>
                  <span class="sender-role-pill">{{ msg.senderRole }}</span>
                </div>
                <div class="bubble bubble--in"
                     (mouseenter)="hoveredId = msg.id!"
                     (mouseleave)="hoveredId = null">
                  <span class="bubble-text">{{ msg.body | mask }}</span>
                  <button class="msg-delete-btn"
                          *ngIf="isAdmin && hoveredId === msg.id"
                          (click)="deleteMessage(msg)"
                          matTooltip="Delete message"
                          aria-label="Delete message">
                    <mat-icon>delete</mat-icon>
                  </button>
                </div>
                <div class="msg-time">{{ msg.createdAt | date:'h:mm a' }}</div>
              </div>
            </div>

            <!-- ── Outgoing ── -->
            <div *ngIf="msg.senderId === currentUserId"
                 class="msg-row msg-row--out msg-bubble"
                 [attr.data-msg-id]="msg.id">
              <div class="msg-content msg-content--out">
                <div class="bubble bubble--out"
                     (mouseenter)="hoveredId = msg.id!"
                     (mouseleave)="hoveredId = null">
                  <button class="msg-delete-btn msg-delete-btn--out"
                          *ngIf="isAdmin && hoveredId === msg.id"
                          (click)="deleteMessage(msg)"
                          matTooltip="Delete message"
                          aria-label="Delete message">
                    <mat-icon>delete</mat-icon>
                  </button>
                  <span class="bubble-text">{{ msg.body | mask }}</span>
                </div>
                <div class="msg-time msg-time--out">
                  <span class="read-receipt" *ngIf="isLastOutgoing(i) && getReadTime(msg)">
                    ✓✓ Read {{ getReadTime(msg) }}
                  </span>
                  <span>{{ msg.createdAt | date:'h:mm a' }}</span>
                </div>
              </div>
            </div>

          </ng-container>
        </div>
      </div><!-- /messages-area -->

      <!-- ── Compose ─────────────────────── -->
      <div class="compose-area">

        <!-- Template picker (floats above compose) -->
        <div class="template-picker" *ngIf="templatePickerOpen" role="dialog" aria-label="Templates">
          <div class="tpl-header">
            <span class="tpl-title">Message Templates</span>
            <button class="tpl-close" (click)="templatePickerOpen = false" aria-label="Close templates">
              <mat-icon>close</mat-icon>
            </button>
          </div>
          <div class="tpl-search">
            <mat-icon class="tpl-search-icon">search</mat-icon>
            <input [(ngModel)]="templateSearch" placeholder="Search templates…" aria-label="Search templates">
          </div>
          <div class="tpl-list">
            <button class="tpl-item" *ngFor="let tmpl of filteredTemplates"
                    (click)="insertTemplate(tmpl)">
              <span class="tpl-name">{{ tmpl.name }}</span>
              <span class="tpl-preview">{{ tmpl.body | slice:0:60 }}{{ tmpl.body.length > 60 ? '…' : '' }}</span>
            </button>
            <div class="tpl-empty" *ngIf="filteredTemplates.length === 0">
              <mat-icon>content_paste_off</mat-icon>
              <span>No templates found</span>
            </div>
          </div>
        </div>

        <div class="compose-inner">
          <textarea #composeRef
                    class="compose-input"
                    [(ngModel)]="composeText"
                    placeholder="Type a message… (Shift+Enter for new line)"
                    (keydown)="onComposeKeydown($event)"
                    (input)="autoExpand($event)"
                    rows="1"
                    aria-label="Message input"
                    maxlength="2000">
          </textarea>
          <div class="compose-actions">
            <button class="compose-action-btn"
                    (click)="toggleTemplatePicker()"
                    [class.compose-action-btn--active]="templatePickerOpen"
                    matTooltip="Insert template"
                    aria-label="Insert template">
              <mat-icon>content_paste</mat-icon>
            </button>
            <button class="send-btn"
                    (click)="sendMessage()"
                    [disabled]="!canSend || sending"
                    matTooltip="Send (Enter)"
                    aria-label="Send message">
              <mat-icon>send</mat-icon>
            </button>
          </div>
        </div>
      </div><!-- /compose-area -->

    </ng-container><!-- /selectedThread -->

  </main>
</div>

<!-- ══════════════════════════════════════════
     MODALS
══════════════════════════════════════════════ -->

<!-- New Thread Modal -->
<app-modal
  [open]="newThreadModalOpen"
  title="New Conversation"
  size="sm"
  confirmLabel="Start Conversation"
  [loading]="newThreadLoading"
  [confirmDisabled]="!newThreadSubject.trim() || selectedRecipientId === null"
  (confirmed)="submitNewThread()"
  (cancelled)="newThreadModalOpen = false">
  <div class="modal-form">
    <label class="form-label">To</label>
    <select class="form-select" [(ngModel)]="selectedRecipientId">
      <option [ngValue]="null" disabled>Select recipient…</option>
      <option *ngFor="let r of availableRecipients" [ngValue]="r.id">
        {{ r.firstName }} {{ r.lastName }}
      </option>
    </select>
    <label class="form-label mt">Subject</label>
    <input class="form-input" [(ngModel)]="newThreadSubject"
           placeholder="What is this about?" maxlength="120">
    <p class="form-hint">Start a direct conversation with a resident or staff member.</p>
  </div>
</app-modal>

<!-- Post Announcement Modal (admin only) -->
<app-modal
  *ngIf="isAdmin"
  [open]="announcementModalOpen"
  title="Post Announcement"
  size="md"
  confirmLabel="Post Announcement"
  [loading]="announcementLoading"
  [confirmDisabled]="!announcementSubject.trim() || !announcementBody.trim()"
  (confirmed)="submitAnnouncement()"
  (cancelled)="closeAnnouncementModal()">
  <div class="modal-form">
    <label class="form-label">Subject</label>
    <input class="form-input" [(ngModel)]="announcementSubject"
           placeholder="Announcement subject" maxlength="120">

    <label class="form-label mt">Message</label>
    <textarea class="form-textarea" [(ngModel)]="announcementBody"
              placeholder="Write your announcement to all residents and staff…"
              rows="5" maxlength="500">
    </textarea>
    <div class="char-counter" [class.char-counter--warn]="announcementBody.length > 450">
      {{ announcementBody.length }} / 500
    </div>

    <div class="ann-preview" *ngIf="announcementBody.trim().length > 0">
      <div class="ann-preview-label">
        <mat-icon class="preview-icon">visibility</mat-icon>
        Preview after masking
      </div>
      <div class="ann-preview-body">{{ announcementBody | mask }}</div>
    </div>
  </div>
</app-modal>
  `,
  styles: [`
    /* ─── Shell ──────────────────────────────────── */
    :host {
      display: block;
      height: calc(100vh - var(--hp-topbar-h));
      overflow: hidden;
    }

    .msg-shell {
      display: flex;
      height: 100%;
    }

    /* ─── Left Panel ─────────────────────────────── */
    .msg-panel-left {
      width: 300px;
      min-width: 300px;
      background: #fff;
      border-right: 1px solid var(--hp-border);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    /* Search */
    .panel-search {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.875rem 1rem;
      border-bottom: 1px solid var(--hp-border);
      flex-shrink: 0;
    }
    .search-icon { font-size: 1.125rem; width: 1.125rem; height: 1.125rem; color: var(--hp-text-muted); }
    .search-input {
      flex: 1;
      border: none;
      outline: none;
      font-size: 0.875rem;
      color: var(--hp-text);
      background: transparent;
      font-family: inherit;
    }
    .search-input::placeholder { color: var(--hp-text-muted); }

    /* Admin note */
    .admin-note-banner {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 1rem;
      background: #fef3c7;
      border-bottom: 1px solid #fde68a;
      font-size: 0.75rem;
      color: #92400e;
      flex-shrink: 0;
    }
    .admin-note-icon { font-size: 0.875rem; width: 0.875rem; height: 0.875rem; }

    /* Tabs */
    .panel-tabs {
      display: flex;
      padding: 0.625rem 0.75rem 0;
      gap: 0.375rem;
      flex-shrink: 0;
      border-bottom: 1px solid var(--hp-border);
      padding-bottom: 0;
    }
    .tab-btn {
      display: flex;
      align-items: center;
      gap: 0.375rem;
      padding: 0.5rem 0.875rem;
      border: none;
      border-radius: 20px 20px 0 0;
      font-size: 0.8125rem;
      font-weight: 500;
      color: var(--hp-text-muted);
      background: transparent;
      cursor: pointer;
      transition: color 150ms, background 150ms;
    }
    .tab-btn:hover { color: var(--hp-navy); background: var(--hp-bg); }
    .tab-btn--active {
      color: var(--hp-teal-dark);
      font-weight: 700;
      background: #f0fdfa;
      border-bottom: 2px solid var(--hp-teal);
    }
    .tab-count {
      display: inline-flex; align-items: center; justify-content: center;
      min-width: 18px; padding: 0 4px; height: 18px;
      background: #ef4444; color: #fff;
      border-radius: 9999px; font-size: 0.6875rem; font-weight: 700;
    }

    /* Thread list */
    .thread-list {
      flex: 1;
      overflow-y: auto;
      padding: 0.25rem 0;
    }

    /* Thread skeleton */
    @keyframes shimmer {
      0%   { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
    .thread-skeleton {
      height: 72px;
      margin: 0.25rem 0.75rem;
      border-radius: 8px;
      background: linear-gradient(90deg, #f1f5f9 25%, #e9edf2 50%, #f1f5f9 75%);
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite;
    }

    /* Thread empty */
    .thread-empty {
      display: flex; flex-direction: column; align-items: center;
      padding: 3rem 1rem; color: var(--hp-text-muted); text-align: center;
    }
    .thread-empty mat-icon { font-size: 2.5rem; width: 2.5rem; height: 2.5rem; opacity: 0.35; }
    .thread-empty p { margin: 0.75rem 0 0; font-size: 0.875rem; }

    /* Thread item */
    .thread-item {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.75rem 1rem;
      cursor: pointer;
      transition: background 120ms;
      position: relative;
      border-radius: 0;
    }
    .thread-item:hover { background: #f8fafc; }
    .thread-item--active { background: #f0fdfa; }
    .thread-item--unread { background: #fff; }
    .thread-item--active:hover { background: #e6faf7; }

    /* Unread dot */
    .unread-dot {
      position: absolute; left: 4px; top: 50%; transform: translateY(-50%);
      width: 6px; height: 6px; border-radius: 50%;
      background: var(--hp-teal-dark);
    }

    /* Thread avatar */
    .thread-avatar {
      width: 40px; height: 40px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      color: #fff; font-size: 0.875rem; font-weight: 700;
      text-transform: uppercase; flex-shrink: 0;
    }
    .thread-avatar--announce {
      background: linear-gradient(135deg, #1e3a5f, #2563eb);
    }
    .thread-avatar--announce mat-icon {
      font-size: 1.125rem; width: 1.125rem; height: 1.125rem; color: #fff;
    }

    /* Thread info */
    .thread-info { flex: 1; min-width: 0; }
    .thread-info-top {
      display: flex; align-items: center; justify-content: space-between; gap: 0.5rem;
    }
    .thread-name {
      font-size: 0.875rem; color: var(--hp-text);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .thread-name--bold { font-weight: 700; }
    .thread-time { font-size: 0.6875rem; color: var(--hp-text-muted); white-space: nowrap; flex-shrink: 0; }
    .thread-info-bottom {
      display: flex; align-items: center; justify-content: space-between;
      margin-top: 0.125rem;
    }
    .thread-subject {
      font-size: 0.75rem; color: var(--hp-text-muted);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1;
    }

    /* Unread badge */
    .unread-badge {
      display: inline-flex; align-items: center; justify-content: center;
      min-width: 20px; height: 20px; padding: 0 5px;
      background: var(--hp-teal-dark); color: #fff;
      border-radius: 9999px; font-size: 0.6875rem; font-weight: 700; flex-shrink: 0;
    }

    /* Panel actions */
    .panel-actions {
      padding: 0.75rem;
      border-top: 1px solid var(--hp-border);
      display: flex; flex-direction: column; gap: 0.5rem;
      flex-shrink: 0;
    }
    .btn-new-msg {
      display: flex; align-items: center; justify-content: center; gap: 0.5rem;
      width: 100%; padding: 0.625rem 1rem;
      border: 1.5px solid var(--hp-teal-dark);
      border-radius: 8px; background: transparent;
      color: var(--hp-teal-dark); font-size: 0.875rem; font-weight: 600;
      cursor: pointer; transition: background 150ms, color 150ms;
    }
    .btn-new-msg:hover { background: var(--hp-teal-dark); color: #fff; }
    .btn-new-msg mat-icon { font-size: 1rem; width: 1rem; height: 1rem; }

    .btn-announce {
      display: flex; align-items: center; justify-content: center; gap: 0.5rem;
      width: 100%; padding: 0.5rem 1rem;
      border: 1.5px dashed #fbbf24;
      border-radius: 8px; background: #fef9c3;
      color: #92400e; font-size: 0.8125rem; font-weight: 600;
      cursor: pointer; transition: background 150ms;
    }
    .btn-announce:hover { background: #fef3c7; }
    .btn-announce mat-icon { font-size: 1rem; width: 1rem; height: 1rem; }

    /* ─── Right Panel ────────────────────────────── */
    .msg-panel-right {
      flex: 1;
      display: flex;
      flex-direction: column;
      background: #f4f6f9;
      min-width: 0;
      overflow: hidden;
    }

    /* Empty state */
    .msg-empty-state {
      flex: 1; display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      color: var(--hp-text-muted); text-align: center;
      padding: 2rem;
    }
    .empty-illustration { margin-bottom: 1.25rem; }
    .msg-empty-state h3 { color: #374151; margin: 0 0 0.5rem; font-size: 1.125rem; }
    .msg-empty-state p  { margin: 0; font-size: 0.875rem; }

    /* Thread header */
    .msg-thread-header {
      display: flex; align-items: center; gap: 1rem;
      padding: 0.875rem 1.25rem;
      background: #fff;
      border-bottom: 1px solid var(--hp-border);
      box-shadow: 0 1px 4px rgba(0,0,0,0.06);
      flex-shrink: 0;
    }
    .participants-stack { display: flex; }
    .p-avatar {
      width: 36px; height: 36px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      color: #fff; font-size: 0.8125rem; font-weight: 700;
      text-transform: uppercase;
      border: 2px solid #fff;
      margin-left: -8px;
    }
    .p-avatar:first-child { margin-left: 0; }
    .p-avatar--more {
      background: #e5e7eb; color: #6b7280;
      font-size: 0.6875rem;
    }
    .thread-header-text { flex: 1; min-width: 0; }
    .thread-header-name {
      font-size: 1rem; font-weight: 700; color: var(--hp-navy);
      margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .thread-header-subject {
      font-size: 0.75rem; color: var(--hp-text-muted); display: block;
    }
    .thread-info-btn { color: var(--hp-text-muted) !important; }

    /* Admin access banner */
    .admin-access-banner {
      display: flex; align-items: center; gap: 0.625rem;
      padding: 0.625rem 1.25rem;
      background: linear-gradient(90deg, #fef3c7, #fef9c3);
      border-bottom: 1px solid #fde68a;
      font-size: 0.8125rem; color: #92400e;
      flex-shrink: 0;
    }
    .banner-icon { font-size: 1rem; width: 1rem; height: 1rem; }

    /* Messages area */
    .messages-area {
      flex: 1; overflow-y: auto; padding: 1.25rem 1.5rem;
      display: flex; flex-direction: column;
    }
    .msgs-inner { display: flex; flex-direction: column; gap: 0.125rem; }

    /* Loading skeletons */
    .msgs-loading { display: flex; flex-direction: column; gap: 0.75rem; padding: 0.5rem 0; }
    .msg-skel {
      height: 48px; border-radius: 12px;
      background: linear-gradient(90deg, #e9ecef 25%, #dde1e7 50%, #e9ecef 75%);
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite;
    }
    .msg-skel--in { width: 55%; align-self: flex-start; }

    /* Empty messages */
    .msgs-empty {
      display: flex; align-items: center; justify-content: center;
      padding: 3rem; color: var(--hp-text-muted); font-size: 0.875rem;
      font-style: italic;
    }

    /* Time divider */
    .time-divider {
      display: flex; align-items: center; gap: 0.75rem;
      margin: 0.875rem 0;
      &::before, &::after {
        content: ''; flex: 1; height: 1px; background: var(--hp-border);
      }
      span {
        font-size: 0.6875rem; color: var(--hp-text-muted);
        white-space: nowrap; font-weight: 500;
        background: #f4f6f9; padding: 0 0.375rem;
      }
    }

    /* Message rows */
    .msg-row {
      display: flex; align-items: flex-end; gap: 0.625rem;
      margin-bottom: 0.25rem;
    }
    .msg-row--out { flex-direction: row-reverse; }

    .msg-avatar {
      width: 32px; height: 32px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      color: #fff; font-size: 0.75rem; font-weight: 700;
      text-transform: uppercase; flex-shrink: 0; align-self: flex-end;
    }

    .msg-content { display: flex; flex-direction: column; max-width: 68%; }
    .msg-content--out { align-items: flex-end; }

    .msg-sender {
      display: flex; align-items: center; gap: 0.375rem;
      margin-bottom: 0.25rem;
    }
    .sender-name { font-size: 0.75rem; font-weight: 600; color: var(--hp-text-muted); }
    .sender-role-pill {
      padding: 1px 6px; background: #e0e7ff; color: #3730a3;
      border-radius: 9999px; font-size: 0.625rem; font-weight: 700;
      text-transform: capitalize;
    }

    /* Bubble */
    .bubble {
      position: relative; padding: 0.625rem 0.875rem;
      font-size: 0.9375rem; line-height: 1.5; word-break: break-word;
    }
    .bubble--in {
      background: #fff; color: #1e293b;
      border-radius: 18px 18px 18px 4px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.08);
    }
    .bubble--out {
      background: var(--hp-navy); color: #fff;
      border-radius: 18px 18px 4px 18px;
    }
    .bubble-text { display: block; }

    /* Admin delete button */
    .msg-delete-btn {
      position: absolute; top: -10px; right: -10px;
      display: flex; align-items: center; justify-content: center;
      width: 28px; height: 28px;
      background: #ef4444; color: #fff;
      border: 2px solid #fff; border-radius: 50%;
      cursor: pointer; transition: background 150ms;
      box-shadow: 0 2px 6px rgba(0,0,0,0.2);
    }
    .msg-delete-btn:hover { background: #dc2626; }
    .msg-delete-btn mat-icon { font-size: 0.875rem; width: 0.875rem; height: 0.875rem; }
    .msg-delete-btn--out { right: auto; left: -10px; }

    /* Timestamps */
    .msg-time {
      font-size: 0.6875rem; color: var(--hp-text-muted);
      margin-top: 0.25rem; padding: 0 0.25rem;
    }
    .msg-time--out {
      display: flex; flex-direction: column; align-items: flex-end; gap: 0.125rem;
    }
    .read-receipt {
      display: block; font-size: 0.6875rem;
      color: var(--hp-teal-dark); font-weight: 500;
    }

    /* ─── Compose ─────────────────────────────── */
    .compose-area {
      background: #fff;
      border-top: 1px solid var(--hp-border);
      padding: 0.875rem 1.25rem;
      flex-shrink: 0;
      position: relative;
    }

    /* Template picker */
    .template-picker {
      position: absolute; bottom: calc(100% + 4px); left: 1.25rem; right: 1.25rem;
      background: #fff; border: 1px solid var(--hp-border);
      border-radius: 12px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.12);
      overflow: hidden; z-index: 100;
      max-height: 280px; display: flex; flex-direction: column;
    }
    .tpl-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 0.625rem 0.875rem;
      border-bottom: 1px solid var(--hp-border);
      flex-shrink: 0;
    }
    .tpl-title { font-size: 0.8125rem; font-weight: 700; color: var(--hp-navy); }
    .tpl-close {
      display: flex; align-items: center; justify-content: center;
      width: 24px; height: 24px; border: none; background: none;
      cursor: pointer; color: var(--hp-text-muted); border-radius: 4px;
      transition: background 150ms;
    }
    .tpl-close:hover { background: var(--hp-bg); }
    .tpl-close mat-icon { font-size: 1rem; width: 1rem; height: 1rem; }

    .tpl-search {
      display: flex; align-items: center; gap: 0.5rem;
      padding: 0.5rem 0.875rem;
      border-bottom: 1px solid var(--hp-border);
      flex-shrink: 0;
    }
    .tpl-search-icon { font-size: 0.875rem; width: 0.875rem; height: 0.875rem; color: var(--hp-text-muted); }
    .tpl-search input {
      flex: 1; border: none; outline: none; font-size: 0.8125rem;
      font-family: inherit; background: transparent; color: var(--hp-text);
    }

    .tpl-list { overflow-y: auto; }
    .tpl-item {
      display: flex; flex-direction: column; gap: 0.125rem;
      padding: 0.625rem 0.875rem; width: 100%;
      border: none; text-align: left; cursor: pointer;
      background: transparent; transition: background 120ms;
      border-bottom: 1px solid #f3f4f6;
    }
    .tpl-item:last-child { border-bottom: none; }
    .tpl-item:hover { background: #f8fafc; }
    .tpl-name { font-size: 0.8125rem; font-weight: 600; color: var(--hp-navy); }
    .tpl-preview { font-size: 0.75rem; color: var(--hp-text-muted); }

    .tpl-empty {
      display: flex; align-items: center; justify-content: center; gap: 0.5rem;
      padding: 1.5rem; color: var(--hp-text-muted); font-size: 0.8125rem;
    }
    .tpl-empty mat-icon { font-size: 1rem; width: 1rem; height: 1rem; opacity: 0.5; }

    /* Compose inner */
    .compose-inner {
      display: flex; align-items: flex-end; gap: 0.75rem;
    }
    .compose-input {
      flex: 1; resize: none; overflow: hidden;
      border: 1.5px solid var(--hp-border); border-radius: 12px;
      padding: 0.625rem 0.875rem;
      font-size: 0.9375rem; font-family: inherit; color: var(--hp-text);
      background: #f8fafc; outline: none;
      transition: border-color 150ms;
      min-height: 44px; max-height: 160px; line-height: 1.5;
    }
    .compose-input:focus { border-color: var(--hp-teal-dark); background: #fff; }
    .compose-input::placeholder { color: var(--hp-text-muted); }

    .compose-actions { display: flex; align-items: center; gap: 0.375rem; flex-shrink: 0; }
    .compose-action-btn {
      display: flex; align-items: center; justify-content: center;
      width: 36px; height: 36px; border-radius: 50%;
      border: 1.5px solid var(--hp-border); background: transparent;
      color: var(--hp-text-muted); cursor: pointer;
      transition: background 150ms, color 150ms, border-color 150ms;
    }
    .compose-action-btn:hover { border-color: var(--hp-teal); color: var(--hp-teal-dark); }
    .compose-action-btn--active {
      background: #f0fdfa; border-color: var(--hp-teal-dark); color: var(--hp-teal-dark);
    }
    .compose-action-btn mat-icon { font-size: 1rem; width: 1rem; height: 1rem; }

    .send-btn {
      display: flex; align-items: center; justify-content: center;
      width: 40px; height: 40px; border-radius: 50%;
      border: none; background: var(--hp-teal-dark); color: #fff;
      cursor: pointer; transition: background 150ms, transform 100ms;
      box-shadow: 0 2px 8px rgba(13,148,136,0.35);
    }
    .send-btn:hover:not(:disabled) { background: var(--hp-teal); transform: scale(1.05); }
    .send-btn:disabled { background: #e5e7eb; color: #9ca3af; box-shadow: none; cursor: not-allowed; }
    .send-btn mat-icon { font-size: 1.125rem; width: 1.125rem; height: 1.125rem; }

    /* ─── Modals ─────────────────────────────── */
    .modal-form { display: flex; flex-direction: column; }
    .form-label {
      font-size: 0.8125rem; font-weight: 600; color: var(--hp-navy);
      margin-bottom: 0.375rem; display: block;
    }
    .form-label.mt { margin-top: 1rem; }
    .form-hint { font-size: 0.75rem; color: var(--hp-text-muted); margin: 0.5rem 0 0; }

    .form-input, .form-select {
      width: 100%; padding: 0.625rem 0.875rem;
      border: 1.5px solid var(--hp-border); border-radius: 8px;
      font-size: 0.875rem; font-family: inherit; color: var(--hp-text);
      background: #fff; outline: none;
      transition: border-color 150ms;
    }
    .form-input:focus, .form-select:focus { border-color: var(--hp-teal-dark); }

    .form-textarea {
      width: 100%; padding: 0.625rem 0.875rem;
      border: 1.5px solid var(--hp-border); border-radius: 8px;
      font-size: 0.875rem; font-family: inherit; color: var(--hp-text);
      background: #fff; outline: none; resize: vertical;
      transition: border-color 150ms; min-height: 100px;
    }
    .form-textarea:focus { border-color: var(--hp-teal-dark); }

    .char-counter {
      text-align: right; font-size: 0.75rem; color: var(--hp-text-muted);
      margin-top: 0.25rem;
    }
    .char-counter--warn { color: #ef4444; font-weight: 600; }

    /* Announcement preview */
    .ann-preview {
      margin-top: 1rem; padding: 0.75rem;
      background: #f0fdfa; border: 1px solid #99f6e4; border-radius: 8px;
    }
    .ann-preview-label {
      display: flex; align-items: center; gap: 0.375rem;
      font-size: 0.75rem; font-weight: 600; color: var(--hp-teal-dark); margin-bottom: 0.5rem;
    }
    .preview-icon { font-size: 0.875rem; width: 0.875rem; height: 0.875rem; }
    .ann-preview-body { font-size: 0.875rem; color: var(--hp-text); white-space: pre-wrap; }
  `],
})
export class MessagingComponent implements OnInit, AfterViewChecked, OnDestroy {

  // ── Tab / filter state ──────────────────────────
  activeTab: 'messages' | 'announcements' = 'messages';
  searchQuery = '';

  // ── Thread data ─────────────────────────────────
  threads:       ThreadView[] = [];
  announcements: ThreadView[] = [];
  loadingThreads = true;

  // ── Selected thread ─────────────────────────────
  selectedThread:  Thread | null = null;
  messages:        Message[] = [];
  loadingMessages  = false;

  // ── Compose ─────────────────────────────────────
  composeText = '';
  sending     = false;

  // ── Templates ───────────────────────────────────
  templatePickerOpen = false;
  templates:    MessageTemplate[] = [];
  templateSearch = '';

  // ── Hover (admin delete) ────────────────────────
  hoveredId: number | null = null;

  // ── New thread modal ────────────────────────────
  newThreadModalOpen    = false;
  newThreadSubject      = '';
  selectedRecipientId:  number | null = null;
  availableRecipients:  Resident[] = [];
  newThreadLoading      = false;

  // ── Announcement modal ──────────────────────────
  announcementModalOpen = false;
  announcementSubject   = '';
  announcementBody      = '';
  announcementLoading   = false;

  // ── Resident cache ──────────────────────────────
  private residentMap = new Map<number, Resident>();

  // ── IntersectionObserver ─────────────────────────
  private observer:    IntersectionObserver | null = null;
  private observedIds: Set<number>                = new Set();

  private subs: Subscription[] = [];

  // ── Constructor ─────────────────────────────────
  constructor(
    private messaging: MessagingService,
    private auth:      AuthService,
    private db:        DbService,
    private toast:     ToastService,
    private cdr:       ChangeDetectorRef,
    private el:        ElementRef,
    private ngZone:    NgZone,
  ) {}

  // ── Computed ─────────────────────────────────────

  get currentUserId(): number {
    const role = this.auth.getCurrentRole();
    return role ? (ROLE_USER_ID[role] ?? 1) : 1;
  }

  get isAdmin(): boolean {
    return this.auth.getCurrentRole() === 'admin';
  }

  get totalUnread(): number {
    return this.threads.reduce((sum, tv) => sum + tv.unreadCount, 0);
  }

  get filteredThreads(): ThreadView[] {
    const q = this.searchQuery.toLowerCase().trim();
    if (!q) return this.threads;
    return this.threads.filter(
      tv =>
        tv.displayName.toLowerCase().includes(q) ||
        tv.thread.subject.toLowerCase().includes(q),
    );
  }

  get filteredAnnouncements(): ThreadView[] {
    const q = this.searchQuery.toLowerCase().trim();
    if (!q) return this.announcements;
    return this.announcements.filter(
      tv =>
        tv.thread.subject.toLowerCase().includes(q) ||
        tv.lastBody.toLowerCase().includes(q),
    );
  }

  get filteredTemplates(): MessageTemplate[] {
    const q = this.templateSearch.toLowerCase().trim();
    if (!q) return this.templates;
    return this.templates.filter(
      t => t.name.toLowerCase().includes(q) || t.body.toLowerCase().includes(q),
    );
  }

  get canSend(): boolean {
    return this.composeText.trim().length > 0 && this.selectedThread !== null;
  }

  get currentThreadDisplayName(): string {
    return this.threads.find(tv => tv.thread.id === this.selectedThread?.id)?.displayName
      ?? this.announcements.find(tv => tv.thread.id === this.selectedThread?.id)?.displayName
      ?? this.selectedThread?.subject
      ?? '';
  }

  get visibleParticipants(): number[] {
    return (this.selectedThread?.participantIds ?? []).slice(0, 3);
  }

  get extraParticipants(): number {
    const len = this.selectedThread?.participantIds.length ?? 0;
    return Math.max(0, len - 3);
  }

  get isAdminAccessingThread(): boolean {
    if (!this.isAdmin || !this.selectedThread) return false;
    return !this.selectedThread.participantIds.includes(this.currentUserId);
  }

  // ── Lifecycle ─────────────────────────────────────

  ngOnInit(): void {
    this.setupObserver();
    this.loadAll();

    // Re-load threads when auth state changes
    this.subs.push(
      this.auth.state$.subscribe(() => this.loadAll()),
    );
  }

  ngAfterViewChecked(): void {
    this.observeNewMessages();
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
    this.subs.forEach(s => s.unsubscribe());
  }

  // ── Data loading ─────────────────────────────────

  private async loadAll(): Promise<void> {
    await Promise.all([
      this.loadResidents(),
      this.loadThreads(),
      this.loadTemplates(),
    ]);
    this.cdr.markForCheck();
  }

  private async loadResidents(): Promise<void> {
    const residents = await this.db.residents.toArray();
    this.residentMap.clear();
    residents.forEach(r => this.residentMap.set(r.id!, r));
    this.availableRecipients = residents.filter(r => r.id !== this.currentUserId);
  }

  private async loadThreads(): Promise<void> {
    this.loadingThreads = true;
    this.cdr.markForCheck();
    try {
      const role     = this.auth.getCurrentRole() ?? undefined;
      const userId   = this.currentUserId;

      // DM threads
      const rawThreads = await this.messaging.getThreads(userId, role);
      const dmThreads  = rawThreads.filter(t => {
        // A thread is DM-type if it has participants OR has only direct messages
        return t.participantIds.length > 0;
      });

      // Announcement threads (participantIds is empty [] for broadcasts)
      const annThreads = rawThreads.filter(t => t.participantIds.length === 0);

      // Also fetch via getAnnouncements for completeness (might overlap with empty-participant logic)
      const annByType = await this.messaging.getAnnouncements();

      // Merge and deduplicate announcements
      const allAnnIds = new Set(annThreads.map(t => t.id!));
      annByType.forEach(t => { if (!allAnnIds.has(t.id!)) { annThreads.push(t); allAnnIds.add(t.id!); } });

      // Load all messages to compute unread counts + previews efficiently
      const allMessages = await this.db.messages.filter(m => !m.deleted).toArray();
      const msgByThread = new Map<number, Message[]>();
      allMessages.forEach(m => {
        const arr = msgByThread.get(m.threadId) ?? [];
        arr.push(m);
        msgByThread.set(m.threadId, arr);
      });

      this.threads       = dmThreads.map(t  => this.buildThreadView(t,  msgByThread, userId));
      this.announcements = annThreads.map(t => this.buildThreadView(t,  msgByThread, userId))
        .sort((a, b) =>
          new Date(b.thread.lastMessageAt).getTime() - new Date(a.thread.lastMessageAt).getTime(),
        );
    } catch (e) {
      this.toast.error('Failed to load conversations');
      console.error(e);
    } finally {
      this.loadingThreads = false;
      this.cdr.markForCheck();
    }
  }

  private buildThreadView(
    thread: Thread,
    msgByThread: Map<number, Message[]>,
    userId: number,
  ): ThreadView {
    const msgs       = msgByThread.get(thread.id!) ?? [];
    const sorted     = [...msgs].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const lastMsg    = sorted[0] ?? null;
    const unreadCount = msgs.filter(
      m => m.senderId !== userId && !m.readBy.some(r => r.userId === userId),
    ).length;

    const displayName = this.buildDisplayName(thread);
    const initials    = this.buildInitials(displayName);
    const avatarColor = this.colorFromSeed(displayName);

    return {
      thread,
      displayName,
      initials,
      avatarColor,
      unreadCount,
      lastBody: lastMsg?.body ?? '',
    };
  }

  private async loadTemplates(): Promise<void> {
    try {
      this.templates = await this.messaging.getTemplates();
    } catch {
      this.templates = [];
    }
  }

  // ── Thread selection ──────────────────────────────

  async selectThread(thread: Thread): Promise<void> {
    if (this.selectedThread?.id === thread.id) return;

    this.selectedThread = thread;
    this.observedIds.clear();   // reset so new messages get observed
    this.messages       = [];
    this.composeText    = '';
    this.templatePickerOpen = false;
    this.loadingMessages = true;
    this.cdr.markForCheck();

    try {
      this.messages = await this.messaging.getMessages(
        thread.id!,
        this.currentUserId,
        this.auth.getCurrentRole() ?? undefined,
      );
    } catch (e) {
      this.toast.error('Failed to load messages');
      console.error(e);
    } finally {
      this.loadingMessages = false;
      this.cdr.markForCheck();
      this.scrollToBottom();
    }
  }

  switchTab(tab: 'messages' | 'announcements'): void {
    this.activeTab = tab;
    this.selectedThread = null;
    this.messages = [];
  }

  // ── Send message ──────────────────────────────────

  async sendMessage(): Promise<void> {
    if (!this.canSend || this.sending) return;
    this.sending = true;
    const text = this.composeText.trim();
    this.composeText = '';
    this.cdr.markForCheck();

    try {
      const msg = await this.messaging.sendMessage({
        threadId:   this.selectedThread!.id!,
        senderId:   this.currentUserId,
        senderRole: this.auth.getCurrentRole() ?? 'admin',
        rawBody:    text,
        type:       'direct',
      });
      this.messages = [...this.messages, msg];
      // Update thread preview in left panel
      const tv = this.threads.find(t => t.thread.id === this.selectedThread!.id);
      if (tv) { tv.lastBody = msg.body; tv.thread.lastMessageAt = msg.createdAt; }
      this.cdr.markForCheck();
      this.scrollToBottom();
    } catch (e) {
      this.toast.error('Failed to send message. Please try again.');
      this.composeText = text; // restore
      console.error(e);
    } finally {
      this.sending = false;
      this.cdr.markForCheck();
    }
  }

  async deleteMessage(msg: Message): Promise<void> {
    if (!this.isAdmin) return;
    try {
      await this.messaging.deleteMessage(msg.id!, this.currentUserId, 'admin');
      this.messages = this.messages.filter(m => m.id !== msg.id);
      this.hoveredId = null;
      this.cdr.markForCheck();
      this.toast.success('Message deleted');
    } catch (e) {
      this.toast.error('Failed to delete message');
      console.error(e);
    }
  }

  // ── New thread ────────────────────────────────────

  openNewThread(): void {
    this.newThreadSubject    = '';
    this.selectedRecipientId = null;
    this.newThreadModalOpen  = true;
  }

  async submitNewThread(): Promise<void> {
    if (!this.newThreadSubject.trim() || this.selectedRecipientId === null) return;
    this.newThreadLoading = true;
    try {
      const participantIds = [this.currentUserId, this.selectedRecipientId];
      const thread = await this.messaging.createThread(participantIds, this.newThreadSubject.trim());
      this.newThreadModalOpen = false;
      await this.loadThreads();
      await this.selectThread(thread);
    } catch (e) {
      this.toast.error('Failed to create conversation');
      console.error(e);
    } finally {
      this.newThreadLoading = false;
      this.cdr.markForCheck();
    }
  }

  // ── Announcement ──────────────────────────────────

  closeAnnouncementModal(): void {
    this.announcementModalOpen = false;
    this.announcementSubject   = '';
    this.announcementBody      = '';
  }

  async submitAnnouncement(): Promise<void> {
    if (!this.announcementSubject.trim() || !this.announcementBody.trim()) return;
    this.announcementLoading = true;
    try {
      const { thread } = await this.messaging.createAnnouncement({
        senderId:   this.currentUserId,
        senderRole: 'admin',
        subject:    this.announcementSubject.trim(),
        rawBody:    this.announcementBody.trim(),
      });
      this.closeAnnouncementModal();
      this.activeTab = 'announcements';
      await this.loadThreads();
      await this.selectThread(thread);
      this.toast.success('Announcement posted successfully');
    } catch (e) {
      this.toast.error('Failed to post announcement');
      console.error(e);
    } finally {
      this.announcementLoading = false;
      this.cdr.markForCheck();
    }
  }

  // ── Templates ─────────────────────────────────────

  toggleTemplatePicker(): void {
    this.templatePickerOpen = !this.templatePickerOpen;
    this.templateSearch     = '';
  }

  insertTemplate(tmpl: MessageTemplate): void {
    this.composeText = tmpl.body;
    this.templatePickerOpen = false;
    this.cdr.markForCheck();
  }

  // ── Compose helpers ───────────────────────────────

  onComposeKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  autoExpand(event: Event): void {
    const ta = event.target as HTMLTextAreaElement;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 160) + 'px';
  }

  // ── Message display helpers ───────────────────────

  showTimeDivider(index: number): boolean {
    if (index === 0) return true;
    const curr = new Date(this.messages[index].createdAt).getTime();
    const prev = new Date(this.messages[index - 1].createdAt).getTime();
    return curr - prev > 5 * 60 * 1000; // > 5 minutes
  }

  isLastOutgoing(index: number): boolean {
    for (let i = this.messages.length - 1; i >= 0; i--) {
      if (this.messages[i].senderId === this.currentUserId) return i === index;
    }
    return false;
  }

  getReadTime(msg: Message): string {
    const entry = msg.readBy.find(r => r.userId !== this.currentUserId);
    if (!entry) return '';
    const d = new Date(entry.readAt);
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  }

  // ── Avatar / name helpers ─────────────────────────

  nameById(id: number): string {
    if (id === ROLE_USER_ID['admin']) return 'Admin';
    const r = this.residentMap.get(id);
    return r ? `${r.firstName} ${r.lastName}` : `User ${id}`;
  }

  initialsById(id: number): string {
    const name = this.nameById(id);
    return this.buildInitials(name);
  }

  colorById(id: number): string {
    return this.colorFromSeed(String(id));
  }

  // ── Private helpers ───────────────────────────────

  private buildDisplayName(thread: Thread): string {
    if (thread.participantIds.length === 0) return thread.subject;
    const others = thread.participantIds.filter(id => id !== this.currentUserId);
    if (others.length === 0) return 'Just you';
    const names = others.slice(0, 2).map(id => {
      if (id === ROLE_USER_ID['admin']) return 'Admin';
      const r = this.residentMap.get(id);
      return r ? `${r.firstName} ${r.lastName}` : `User ${id}`;
    });
    const extra = others.length > 2 ? ` +${others.length - 2}` : '';
    return names.join(', ') + extra;
  }

  private buildInitials(name: string): string {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  }

  private colorFromSeed(seed: string): string {
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) & 0xffffffff;
    return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
  }

  private setupObserver(): void {
    this.ngZone.runOutsideAngular(() => {
      this.observer = new IntersectionObserver(
        (entries) => {
          const toMark = entries
            .filter(e => e.isIntersecting)
            .map(e => Number((e.target as Element).getAttribute('data-msg-id')))
            .filter(id => id > 0);

          if (toMark.length > 0) {
            this.ngZone.run(() => {
              toMark.forEach(id => this.messaging.markRead(id, this.currentUserId));
            });
          }
        },
        { threshold: 0.5 },
      );
    });
  }

  private observeNewMessages(): void {
    if (!this.observer || !this.selectedThread) return;
    const elements = this.el.nativeElement.querySelectorAll('.msg-bubble[data-msg-id]');
    elements.forEach((el: Element) => {
      const id = Number(el.getAttribute('data-msg-id'));
      if (id && !this.observedIds.has(id)) {
        this.observedIds.add(id);
        this.observer!.observe(el);
      }
    });
  }

  private scrollToBottom(): void {
    setTimeout(() => {
      const area = this.el.nativeElement.querySelector('.messages-area');
      if (area) area.scrollTop = area.scrollHeight;
    }, 50);
  }
}
