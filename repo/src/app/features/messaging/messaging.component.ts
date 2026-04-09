import {
  Component, OnInit, AfterViewChecked, OnDestroy,
  ElementRef, NgZone, ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
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
import { LoggerService } from '../../core/services/logger.service';

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
  styleUrls: ['./messaging.component.scss'],
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
    private logger:    LoggerService,
    private cdr:       ChangeDetectorRef,
    private el:        ElementRef,
    private ngZone:    NgZone,
    private route:     ActivatedRoute,
  ) {}

  // ── Computed ─────────────────────────────────────

  get currentUserId(): number {
    return this.auth.getCurrentUserId() ?? 0;
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
    this.loadAll().then(() => this.handleDeepLink());

    // Re-load threads when auth state changes
    this.subs.push(
      this.auth.state$.subscribe(() => this.loadAll()),
    );
  }

  private handleDeepLink(): void {
    const threadId = this.route.snapshot.queryParamMap.get('threadId');
    if (threadId) {
      const id = Number(threadId);
      const dmMatch = this.threads.find(tv => tv.thread.id === id);
      if (dmMatch) {
        this.activeTab = 'messages';
        this.selectThread(dmMatch.thread);
        return;
      }
      const annMatch = this.announcements.find(tv => tv.thread.id === id);
      if (annMatch) {
        this.activeTab = 'announcements';
        this.selectThread(annMatch.thread);
      }
    }
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
      const rawThreads = await this.messaging.getThreads();
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
      this.logger.error('MessagingComponent', 'Operation failed', e);
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
      this.messages = await this.messaging.getMessages(thread.id!);
    } catch (e) {
      this.toast.error('Failed to load messages');
      this.logger.error('MessagingComponent', 'Operation failed', e);
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
      this.logger.error('MessagingComponent', 'Operation failed', e);
    } finally {
      this.sending = false;
      this.cdr.markForCheck();
    }
  }

  async deleteMessage(msg: Message): Promise<void> {
    if (!this.isAdmin) return;
    try {
      await this.messaging.deleteMessage(msg.id!);
      this.messages = this.messages.filter(m => m.id !== msg.id);
      this.hoveredId = null;
      this.cdr.markForCheck();
      this.toast.success('Message deleted');
    } catch (e) {
      this.toast.error('Failed to delete message');
      this.logger.error('MessagingComponent', 'Operation failed', e);
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
      this.logger.error('MessagingComponent', 'Operation failed', e);
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
      this.logger.error('MessagingComponent', 'Operation failed', e);
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
    if (id === 1) return 'Admin';
    if (id === 3) return 'Compliance';
    if (id === 4) return 'Analyst';
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
      if (id === 1) return 'Admin';
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
              toMark.forEach(id => this.messaging.markRead(id));
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
