// ============================================================
// رِفق — Heart Repository (Reflections, Health Check-in)
// ============================================================

import { db } from '../schema';
import { BaseRepository } from './baseRepository';
import type { ReflectionEntry, EnergyCheckin } from '../../types';
import { localDateKey } from '../../../utils';

class ReflectionRepository extends BaseRepository<ReflectionEntry> {
  constructor() {
    super(db.reflections);
  }

  async getByKind(kind: ReflectionEntry['kind']): Promise<ReflectionEntry[]> {
    return this.table.where('kind').equals(kind).toArray();
  }

  async getByDate(date: string, kind?: ReflectionEntry['kind']): Promise<ReflectionEntry[]> {
    const base = this.table.where('date').equals(date);
    const results = await base.toArray();
    return kind ? results.filter((r) => r.kind === kind) : results;
  }

  async addEntry(
    kind: ReflectionEntry['kind'],
    answers: Record<string, string>,
    opts?: { linkedPathItemId?: string; skipped?: boolean }
  ): Promise<ReflectionEntry> {
    return this.create({
      kind,
      date: new Date().toISOString().slice(0, 10),
      answers,
      skipped: opts?.skipped ?? false,
      linkedPathItemId: opts?.linkedPathItemId
    } as ReflectionEntry);
  }
}

class EnergyCheckinRepository extends BaseRepository<EnergyCheckin> {
  constructor() {
    super(db.energyCheckins);
  }

  /** إدخال اليوم (يستبدل السابق إن وجد) */
  async upsertToday(level: EnergyCheckin['level'], note?: string, wantsLightDay = false): Promise<EnergyCheckin> {
    const today = localDateKey();
    const existing = await this.table.where('date').equals(today).first();
    if (existing) {
      return this.update(existing.id, { level, note, wantsLightDay }) as Promise<EnergyCheckin>;
    }
    return this.create({
      date: today,
      level,
      note,
      wantsLightDay
    } as EnergyCheckin);
  }

  async getToday(): Promise<EnergyCheckin | undefined> {
    const today = localDateKey();
    return this.table.where('date').equals(today).first();
  }
}

export const reflectionRepository = new ReflectionRepository();
export const energyCheckinRepository = new EnergyCheckinRepository();