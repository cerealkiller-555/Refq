// ============================================================
// رِفق — Vault Store (الملاحظات، الـBacklinks، البحث)
// ============================================================

import { create } from 'zustand';
import {
  noteRepository,
  folderRepository,
  noteIndexRepository,
  pathItemRepository
} from '../db/repositories';
import { parseMarkdown, computeBacklinks } from '../../utils/markdown';
import type { Note, Folder, NoteIndex } from '../types';

interface VaultState {
  notes: Note[];
  folders: Folder[];
  indexes: NoteIndex[];
  backlinks: Record<string, string[]>;
  /** عناوين عناصر المسارات المرتبطة بملاحظات (noteId → itemTitle) — تُحسب في load */
  linkedItemTitles: Record<string, string>;
  load: () => Promise<void>;
  createNote: (title: string, markdown: string, folderId?: string) => Promise<void>;
  updateNote: (id: string, markdown: string, title?: string, folderId?: string) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
  addFolder: (name: string) => Promise<void>;
  deleteFolder: (id: string) => Promise<void>;
  rebuildIndex: () => Promise<void>;
  search: (term: string) => Promise<Note[]>;
  /** ربط ملاحظة بعنصر مسار تعليمي — أو فك الربط بـ null */
  linkNoteToPathItem: (noteId: string, pathItemId: string | null) => Promise<void>;
}

export const useVaultStore = create<VaultState>((set) => ({
  notes: [],
  folders: [],
  indexes: [],
  backlinks: {},
  linkedItemTitles: {},

  load: async () => {
    const [notes, folders, indexes, items] = await Promise.all([
      noteRepository.getAll(),
      folderRepository.getAll(),
      noteIndexRepository.getAll(),
      pathItemRepository.getAll()
    ]);
    const titlesById = Object.fromEntries(notes.map((n) => [n.id, n.title]));
    const backlinks = computeBacklinks(indexes, titlesById);
    // ربط الملاحظات بعناصر المسارات — يُحسب هنا حتى لا ننتظر وعدًا أثناء العرض
    const linkedItemTitles: Record<string, string> = {};
    for (const item of items) {
      if (item.linkedNoteId) linkedItemTitles[item.linkedNoteId] = item.title;
    }
    set({ notes, folders, indexes, backlinks, linkedItemTitles });
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

  updateNote: async (id, markdown, title, folderId) => {
    await noteRepository.updateMarkdown(id, markdown, title, folderId);
    const parsed = parseMarkdown(markdown, title ?? '');
    await noteIndexRepository.upsertForNote(id, {
      tags: parsed.tags,
      properties: parsed.properties,
      outboundLinks: parsed.outboundLinks
    });
    await useVaultStore.getState().load();
  },

  deleteNote: async (id) => {
    await noteRepository.deleteNote(id);
    await useVaultStore.getState().load();
  },

  addFolder: async (name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    await folderRepository.create({ name: trimmed } as Folder);
    await useVaultStore.getState().load();
  },

  deleteFolder: async (id) => {
    await folderRepository.deleteFolder(id);
    await useVaultStore.getState().load();
  },

  linkNoteToPathItem: async (noteId, pathItemId) => {
    if (pathItemId) {
      await pathItemRepository.update(pathItemId, { linkedNoteId: noteId });
    } else {
      // فك الربط من أي عنصر كان يشير لهذه الملاحظة
      const all = await pathItemRepository.getAll();
      const linked = all.filter((i) => i.linkedNoteId === noteId);
      for (const item of linked) {
        await pathItemRepository.update(item.id, { linkedNoteId: undefined });
      }
    }
  },

  rebuildIndex: async () => {
    await noteIndexRepository.rebuildAll(() => noteRepository.getAll());
    await useVaultStore.getState().load();
  },

  search: async (term) => {
    return noteRepository.searchByText(term);
  }
}));