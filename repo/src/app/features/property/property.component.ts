import {
  Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

import { PropertyService, ReasonCode } from '../../core/services/property.service';
import { DbService, Building, Unit, Room, Occupancy, Resident } from '../../core/services/db.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../shared/components/toast/toast.service';
import { SelectOption } from '../../shared/components/forms/select.component';
import { SharedModule } from '../../shared/shared.module';

import { BuildingDrawerComponent, BuildingStatViewModel } from './building-drawer.component';
import { UnitDrawerComponent, RoomOccupant } from './unit-drawer.component';
import { MoveInModalComponent, MoveInPayload } from './move-in-modal.component';
import { MoveOutModalComponent, MoveOutPayload } from './move-out-modal.component';

@Component({
  selector: 'app-property',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatIconModule,
    SharedModule,
    BuildingDrawerComponent,
    UnitDrawerComponent,
    MoveInModalComponent,
    MoveOutModalComponent,
  ],
  templateUrl: './property.component.html',
  styleUrls: ['./property.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PropertyComponent implements OnInit {

  // -------------------------------------------------------
  // Raw data
  // -------------------------------------------------------

  loading = true;
  buildings: Building[] = [];
  allUnits: Unit[] = [];
  allRooms: Room[] = [];
  allOccupancies: Occupancy[] = [];
  allResidents: Resident[] = [];

  // -------------------------------------------------------
  // Computed / View-model data
  // -------------------------------------------------------

  buildingStats: BuildingStatViewModel[] = [];
  totalBuildings = 0;
  totalUnits = 0;
  totalRooms = 0;
  overallOccupancyRate = 0;

  // -------------------------------------------------------
  // Building drawer state
  // -------------------------------------------------------

  buildingDrawerOpen = false;
  selectedBuildingStat: BuildingStatViewModel | null = null;
  selectedBuildingUnits: Unit[] = [];
  selectedBuildingRooms: Room[] = [];

  // -------------------------------------------------------
  // Unit drawer state
  // -------------------------------------------------------

  unitDrawerOpen = false;
  selectedUnit: Unit | null = null;
  selectedUnitRooms: Room[] = [];
  roomOccupantsMap: Map<number, RoomOccupant | null> = new Map();

  // -------------------------------------------------------
  // Modal state
  // -------------------------------------------------------

  addBuildingOpen = false;
  addUnitOpen = false;
  addRoomOpen = false;
  moveInOpen = false;
  moveOutOpen = false;
  isSaving = false;

  selectedRoom: Room | null = null;
  moveOutData: { room: Room; occupancy: Occupancy; resident: Resident } | null = null;
  availableResidents: Resident[] = [];

  // -------------------------------------------------------
  // Forms
  // -------------------------------------------------------

  buildingForm!: FormGroup;
  unitForm!: FormGroup;
  roomForm!: FormGroup;

  // -------------------------------------------------------
  // Constants
  // -------------------------------------------------------

  readonly unitTypeOptions: SelectOption[] = [
    { value: 'Studio', label: 'Studio' },
    { value: '1BR',    label: '1 Bedroom' },
    { value: '2BR',    label: '2 Bedrooms' },
    { value: '3BR',    label: '3 Bedrooms' },
    { value: 'Suite',  label: 'Suite' },
    { value: 'Other',  label: 'Other' },
  ];

  readonly skeletonItems = [1, 2, 3];

  private actorRole = 'admin';
  private actorId = 1;

  constructor(
    private propertyService: PropertyService,
    private db: DbService,
    private authService: AuthService,
    private toast: ToastService,
    private fb: FormBuilder,
    private cdr: ChangeDetectorRef,
  ) {}

  // -------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------

  ngOnInit(): void {
    this.authService.state$.subscribe(s => {
      this.actorRole = s.role ?? 'admin';
    });
    this.initForms();
    this.loadData();
  }

  // -------------------------------------------------------
  // Form init
  // -------------------------------------------------------

  private initForms(): void {
    this.buildingForm = this.fb.group({
      name:    ['', [Validators.required, Validators.maxLength(100)]],
      address: ['', [Validators.required, Validators.maxLength(200)]],
      floors:  [1,  [Validators.required, Validators.min(1), Validators.max(200)]],
    });

    this.unitForm = this.fb.group({
      unitNumber: ['', Validators.required],
      floor:      [1,  [Validators.required, Validators.min(1)]],
      type:       ['1BR', Validators.required],
    });

    this.roomForm = this.fb.group({
      roomNumber: ['', Validators.required],
      capacity:   [1,  [Validators.required, Validators.min(1), Validators.max(50)]],
    });
  }

  // -------------------------------------------------------
  // Data loading
  // -------------------------------------------------------

  async loadData(): Promise<void> {
    this.loading = true;
    this.cdr.markForCheck();
    try {
      const [buildings, units, rooms, occupancies, residents] = await Promise.all([
        this.propertyService.getBuildings(),
        this.propertyService.getUnits(),
        this.propertyService.getRooms(),
        this.db.occupancies.toArray(),
        this.db.residents.toArray(),
      ]);

      this.buildings     = buildings;
      this.allUnits      = units;
      this.allRooms      = rooms;
      this.allOccupancies = occupancies;
      this.allResidents  = residents;

      this.computeStats();
    } catch {
      this.toast.show('Failed to load property data', 'error');
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  private computeStats(): void {
    this.totalBuildings = this.buildings.length;
    this.totalUnits     = this.allUnits.length;
    this.totalRooms     = this.allRooms.length;

    const activeCount = this.allOccupancies.filter(o => o.status === 'active').length;
    this.overallOccupancyRate = this.totalRooms > 0
      ? Math.round((activeCount / this.totalRooms) * 100)
      : 0;

    this.buildingStats = this.buildings.map(b => {
      const units  = this.allUnits.filter(u => u.buildingId === b.id);
      const unitIds = units.map(u => u.id!);
      const rooms  = this.allRooms.filter(r => unitIds.includes(r.unitId));
      const roomIds = rooms.map(r => r.id!);
      const active = this.allOccupancies.filter(
        o => o.status === 'active' && roomIds.includes(o.roomId),
      );
      return {
        building:       b,
        unitCount:      units.length,
        roomCount:      rooms.length,
        occupancyCount: active.length,
        occupancyRate:  rooms.length > 0 ? Math.round((active.length / rooms.length) * 100) : 0,
      };
    });
  }

  // -------------------------------------------------------
  // Building card click → open drawer
  // -------------------------------------------------------

  openBuilding(stat: BuildingStatViewModel): void {
    this.selectedBuildingStat  = stat;
    this.selectedBuildingUnits = this.allUnits.filter(u => u.buildingId === stat.building.id);
    this.selectedBuildingRooms = this.allRooms.filter(r =>
      this.selectedBuildingUnits.some(u => u.id === r.unitId),
    );
    this.buildingDrawerOpen = true;
    this.cdr.markForCheck();
  }

  // -------------------------------------------------------
  // Unit row click → open unit drawer
  // -------------------------------------------------------

  openUnit(unit: Unit): void {
    this.selectedUnit      = unit;
    this.selectedUnitRooms = this.allRooms.filter(r => r.unitId === unit.id);
    this.buildRoomOccupantsMap(this.selectedUnitRooms);
    this.unitDrawerOpen = true;
    this.cdr.markForCheck();
  }

  private buildRoomOccupantsMap(rooms: Room[]): void {
    const map = new Map<number, RoomOccupant | null>();
    for (const room of rooms) {
      const occ = this.allOccupancies.find(
        o => o.roomId === room.id && o.status === 'active',
      );
      if (occ) {
        const resident = this.allResidents.find(r => r.id === occ.residentId);
        map.set(room.id!, resident ? { occupancy: occ, resident } : null);
      } else {
        map.set(room.id!, null);
      }
    }
    this.roomOccupantsMap = map;
  }

  // -------------------------------------------------------
  // Add Building
  // -------------------------------------------------------

  openAddBuilding(): void {
    this.buildingForm.reset({ name: '', address: '', floors: 1 });
    this.addBuildingOpen = true;
    this.cdr.markForCheck();
  }

  async confirmAddBuilding(): Promise<void> {
    if (this.buildingForm.invalid) return;
    this.isSaving = true;
    this.cdr.markForCheck();
    try {
      const { name, address, floors } = this.buildingForm.value;
      await this.propertyService.createBuilding(
        { name, address, floors: Number(floors) },
        this.actorId,
        this.actorRole,
      );
      this.toast.show(`Building "${name}" created`, 'success');
      this.addBuildingOpen = false;
      await this.loadData();
    } catch {
      this.toast.show('Failed to create building', 'error');
    } finally {
      this.isSaving = false;
      this.cdr.markForCheck();
    }
  }

  // -------------------------------------------------------
  // Add Unit (inside selected building)
  // -------------------------------------------------------

  openAddUnit(): void {
    this.unitForm.reset({ unitNumber: '', floor: 1, type: '1BR' });
    this.addUnitOpen = true;
    this.cdr.markForCheck();
  }

  async confirmAddUnit(): Promise<void> {
    if (this.unitForm.invalid || !this.selectedBuildingStat) return;
    this.isSaving = true;
    this.cdr.markForCheck();
    try {
      const { unitNumber, floor, type } = this.unitForm.value;
      await this.propertyService.createUnit(
        {
          buildingId: this.selectedBuildingStat.building.id!,
          unitNumber,
          floor: Number(floor),
          type,
        },
        this.actorId,
        this.actorRole,
      );
      this.toast.show(`Unit ${unitNumber} created`, 'success');
      this.addUnitOpen = false;
      await this.loadData();
      // Refresh building drawer data
      if (this.selectedBuildingStat) {
        const refreshed = this.buildingStats.find(
          s => s.building.id === this.selectedBuildingStat!.building.id,
        );
        if (refreshed) this.openBuilding(refreshed);
      }
    } catch {
      this.toast.show('Failed to create unit', 'error');
    } finally {
      this.isSaving = false;
      this.cdr.markForCheck();
    }
  }

  // -------------------------------------------------------
  // Add Room (inside selected unit)
  // -------------------------------------------------------

  openAddRoom(): void {
    this.roomForm.reset({ roomNumber: '', capacity: 1 });
    this.addRoomOpen = true;
    this.cdr.markForCheck();
  }

  async confirmAddRoom(): Promise<void> {
    if (this.roomForm.invalid || !this.selectedUnit) return;
    this.isSaving = true;
    this.cdr.markForCheck();
    try {
      const { roomNumber, capacity } = this.roomForm.value;
      await this.propertyService.createRoom(
        { unitId: this.selectedUnit.id!, roomNumber, capacity: Number(capacity) },
        this.actorId,
        this.actorRole,
      );
      this.toast.show(`Room ${roomNumber} created`, 'success');
      this.addRoomOpen = false;
      await this.loadData();
      // Refresh unit drawer
      if (this.selectedUnit) this.openUnit(this.selectedUnit);
    } catch {
      this.toast.show('Failed to create room', 'error');
    } finally {
      this.isSaving = false;
      this.cdr.markForCheck();
    }
  }

  // -------------------------------------------------------
  // Move In
  // -------------------------------------------------------

  openMoveIn(room: Room): void {
    this.selectedRoom = room;
    const activeIds = new Set(
      this.allOccupancies.filter(o => o.status === 'active').map(o => o.residentId),
    );
    this.availableResidents = this.allResidents.filter(
      r => r.status === 'active' && !activeIds.has(r.id!),
    );
    this.moveInOpen = true;
    this.cdr.markForCheck();
  }

  async confirmMoveIn(payload: MoveInPayload): Promise<void> {
    if (!this.selectedRoom) return;
    this.isSaving = true;
    this.cdr.markForCheck();
    try {
      await this.propertyService.moveIn({
        residentId:    payload.residentId,
        roomId:        this.selectedRoom.id!,
        effectiveFrom: payload.effectiveFrom,
        reasonCode:    payload.reasonCode,
        actorId:       this.actorId,
        actorRole:     this.actorRole,
      });
      this.toast.show('Move-in completed successfully', 'success');
      this.moveInOpen = false;
      await this.loadData();
      if (this.selectedUnit) this.openUnit(this.selectedUnit);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Move-in failed';
      this.toast.show(msg, 'error');
    } finally {
      this.isSaving = false;
      this.cdr.markForCheck();
    }
  }

  // -------------------------------------------------------
  // Move Out
  // -------------------------------------------------------

  openMoveOut(data: { room: Room; occupancy: Occupancy; resident: Resident }): void {
    this.moveOutData = data;
    this.moveOutOpen = true;
    this.cdr.markForCheck();
  }

  async confirmMoveOut(payload: MoveOutPayload): Promise<void> {
    if (!this.moveOutData) return;
    this.isSaving = true;
    this.cdr.markForCheck();
    try {
      await this.propertyService.moveOut({
        residentId:  this.moveOutData.occupancy.residentId,
        effectiveTo: payload.effectiveTo,
        reasonCode:  payload.reasonCode,
        actorId:     this.actorId,
        actorRole:   this.actorRole,
      });
      this.toast.show('Move-out completed successfully', 'success');
      this.moveOutOpen = false;
      await this.loadData();
      if (this.selectedUnit) this.openUnit(this.selectedUnit);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Move-out failed';
      this.toast.show(msg, 'error');
    } finally {
      this.isSaving = false;
      this.cdr.markForCheck();
    }
  }

  // -------------------------------------------------------
  // Helpers
  // -------------------------------------------------------

  occupancyColor(rate: number): string {
    if (rate >= 95) return '#ef4444';
    if (rate >= 80) return '#f59e0b';
    return '#10b981';
  }

  occupancyClass(rate: number): string {
    if (rate >= 95) return 'high';
    if (rate >= 80) return 'medium';
    return 'low';
  }

  fieldError(form: FormGroup, field: string): string {
    const c = form.get(field);
    if (!c?.touched || c.valid) return '';
    if (c.errors?.['required'])  return `${field} is required`;
    if (c.errors?.['maxlength']) return `Too long`;
    if (c.errors?.['min'])       return `Value too low`;
    return 'Invalid value';
  }
}
