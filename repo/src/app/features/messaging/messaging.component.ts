import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-messaging',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  template: `
    <div class="hp-page">
      <h1>Messages</h1>
      <div class="hp-card">
        <div class="hp-empty-state">
          <mat-icon class="hp-empty-icon">chat</mat-icon>
          <h3>Messages</h3>
          <p>Phase 2+ — Coming Soon</p>
          <p>In-app messaging, announcements, and direct message threads.</p>
        </div>
      </div>
    </div>
  `,
})
export class MessagingComponent {}
