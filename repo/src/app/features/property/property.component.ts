import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-property',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  template: `
    <div class="hp-page">
      <h1>Property Management</h1>
      <div class="hp-card">
        <div class="hp-empty-state">
          <mat-icon class="hp-empty-icon">property</mat-icon>
          <h3>Property Management</h3>
          <p>Phase 2+ — Coming Soon</p>
          <p>Property hierarchy (Buildings → Units → Rooms) and occupancy management.</p>
        </div>
      </div>
    </div>
  `,
})
export class PropertyComponent {}
