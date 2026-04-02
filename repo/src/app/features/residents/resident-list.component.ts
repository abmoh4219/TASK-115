import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-resident-list',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  template: `
    <div class="hp-page">
      <h1>Residents</h1>
      <div class="hp-card">
        <div class="hp-empty-state">
          <mat-icon class="hp-empty-icon">people</mat-icon>
          <h3>Residents</h3>
          <p>Phase 2+ — Coming Soon</p>
          <p>Resident profiles, move-in/out, and change log.</p>
        </div>
      </div>
    </div>
  `,
})
export class ResidentListComponent {}
