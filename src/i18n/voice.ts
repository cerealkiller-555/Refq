// ============================================================
// رِفق — صوت رِفق (كل نصوص الواجهة في مكان واحد)
// قواعد الصوت: هادئ، مشجع، بلا لوم، بلا أرقام على القلب،
// بلا "أنتِ متأخرة"، بلا streaks. الراحة جزء من الخطة.
// ============================================================

export const voice = {
  today: {
    hint: 'خطوة واحدة تكفي للبداية — ومش لازم تكوني مثالية.',
    energy: {
      title: 'طاقة اليوم',
      question: 'كيف طاقتك الآن؟',
      low: '🔴 منخفضة',
      medium: '🟡 متوسطة',
      high: '🟢 عالية',
      lightDay: 'أريد يومًا خفيفًا',
      notePlaceholder: 'ملاحظة (اختياري)…',
      saved: 'سجلنا طاقة اليوم 🤍 تعدليها في أي وقت.',
      needLevelFirst: 'اختاري مستوى الطاقة أولًا، وبعدين فعّلي اليوم الخفيف.'
    },
    priorities: {
      title: 'أهم أولويات اليوم',
      empty: 'لا أولويات الآن — أضيفي مهمة صغيرة أو خذي نفسًا 🤍'
    },
    suggestion: {
      title: '✨ ماذا أفعل الآن؟',
      question: 'كم عندك من الوقت؟',
      minutes: 'دقيقة',
      start: 'ابدئي',
      again: 'اقتراح آخر',
      inProgressBadge: 'جارية'
    },
    quickCapture: {
      title: 'التقاط سريع',
      placeholder: 'خاطرة أو مهمة… اكتبيها واضغطي Enter'
    },
    tasks: {
      title: 'مهامي الحالية',
      empty: 'لا مهام مفتوحة الآن — يوم خفيف 🤍'
    }
  },
  planning: {
    tasksTitle: 'المهام',
    addTitle: 'مهمة جديدة',
    fields: {
      title: 'اسم المهمة',
      importance: 'الأهمية',
      urgency: 'الإلحاح',
      duration: 'المدة المتوقعة (دقائق)',
      deadline: 'الموعد النهائي (اختياري)',
      energy: 'الطاقة المطلوبة (اختياري)',
      save: 'إضافة المهمة'
    },
    importanceLabels: { high: 'مهمة', low: 'عادية' } as Record<string, string>,
    urgencyLabels: { high: 'عاجلة', low: 'غير عاجلة' } as Record<string, string>,
    energyLabels: { low: 'خفيفة', medium: 'متوسطة', high: 'عميقة' } as Record<string, string>,
    empty: 'لا مهام بعد — أضيفي أول مهمة بهدوء.',
    doneTitle: 'أُنجزت',
    calendar: {
      tabs: { tasks: '📋 المهام', day: '📅 اليوم', week: '🗓️ الأسبوع' },
      addEventTitle: 'حدث جديد',
      eventName: 'اسم الحدث',
      kind: 'النوع',
      kindFixed: 'ثابت — لا يتحرك أبدًا',
      kindFlexible: 'مرن — وقت مخصص لمهمة',
      date: 'التاريخ',
      time: 'وقت البداية',
      duration: 'المدة (دقائق)',
      note: 'ملاحظة (اختياري)',
      save: 'إضافة الحدث',
      kindLabels: { fixed: 'ثابت', flexible: 'مرن' } as Record<string, string>,
      emptyDay: 'لا أحداث في هذا اليوم — يوم مفتوح لك 🤍',
      emptyWeek: 'أسبوعك فاضي — أضيفي أول حدث بهدوء.',
      prev: 'السابق',
      next: 'التالي',
      today: 'اليوم',
      dayNames: ['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'] as string[],
      schedule: {
        button: 'جدولة 📅',
        title: 'جدولة المهمة في التقويم',
        date: 'اليوم',
        time: 'الساعة',
        confirm: 'حدّدها',
        cancel: 'بدون جدولة',
        done: 'المهمة اتحطت في التقويم 📅 تقدري تغيريها في أي وقت.'
      },
      recovery: {
        banner: 'فيه مهام كانت مجدولة في أيام فاتت. نعيد توزيعها على الأيام الجاية بلطف؟',
        button: 'أعد التوزيع بلطف',
        applied: 'تمت إعادة التوزيع 🤍 مفيش ضغط، والثوابت ما اتحركتش أبدًا.',
        dismiss: 'شكرًا، دلوقتي كفاية'
      },
      scheduledChip: 'مجدولة'
    }
  },
  heart: {
    placeholder: 'قسم القلب — أثر، فتش عن قلبك، وقفة، محاسبة. يُبنى في مرحلته الخاصة بلطف.'
  },
  learning: {
    placeholder: 'مسارات التعلم — تُبنى في مرحلتها.'
  },
  vault: {
    placeholder: 'مكتبة المعرفة — تُبنى في مرحلتها.'
  },
  common: {
    complete: 'إنجاز',
    reopen: 'إعادة فتح',
    delete: 'حذف',
    edit: 'تعديل',
    save: 'حفظ',
    cancel: 'إلغاء'
  }
};

/** تحية حسب الوقت — هادئة وبلا ضغط */
export function greetingForHour(hour: number): string {
  if (hour >= 5 && hour < 12) return 'صباح الخير 🌤';
  if (hour >= 12 && hour < 17) return 'نهارك هادئ 🌿';
  if (hour >= 17 && hour < 21) return 'مساء الخير 🌆';
  return 'ليلة طيبة 🌙';
}