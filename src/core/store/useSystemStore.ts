// ============================================================
// رِفق — System Store (الإعدادات، النصوص، النسخ الاحتياطي)
// ============================================================

import { create } from 'zustand';
import { settingsRepository, shariaTextRepository } from '../db/repositories';
import { exportAll, importAll, deleteAllData } from '../../utils/backup';
import type { Settings, ShariaText, BackupSnapshot } from '../types';

interface SystemState {
  settings: Settings | null;
  shariaTexts: ShariaText[];
  loadSettings: () => Promise<void>;
  updateSettings: (changes: Partial<Settings>) => Promise<void>;
  loadShariaTexts: () => Promise<void>;
  addShariaText: (text: Omit<ShariaText, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  exportBackup: () => Promise<BackupSnapshot>;
  importBackup: (snapshot: BackupSnapshot) => Promise<string[]>;
  deleteAll: () => Promise<void>;
}

export const useSystemStore = create<SystemState>((set) => ({
  settings: null,
  shariaTexts: [],

  loadSettings: async () => {
    const settings = await settingsRepository.get();
    set({ settings });
  },

  updateSettings: async (changes) => {
    const settings = await settingsRepository.update(changes);
    set({ settings });
  },

  loadShariaTexts: async () => {
    const shariaTexts = await shariaTextRepository.getAll();
    set({ shariaTexts });
  },

  addShariaText: async (text) => {
    await shariaTextRepository.create(text as ShariaText);
    const shariaTexts = await shariaTextRepository.getAll();
    set({ shariaTexts });
  },

  exportBackup: async () => exportAll(),

  importBackup: async (snapshot) => {
    const imported = await importAll(snapshot);
    return imported;
  },

  deleteAll: async () => {
    await deleteAllData();
  }
}));