import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-my-profile',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  template: `
    <div class="hp-page">
      <h1>My Profile</h1>
      <div class="hp-card">
        <div class="hp-empty-state">
          <mat-icon class="hp-empty-icon">person</mat-icon>
          <h3>My Profile</h3>
          <p>Phase 2+ — Coming Soon</p>
          <p>View and update your resident profile, documents, and enrollments.</p>
        </div>
      </div>
    </div>
  `,
})
export class MyProfileComponent {}
