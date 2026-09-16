// ============================================================
// رِفق — تصدير ملاحظات المعرفة (ملفات .md حقيقية داخل zip)
// rawMarkdown هو المصدر الوحيد — الملف المُصدَّر هو الملاحظة نفسها،
// قابلة للفتح في أي محرر Markdown (Obsidian وغيره).
// ============================================================

import JSZip from 'jszip';
import { noteRepository, folderRepository } from '../core/db/repositories';
import type { Note } from '../core/types';

/** تنظيف اسم الملف من المحارف غير الصالحة */
export function sanitizeFileName(title: string): string {
  const clean = (title || 'ملاحظة').replace(/[\\/:*?"<>|]/g, '-').trim();
  return clean || 'ملاحظة';
}

/** تجميع كل الملاحظات في ملف zip — مجلد لكل Folder، وملف .md لكل ملاحظة */
export async function buildNotesZip(): Promise<Blob> {
  const [notes, folders] = await Promise.all([
    noteRepository.getAll(),
    folderRepository.getAll()
  ]);
  const folderNameById = new Map(folders.map((f) => [f.id, f.name]));

  const zip = new JSZip();
  const usedPaths = new Set<string>();

  for (const note of notes as Note[]) {
    const folder = note.folderId ? folderNameById.get(note.folderId) : undefined;
    let name = `${sanitizeFileName(note.title)}.md`;
    let path = folder ? `${folder}/${name}` : name;
    let i = 2;
    while (usedPaths.has(path)) {
      name = `${sanitizeFileName(note.title)} (${i++}).md`;
      path = folder ? `${folder}/${name}` : name;
    }
    usedPaths.add(path);
    // الملف نفسه هو الملاحظة — rawMarkdown كما هو، بلا أي تحويل
    zip.file(path, note.rawMarkdown);
  }

  return zip.generateAsync({ type: 'blob' });
}

/** تنزيل أي Blob عبر المتصفح */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** تصدير كل الملاحظات كـ zip واحد */
export async function exportNotesZip(): Promise<void> {
  const blob = await buildNotesZip();
  downloadBlob(blob, `refq-vault-${new Date().toISOString().slice(0, 10)}.zip`);
}

/** تنزيل ملاحظة واحدة كملف .md */
export function downloadNoteMarkdown(note: Note): void {
  const blob = new Blob([note.rawMarkdown], { type: 'text/markdown;charset=utf-8' });
  downloadBlob(blob, `${sanitizeFileName(note.title)}.md`);
}