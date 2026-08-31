# رِفق — Final Architecture & Implementation Plan

**Stack المعتمد:** React + Vite + TypeScript + PWA + Dexie (IndexedDB) + Zustand + Supabase (Auth + Sync)

**تحديث معماري:** تقرر إضافة مزامنة تلقائية عبر أكتر من جهاز. Dexie هيفضل هو الطبقة المحلية (offline-first)، وSupabase هيبقى المصدر السحابي اللي بيتزامن معاه. انظر قسم 1.6 و5 (P2) للتفاصيل.

---

# 1. Final Architecture

## 1.1 المبدأ المعماري الأساسي

```
UI Layer (React Components)
        ↓
State Layer (Zustand stores — واحد لكل domain)
        ↓
Domain Engines (Priority / Suggestion / Recovery) — pure functions
        ↓
Data Layer (Repositories) — الطبقة الوحيدة اللي بتلمس Dexie
        ↓
Storage (IndexedDB via Dexie)
```

**قاعدة صارمة:** الـUI ماينفعش يتكلم مع Dexie مباشرة. كل حاجة بتعدي من خلال Repository functions. ده بيخلي أي تغيير مستقبلي في طريقة التخزين (حتى لو غيرت من Dexie لحاجة تانية) ما يكسرش الـUI.

## 1.2 حل مشكلة "Markdown = المصدر الأصلي" داخل المتصفح

نقطة مهمة لازم تكون واضحة من الأول: المتصفح مايقدرش يتعامل مع ملفات Markdown حقيقية على الجهاز بشكل تلقائي وموثوق عبر كل المنصات (File System Access API متاحة على Chrome/Edge بس، مش على كل المتصفحات أو الموبايل).

**الحل المعماري:**

- كل Note في Dexie بيتخزن فيها الـ**raw markdown text كامل كما هو** (مش نسخة معالجة أو مجزأة). العمود اسمه `rawMarkdown` وهو **المصدر الوحيد للحقيقة**.
- أي بيانات مشتقة (tags، properties، wikilinks، backlinks) بتتستخرج من `rawMarkdown` وقت الحفظ وتتخزن في جداول/أعمدة منفصلة **كـcache قابل لإعادة البناء بالكامل** من الـrawMarkdown في أي وقت.
- زرار "إعادة بناء الفهرس" (Rebuild Index) في الإعدادات بيمسح كل الـcache ده ويعيد استخراجه من الـrawMarkdown — ده بيثبت عمليًا إن الـMarkdown هو المصدر الحقيقي مش Dexie.
- الـExport الحقيقي (قسم 12 في خطتك) بيولّد ملفات `.md` فعلية للتنزيل (باستخدام مكتبة zip) بحيث لو حد فتح الملفات دي في أي Markdown editor تاني (Obsidian مثلاً) هتشتغل عادي.

كده انت محقق مبدأ "Markdown = SOT" فعليًا وليس شكليًا، من غير ما تحتاج File System API غير مستقرة عبر المنصات.

## 1.3 الـModules الرئيسية

| Module | المسؤولية |
|---|---|
| `today` | Energy check-in, ماذا أفعل الآن, Top priorities, Quick capture |
| `planning` | Tasks, Backlog, Calendar, Fixed/Flexible events, Replanning |
| `learning` | LearningPath, PathItem tree, Sessions, Next step |
| `vault` | Notes, Folders, Tags, Links, Search, Export |
| `heart` | أثر, فتش عن قلبك, وقفة, محاسبة |
| `system` | Settings, Backup/Import/Export, Delete data |

## 1.4 الـEngines (منطق مستقل عن الـUI)

هذه أهم نقطة معمارية — كل واحد فيهم **pure function** بياخد state ويرجع نتيجة، بدون side effects، عشان يبقى قابل للاختبار بسهولة تامة:

- **PriorityEngine**: بياخد قائمة Tasks/PathItems ويرجعها مرتبة (أهمية × إلحاح، انظر قسم 5).
- **SuggestionEngine**: بياخد الوقت المتاح + الطاقة + الـpriority list ويرجع اقتراح واحد بس (أو لا شيء).
- **RecoveryEngine**: بياخد يوم فائت ويقترح إعادة توزيع بدون ما يحرك fixed events.

## 1.6 Sync Architecture (متعدد الأجهزة)

**القرار:** المستخدمة عايزة تستخدم رِفق على أكتر من جهاز مع مزامنة تلقائية. ده بيضيف طبقة جديدة فوق كل حاجة بنيناها، لكن من غير ما يكسر مبدأ Local-first.

```
Local (Dexie) ←→ SyncEngine ←→ Supabase (Postgres + Realtime + Auth)
```

- **Dexie يفضل هو المصدر اللي الـUI بتتعامل معاه مباشرة** — أي عملية (قراءة/كتابة) بتحصل محليًا الأول، فالتطبيق شغال حتى من غير نت (offline-first محفوظ).
- **SyncEngine** طبقة منفصلة (مش جزء من الـUI ولا الـRepositories) مسؤوليتها بس:
  - لما يكون فيه نت: تبعت أي تغيير محلي جديد (queue) لـSupabase.
  - تستقبل تغييرات من أجهزة تانية (عبر Supabase Realtime) وتحدّث Dexie.
- **حل التعارضات:** كل سجل عنده `updatedAt`. لو نفس السجل اتعدل على جهازين وهما offline، اللي وقته أحدث (`updatedAt` الأكبر) بيكسب — استراتيجية بسيطة (Last-Write-Wins) كافية لـMVP، وممكن تتطور لاحقًا لو احتجنا دمج أدق على مستوى الحقل الواحد.
- **Auth:** تسجيل دخول بسيط (Email + Password أو Magic Link عبر Supabase Auth) — الحساب ده بس عشان يربط أجهزتك ببعض، مش بوابة اشتراك أو دفع.
- **Data Ownership لسه محفوظ:** بيانات Supabase تصديرها متاح بالكامل (نفس آلية Export في قسم 12)، ومفيش قفل على المنصة — أي وقت تقدري تاخدي بياناتك وتمشي.

### تأثير القرار على الـData Model (قسم 2)

عشان المزامنة تشتغل صح، كل الجداول لازم:
- الـ`id` يبقى **UUID** مش رقم متتالي (عشان أجهزة مختلفة توّلد IDs من غير تعارض وهي offline).
- كل سجل يضاف له `updatedAt: Date` (لحل التعارضات) و`deletedAt?: Date` (soft-delete بدل الحذف الفعلي، عشان الحذف نفسه يتزامن صح بين الأجهزة).

ده بيتضاف من P0 حتى لو الـSyncEngine نفسه بيتبني في مرحلة لاحقة (P2) — رخيص نعمله دلوقتي، مكلف نرجعله بعدين.

## 1.5 State Management (Zustand)

Store واحد منفصل لكل domain، مش store عملاق واحد:

```
useTodayStore, usePlanningStore, useLearningStore,
useVaultStore, useHeartStore, useSystemStore
```

كل store بيستدعي الـRepository functions، مش Dexie مباشرة.

---

# 2. Final Data Model

```typescript
// ===== Planning =====
Task {
  id, title, description?,
  importance: 'high' | 'low',
  urgency: 'high' | 'low',
  estimatedDuration: number, // minutes
  deadline?: Date,
  status: 'todo' | 'in_progress' | 'done',
  linkedPathItemId?: string,
  createdAt, updatedAt
}

CalendarEvent {
  id, title,
  kind: 'fixed' | 'flexible',
  start: Date, end: Date,
  recurring?: { freq: 'daily'|'weekly', until?: Date },
  linkedTaskId?: string,
  linkedSessionId?: string
}

// ===== Learning =====
LearningPath {
  id, title, description?,
  type: 'university' | 'course' | 'sharia_course' | 'book' | 'quran' | 'sharia_knowledge',
  status: 'active' | 'paused' | 'done',
  order: number, createdAt
}

PathItem {
  id, pathId, parentId?, // tree structure
  title, order,
  estimatedDuration?: number,
  deadline?: Date,
  status: 'todo' | 'in_progress' | 'done',
  linkedNoteId?: string,
  createdAt, updatedAt
}

Session {
  id, pathItemId, date,
  durationMinutes: number,
  note?: string
}

// ===== Vault =====
Note {
  id, title,
  rawMarkdown: string, // المصدر الوحيد للحقيقة
  folderId?: string,
  createdAt, updatedAt
}

// derived/cached — قابلة لإعادة البناء بالكامل من rawMarkdown
NoteIndex {
  noteId,
  tags: string[],
  properties: Record<string, string>,
  outboundLinks: string[], // note titles/ids من [[...]]
}

Folder { id, name, parentId? }

// ===== Heart =====
ReflectionEntry {
  id,
  kind: 'athar' | 'search_heart' | 'waqfa' | 'muhasaba',
  date,
  linkedPathItemId?: string,
  answers: Record<string, string>,
  skipped: boolean
}

// ===== System =====
EnergyCheckin {
  id, date,
  level: 'low' | 'medium' | 'high',
  note?: string,
  wantsLightDay: boolean
}

ShariaText {
  id,
  kind: 'ayah' | 'hadith' | 'scholar_quote' | 'faida' | 'tarif',
  text: string,
  source: string,
  linkedNoteId?: string
}

BackupSnapshot {
  id, createdAt,
  schemaVersion: number,
  data: <كل الجداول أعلاه>
}
```

**ملاحظة مهمة:** كل الـtypes دي union types بسيطة (string literals) مش enums منفصلة، عشان تقدر تضيف نوع جديد (زي نوع سابع لمسار تعليمي) من غير تعديل بنية قاعدة البيانات — فقط تعديل الـtype union.

---

# 3. Folder Structure

```
src/
  app/
    App.tsx
    router.tsx
    layout/

  features/
    today/
      components/
      TodayPage.tsx
    planning/
      components/
      TasksPage.tsx
      CalendarPage.tsx
    learning/
      components/
      LearningPage.tsx
    vault/
      components/
      VaultPage.tsx
    heart/
      components/
      HeartPage.tsx
    system/
      SettingsPage.tsx

  core/
    db/
      schema.ts          // Dexie schema definition
      repositories/
        taskRepository.ts
        calendarRepository.ts
        learningRepository.ts
        vaultRepository.ts
        heartRepository.ts
        systemRepository.ts
    engines/
      priorityEngine.ts
      suggestionEngine.ts
      recoveryEngine.ts
    store/
      useTodayStore.ts
      usePlanningStore.ts
      useLearningStore.ts
      useVaultStore.ts
      useHeartStore.ts
      useSystemStore.ts
    types/
      index.ts

  components/            // UI مشتركة (Button, Card, Modal...)
  utils/
    markdown.ts           // parse/extract من rawMarkdown
    backup.ts              // export/import/zip

public/
  manifest.json
  icons/
  sw.js (service worker للـPWA)

tests/
  engines/
  repositories/
  components/
```

---

# 4. MVP Scope

هذا ملخص لما اتفقنا عليه في خطتك — بدون تغيير:

- 🏠 **اليوم**: Today, Energy check-in, Top priorities, ماذا أفعل الآن، Focus session, Quick capture
- 📅 **التخطيط**: Tasks, Backlog, Calendar Day/Week, Fixed/Flexible events, Deadlines, Manual replanning
- 📚 **التعلم**: LearningPath موحد، الأنواع الستة، PathItems، Sessions، Notes، Next step
- 🧠 **المعرفة**: Markdown Vault (Notes, Tags, Properties, Wikilinks, Backlinks, Search, Export)
- 🤍 **القلب**: أثر مختصر، فتش عن قلبك، وقفة مختصرة، محاسبة اختيارية
- ⚙️ **النظام**: Dexie، Zustand، PWA، Import/Export، Delete data، Tests

---

# 5. P0 Implementation Plan

تنفيذ تدريجي — كل مرحلة لازم تشتغل وتتاختبر قبل ما ننتقل للي بعدها.

### P0 — الأساس (Infrastructure)
- إعداد Vite + React + TypeScript + PWA plugin
- Dexie schema كامل (كل الجداول في قسم 2) + migrations skeleton
- Zustand stores فاضية (skeleton) لكل domain
- Routing + Layout أساسي (شريط تنقل بين الأقسام الستة)
- Design tokens أساسية (ألوان، خطوط، مسافات)
- **اختبار المرحلة:** التطبيق يفتح كـPWA، يتثبت على الموبايل، Dexie بتتفتح وتتقفل صح، كل صفحة فاضية بس موجودة.

### P1 — Tasks + Today الأساسي
- Task CRUD كامل (repository + store + UI)
- Energy check-in
- PriorityEngine (نسخة أولى بسيطة — قسم 6 تحت)
- SuggestionEngine ("ماذا أفعل الآن؟" بنسخته الأولى)
- Quick capture
- **اختبار المرحلة:** تقدر تضيف مهام فعلية وتستخدم "ماذا أفعل الآن؟" يوميًا فعلاً.

### P2 — Calendar
- CalendarEvent CRUD (Fixed/Flexible)
- Day/Week views
- ربط Tasks بـCalendar
- RecoveryEngine (إعادة التوزيع بعد يوم ضائع)
- **اختبار المرحلة:** تقدر تخطط أسبوعك وتشوف الـreplanning شغال صح.

### P3 — Learning
- LearningPath + PathItem tree CRUD
- Sessions
- ربط PathItem بالـSuggestionEngine (يدخل في "ماذا أفعل الآن؟")
- Next step logic
- **اختبار المرحلة:** تقدر تضيف مسار تعليمي فعلي وتتابعه.

### P4 — Vault
- Note CRUD + rawMarkdown editor بسيط
- Folders + Tags + Properties
- Wikilinks `[[...]]` + Backlinks (مبنية من الـNoteIndex)
- Search أساسي (full-text على rawMarkdown)
- Export (.md files + zip)
- ربط Note بـPathItem
- **اختبار المرحلة:** تقدر تاخد ملاحظات فعلية وتربطها بالتعلم وتصدرها.

### P5 — Heart
- أثر (بعد إنجاز PathItem)
- فتش عن قلبك (سؤال دوري)
- وقفة (أسبوعي)
- محاسبة (اختياري)
- ShariaText CRUD بسيط
- **اختبار المرحلة:** الأسئلة بتظهر في وقتها المناسب ومفيش ضغط أو تقييم.

### P6 — System Polish
- Full Backup/Import/Export (versioned schema)
- Delete all data
- Rebuild Index (لإثبات إن Markdown هو SOT)
- مراجعة شاملة لمبدأ "التعافي" (قسم 6 في خطتك) عبر كل الموديولز
- **اختبار المرحلة:** تقدر تصدّر بياناتك بالكامل وتستوردها في نسخة تانية من التطبيق بدون فقد بيانات.

---

# 6. Testing Strategy

بما إن الوقت مش عامل ضاغط، الأفضل اختبار شامل في كل مرحلة قبل الانتقال للي بعدها:

## 6.1 Unit Tests — الأهم والأسهل
الـEngines (Priority, Suggestion, Recovery) دوال pure، فهي أسهل حاجة تتاختبر:
```
priorityEngine.test.ts:
  - مهمة عاجلة+مهمة تطلع الأول من مهمة مش عاجلة وغير مهمة
  - مهمة deadline قريب تتقدم حتى لو أهمية أقل
  - ... (test cases واضحة ومحددة)

suggestionEngine.test.ts:
  - وقت متاح 30 دقيقة + مهمة تاخد 30 دقيقة بالظبط = تترشح
  - لا يوجد وقت كافي لأي حاجة = "لا توجد مهمة تستحق..."
  - طاقة منخفضة = يفضل مهام أخف

recoveryEngine.test.ts:
  - يوم فائت فيه مهام مش fixed = تتوزع على الأيام الجاية
  - fixed events متتحركش أبدًا
```

## 6.2 Repository Tests
باستخدام `fake-indexeddb` (مكتبة بتحاكي IndexedDB في بيئة الاختبار من غير متصفح فعلي):
- كل repository function بتتاختبر: create/read/update/delete + edge cases

## 6.3 Component Tests
React Testing Library لأهم الـflows:
- إضافة Task من الـUI لحد ما يظهر في القائمة
- "ماذا أفعل الآن؟" بيعرض الاقتراح الصح
- Note editor بيحفظ ويعرض backlinks صح

## 6.4 Manual Checklist لكل مرحلة
قبل ما تعتبر مرحلة "مستقرة" وتنتقل للي بعدها، تأكد:
- [ ] كل الـtests الأوتوماتيك عدّت
- [ ] استخدمت الفيتشر فعليًا لمدة يوم/أسبوع حسب المرحلة
- [ ] مفيش console errors
- [ ] الداتا بترجع صح بعد refresh للصفحة (persistence شغالة)

---

## القرار

هذا هو الأساس المعماري الكامل. الخطوة التالية بعد موافقتك: البدء الفعلي في **P0** فقط — إعداد المشروع والـschema والـskeleton، من غير أي UI حقيقي بعد.