// ============================================================
// رِفق — System Repository (Settings, ShariaText)
// ============================================================

import { db } from '../schema';
import { BaseRepository } from './baseRepository';
import type { Settings, ShariaText } from '../../types';

class SettingsRepository {
  constructor(private readonly table: typeof db.settings) {}

  /** قراءة الإعدادات مع إنشاء افتراضية إن لم توجد */
  async get(): Promise<Settings> {
    const existing = await this.table.get('main');
    if (existing) return existing;
    const defaults: Settings = {
      id: 'main',
      direction: [],
      notifyPrefs: {
        remindersEnabled: true,
        atarFollowUp: true,
        heartCheck: true,
        waqfa: true
      },
      onboardingDone: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await this.table.put(defaults);
    return defaults;
  }

  async update(changes: Partial<Settings>): Promise<Settings> {
    const current = await this.get();
    const merged: Settings = {
      ...current,
      ...changes,
      updatedAt: new Date().toISOString()
    };
    await this.table.put(merged);
    return merged;
  }

  async setOnboardingDone(): Promise<Settings> {
    return this.update({ onboardingDone: true });
  }
}

class ShariaTextRepository extends BaseRepository<ShariaText> {
  constructor() {
    super(db.shariaTexts);
  }

  async getByKind(kind: ShariaText['kind']): Promise<ShariaText[]> {
    return this.table.where('kind').equals(kind).toArray();
  }

  async search(term: string): Promise<ShariaText[]> {
    const lower = term.toLowerCase();
    return this.table
      .filter((s) => s.text.toLowerCase().includes(lower) || s.source.toLowerCase().includes(lower))
      .toArray();
  }
}

export const settingsRepository = new SettingsRepository(db.settings);
export const shariaTextRepository = new ShariaTextRepository();