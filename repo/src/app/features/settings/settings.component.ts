import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  template: `
    <div class="hp-page">
      <h1>Settings</h1>
      <div class="hp-card">
        <div class="hp-empty-state">
          <mat-icon class="hp-empty-icon">settings</mat-icon>
          <h3>Settings</h3>
          <p>Phase 2+ — Coming Soon</p>
          <p>UI preferences, password management, and import/export.</p>
        </div>
      </div>
    </div>
  `,
})
export class SettingsComponent {}
