// ============================================================
// رِفق — Screen: المعرفة (Vault)
// ملاحظات Markdown (المصدر الوحيد للحقيقة)، مجلدات، وسوم،
// [[روابط داخلية]]، روابط عائدة، بحث، تصدير .md/zip.
// كل المنطق في الـstore — هنا عرض فقط.
// ============================================================

import { useEffect, useMemo, useState } from 'react';
import { useVaultStore } from '../../../core/store/useVaultStore';
import { voice } from '../../../i18n/voice';
import { Card, Button, Chip, EmptyState } from '../../components';
import { exportNotesZip, downloadNoteMarkdown } from '../../../utils/vaultExport';
import type { Note } from '../../../core/types';

const V = voice.vault;
const C = voice.common;

interface EditorState {
  id: string | null; // null = ملاحظة جديدة
  title: string;
  markdown: string;
  folderId?: string;
}

const EMPTY_EDITOR: EditorState = { id: null, title: '', markdown: '' };

/** محرر الملاحظة — عنوان + نص خام + وسوم مستخرجة + حفظ */
function NoteEditor({ initial, onClose }: { initial: EditorState; onClose: () => void }) {
  const createNote = useVaultStore((s) => s.createNote);
  const updateNote = useVaultStore((s) => s.updateNote);
  const indexes = useVaultStore((s) => s.indexes);

  const [title, setTitle] = useState(initial.title);
  const [markdown, setMarkdown] = useState(initial.markdown);

  const parsedTags = useMemo(() => {
    const idx = indexes.find((i) => i.noteId === initial.id);
    return idx?.tags ?? [];
  }, [indexes, initial.id]);

  const save = async () => {
    const t = title.trim() || 'ملاحظة بدون عنوان';
    if (initial.id) {
      await updateNote(initial.id, markdown, t, initial.folderId);
    } else {
      await createNote(t, markdown, initial.folderId);
    }
    onClose();
  };

  return (
    <Card title={initial.id ? V.edit : V.newNote} icon="📝">
      <div className="add-form">
        <input
          className="text-input"
          placeholder={V.noteTitle}
          aria-label={V.noteTitle}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <textarea
          className="text-input vault-editor"
          rows={10}
          placeholder={V.noteBody}
          aria-label={V.noteBody}
          value={markdown}
          onChange={(e) => setMarkdown(e.target.value)}
        />
        {parsedTags.length > 0 && (
          <div className="reason-chips">
            {parsedTags.map((tag) => (
              <Chip key={tag}>#{tag}</Chip>
            ))}
          </div>
        )}
        <div className="banner-actions">
          <Button onClick={() => void save()}>{V.save}</Button>
          <Button variant="ghost" onClick={onClose}>{V.cancel}</Button>
        </div>
      </div>
    </Card>
  );
}

/** روابط عائدة لملاحظة مفتوحة — مبنية من الـNoteIndex */
function Backlinks({ noteId, onOpen }: { noteId: string; onOpen: (note: Note) => void }) {
  const backlinks = useVaultStore((s) => s.backlinks);
  const notes = useVaultStore((s) => s.notes);
  const ids = backlinks[noteId] ?? [];
  const linkedNotes = ids
    .map((id) => notes.find((n) => n.id === id))
    .filter((n): n is Note => Boolean(n));

  return (
    <div className="backlinks">
      <p className="section-divider">{V.backlinks}</p>
      {linkedNotes.length === 0 ? (
        <p className="muted">{V.noBacklinks}</p>
      ) : (
        <div className="reason-chips">
          {linkedNotes.map((n) => (
            <button
              key={n.id}
              className="chip backlink-chip"
              onClick={() => onOpen(n)}
              title={V.openBacklink}
            >
              ↩ {n.title}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function VaultPage() {
  const notes = useVaultStore((s) => s.notes);
  const folders = useVaultStore((s) => s.folders);
  const indexes = useVaultStore((s) => s.indexes);
  const load = useVaultStore((s) => s.load);
  const deleteNote = useVaultStore((s) => s.deleteNote);
  const addFolder = useVaultStore((s) => s.addFolder);
  const deleteFolder = useVaultStore((s) => s.deleteFolder);
  const rebuildIndex = useVaultStore((s) => s.rebuildIndex);
  const linkedItemTitles = useVaultStore((s) => s.linkedItemTitles);

  const [folderId, setFolderId] = useState<string | null>(null); // null = الكل
  const [term, setTerm] = useState('');
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [openNoteId, setOpenNoteId] = useState<string | null>(null);
  const [newFolder, setNewFolder] = useState('');
  const [showFolderInput, setShowFolderInput] = useState(false);

  useEffect(() => {
    void load();
  }, [load]);

  // القائمة: بحث + تصفية بالمجلد — الأحدث أولًا
  const visibleNotes = useMemo(() => {
    let list = notes;
    if (folderId !== null) list = list.filter((n) => n.folderId === folderId);
    if (term.trim()) {
      const q = term.trim().toLowerCase();
      list = list.filter(
        (n) => n.title.toLowerCase().includes(q) || n.rawMarkdown.toLowerCase().includes(q)
      );
    }
    return list.sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''));
  }, [notes, folderId, term]);

  const openNote = notes.find((n) => n.id === openNoteId) ?? null;
  const indexFor = (id: string) => indexes.find((i) => i.noteId === id);

  // فتح ملاحظة من الروابط العائدة — ينقل للمحرر المفتوح
  const openBacklinkNote = (note: Note) => setOpenNoteId(note.id);

  const startEdit = (note: Note) => {
    setEditor({
      id: note.id,
      title: note.title,
      markdown: note.rawMarkdown,
      folderId: note.folderId
    });
    setOpenNoteId(null);
  };

  // عنوان الخطوة المرتبطة (محسوب في الـstore — بلا انتظار وعد أثناء العرض)
  const linkedTitleFor = (noteId: string) => linkedItemTitles[noteId];

  return (
    <section className="screen">
      <h2 className="screen-title">{V.title}</h2>

      {/* شريط الأدوات: بحث + إجراءات */}
      <Card>
        <input
          className="text-input"
          placeholder={V.searchPlaceholder}
          aria-label={V.searchPlaceholder}
          value={term}
          onChange={(e) => setTerm(e.target.value)}
        />
        <div className="banner-actions" style={{ marginTop: 'var(--space-2)', flexWrap: 'wrap' }}>
          <Button onClick={() => setEditor({ ...EMPTY_EDITOR, folderId: folderId ?? undefined })}>
            + {V.newNote}
          </Button>
          <Button variant="soft" onClick={() => void exportNotesZip()}>
            {V.exportZip}
          </Button>
          <Button variant="ghost" onClick={() => void rebuildIndex()}>
            {V.rebuild}
          </Button>
        </div>
      </Card>

      {/* المجلدات */}
      <Card title={V.foldersTitle} icon="🗂">
        <div className="reason-chips">
          <button
            className={`chip folder-chip${folderId === null ? ' folder-active' : ''}`}
            onClick={() => setFolderId(null)}
          >
            {V.allFolder} ({notes.length})
          </button>
          {folders.map((f) => {
            const count = notes.filter((n) => n.folderId === f.id).length;
            return (
              <span key={f.id} className="folder-item">
                <button
                  className={`chip folder-chip${folderId === f.id ? ' folder-active' : ''}`}
                  onClick={() => setFolderId(f.id)}
                >
                  🗂 {f.name} ({count})
                </button>
                {folderId === f.id && (
                  <button
                    className="folder-delete"
                    aria-label={`${C.delete} ${f.name}`}
                    title={C.delete}
                    onClick={() => {
                      void deleteFolder(f.id);
                      setFolderId(null);
                    }}
                  >
                    ×
                  </button>
                )}
              </span>
            );
          })}
        </div>
        {showFolderInput ? (
          <div className="form-row" style={{ marginTop: 'var(--space-2)' }}>
            <input
              className="text-input"
              placeholder={V.folderPlaceholder}
              aria-label={V.folderPlaceholder}
              value={newFolder}
              autoFocus
              onChange={(e) => setNewFolder(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  void addFolder(newFolder);
                  setNewFolder('');
                  setShowFolderInput(false);
                }
              }}
            />
            <Button
              variant="soft"
              onClick={() => {
                void addFolder(newFolder);
                setNewFolder('');
                setShowFolderInput(false);
              }}
            >
              {V.save}
            </Button>
          </div>
        ) : (
          <Button variant="ghost" onClick={() => setShowFolderInput(true)}>
            + {V.newFolder}
          </Button>
        )}
      </Card>
      {/* المحرر — ملاحظة جديدة أو تعديل */}
      {editor && <NoteEditor key={editor.id ?? 'new'} initial={editor} onClose={() => setEditor(null)} />}

      {/* الملاحظة المفتوحة — عرض + روابط عائدة */}
      {openNote && (
        <Card title={openNote.title} icon="📝">
          <div className="reason-chips" style={{ marginBottom: 'var(--space-2)' }}>
            <Button variant="soft" size="sm" onClick={() => startEdit(openNote)}>
              {V.edit}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => void downloadNoteMarkdown(openNote)}>
              {V.exportNote}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setOpenNoteId(null)}>
              {C.cancel}
            </Button>
          </div>

          {linkedTitleFor(openNote.id) && (
            <Chip>
              📎 {V.linkedPathItem} {linkedTitleFor(openNote.id)}
            </Chip>
          )}

          <pre className="vault-preview">{openNote.rawMarkdown}</pre>

          <Backlinks noteId={openNote.id} onOpen={openBacklinkNote} />
        </Card>
      )}


      {/* قائمة الملاحظات */}
      {visibleNotes.length === 0 ? (
        <EmptyState icon="📝">
          <strong>{V.noNotes}</strong>
          <br />
          {V.noResults}
        </EmptyState>
      ) : (
        visibleNotes.map((n) => {
          const idx = indexFor(n.id);
          const linkedTitle = linkedTitleFor(n.id);
          return (
            <Card key={n.id}>
              <div className="reason-chips" style={{ justifyContent: 'space-between' }}>
                <button
                  className="note-title-btn"
                  onClick={() => setOpenNoteId(n.id)}
                >
                  {n.title}
                </button>
                <div className="reason-chips">
                  <Button variant="ghost" size="sm" onClick={() => void downloadNoteMarkdown(n)}>
                    {V.exportNote}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => void deleteNote(n.id)}>
                    {C.delete}
                  </Button>
                </div>
              </div>
              {idx && idx.tags.length > 0 && (
                <div className="reason-chips" style={{ marginTop: 'var(--space-1)' }}>
                  {idx.tags.map((tag) => (
                    <Chip key={tag}>#{tag}</Chip>
                  ))}
                </div>
              )}
              {linkedTitle && (
                <p className="muted" style={{ marginTop: 'var(--space-1)', fontSize: '0.8em' }}>
                  ↳ {V.linkedPathItem} {linkedTitle}
                </p>
              )}
            </Card>
          );
        })
      )}
    </section>
  );
}

export default VaultPage;
