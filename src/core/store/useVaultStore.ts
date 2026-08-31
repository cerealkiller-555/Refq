// ============================================================
// رِفق — Vault Store (الملاحظات، الـBacklinks، البحث)
// ============================================================

import { create } from 'zustand';
import { noteRepository, folderRepository, noteIndexRepository } from '../db/repositories';
import { parseMarkdown, computeBacklinks } from '../../utils/markdown';
import type { Note, Folder, NoteIndex } from '../types';

interface VaultState {
  notes: Note[];
  folders: Folder[];
  indexes: NoteIndex[];
  backlinks: Record<string, string[]>;
  load: () => Promise<void>;
  createNote: (title: string, markdown: string, folderId?: string) => Promise<void>;
  updateNote: (id: string, markdown: string, title?: string) => Promise<void>;
  rebuildIndex: () => Promise<void>;
  search: (term: string) => Promise<Note[]>;
}

export const useVaultStore = create<VaultState>((set) => ({
  notes: [],
  folders: [],
  indexes: [],
  backlinks: {},

  load: async () => {
    const [notes, folders, indexes] = await Promise.all([
      noteRepository.getAll(),
      folderRepository.getAll(),
      noteIndexRepository.getAll()
    ]);
    const titlesById = Object.fromEntries(notes.map((n) => [n.id, n.title]));
    const backlinks = computeBacklinks(indexes, titlesById);
    set({ notes, folders, indexes, backlinks });
  },

  createNote: async (title, markdown, folderId) => {
    await noteRepository.createNote(title, markdown, folderId);
    await noteIndexRepository.upsertForNote((await noteRepository.searchByText(title))[0]?.id ?? '', {
      tags: parseMarkdown(markdown, title).tags,
      properties: parseMarkdown(markdown, title).properties,
      outboundLinks: parseMarkdown(markdown, title).outboundLinks
    });
    await useVaultStore.getState().load();
  },

  updateNote: async (id, markdown, title) => {
    await noteRepository.updateMarkdown(id, markdown, title);
    const parsed = parseMarkdown(markdown, title ?? '');
    await noteIndexRepository.upsertForNote(id, {
      tags: parsed.tags,
      properties: parsed.properties,
      outboundLinks: parsed.outboundLinks
    });
    await useVaultStore.getState().load();
  },

  rebuildIndex: async () => {
    await noteIndexRepository.rebuildAll(() => noteRepository.getAll());
    await useVaultStore.getState().load();
  },

  search: async (term) => {
    return noteRepository.searchByText(term);
  }
}));