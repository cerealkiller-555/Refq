// ============================================================
// رِفق — اختبارات Vault Markdown (P0.5)
// ============================================================

import { describe, it, expect } from 'vitest';
import {
  parseMarkdown,
  computeBacklinks
} from '../src/utils/markdown';

describe('Markdown Parser', () => {
  it('يستخرج العنوان من أول Heading', () => {
    const parsed = parseMarkdown('# فوائد سورة الكهف\n\nنص');
    expect(parsed.title).toBe('فوائد سورة الكهف');
  });

  it('يستخرج Frontmatter properties', () => {
    const parsed = parseMarkdown(
      '---\ntype: faida\npath: تفسير\n---\n# عنوان\n\nنص'
    );
    expect(parsed.properties.type).toBe('faida');
    expect(parsed.properties.path).toBe('تفسير');
  });

  it('يستخرج الوسوم #tag', () => {
    const parsed = parseMarkdown('# عنوان\n\nهذا نص فيه #صبر و #تواضع');
    expect(parsed.tags).toContain('صبر');
    expect(parsed.tags).toContain('تواضع');
  });

  it('يستخرج الروابط الداخلية [[..]]', () => {
    const parsed = parseMarkdown('# عنوان\n\nانظر [[فضل الصبر]] و[[التواضع|أيضًا]]');
    expect(parsed.outboundLinks).toContain('فضل الصبر');
    expect(parsed.outboundLinks).toContain('التواضع');
    expect(parsed.outboundLinks).not.toContain('التواضع|أيضًا');
  });

  it('يستخرج عنوانًا من properties عند غياب Heading', () => {
    const parsed = parseMarkdown(
      '---\ntitle: ملاحظة بدون عنوان\n---\n\nنص مباشر'
    );
    expect(parsed.title).toBe('ملاحظة بدون عنوان');
  });
});

describe('Backlinks', () => {
  it('يحسب backlinks صحيحة بين الملاحظات', () => {
    const indexes = [
      { noteId: 'n1', outboundLinks: ['فضل الصبر'] },
      { noteId: 'n2', outboundLinks: ['فضل الصبر'] },
      { noteId: 'n3', outboundLinks: ['شيء آخر'] }
    ];
    const titlesById = {
      n1: 'فضل الصبر',
      n2: 'ملاحظة أخرى',
      n3: 'ثالثة'
    };
    const backlinks = computeBacklinks(indexes, titlesById);
    // من يقوم بالإشارة إلى 'فضل الصبر' (n1)
    expect(backlinks['n1']).toContain('n2');
    // لا أحد يشير إلى n3
    expect(backlinks['n3']).toBeUndefined();
  });
});