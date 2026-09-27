// ============================================================
// رِفق — قناة تغييرات الخطوات التعليمية (منفصلة تمامًا عن دورة حياة المهمة)
// الكاتب الوحيد لخطوات المسارات هو useLearningStore: كل عملية كتابة فيه
// (إضافة/تعديل/حذف/تغيير حالة/إنجاز) تُنشَر هنا بعد الكتابة الفعلية في الـDB
// وبعد تحديث الحالة المحمّلة. المستجيب مسؤول عن القراءات فقط — لا يكتب بيانات أبدًا (لا حلقة).
// ============================================================

/** أنواع التغيّر المنشور — كل تغيّر يُنشر مرة واحدة لكل عملية */
export type LearningChangeType =
  | 'completed' // إنجاز خطوة (نقطة تسجيل الجلسة الموحّدة)
  | 'status' // تغيّرت حالة خطوة قائمة (بدء/إرجاع) أو بياناتها (عنوان/مدة/موعد)
  | 'added' // أُضيفت خطوة
  | 'removed' // حُذفت خطوة
  | 'path-removed'; // حُذف مسار كامل بخطواته معه

export interface LearningChange {
  type: LearningChangeType;
  /** الخطوة المعنية — غير معروفة في حذف المسار الكامل */
  itemId?: string;
  /** المسار — قد يكون غير معروف (الشريط يعرف معرّف الخطوة فقط) */
  pathId?: string;
}

type LearningListener = (change: LearningChange) => void;
const listeners = new Set<LearningListener>();

/**
 * الاشراك بتغيّرات الخطوات التعليمية (إنجاز/تغيير حالة من أي شاشة).
 * المستجيب مسؤول عن القراءات فقط — لا يكتب بيانات أبدًا (لا حلقة).
 */
export function onLearningChange(listener: LearningListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** إشعار المسجِّلين — فشل مستجيب واحد لا يكسر عملية الكتابة */
export function notifyLearningChange(change: LearningChange): void {
  for (const listener of listeners) {
    try {
      listener(change);
    } catch {
      // فشل مستجيب واحد لا يكسر عملية الكتابة
    }
  }
}
