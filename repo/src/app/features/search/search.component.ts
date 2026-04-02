import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-search',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  template: `
    <div class="hp-page">
      <h1>Search</h1>
      <div class="hp-card">
        <div class="hp-empty-state">
          <mat-icon class="hp-empty-icon">search</mat-icon>
          <h3>Search</h3>
          <p>Phase 2+ — Coming Soon</p>
          <p>Full-text search across residents, documents, courses, and messages.</p>
        </div>
      </div>
    </div>
  `,
})
export class SearchComponent {}
