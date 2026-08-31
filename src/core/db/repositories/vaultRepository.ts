// ============================================================
// رِفق — Vault Repository (Notes, Folders, NoteIndex)
// Markdown = المصدر الوحيد للحقيقة. NoteIndex هو cache قابل لإعادة البناء.
// ============================================================

import { db } from '../schema';
import { BaseRepository } from './baseRepository';
import { parseMarkdown } from '../../../utils/markdown';
import type { Note, Folder, NoteIndex } from '../../types';

class NoteRepository extends BaseRepository<Note> {
  constructor() {
    super(db.notes);
  }

  async createNote(title: string, rawMarkdown: string, folderId?: string): Promise<Note> {
    return this.create({
      title,
      rawMarkdown,
      folderId
    } as Note);
  }

  /** تحديث Markdown — التغيير الجوهري، يلمس المصدر فقط */
  async updateMarkdown(id: string, rawMarkdown: string, title?: string): Promise<Note | undefined> {
    return this.update(id, { rawMarkdown, title } as Partial<Note>);
  }

  async getByFolder(folderId?: string): Promise<Note[]> {
    if (!folderId) {
      return this.table.filter((n) => !n.folderId).toArray();
    }
    return this.table.where('folderId').equals(folderId).toArray();
  }

  async searchByText(term: string): Promise<Note[]> {
    const lower = term.toLowerCase();
    return this.table
      .filter(
        (n) =>
          n.title.toLowerCase().includes(lower) ||
          n.rawMarkdown.toLowerCase().includes(lower)
      )
      .toArray();
  }
}

class FolderRepository extends BaseRepository<Folder> {
  constructor() {
    super(db.folders);
  }

  async getByName(name: string): Promise<Folder | undefined> {
    return this.table.where('name').equals(name).first();
  }

  async getChildren(folderId?: string): Promise<Folder[]> {
    if (!folderId) {
      return this.table.filter((f) => !f.parentId).toArray();
    }
    return this.table.where('parentId').equals(folderId).toArray();
  }
}

class NoteIndexRepository {
  constructor(private readonly table: typeof db.noteIndexes) {}

  async getAll(): Promise<NoteIndex[]> {
    return this.table.toArray();
  }

  async getByNote(noteId: string): Promise<NoteIndex | undefined> {
    return this.table.get(noteId);
  }

  async upsertForNote(noteId: string, index: Omit<NoteIndex, 'noteId' | 'updatedAt'>): Promise<void> {
    await this.table.put({
      noteId,
      ...index,
      updatedAt: new Date().toISOString()
    } as NoteIndex);
  }

  /** إعادة بناء كاملة — تستدعيها ميزة "Reindex" وتثبت أن rawMarkdown هو المصدر */
  async rebuildAll(getNotes: () => Promise<Note[]>): Promise<void> {
    const notes = await getNotes();
    await this.table.clear();

    for (const note of notes) {
      const parsed = parseMarkdown(note.rawMarkdown, note.title);
      await this.upsertForNote(note.id, {
        tags: parsed.tags,
        properties: parsed.properties,
        outboundLinks: parsed.outboundLinks
      });
    }
  }
}

export const noteRepository = new NoteRepository();
export const folderRepository = new FolderRepository();
export const noteIndexRepository = new NoteIndexRepository(db.noteIndexes);