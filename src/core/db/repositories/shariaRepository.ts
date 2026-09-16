// ============================================================
// رِفق — ShariaText Repository (النصوص الشرعية)
// ============================================================

import { db } from '../schema';
import { BaseRepository } from './baseRepository';
import type { ShariaText, ShariaTextKind } from '../../types';

class ShariaRepository extends BaseRepository<ShariaText> {
  constructor() {
    super(db.shariaTexts);
  }

  async getByKind(kind: ShariaTextKind): Promise<ShariaText[]> {
    return this.table.where('kind').equals(kind).toArray();
  }

  async getByPath(pathId: string): Promise<ShariaText[]> {
    return this.table.where('pathId').equals(pathId).toArray();
  }

  async addText(
    kind: ShariaTextKind,
    text: string,
    source: string,
    opts?: { linkedNoteId?: string; pathId?: string }
  ): Promise<ShariaText> {
    return this.create({
      kind,
      text,
      source,
      linkedNoteId: opts?.linkedNoteId,
      pathId: opts?.pathId
    } as ShariaText);
  }
}

export const shariaRepository = new ShariaRepository();
