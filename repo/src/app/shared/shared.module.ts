/**
 * SharedModule
 *
 * Aggregates and re-exports all shared components and pipes.
 * Import this module in any feature module that needs shared UI.
 *
 * All components are standalone — this module provides a single
 * convenient import point.
 */
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

// Components
import { TableComponent } from './components/table/table.component';
import { DrawerComponent } from './components/drawer/drawer.component';
import { ModalComponent } from './components/modal/modal.component';
import { BadgeComponent } from './components/badge/badge.component';
import { ToastComponent } from './components/toast/toast.component';
import { InputComponent } from './components/forms/input.component';
import { SelectComponent } from './components/forms/select.component';
import { TextareaComponent } from './components/forms/textarea.component';
import { FileUploadComponent } from './components/forms/file-upload.component';
import { StatCardComponent } from './components/stat-card/stat-card.component';
import { RoleBadgeComponent } from './components/role-badge/role-badge.component';
import { StatusBadgeComponent } from './components/status-badge/status-badge.component';
import { EmptyStateComponent } from './components/empty-state/empty-state.component';

// Pipes
import { MaskPipe } from './pipes/mask.pipe';

const SHARED_COMPONENTS = [
  TableComponent,
  DrawerComponent,
  ModalComponent,
  BadgeComponent,
  ToastComponent,
  InputComponent,
  SelectComponent,
  TextareaComponent,
  FileUploadComponent,
  StatCardComponent,
  RoleBadgeComponent,
  StatusBadgeComponent,
  EmptyStateComponent,
  MaskPipe,
] as const;

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    ...SHARED_COMPONENTS,
  ],
  exports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    ...SHARED_COMPONENTS,
  ],
})
export class SharedModule {}
