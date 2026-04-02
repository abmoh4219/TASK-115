import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

// Guards
import { AdminGuard } from './core/guards/admin.guard';
import { ResidentGuard } from './core/guards/resident.guard';
import { ComplianceGuard } from './core/guards/compliance.guard';
import { AnalystGuard } from './core/guards/analyst.guard';
import { AllRolesGuard, AdminOrComplianceGuard, AdminOrResidentGuard } from './core/guards/multi-role.guard';

// Feature components
import { RolePickerComponent } from './features/login/role-picker.component';
import { UnauthorizedComponent } from './features/unauthorized/unauthorized.component';
import { AdminDashboardComponent } from './features/dashboard/admin-dashboard.component';
import { PropertyComponent } from './features/property/property.component';
import { ResidentListComponent } from './features/residents/resident-list.component';
import { MyProfileComponent } from './features/residents/my-profile.component';
import { DocumentQueueComponent } from './features/documents/document-queue.component';
import { MessagingComponent } from './features/messaging/messaging.component';
import { SearchComponent } from './features/search/search.component';
import { EnrollmentComponent } from './features/enrollment/enrollment.component';
import { AnalyticsDashboardComponent } from './features/analytics/analytics-dashboard.component';
import { AuditLogComponent } from './features/audit/audit-log.component';
import { SettingsComponent } from './features/settings/settings.component';

export const routes: Routes = [
  // Public routes
  { path: 'login',        component: RolePickerComponent },
  { path: 'unauthorized', component: UnauthorizedComponent },

  // Admin-only routes
  { path: 'dashboard',   component: AdminDashboardComponent,    canActivate: [AdminGuard] },
  { path: 'property',    component: PropertyComponent,           canActivate: [AdminGuard] },
  { path: 'audit',       component: AuditLogComponent,           canActivate: [AdminGuard] },
  { path: 'settings',    component: SettingsComponent,           canActivate: [AdminGuard] },

  // Admin + Compliance: resident roster
  { path: 'residents',   component: ResidentListComponent,       canActivate: [AdminOrComplianceGuard] },

  // Resident-only
  { path: 'my-profile',  component: MyProfileComponent,          canActivate: [ResidentGuard] },

  // Compliance-only: document queue
  { path: 'documents',   component: DocumentQueueComponent,      canActivate: [ComplianceGuard] },

  // Admin + Resident: enrollment
  { path: 'enrollment',  component: EnrollmentComponent,         canActivate: [AdminOrResidentGuard] },

  // Analyst-only
  { path: 'analytics',   component: AnalyticsDashboardComponent, canActivate: [AnalystGuard] },

  // All authenticated roles: messaging, search
  { path: 'messages',    component: MessagingComponent,          canActivate: [AllRolesGuard] },
  { path: 'search',      component: SearchComponent,             canActivate: [AllRolesGuard] },

  // Redirects
  { path: '',     redirectTo: '/login', pathMatch: 'full' },
  { path: '**',   redirectTo: '/login' },
];

@NgModule({
  imports: [RouterModule.forRoot(routes, {
    scrollPositionRestoration: 'top',
  })],
  exports: [RouterModule],
})
export class AppRoutingModule {}
