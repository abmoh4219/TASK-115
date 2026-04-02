import { Injectable } from '@angular/core';
import { DbService, Building, Unit, Room, Occupancy, Resident } from './db.service';
import { AuditAction, AuditService } from './audit.service';
import DOMPurify from 'dompurify';

export enum ReasonCode {
  MOVE_IN_NEW        = 'MOVE_IN_NEW',
  TRANSFER           = 'TRANSFER',
  LEASE_START        = 'LEASE_START',
  MOVE_OUT_VOLUNTARY = 'MOVE_OUT_VOLUNTARY',
  MOVE_OUT_EVICTION  = 'MOVE_OUT_EVICTION',
  LEASE_END          = 'LEASE_END',
  ADMINISTRATIVE     = 'ADMINISTRATIVE',
}

/** Union of enum values + string for backward-compatibility with existing DB records. */
export type MoveReasonCode = ReasonCode | string;

@Injectable({ providedIn: 'root' })
export class PropertyService {

  constructor(
    private db: DbService,
    private audit: AuditService,
  ) {}

  // --------------------------------------------------
  // Buildings
  // --------------------------------------------------

  async getBuildings(): Promise<Building[]> {
    return this.db.buildings.toArray();
  }

  async getBuilding(id: number): Promise<Building | undefined> {
    return this.db.buildings.get(id);
  }

  async createBuilding(data: Omit<Building, 'id' | 'createdAt' | 'updatedAt'>, actorId: number, actorRole: string): Promise<Building> {
    const now = new Date();
    const id = await this.db.buildings.add({
      ...data,
      name: DOMPurify.sanitize(data.name),
      address: DOMPurify.sanitize(data.address),
      createdAt: now,
      updatedAt: now,
    });
    const building = await this.db.buildings.get(id);
    this.audit.log(AuditAction.RULE_CHANGED, actorId, actorRole, 'building', id, undefined, building);
    return building!;
  }

  async updateBuilding(id: number, data: Partial<Building>, actorId: number, actorRole: string): Promise<void> {
    const before = await this.db.buildings.get(id);
    await this.db.buildings.update(id, { ...data, updatedAt: new Date() });
    const after = await this.db.buildings.get(id);
    this.audit.log(AuditAction.RULE_CHANGED, actorId, actorRole, 'building', id, before, after);
  }

  // --------------------------------------------------
  // Units
  // --------------------------------------------------

  async getUnits(buildingId?: number): Promise<Unit[]> {
    if (buildingId !== undefined) {
      return this.db.units.where('buildingId').equals(buildingId).toArray();
    }
    return this.db.units.toArray();
  }

  async createUnit(data: Omit<Unit, 'id' | 'createdAt' | 'updatedAt'>, actorId: number, actorRole: string): Promise<Unit> {
    const now = new Date();
    const id = await this.db.units.add({ ...data, createdAt: now, updatedAt: now });
    const unit = await this.db.units.get(id);
    this.audit.log(AuditAction.RULE_CHANGED, actorId, actorRole, 'unit', id, undefined, unit);
    return unit!;
  }

  async updateUnit(id: number, data: Partial<Unit>, actorId: number, actorRole: string): Promise<void> {
    const before = await this.db.units.get(id);
    await this.db.units.update(id, { ...data, updatedAt: new Date() });
    const after = await this.db.units.get(id);
    this.audit.log(AuditAction.RULE_CHANGED, actorId, actorRole, 'unit', id, before, after);
  }

  // --------------------------------------------------
  // Rooms
  // --------------------------------------------------

  async getRooms(unitId?: number): Promise<Room[]> {
    if (unitId !== undefined) {
      return this.db.rooms.where('unitId').equals(unitId).toArray();
    }
    return this.db.rooms.toArray();
  }

  async createRoom(data: Omit<Room, 'id' | 'createdAt' | 'updatedAt'>, actorId: number, actorRole: string): Promise<Room> {
    const now = new Date();
    const id = await this.db.rooms.add({ ...data, createdAt: now, updatedAt: now });
    const room = await this.db.rooms.get(id);
    this.audit.log(AuditAction.RULE_CHANGED, actorId, actorRole, 'room', id, undefined, room);
    return room!;
  }

  async updateRoom(id: number, data: Partial<Room>, actorId: number, actorRole: string): Promise<void> {
    const before = await this.db.rooms.get(id);
    await this.db.rooms.update(id, { ...data, updatedAt: new Date() });
    const after = await this.db.rooms.get(id);
    this.audit.log(AuditAction.RULE_CHANGED, actorId, actorRole, 'room', id, before, after);
  }

  // --------------------------------------------------
  // Occupancy — Move In
  // Only one active occupancy per resident at a time.
  // --------------------------------------------------

  async moveIn(params: {
    residentId: number;
    roomId: number;
    effectiveFrom: Date;
    reasonCode: MoveReasonCode;
    actorId: number;
    actorRole: string;
  }): Promise<Occupancy> {
    // Enforce: one active occupancy per resident
    const existing = await this.db.occupancies
      .filter(o => o.residentId === params.residentId && o.status === 'active')
      .first();

    if (existing) {
      throw new Error('RESIDENT_ALREADY_HAS_ACTIVE_OCCUPANCY');
    }

    const id = await this.db.occupancies.add({
      residentId:    params.residentId,
      roomId:        params.roomId,
      effectiveFrom: params.effectiveFrom,
      reasonCode:    params.reasonCode,
      status:        'active',
      createdAt:     new Date(),
    });

    const occupancy = await this.db.occupancies.get(id);

    this.audit.log(
      AuditAction.MOVE_IN,
      params.actorId,
      params.actorRole,
      'occupancy',
      id,
      undefined,
      occupancy,
    );

    return occupancy!;
  }

  // --------------------------------------------------
  // Occupancy — Move Out
  // --------------------------------------------------

  async moveOut(params: {
    residentId: number;
    effectiveTo: Date;
    reasonCode: MoveReasonCode;
    actorId: number;
    actorRole: string;
  }): Promise<void> {
    const active = await this.db.occupancies
      .filter(o => o.residentId === params.residentId && o.status === 'active')
      .first();

    if (!active?.id) throw new Error('NO_ACTIVE_OCCUPANCY');

    const before = { ...active };
    await this.db.occupancies.update(active.id, {
      effectiveTo: params.effectiveTo,
      reasonCode:  params.reasonCode,
      status:      'ended',
    });
    const after = await this.db.occupancies.get(active.id);

    this.audit.log(
      AuditAction.MOVE_OUT,
      params.actorId,
      params.actorRole,
      'occupancy',
      active.id,
      before,
      after,
    );
  }

  async getActiveOccupancy(residentId: number): Promise<Occupancy | undefined> {
    return this.db.occupancies
      .filter(o => o.residentId === residentId && o.status === 'active')
      .first();
  }

  async getOccupancyHistory(residentId: number): Promise<Occupancy[]> {
    return this.db.occupancies
      .filter(o => o.residentId === residentId)
      .sortBy('effectiveFrom');
  }

  // --------------------------------------------------
  // Room Occupants
  // --------------------------------------------------

  async getRoomOccupants(roomId: number): Promise<{ occupancy: Occupancy; resident: Resident }[]> {
    const activeOccupancies = await this.db.occupancies
      .filter(o => o.roomId === roomId && o.status === 'active')
      .toArray();

    const results = await Promise.all(
      activeOccupancies.map(async occ => {
        const resident = await this.db.residents.get(occ.residentId);
        return resident ? { occupancy: occ, resident } : null;
      }),
    );

    return results.filter(
      (r): r is { occupancy: Occupancy; resident: Resident } => r !== null,
    );
  }
}
