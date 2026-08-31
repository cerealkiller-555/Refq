// ============================================================
// رِفق — Markdown Vault Parser
// يستخرج من rawMarkdown: tags, properties (Frontmatter), wikilinks
// Markdown = المصدر الوحيد للحقيقة. كل ما هنا مشتق قابل لإعادة البناء.
// ============================================================

export interface ParsedMarkdown {
  title: string; // أول Heading أو اسم الملف
  tags: string[];
  properties: Record<string, string>;
  outboundLinks: string[]; // عناوين [[...]]
}

/** استخراج Frontmatter YAML بسيط (بين --- في البداية) */
function parseFrontmatter(raw: string): { properties: Record<string, string>; rest: string } {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) return { properties: {}, rest: raw };

  const props: Record<string, string> = {};
  for (const line of match[1].split(/\r?\n/)) {
    const sep = line.indexOf(':');
    if (sep > 0) {
      const key = line.slice(0, sep).trim();
      const value = line.slice(sep + 1).trim().replace(/^["']|["']$/g, '');
      if (key) props[key] = value;
    }
  }
  return { properties: props, rest: raw.slice(match[0].length) };
}

/** وضع العناوين بأسلوب # Title */
function parseTitle(raw: string): string {
  const heading = raw.match(/^#\s+(.+)$/m);
  return heading ? heading[1].trim() : '';
}

/** وسوم #tag (بدون وسوم هاش من عناوين) */
function parseTags(rest: string): string[] {
  const matches = rest.match(/(?:^|\s)#([\p{L}\p{N}_-]+)/gu) ?? [];
  return Array.from(new Set(matches.map((m) => m.trim().slice(1))));
}

/** روابط داخلية [[Note Name]] أو [[Note Name|Alias]] */
function parseLinks(rest: string): string[] {
  const matches = rest.match(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g) ?? [];
  return Array.from(new Set(matches.map((m) => m.slice(2, -2).split('|')[0].trim())));
}

/**
 * يحلل نص Markdown خام وتُرجع كل المشتقات.
 * هذه هي الدالة التي تثبت أن rawMarkdown هو مصدر الحقيقة.
 */
export function parseMarkdown(raw: string, fallbackTitle = ''): ParsedMarkdown {
  const { properties, rest } = parseFrontmatter(raw);
  return {
    title: parseTitle(rest) || properties.title || fallbackTitle,
    tags: parseTags(rest),
    properties,
    outboundLinks: parseLinks(rest)
  };
}

/** حساب backlinks من مجموعة عقدات (تسمى keyed by noteId) */
export function computeBacklinks(
  indexes: Array<{ noteId: string; outboundLinks: string[] }>,
  titlesById: Record<string, string>
): Record<string, string[]> {
  const backlinks: Record<string, string[]> = {};
  for (const index of indexes) {
    for (const target of index.outboundLinks) {
      // ابحث عن noteId يحمل هذا العنوان
      const targetId = Object.keys(titlesById).find((id) => titlesById[id] === target);
      if (!targetId) continue;
      if (!backlinks[targetId]) backlinks[targetId] = [];
      backlinks[targetId].push(index.noteId);
    }
  }
  return backlinks;
}