// رِفق — إعداد بيئة الاختبارات
// يجهّز fake-indexeddb لاختبارات طبقة البيانات (Dexie) خارج المتصفح
import 'fake-indexeddb/auto';

// توافق jsdom مع التنقل: react-router ينشئ Request مع AbortSignal عند كل
// تنقّل، وjsdom يوفّر AbortController خاصًا به بينما Request العالمي هنا من
// undici (Node) يرفض أي signal غير خاص به. نُسقط signal من كل init (بيئة
// الاختبار فقط) — ثم يمدّد Request إشارة داخلية سليمة. المتصفح الحقيقي
// متوافق أصلًا ولا يتأثر.
const OriginalRequest = globalThis.Request;
if (OriginalRequest) {
  class CompatRequest extends OriginalRequest {
    constructor(input: RequestInfo | URL, init?: RequestInit) {
      let safeInit = init;
      if (init?.signal) {
        const { signal: _signal, ...rest } = init;
        safeInit = rest;
      }
      super(input, safeInit);
    }
  }
  globalThis.Request = CompatRequest as unknown as typeof Request;
}
