import {
  Component, OnInit,
  ChangeDetectionStrategy, ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';

import { ModalComponent } from '../../shared/components/modal/modal.component';

import { ImportExportService } from '../../core/services/import-export.service';
import { SearchService } from '../../core/services/search.service';
import { MessagingService } from '../../core/services/messaging.service';
import { AuthService } from '../../core/services/auth.service';
import { ThemeService, ThemeMode, UiDensity } from '../../core/services/theme.service';
import { ContentPolicy, MessageTemplate, SearchDictionaryEntry, ZeroResultsLog } from '../../core/services/db.service';
import { ContentPolicyService } from '../../core/services/content-policy.service';
import { ToastService } from '../../shared/components/toast/toast.service';

type SettingsSection = 'data' | 'dictionary' | 'safety' | 'templates' | 'preferences' | 'security';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatIconModule, MatButtonModule, MatTooltipModule,
    ModalComponent,
  ],
  template: `
    <div class="settings-page">
      <div class="page-header">
        <h1 class="page-title"><mat-icon class="page-icon">settings</mat-icon> Settings</h1>
      </div>

      <div class="settings-layout">
        <!-- ═══ Left Sidebar Nav ══════════════════════ -->
        <nav class="settings-nav">
          <button *ngFor="let s of sections" class="nav-pill"
            [class.nav-pill--active]="activeSection === s.key"
            (click)="activeSection = s.key">
            <mat-icon>{{ s.icon }}</mat-icon>
            <span>{{ s.label }}</span>
          </button>
        </nav>

        <!-- ═══ Content ═══════════════════════════════ -->
        <div class="settings-content">

          <!-- ════════════════════════════════════════════ -->
          <!-- DATA MANAGEMENT                              -->
          <!-- ════════════════════════════════════════════ -->
          <div *ngIf="activeSection === 'data'" class="section">
            <h2 class="section-title">Data Management</h2>
            <div class="action-cards">
              <div class="action-card">
                <div class="action-card__icon-wrap action-card__icon-wrap--teal">
                  <mat-icon>cloud_download</mat-icon>
                </div>
                <h3 class="action-card__title">Export Data</h3>
                <p class="action-card__desc">Download an encrypted backup of all data as a .hpd file.</p>
                <button class="btn-teal" (click)="exportModalOpen = true">
                  <mat-icon>download</mat-icon> Export
                </button>
              </div>
              <div class="action-card">
                <div class="action-card__icon-wrap action-card__icon-wrap--navy">
                  <mat-icon>cloud_upload</mat-icon>
                </div>
                <h3 class="action-card__title">Import Data</h3>
                <p class="action-card__desc">Restore data from an encrypted .hpd backup file.</p>
                <button class="btn-outline" (click)="importModalOpen = true">
                  <mat-icon>upload</mat-icon> Import
                </button>
              </div>
            </div>
          </div>

          <!-- ════════════════════════════════════════════ -->
          <!-- SEARCH DICTIONARY                            -->
          <!-- ════════════════════════════════════════════ -->
          <div *ngIf="activeSection === 'dictionary'" class="section">
            <h2 class="section-title">Search Dictionary</h2>

            <div class="dict-table-wrap" *ngIf="dictEntries.length > 0">
              <table class="mini-table">
                <thead><tr><th>Term</th><th>Synonyms</th><th>Corrections</th><th></th></tr></thead>
                <tbody>
                  <tr *ngFor="let d of dictEntries">
                    <td class="cell-bold">{{ d.term }}</td>
                    <td>{{ d.synonyms.join(', ') || '—' }}</td>
                    <td>{{ d.corrections.join(', ') || '—' }}</td>
                    <td>
                      <button class="icon-btn" matTooltip="Edit" (click)="editDictEntry(d)">
                        <mat-icon>edit</mat-icon>
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div class="empty-msg" *ngIf="dictEntries.length === 0">No dictionary entries yet.</div>

            <h3 class="sub-title">Zero Results Report</h3>
            <div class="zero-wrap" *ngIf="zeroResults.length > 0">
              <div class="zero-row" *ngFor="let z of zeroResults">
                <span class="zero-query">{{ z.query }}</span>
                <span class="zero-time">{{ z.timestamp | date:'shortDate' }}</span>
                <button class="icon-btn" matTooltip="Add to Dictionary" (click)="addZeroToDictionary(z.query)">
                  <mat-icon>library_add</mat-icon>
                </button>
              </div>
            </div>
            <div class="empty-msg" *ngIf="zeroResults.length === 0">No zero-result queries.</div>
          </div>

          <!-- ════════════════════════════════════════════ -->
          <!-- CONTENT SAFETY                               -->
          <!-- ════════════════════════════════════════════ -->
          <div *ngIf="activeSection === 'safety'" class="section">
            <h2 class="section-title">Content Safety Policies</h2>

            <div class="policy-list" *ngIf="policies.length > 0">
              <div class="policy-card" *ngFor="let p of policies">
                <div class="policy-card__left">
                  <span class="policy-pattern">{{ p.pattern }}</span>
                  <span class="policy-meta">{{ p.type }} · {{ p.action }} · {{ p.severity }}</span>
                </div>
                <label class="toggle-switch">
                  <input type="checkbox" [checked]="p.enabled" (change)="togglePolicy(p)" />
                  <span class="toggle-slider"></span>
                </label>
              </div>
            </div>
            <div class="empty-msg" *ngIf="policies.length === 0">No content policies configured.</div>

            <h3 class="sub-title">Add Policy</h3>
            <div class="add-form">
              <input type="text" class="form-input" placeholder="Pattern…" [(ngModel)]="newPolicyPattern" />
              <select class="form-input form-input--sm" [(ngModel)]="newPolicyType">
                <option value="keyword">Keyword</option>
                <option value="regex">Regex</option>
                <option value="phrase">Phrase</option>
              </select>
              <select class="form-input form-input--sm" [(ngModel)]="newPolicyAction">
                <option value="flag">Flag</option>
                <option value="block">Block</option>
                <option value="redact">Redact</option>
              </select>
              <select class="form-input form-input--sm" [(ngModel)]="newPolicySeverity">
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
              <button class="btn-teal btn-teal--sm" (click)="addPolicy()" [disabled]="!newPolicyPattern.trim()">Add</button>
            </div>
          </div>

          <!-- ════════════════════════════════════════════ -->
          <!-- TEMPLATES                                    -->
          <!-- ════════════════════════════════════════════ -->
          <div *ngIf="activeSection === 'templates'" class="section">
            <h2 class="section-title">Message Templates</h2>

            <div class="template-grid" *ngIf="templates.length > 0">
              <div class="template-card" *ngFor="let t of templates">
                <h4 class="template-card__name">{{ t.name }}</h4>
                <p class="template-card__body">{{ t.body | slice:0:100 }}{{ t.body.length > 100 ? '…' : '' }}</p>
                <div class="template-card__footer">
                  <span class="template-card__cat">{{ t.category }}</span>
                  <button class="icon-btn" matTooltip="Delete" (click)="deleteTemplate(t)">
                    <mat-icon>delete</mat-icon>
                  </button>
                </div>
              </div>
            </div>
            <div class="empty-msg" *ngIf="templates.length === 0">No templates yet.</div>

            <h3 class="sub-title">Create Template</h3>
            <div class="create-form">
              <input type="text" class="form-input" placeholder="Template name" [(ngModel)]="newTplName" />
              <input type="text" class="form-input" placeholder="Category" [(ngModel)]="newTplCategory" />
              <textarea class="form-textarea" [placeholder]="'Body (use {' + '{residentName}' + '} for merge fields)'" [(ngModel)]="newTplBody" rows="4"></textarea>
              <button class="btn-teal" (click)="createTemplate()" [disabled]="!newTplName.trim() || !newTplBody.trim()">
                Create Template
              </button>
            </div>
          </div>

          <!-- ════════════════════════════════════════════ -->
          <!-- PREFERENCES                                  -->
          <!-- ════════════════════════════════════════════ -->
          <div *ngIf="activeSection === 'preferences'" class="section">
            <h2 class="section-title">Preferences</h2>

            <h3 class="sub-title">Theme</h3>
            <div class="option-cards">
              <div class="option-card" [class.option-card--active]="currentTheme === 'light'" (click)="setTheme('light')">
                <div class="option-preview option-preview--light">
                  <div class="preview-bar"></div>
                  <div class="preview-sidebar"></div>
                  <div class="preview-content"></div>
                </div>
                <span class="option-label">Light</span>
              </div>
              <div class="option-card" [class.option-card--active]="currentTheme === 'dark'" (click)="setTheme('dark')">
                <div class="option-preview option-preview--dark">
                  <div class="preview-bar"></div>
                  <div class="preview-sidebar"></div>
                  <div class="preview-content"></div>
                </div>
                <span class="option-label">Dark</span>
              </div>
            </div>

            <h3 class="sub-title">Density</h3>
            <div class="option-cards option-cards--three">
              <div class="option-card option-card--sm" [class.option-card--active]="currentDensity === 'compact'" (click)="setDensity('compact')">
                <mat-icon>density_small</mat-icon>
                <span class="option-label">Compact</span>
              </div>
              <div class="option-card option-card--sm" [class.option-card--active]="currentDensity === 'comfortable'" (click)="setDensity('comfortable')">
                <mat-icon>density_medium</mat-icon>
                <span class="option-label">Comfortable</span>
              </div>
              <div class="option-card option-card--sm" [class.option-card--active]="currentDensity === 'spacious'" (click)="setDensity('spacious')">
                <mat-icon>density_large</mat-icon>
                <span class="option-label">Spacious</span>
              </div>
            </div>
          </div>

          <!-- ════════════════════════════════════════════ -->
          <!-- SECURITY                                     -->
          <!-- ════════════════════════════════════════════ -->
          <div *ngIf="activeSection === 'security'" class="section">
            <h2 class="section-title">Security</h2>

            <div class="password-card">
              <div class="password-card__header">
                <mat-icon class="password-card__icon">lock</mat-icon>
                <h3>Change Password</h3>
              </div>
              <div class="password-form">
                <div class="form-group">
                  <label>Current Password</label>
                  <input type="password" class="form-input" [(ngModel)]="currentPassword" autocomplete="current-password" />
                </div>
                <div class="form-group">
                  <label>New Password</label>
                  <input type="password" class="form-input" [(ngModel)]="newPassword" autocomplete="new-password" />
                </div>
                <div class="form-group">
                  <label>Confirm New Password</label>
                  <input type="password" class="form-input" [(ngModel)]="confirmPassword" autocomplete="new-password" />
                </div>
                <p class="form-error" *ngIf="passwordError">{{ passwordError }}</p>
                <p class="form-success" *ngIf="passwordSuccess">{{ passwordSuccess }}</p>
                <button class="btn-teal" (click)="changePassword()" [disabled]="changingPassword || !currentPassword || !newPassword">
                  {{ changingPassword ? 'Changing…' : 'Change Password' }}
                </button>
              </div>
            </div>
          </div>

        </div><!-- /settings-content -->
      </div><!-- /settings-layout -->

      <!-- ═══ Export Modal ═══════════════════════════ -->
      <app-modal [open]="exportModalOpen" title="Export Data" confirmLabel="Export"
        [loading]="exporting" (confirmed)="doExport()" (cancelled)="exportModalOpen = false">
        <div class="modal-form">
          <p class="modal-note"><mat-icon>info</mat-icon> The export will be encrypted with AES-256. You will need this password to import.</p>
          <div class="form-group">
            <label>Password</label>
            <input type="password" class="form-input" [(ngModel)]="exportPassword" placeholder="Encryption password" />
          </div>
        </div>
      </app-modal>

      <!-- ═══ Import Modal ═══════════════════════════ -->
      <app-modal [open]="importModalOpen" title="Import Data" confirmLabel="Import"
        [loading]="importing" [confirmDisabled]="!importFile"
        (confirmed)="doImport()" (cancelled)="importModalOpen = false">
        <div class="modal-form">
          <div class="dropzone" (click)="fileInput.click()" (dragover)="$event.preventDefault()" (drop)="onFileDrop($event)">
            <mat-icon class="dropzone__icon">upload_file</mat-icon>
            <span *ngIf="!importFile">Drop .hpd file here or click to browse</span>
            <span *ngIf="importFile" class="dropzone__file">{{ importFile.name }}</span>
            <input #fileInput type="file" accept=".hpd" (change)="onFileSelect($event)" hidden />
          </div>
          <div class="form-group">
            <label>Password</label>
            <input type="password" class="form-input" [(ngModel)]="importPassword" placeholder="Decryption password" />
          </div>
          <div class="mode-cards">
            <div class="mode-card" [class.mode-card--active]="importMode === 'merge'" (click)="importMode = 'merge'">
              <mat-icon>merge</mat-icon>
              <span class="mode-card__title">Safe Merge</span>
              <span class="mode-card__desc">Add new records, update existing</span>
            </div>
            <div class="mode-card" [class.mode-card--active]="importMode === 'overwrite'" (click)="importMode = 'overwrite'">
              <mat-icon>sync</mat-icon>
              <span class="mode-card__title">Full Overwrite</span>
              <span class="mode-card__desc">Replace all data with imported data</span>
            </div>
          </div>
        </div>
      </app-modal>

      <!-- ═══ Import Result Modal ═════════════════════ -->
      <app-modal [open]="importResultOpen" [title]="importResultSuccess ? 'Import Successful' : 'Import Failed'"
        [type]="importResultSuccess ? 'default' : 'danger'"
        confirmLabel="OK" [confirmOnly]="true"
        (confirmed)="importResultOpen = false" (cancelled)="importResultOpen = false">
        <p *ngIf="importResultSuccess" style="text-align:center; color:#059669; font-weight:600">
          <mat-icon style="vertical-align:middle">check_circle</mat-icon> Data imported successfully.
        </p>
        <p *ngIf="!importResultSuccess" style="text-align:center; color:#dc2626">
          {{ importResultReason }}
        </p>
      </app-modal>
    </div>
  `,
  styles: [`
    .settings-page { padding: 1.5rem 2rem 3rem; max-width: 1400px; margin: 0 auto; }
    .page-header { margin-bottom: 1.25rem; }
    .page-title {
      display: flex; align-items: center; gap: 0.5rem;
      font-size: 1.5rem; font-weight: 800; color: var(--hp-navy, #1e3a5f); margin: 0;
    }
    .page-icon { font-size: 1.75rem; width: 1.75rem; height: 1.75rem; color: var(--hp-teal, #2dd4bf); }

    .settings-layout { display: flex; gap: 1.5rem; }

    /* Sidebar nav */
    .settings-nav {
      display: flex; flex-direction: column; gap: 0.25rem;
      width: 220px; flex-shrink: 0;
    }
    .nav-pill {
      display: flex; align-items: center; gap: 0.625rem;
      padding: 0.625rem 1rem; border: none; border-radius: 8px;
      background: transparent; font-size: 0.875rem; font-weight: 500;
      color: var(--hp-text-muted, #6b7280); cursor: pointer; text-align: left;
      transition: all 150ms;
    }
    .nav-pill mat-icon { font-size: 1.125rem; width: 1.125rem; height: 1.125rem; }
    .nav-pill:hover { background: var(--hp-white, #fff); color: var(--hp-text, #374151); }
    .nav-pill--active {
      background: var(--hp-white, #fff); color: var(--hp-navy, #1e3a5f); font-weight: 600;
      box-shadow: 0 1px 3px rgba(0,0,0,0.06);
    }

    .settings-content { flex: 1; min-width: 0; }

    .section-title { font-size: 1.125rem; font-weight: 700; color: var(--hp-navy, #1e3a5f); margin: 0 0 1.25rem; }
    .sub-title { font-size: 0.9375rem; font-weight: 700; color: var(--hp-navy, #1e3a5f); margin: 1.5rem 0 0.75rem; }
    .empty-msg { color: var(--hp-text-muted, #9ca3af); font-size: 0.875rem; padding: 1rem 0; }

    /* Action cards (Data Management) */
    .action-cards { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
    .action-card {
      background: var(--hp-white, #fff); border: 1px solid var(--hp-border, #f3f4f6);
      border-radius: 14px; padding: 1.5rem;
      display: flex; flex-direction: column; gap: 0.75rem;
      box-shadow: 0 1px 3px rgba(0,0,0,0.04);
    }
    .action-card__icon-wrap {
      width: 48px; height: 48px; border-radius: 12px;
      display: flex; align-items: center; justify-content: center;
    }
    .action-card__icon-wrap--teal { background: rgba(45,212,191,0.12); color: #0d9488; }
    .action-card__icon-wrap--navy { background: rgba(30,58,95,0.1); color: #1e3a5f; }
    .action-card__title { font-size: 1rem; font-weight: 700; color: var(--hp-navy, #1e3a5f); margin: 0; }
    .action-card__desc { font-size: 0.8125rem; color: var(--hp-text-muted, #6b7280); margin: 0; flex: 1; }

    /* Buttons */
    .btn-teal {
      display: inline-flex; align-items: center; gap: 0.375rem;
      padding: 0.5rem 1.25rem; border: none; border-radius: 8px;
      background: #2dd4bf; color: #fff; font-size: 0.8125rem; font-weight: 700;
      cursor: pointer; transition: all 150ms;
    }
    .btn-teal:hover:not(:disabled) { box-shadow: 0 4px 12px rgba(45,212,191,0.4); transform: translateY(-1px); }
    .btn-teal:disabled { opacity: 0.5; cursor: default; }
    .btn-teal--sm { padding: 0.375rem 0.875rem; font-size: 0.75rem; }
    .btn-teal mat-icon { font-size: 1rem; width: 1rem; height: 1rem; }

    .btn-outline {
      display: inline-flex; align-items: center; gap: 0.375rem;
      padding: 0.5rem 1.25rem; border: 1px solid var(--hp-border, #e5e7eb); border-radius: 8px;
      background: var(--hp-white, #fff); font-size: 0.8125rem; font-weight: 600;
      color: var(--hp-text, #374151); cursor: pointer; transition: all 150ms;
    }
    .btn-outline:hover { border-color: #1e3a5f; }
    .btn-outline mat-icon { font-size: 1rem; width: 1rem; height: 1rem; }

    .icon-btn {
      display: inline-flex; align-items: center; justify-content: center;
      width: 28px; height: 28px; border: none; border-radius: 6px;
      background: transparent; cursor: pointer; color: var(--hp-text-muted, #6b7280);
    }
    .icon-btn:hover { background: rgba(45,212,191,0.1); color: #0d9488; }
    .icon-btn mat-icon { font-size: 1rem; width: 1rem; height: 1rem; }

    /* Mini table */
    .dict-table-wrap { border: 1px solid var(--hp-border, #f3f4f6); border-radius: 10px; overflow: hidden; }
    .mini-table { width: 100%; border-collapse: collapse; font-size: 0.8125rem; }
    .mini-table th {
      text-align: left; padding: 0.625rem 0.875rem; font-weight: 700;
      font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.04em;
      color: var(--hp-text-muted, #6b7280); background: var(--hp-bg, #f9fafb);
      border-bottom: 2px solid var(--hp-border, #f3f4f6);
    }
    .mini-table td { padding: 0.625rem 0.875rem; color: var(--hp-text, #374151); border-bottom: 1px solid var(--hp-border, #f9fafb); }
    .cell-bold { font-weight: 600; }

    /* Zero results */
    .zero-wrap { display: flex; flex-direction: column; gap: 0.25rem; }
    .zero-row {
      display: flex; align-items: center; gap: 0.5rem;
      padding: 0.375rem 0.5rem; border-radius: 6px;
    }
    .zero-row:hover { background: var(--hp-bg, #f9fafb); }
    .zero-query { flex: 1; font-size: 0.8125rem; font-weight: 500; color: var(--hp-text, #374151); }
    .zero-time { font-size: 0.75rem; color: var(--hp-text-muted, #9ca3af); }

    /* Policy cards */
    .policy-list { display: flex; flex-direction: column; gap: 0.5rem; }
    .policy-card {
      display: flex; align-items: center; justify-content: space-between;
      padding: 0.875rem 1rem; background: var(--hp-white, #fff);
      border: 1px solid var(--hp-border, #f3f4f6); border-radius: 10px;
    }
    .policy-pattern { font-family: monospace; font-size: 0.8125rem; font-weight: 600; color: var(--hp-text, #374151); }
    .policy-meta { font-size: 0.75rem; color: var(--hp-text-muted, #9ca3af); margin-left: 0.75rem; }

    /* Toggle switch */
    .toggle-switch { position: relative; display: inline-block; width: 40px; height: 22px; cursor: pointer; }
    .toggle-switch input { opacity: 0; width: 0; height: 0; }
    .toggle-slider {
      position: absolute; inset: 0; background: #d1d5db; border-radius: 22px;
      transition: background 200ms;
    }
    .toggle-slider::before {
      content: ''; position: absolute; width: 16px; height: 16px;
      bottom: 3px; left: 3px; background: #fff; border-radius: 50%;
      transition: transform 200ms;
    }
    .toggle-switch input:checked + .toggle-slider { background: #2dd4bf; }
    .toggle-switch input:checked + .toggle-slider::before { transform: translateX(18px); }

    /* Add form (inline) */
    .add-form { display: flex; gap: 0.5rem; align-items: flex-end; flex-wrap: wrap; }

    /* Form inputs */
    .form-input {
      padding: 0.5rem 0.75rem; border: 1px solid var(--hp-border, #e5e7eb); border-radius: 8px;
      font-size: 0.8125rem; color: var(--hp-text, #374151); background: var(--hp-white, #fff);
      outline: none; min-width: 120px;
    }
    .form-input:focus { border-color: #2dd4bf; box-shadow: 0 0 0 2px rgba(45,212,191,0.15); }
    .form-input--sm { min-width: 90px; }
    .form-textarea {
      width: 100%; padding: 0.625rem 0.75rem;
      border: 1px solid var(--hp-border, #e5e7eb); border-radius: 8px;
      font-size: 0.8125rem; color: var(--hp-text, #374151); background: var(--hp-white, #fff);
      outline: none; resize: vertical; font-family: inherit;
    }
    .form-textarea:focus { border-color: #2dd4bf; box-shadow: 0 0 0 2px rgba(45,212,191,0.15); }

    .form-group { display: flex; flex-direction: column; gap: 0.25rem; margin-bottom: 0.75rem; }
    .form-group label { font-size: 0.75rem; font-weight: 600; color: var(--hp-text-muted, #6b7280); }
    .form-error { color: #dc2626; font-size: 0.8125rem; margin: 0; }
    .form-success { color: #059669; font-size: 0.8125rem; margin: 0; }

    /* Template grid */
    .template-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
    .template-card {
      background: var(--hp-white, #fff); border: 1px solid var(--hp-border, #f3f4f6);
      border-radius: 10px; padding: 1rem;
    }
    .template-card__name { font-size: 0.875rem; font-weight: 700; color: var(--hp-navy, #1e3a5f); margin: 0 0 0.375rem; }
    .template-card__body { font-size: 0.8125rem; color: var(--hp-text-muted, #6b7280); margin: 0 0 0.5rem; line-height: 1.4; }
    .template-card__footer { display: flex; align-items: center; justify-content: space-between; }
    .template-card__cat { font-size: 0.7rem; font-weight: 600; color: #0d9488; background: #f0fdfa; padding: 0.15rem 0.5rem; border-radius: 999px; }

    .create-form { display: flex; flex-direction: column; gap: 0.625rem; max-width: 500px; }

    /* Preference option cards */
    .option-cards { display: flex; gap: 1rem; }
    .option-cards--three { display: grid; grid-template-columns: repeat(3, 1fr); }
    .option-card {
      display: flex; flex-direction: column; align-items: center; gap: 0.625rem;
      padding: 1rem 1.25rem; background: var(--hp-white, #fff);
      border: 2px solid var(--hp-border, #e5e7eb); border-radius: 12px;
      cursor: pointer; transition: all 200ms; min-width: 140px;
    }
    .option-card:hover { border-color: #2dd4bf; }
    .option-card--active {
      border-color: #2dd4bf; background: rgba(45,212,191,0.05);
      box-shadow: 0 0 0 3px rgba(45,212,191,0.15);
    }
    .option-card--sm { padding: 0.75rem 1rem; }
    .option-card--sm mat-icon { font-size: 1.5rem; width: 1.5rem; height: 1.5rem; color: var(--hp-navy, #1e3a5f); }
    .option-label { font-size: 0.8125rem; font-weight: 600; color: var(--hp-text, #374151); }

    /* Theme preview thumbnails */
    .option-preview {
      width: 120px; height: 72px; border-radius: 8px; overflow: hidden;
      display: grid; grid-template-columns: 24px 1fr; grid-template-rows: 12px 1fr;
      border: 1px solid var(--hp-border, #e5e7eb);
    }
    .option-preview--light { background: #f8fafc; }
    .option-preview--light .preview-bar { background: #fff; grid-column: 1 / -1; border-bottom: 1px solid #e5e7eb; }
    .option-preview--light .preview-sidebar { background: #1e3a5f; }
    .option-preview--light .preview-content { background: #f8fafc; }
    .option-preview--dark { background: #0f172a; }
    .option-preview--dark .preview-bar { background: #1e293b; grid-column: 1 / -1; border-bottom: 1px solid #334155; }
    .option-preview--dark .preview-sidebar { background: #1e3a5f; }
    .option-preview--dark .preview-content { background: #0f172a; }

    /* Password card */
    .password-card {
      background: var(--hp-white, #fff); border: 1px solid var(--hp-border, #f3f4f6);
      border-radius: 14px; padding: 2rem; max-width: 420px; margin: 0 auto;
    }
    .password-card__header {
      display: flex; align-items: center; gap: 0.625rem;
      margin-bottom: 1.5rem; justify-content: center;
    }
    .password-card__header h3 { margin: 0; font-size: 1.125rem; font-weight: 700; color: var(--hp-navy, #1e3a5f); }
    .password-card__icon { color: var(--hp-teal, #2dd4bf); }
    .password-form { display: flex; flex-direction: column; gap: 0; }

    /* Modal form */
    .modal-form { display: flex; flex-direction: column; gap: 0.75rem; }
    .modal-note {
      display: flex; align-items: center; gap: 0.5rem;
      font-size: 0.8125rem; color: var(--hp-text-muted, #6b7280);
      background: #f0fdfa; padding: 0.625rem 0.875rem; border-radius: 8px; margin: 0;
    }
    .modal-note mat-icon { font-size: 1rem; width: 1rem; height: 1rem; color: #0d9488; flex-shrink: 0; }

    /* File dropzone */
    .dropzone {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      gap: 0.5rem; padding: 1.5rem; border: 2px dashed var(--hp-border, #d1d5db);
      border-radius: 10px; cursor: pointer; transition: all 150ms;
      color: var(--hp-text-muted, #9ca3af); font-size: 0.875rem;
    }
    .dropzone:hover { border-color: #2dd4bf; background: rgba(45,212,191,0.03); }
    .dropzone__icon { font-size: 2rem; width: 2rem; height: 2rem; opacity: 0.5; }
    .dropzone__file { font-weight: 600; color: var(--hp-teal, #2dd4bf); }

    /* Import mode cards */
    .mode-cards { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
    .mode-card {
      display: flex; flex-direction: column; align-items: center; gap: 0.375rem;
      padding: 1rem; border: 2px solid var(--hp-border, #e5e7eb); border-radius: 10px;
      cursor: pointer; transition: all 150ms; text-align: center;
    }
    .mode-card:hover { border-color: #2dd4bf; }
    .mode-card--active { border-color: #2dd4bf; background: rgba(45,212,191,0.05); box-shadow: 0 0 0 3px rgba(45,212,191,0.15); }
    .mode-card mat-icon { color: var(--hp-navy, #1e3a5f); }
    .mode-card__title { font-size: 0.8125rem; font-weight: 700; color: var(--hp-text, #374151); }
    .mode-card__desc { font-size: 0.7rem; color: var(--hp-text-muted, #9ca3af); }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsComponent implements OnInit {

  readonly sections: { key: SettingsSection; label: string; icon: string }[] = [
    { key: 'data',        label: 'Data Management',  icon: 'save' },
    { key: 'dictionary',  label: 'Search Dictionary', icon: 'search' },
    { key: 'safety',      label: 'Content Safety',    icon: 'shield' },
    { key: 'templates',   label: 'Templates',         icon: 'chat' },
    { key: 'preferences', label: 'Preferences',       icon: 'palette' },
    { key: 'security',    label: 'Security',           icon: 'lock' },
  ];
  activeSection: SettingsSection = 'data';

  // Data Management
  exportModalOpen = false;
  importModalOpen = false;
  exportPassword  = '';
  importPassword  = '';
  importFile:     File | null = null;
  importMode:     'merge' | 'overwrite' = 'merge';
  exporting       = false;
  importing       = false;
  importResultOpen    = false;
  importResultSuccess = false;
  importResultReason  = '';

  // Dictionary
  dictEntries: SearchDictionaryEntry[] = [];
  zeroResults: ZeroResultsLog[] = [];

  // Content Safety
  policies:         ContentPolicy[] = [];
  newPolicyPattern  = '';
  newPolicyType:    'keyword' | 'regex' | 'phrase' = 'keyword';
  newPolicyAction:  'flag' | 'block' | 'redact' = 'flag';
  newPolicySeverity: 'low' | 'medium' | 'high' = 'low';

  // Templates
  templates:    MessageTemplate[] = [];
  newTplName    = '';
  newTplCategory = '';
  newTplBody    = '';

  // Preferences
  currentTheme:   ThemeMode = 'light';
  currentDensity: UiDensity = 'comfortable';

  // Security
  currentPassword = '';
  newPassword     = '';
  confirmPassword = '';
  passwordError   = '';
  passwordSuccess = '';
  changingPassword = false;

  constructor(
    private importExport:    ImportExportService,
    private searchService:   SearchService,
    private messaging:       MessagingService,
    private auth:            AuthService,
    private theme:           ThemeService,
    private policyService:   ContentPolicyService,
    private toast:           ToastService,
    private cdr:             ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.currentTheme   = this.theme.currentTheme;
    this.currentDensity = this.theme.currentDensity;
    this.loadDictionary();
    this.loadPolicies();
    this.loadTemplates();
  }

  // --------------------------------------------------
  // Data Management
  // --------------------------------------------------

  async doExport(): Promise<void> {
    if (!this.exportPassword) return;
    this.exporting = true;
    this.cdr.markForCheck();
    try {
      await this.importExport.exportData(this.exportPassword, 1, 'admin');
      this.toast.success('Data exported successfully');
      this.exportModalOpen = false;
      this.exportPassword = '';
    } catch {
      this.toast.error('Export failed');
    } finally {
      this.exporting = false;
      this.cdr.markForCheck();
    }
  }

  onFileSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.importFile = input.files?.[0] ?? null;
    this.cdr.markForCheck();
  }

  onFileDrop(event: DragEvent): void {
    event.preventDefault();
    this.importFile = event.dataTransfer?.files[0] ?? null;
    this.cdr.markForCheck();
  }

  async doImport(): Promise<void> {
    if (!this.importFile || !this.importPassword) return;
    this.importing = true;
    this.cdr.markForCheck();
    try {
      const result = await this.importExport.importData(
        this.importFile, this.importPassword, 1, 'admin',
        this.importMode === 'overwrite',
      );
      this.importModalOpen = false;
      this.importResultSuccess = result.success;
      this.importResultReason  = result.reason ?? '';
      this.importResultOpen    = true;
      if (result.success) {
        this.loadDictionary();
        this.loadPolicies();
        this.loadTemplates();
      }
    } finally {
      this.importing = false;
      this.importFile = null;
      this.importPassword = '';
      this.cdr.markForCheck();
    }
  }

  // --------------------------------------------------
  // Dictionary
  // --------------------------------------------------

  private async loadDictionary(): Promise<void> {
    this.dictEntries = await this.searchService.getDictionary();
    this.zeroResults = await this.searchService.getZeroResultsReport(20);
    this.cdr.markForCheck();
  }

  editDictEntry(d: SearchDictionaryEntry): void {
    const syn = prompt('Synonyms (comma-separated)', d.synonyms.join(', '));
    if (syn === null) return;
    const corr = prompt('Corrections (comma-separated)', d.corrections.join(', '));
    if (corr === null) return;
    this.searchService.updateDictionaryEntry(d.id!, {
      synonyms: syn.split(',').map(s => s.trim()).filter(Boolean),
      corrections: corr.split(',').map(s => s.trim()).filter(Boolean),
    }).then(() => this.loadDictionary());
  }

  async addZeroToDictionary(query: string): Promise<void> {
    await this.searchService.addDictionaryEntry({ term: query, synonyms: [], corrections: [] });
    this.toast.success(`"${query}" added to dictionary`);
    this.loadDictionary();
  }

  // --------------------------------------------------
  // Content Safety
  // --------------------------------------------------

  private async loadPolicies(): Promise<void> {
    this.policies = await this.policyService.getPolicies();
    this.cdr.markForCheck();
  }

  async togglePolicy(p: ContentPolicy): Promise<void> {
    await this.policyService.togglePolicy(p.id!, !p.enabled);
    this.loadPolicies();
  }

  async addPolicy(): Promise<void> {
    if (!this.newPolicyPattern.trim()) return;
    await this.policyService.addPolicy({
      pattern:  this.newPolicyPattern.trim(),
      type:     this.newPolicyType,
      action:   this.newPolicyAction,
      severity: this.newPolicySeverity,
      enabled:  true,
      createdAt: new Date(),
    });
    this.newPolicyPattern = '';
    this.toast.success('Policy added');
    this.loadPolicies();
  }

  // --------------------------------------------------
  // Templates
  // --------------------------------------------------

  private async loadTemplates(): Promise<void> {
    this.templates = await this.messaging.getTemplates();
    this.cdr.markForCheck();
  }

  async createTemplate(): Promise<void> {
    if (!this.newTplName.trim() || !this.newTplBody.trim()) return;
    await this.messaging.createTemplate({
      name: this.newTplName.trim(),
      subject: '',
      body: this.newTplBody.trim(),
      category: this.newTplCategory.trim() || 'General',
      createdBy: 1,
    });
    this.newTplName = '';
    this.newTplBody = '';
    this.newTplCategory = '';
    this.toast.success('Template created');
    this.loadTemplates();
  }

  async deleteTemplate(t: MessageTemplate): Promise<void> {
    if (t.id == null) return;
    await this.messaging.deleteTemplate(t.id);
    this.toast.success('Template deleted');
    this.loadTemplates();
  }

  // --------------------------------------------------
  // Preferences
  // --------------------------------------------------

  setTheme(mode: ThemeMode): void {
    this.currentTheme = mode;
    this.theme.setTheme(mode);
    this.cdr.markForCheck();
  }

  setDensity(d: UiDensity): void {
    this.currentDensity = d;
    this.theme.setDensity(d);
    this.cdr.markForCheck();
  }

  // --------------------------------------------------
  // Security
  // --------------------------------------------------

  async changePassword(): Promise<void> {
    this.passwordError   = '';
    this.passwordSuccess = '';

    if (this.newPassword !== this.confirmPassword) {
      this.passwordError = 'Passwords do not match.';
      return;
    }
    if (this.newPassword.length < 8) {
      this.passwordError = 'New password must be at least 8 characters.';
      return;
    }

    this.changingPassword = true;
    this.cdr.markForCheck();

    try {
      const role = this.auth.getCurrentRole();
      if (!role) { this.passwordError = 'Not logged in.'; return; }

      const ok = await this.auth.changePassword(role, this.currentPassword, this.newPassword);
      if (ok) {
        this.passwordSuccess = 'Password changed successfully.';
        this.currentPassword = '';
        this.newPassword     = '';
        this.confirmPassword = '';
      } else {
        this.passwordError = 'Current password is incorrect.';
      }
    } finally {
      this.changingPassword = false;
      this.cdr.markForCheck();
    }
  }
}
